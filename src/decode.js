import { Capacitor, registerPlugin } from '@capacitor/core';
import exifr from 'exifr';
import { readExif, toFields, toMetadata, orientationOf } from './exif.js';
import { cropFromTags, equivalentFocal } from './crop.js';
import { isTiff, readIfds, findEmbeddedJpegs } from './tiff.js';
import { drawOriented } from './render.js';

const RawDecoder = registerPlugin('RawDecoder');

const RAW_EXT = /\.(dng|arw)$/i;
const HEIF_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1', 'mif2', 'avif'];
// Previews smaller than this are treated as thumbnails, not usable photos.
const MIN_PREVIEW_EDGE = 2400;

export const ACCEPT = '.jpg,.jpeg,.png,.webp,.heic,.heif,.hif,.tif,.tiff,.dng,.arw,image/*';

export function sniff(bytes, name = '') {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
  const ascii = (a, b) => String.fromCharCode(...bytes.subarray(a, b));
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp';
  if (ascii(4, 8) === 'ftyp') {
    const brands = [];
    const boxSize = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
    for (let p = 8; p + 4 <= Math.min(boxSize, 64); p += 4) brands.push(ascii(p, p + 4));
    if (brands.some((b) => HEIF_BRANDS.includes(b))) return 'heif';
  }
  if (isTiff(bytes)) return RAW_EXT.test(name) ? 'raw' : 'tiff';
  return 'unknown';
}

/**
 * Decodes a File into a drawable image plus its EXIF.
 * Returns { image, orientation, width, height, kind, fields, meta, note }.
 * `orientation` is the EXIF rotation still to apply when drawing `image`;
 * width/height are the upright size. Full-size images are never redrawn
 * rotated, which would need a canvas bigger than iOS allows.
 */
export async function decodeFile(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let kind = sniff(bytes, file.name);
  if (kind === 'tiff' && isDng(buffer)) kind = 'raw';
  if (kind === 'unknown') throw new Error(`${file.name} isn't a supported image. Use JPEG, PNG, WebP, HEIF, TIFF, DNG or ARW.`);

  const tags = await readExif(buffer, kind);
  let decoded;
  if (kind === 'raw') decoded = await decodeRaw(file, buffer, tags);
  else if (kind === 'tiff') decoded = await decodeTiff(file, buffer, tags);
  else if (kind === 'heif') decoded = await decodeHeif(file);
  else decoded = { image: await loadNative(file) };

  const orientation = decoded.orientation || 1;
  const { width, height } = uprightSize(decoded.image, orientation);
  const fields = toFields(tags);
  const crop = cropFromTags(tags);
  const focalMm = tags.FocalLength > 0 ? tags.FocalLength : null;
  // The camera's own 35mm value is what it shows in its EXIF and menus; use it
  // at import and compute from the crop factor only when it's missing.
  fields.focal35 = tags.FocalLengthIn35mmFormat > 0
    ? `${Math.round(tags.FocalLengthIn35mmFormat)}mm`
    : equivalentFocal(focalMm, crop?.value);
  return { ...decoded, orientation, width, height, kind, fields, crop, focalMm, meta: toMetadata(tags) };
}

function isDng(buffer) {
  try { return readIfds(buffer).some((t) => t.has(0xc612)); } catch { return false; }
}

export function uprightSize(img, orientation = 1) {
  const { width, height } = sizeOf(img);
  return orientation >= 5 ? { width: height, height: width } : { width, height };
}

export function sizeOf(img) {
  return {
    width: img.naturalWidth || img.videoWidth || img.width,
    height: img.naturalHeight || img.videoHeight || img.height,
  };
}

/** Browser-native decode via <img>, which honours EXIF orientation. */
export function loadNative(blobOrUrl) {
  const url = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl);
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  return img.decode().then(
    () => img,
    () => { throw new Error('decode-failed'); },
  ).finally(() => { if (typeof blobOrUrl !== 'string') setTimeout(() => URL.revokeObjectURL(url), 0); });
}

