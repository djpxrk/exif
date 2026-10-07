// Crop factor lookup: EXIF Make/Model (or what the user types in Details)
// → sensor format and crop factor, from the bundled camera database.

import { CAMERA_DB } from './cameras.js';
import { prettyMake, prettyModel } from './exif.js';

/** Loose key for matching model names: "ILCE-7CR", "α7CR" and "a7 CR" all → "a7cr"/"ilce7cr". */
export function normModel(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/α/g, 'a')
    .normalize('NFKD')
    .replace(/[^a-z0-9]/g, '');
}

const brandKey = (s) => normModel(s);

let index;
function buildIndex() {
  index = new Map(); // brandKey → { models: Map(key → camera), rules: [...] }
  const bucket = (brand) => {
    const k = brandKey(brand);
    if (!index.has(k)) index.set(k, { models: new Map(), rules: [] });
    return index.get(k);
  };
  for (const [brand, cameras, rules] of CAMERA_DB) {
    const b = bucket(brand);
    for (const cam of cameras) {
      const [model, names, format, w, h, crop] = cam;
      const entry = { brand, model, format, sensorMm: [w, h], crop };
      const keys = [model, prettyModel(model, brand), ...names];
      for (const name of keys) {
        const key = normModel(name);
        if (!key) continue;
        for (const variant of keyVariants(key, brand)) if (!b.models.has(variant)) b.models.set(variant, entry);
      }
    }
    for (const [pattern, format, w, h, crop] of rules) {
      try { b.rules.push({ re: new RegExp(pattern, 'i'), entry: { brand, model: null, format, sensorMm: [w, h], crop } }); }
      catch { /* skip an invalid pattern rather than break lookups */ }
    }
  }
}

// "canoneosr5" also answers to "eosr5" and "r5"; "leicam11" to "m11".
function keyVariants(key, brand) {
  const out = [key];
  const b = brandKey(brand);
  let k = key;
  if (b && k.startsWith(b) && k.length > b.length) { k = k.slice(b.length); out.push(k); }
  if (k.startsWith('eos') && k.length > 3) out.push(k.slice(3));
  return out;
}

/**
 * Finds the camera for a make/model pair.
 * Returns { brand, model, format, sensorMm, crop, matched: 'model' | 'series' } or null.
 */
export function lookupCamera(make, model) {
  if (!model) return null;
  if (!index) buildIndex();
  let brand = make ? prettyMake(make, model) : '';
  // No make, but the model starts with one ("Sony ILCE-7M4", "Fuji X-T5"):
  // take the brand from there and look up the rest.
  if (!index.has(brandKey(brand))) {
    const [first, ...rest] = String(model).trim().split(/\s+/);
    const guess = rest.length ? prettyMake(first, rest.join(' ')) : '';
    if (index.has(brandKey(guess))) { brand = guess; model = rest.join(' '); }
  }
  const buckets = brand && index.has(brandKey(brand))
    ? [index.get(brandKey(brand))]
    : [...index.values()]; // unknown or empty brand: search every brand
  const key = normModel(model);
  for (const b of buckets) {
    for (const variant of keyVariants(key, brand)) {
      const hit = b.models.get(variant);
      if (hit) return { ...hit, matched: 'model' };
    }
  }
  const raw = String(model).trim();
  for (const b of buckets) {
    for (const rule of b.rules) if (rule.re.test(raw)) return { ...rule.entry, matched: 'series' };
  }
  return null;
}

/** Plain-language sensor class for a crop factor when no database entry exists. */
export function formatForCrop(crop) {
  if (!crop) return '';
  if (crop < 0.7) return 'Large medium format';
  if (crop < 0.9) return 'Medium format';
  if (crop < 1.15) return 'Full frame';
  if (crop < 1.4) return 'APS-H';
  if (crop < 1.58) return 'APS-C';
  if (crop < 1.75) return 'APS-C (Canon)';
  if (crop < 2.3) return 'Micro Four Thirds';
  if (crop < 3.2) return '1-inch';
  return 'Small sensor';
}

/** Crop factor implied by the sensor's focal-plane resolution tags, if present. */
function sensorCrop(tags) {
  const res = tags.FocalPlaneXResolution;
  const px = Math.max(tags.ExifImageWidth || 0, tags.ExifImageHeight || 0);
  const unit = { 2: 25.4, 3: 10, 4: 1, 5: 0.001 }[tags.FocalPlaneResolutionUnit ?? 2];
  if (!(res > 0 && px > 0 && unit)) return null;
  const long = (px / res) * unit;
  if (!(long > 2 && long < 80)) return null; // implausible: ignore
  // Long edge only: assume a 3:2 sensor to get the diagonal.
  return +(43.27 / Math.hypot(long, long / 1.5)).toFixed(2);
}

/**
 * Crop factor for a photo at import.
 * Order: camera database (precise), but the camera's own 35mm-equivalent
 * value wins when it disagrees — that means a crop mode was used (e.g. a
 * full-frame Sony shooting in APS-C mode). Then the focal-plane estimate.
 * Returns { value, format, source: 'database'|'exif'|'sensor', model } or null.
 */
export function cropFromTags(tags) {
  const db = lookupCamera(tags.Make, tags.Model);
  const f = tags.FocalLength;
  const eq = tags.FocalLengthIn35mmFormat;
  const exif = f > 0 && eq > 0 ? eq / f : null;
  // A crop mode only ever enlarges the crop, so an EXIF value below the
  // sensor's own is a camera bug (some Nikon DX bodies write the actual focal length).
  if (db && (!exif || Math.abs(exif / db.crop - 1) < 0.05 || exif < db.crop)) {
    return { value: db.crop, format: db.format, source: 'database', model: db.model };
  }
  if (exif) {
    return { value: +exif.toFixed(2), format: db && Math.abs(exif / db.crop - 1) >= 0.05 ? `${formatForCrop(exif)} crop mode` : formatForCrop(exif), source: 'exif' };
  }
  const s = sensorCrop(tags);
  return s ? { value: s, format: formatForCrop(s), source: 'sensor' } : null;
}

/** 35mm-equivalent focal length text for a focal length in mm and a crop factor. */
export function equivalentFocal(focalMm, crop) {
  return focalMm > 0 && crop > 0 ? `${Math.round(focalMm * crop)}mm` : '';
}
