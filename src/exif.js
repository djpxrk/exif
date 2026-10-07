import exifr from 'exifr';

const PARSE_OPTIONS = {
  tiff: true,
  ifd0: true,
  exif: true,
  gps: true,
  ifd1: false,
  xmp: false,
  icc: false,
  iptc: false,
  makerNote: false,
  translateValues: false,
  reviveValues: true,
  mergeOutput: true,
};

/** Reads EXIF from any supported container, returning {} when nothing is found. */
export async function readExif(buffer, kind) {
  let source = buffer;
  if (kind === 'webp') source = webpExifChunk(buffer);
  let tags = null;
  if (source) {
    try { tags = await exifr.parse(source, PARSE_OPTIONS); } catch { tags = null; }
  }
  // Some HEIF variants (Fujifilm/Sony .HIF) and odd containers trip exifr's
  // container detection; fall back to locating the raw "Exif\0\0" TIFF block.
  if (!tags || (!tags.Make && !tags.Model && !tags.ExposureTime)) {
    const tiff = scanForExifTiff(buffer);
    if (tiff) {
      try { tags = { ...(tags || {}), ...(await exifr.parse(tiff, PARSE_OPTIONS)) }; } catch { /* keep what we have */ }
    }
  }
  return tags || {};
}

function webpExifChunk(buffer) {
  const view = new DataView(buffer);
  let p = 12;
  while (p + 8 <= buffer.byteLength) {
    const id = String.fromCharCode(view.getUint8(p), view.getUint8(p + 1), view.getUint8(p + 2), view.getUint8(p + 3));
    const size = view.getUint32(p + 4, true);
    if (id === 'EXIF') {
      let start = p + 8;
      const head = new Uint8Array(buffer, start, Math.min(6, size));
      if (head[0] === 0x45 && head[1] === 0x78 && head[2] === 0x69 && head[3] === 0x66) start += 6; // "Exif\0\0"
      return buffer.slice(start, p + 8 + size);
    }
    p += 8 + size + (size & 1);
  }
  return null;
}

function scanForExifTiff(buffer) {
  const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 8 * 1024 * 1024));
  for (let i = 0; i < bytes.length - 10; i++) {
    if (bytes[i] === 0x45 && bytes[i + 1] === 0x78 && bytes[i + 2] === 0x69 && bytes[i + 3] === 0x66 &&
        bytes[i + 4] === 0 && bytes[i + 5] === 0) {
      const t = i + 6;
      const ii = bytes[t] === 0x49 && bytes[t + 1] === 0x49 && bytes[t + 2] === 0x2a;
      const mm = bytes[t] === 0x4d && bytes[t + 1] === 0x4d && bytes[t + 3] === 0x2a;
      if (ii || mm) return buffer.slice(t);
    }
  }
  return null;
}

// ---------- Normalising into human-readable fields ----------

const MAKE_NAMES = [
  [/^nikon/i, 'Nikon'],
  [/^canon/i, 'Canon'],
  [/^sony/i, 'SONY'],
  [/^fujifilm|^fuji/i, 'FUJIFILM'],
  [/^olympus|^om digital/i, 'OM SYSTEM'],
  [/^panasonic/i, 'LUMIX'],
  [/^leica/i, 'Leica'],
  [/^ricoh|^pentax/i, 'RICOH'],
  [/^hasselblad/i, 'Hasselblad'],
  [/^apple/i, 'Apple'],
  [/^samsung/i, 'Samsung'],
  [/^google/i, 'Google'],
  [/^sigma/i, 'SIGMA'],
  [/^dji/i, 'DJI'],
];

export function prettyMake(make = '') {
  const m = String(make).trim();
  for (const [re, name] of MAKE_NAMES) if (re.test(m)) return name;
  return m.replace(/\s+(corporation|corp\.?|co\.?,? ?ltd\.?|imaging.*)$/i, '');
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

export function prettyModel(model = '', make = '') {
  let m = String(model).trim();
  const brand = prettyMake(make);
  // Drop a leading brand name the model repeats ("Canon EOS R5", "NIKON Z 6_2")
  const first = String(make).trim().split(/\s+/)[0];
  if (first && m.toLowerCase().startsWith(first.toLowerCase() + ' ')) m = m.slice(first.length + 1);
  if (brand === 'SONY') {
    // ILCE-7RM5 → α7R V, ILCE-6700 → α6700, ILCE-1M2 → α1 II
    const s = m.match(/^ILCE-(\d+)([A-Z]*?)(?:M(\d))?$/);
    if (s) return `α${s[1]}${s[2]}${s[3] ? ' ' + ROMAN[+s[3]] : ''}`;
  }
  if (brand === 'Nikon') m = m.replace(/_2$/, 'II').replace(/_3$/, 'III');
  return m;
}

export function formatShutter(t) {
  if (!t) return '';
  if (t >= 1) return `${+t.toFixed(1)}s`;
  const denom = Math.round(1 / t);
  return `1/${denom}s`;
}

export const formatAperture = (f) => (f ? `f/${+(+f).toFixed(1)}` : '');
export const formatFocal = (mm) => (mm ? `${Math.round(mm)}mm` : '');
export const formatIso = (iso) => (iso ? `ISO${Array.isArray(iso) ? iso[0] : iso}` : '');

export function formatDate(d) {
  if (!(d instanceof Date) || isNaN(d)) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function formatLocation(lat, lon) {
  if (typeof lat !== 'number' || typeof lon !== 'number') return '';
  const fmt = (v, pos, neg) => `${Math.abs(v).toFixed(4)}°${v >= 0 ? pos : neg}`;
  return `${fmt(lat, 'N', 'S')} ${fmt(lon, 'E', 'W')}`;
}

/** Editable, display-ready fields for one photo. */
export function toFields(tags) {
  const lens = String(tags.LensModel || tags.Lens || '').trim();
  return {
    make: prettyMake(tags.Make),
    model: prettyModel(tags.Model, tags.Make),
    lens: lens.replace(/\0/g, ''),
    focal: formatFocal(tags.FocalLength),
    aperture: formatAperture(tags.FNumber),
    shutter: formatShutter(tags.ExposureTime),
    iso: formatIso(tags.ISO ?? tags.ISOSpeedRatings ?? tags.RecommendedExposureIndex),
    date: formatDate(tags.DateTimeOriginal || tags.CreateDate || tags.ModifyDate),
    location: formatLocation(tags.latitude, tags.longitude),
    artist: String(tags.Artist || '').trim(),
    caption: '',
  };
}

/** Raw numeric values kept for writing EXIF back into exported JPEGs. */
export function toMetadata(tags) {
  return {
    Make: tags.Make, Model: tags.Model, LensMake: tags.LensMake, LensModel: tags.LensModel,
    ExposureTime: tags.ExposureTime, FNumber: tags.FNumber,
    ISO: Array.isArray(tags.ISO) ? tags.ISO[0] : tags.ISO,
    FocalLength: tags.FocalLength, FocalLengthIn35mmFormat: tags.FocalLengthIn35mmFormat,
    DateTimeOriginal: tags.DateTimeOriginal, Artist: tags.Artist, Copyright: tags.Copyright,
  };
}

export const orientationOf = (tags) => (typeof tags.Orientation === 'number' ? tags.Orientation : 1);