async function decodeHeif(file) {
  // Safari / iOS decode HEIF natively, including Fujifilm and Sony .HIF.
  try { return { image: await loadNative(file) }; } catch { /* fall through to wasm */ }
  const { heicTo } = await import('heic-to');
  const bitmap = await heicTo({ blob: file, type: 'bitmap' });
  return { image: bitmap };
}

async function decodeTiff(file, buffer, tags) {
  try { return { image: await loadNative(file) }; } catch { /* not Safari */ }
  const UTIF = (await import('utif')).default;
  const ifds = UTIF.decode(buffer);
  const main = ifds
    .filter((ifd) => ifd.t256 && ifd.t257)
    .sort((a, b) => b.t256[0] * b.t257[0] - a.t256[0] * a.t257[0])[0];
  if (!main) throw new Error(`${file.name} has no image data UTIF can read.`);
  UTIF.decodeImage(buffer, main);
  const rgba = UTIF.toRGBA8(main);
  const bitmap = await createImageBitmap(new ImageData(new Uint8ClampedArray(rgba.buffer), main.width, main.height));
  return { image: bitmap, orientation: orientationOf(tags) };
}

async function decodeRaw(file, buffer, tags) {
  const orientation = orientationOf(tags);
  let best = null;

  for (const blob of findEmbeddedJpegs(buffer)) {
    try {
      const img = await loadNative(blob);
      // If the preview carries its own orientation the browser already applied it.
      const own = await exifr.orientation(blob).catch(() => undefined);
      best = { image: img, orientation: own && own !== 1 ? 1 : orientation };
      break;
    } catch { /* try the next candidate */ }
  }

  const edge = best ? Math.max(sizeOf(best.image).width, sizeOf(best.image).height) : 0;
  if (edge >= MIN_PREVIEW_EDGE) return { ...best, note: previewNote(best.image) };

  // Small or missing preview: develop the RAW itself when we can.
  try {
    const full = await developRaw(file);
    if (full) return { image: full, note: 'Developed from RAW data with default settings.' };
  } catch (err) {
    console.warn('RAW develop failed', err);
  }
  if (best) return { ...best, note: previewNote(best.image) + ' This file only embeds a small preview.' };
  throw new Error(`${file.name} has no preview this browser can show. Open it in the iOS app, or export a JPEG from your RAW editor.`);
}

const previewNote = (img) => {
  const { width, height } = sizeOf(img);
  return `Using the camera's embedded preview (${Math.max(width, height)}×${Math.min(width, height)}).`;
};

async function developRaw(file) {
  if (Capacitor.isNativePlatform()) {
    // CoreImage RAW pipeline via the app's RawDecoder plugin (ios/App/App/RawDecoderPlugin.swift).
    const data = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1]);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
    const { url } = await RawDecoder.decode({ data, maxPixels: 40_000_000 });
    return loadNative(Capacitor.convertFileSrc(url));
  }
  // libraw-wasm uses threads, which need a cross-origin isolated page.
  if (!globalThis.crossOriginIsolated) return null;
  const LibRaw = (await import('libraw-wasm')).default;
  const raw = new LibRaw();
  await raw.open(new Uint8Array(await file.arrayBuffer()), { useCameraWb: true, outputBps: 8, userQual: 3 });
  const img = await raw.imageData();
  const { width, height } = img;
  const rgba = new Uint8ClampedArray(width * height * 4);
  const src = img.data;
  const ch = img.colors || 3;
  for (let i = 0, j = 0; i < width * height; i++, j += ch) {
    rgba[i * 4] = src[j];
    rgba[i * 4 + 1] = src[j + 1];
    rgba[i * 4 + 2] = src[j + 2];
    rgba[i * 4 + 3] = 255;
  }
  // An ImageBitmap avoids iOS's canvas size cap. LibRaw already applied the
  // camera's flip setting (userFlip: -1).
  return createImageBitmap(new ImageData(rgba, width, height));
}

/** Downscaled, upright copy used for fast live preview. */
export function makePreview(img, maxEdge = 1800, orientation = 1) {
  const { width, height } = uprightSize(img, orientation);
  const s = Math.min(1, maxEdge / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * s);
  canvas.height = Math.round(height * s);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  drawOriented(ctx, img, orientation, 0, 0, canvas.width, canvas.height);
  return canvas;
}
