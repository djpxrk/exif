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
  [/^pentax/i, 'PENTAX'],
  [/^nikon/i, 'Nikon'],
  [/^canon/i, 'Canon'],
  [/^sony/i, 'SONY'],
  [/^fujifilm|^fuji/i, 'FUJIFILM'],
  [/^olympus/i, 'OLYMPUS'],
  [/^om digital|^om system/i, 'OM SYSTEM'],
  [/^panasonic/i, 'LUMIX'],
  [/^leica/i, 'Leica'],
  [/^ricoh|^pentax/i, 'RICOH'],
  [/^hasselblad/i, 'Hasselblad'],
  [/^apple/i, 'Apple'],
  [/^samsung/i, 'Samsung'],
  [/^google/i, 'Google'],
  [/^sigma/i, 'SIGMA'],
  [/^dji/i, 'DJI'],
  [/^gopro/i, 'GoPro'],
  [/^insta360|^arashi/i, 'Insta360'],
  [/^phase one/i, 'Phase One'],
];

export function prettyMake(make = '', model = '') {
  // Pentax bodies write Make "RICOH IMAGING COMPANY, LTD." but are Pentax-branded.
  if (/^pentax/i.test(String(model).trim())) return 'PENTAX';
  // OM Digital Solutions still made Olympus-branded bodies; OM-1/OM-3/OM-5 and TG-7 are OM SYSTEM.
  if (/^(olympus|om digital)/i.test(String(make).trim())) {
    return /^(OM-\d|TG-7)/i.test(String(model).trim()) ? 'OM SYSTEM' : 'OLYMPUS';
  }
  const m = String(make).trim();
  for (const [re, name] of MAKE_NAMES) if (re.test(m)) return name;
  return m.replace(/\s+(corporation|corp\.?|co\.?,? ?ltd\.?|imaging.*)$/i, '');
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

export function prettyModel(model = '', make = '') {
  let m = String(model).trim();
  const brand = prettyMake(make, model);
  // Drop a leading brand name the model repeats ("Canon EOS R5", "NIKON Z 6_2", "PENTAX K-3")
  for (const first of [String(make).trim().split(/\s+/)[0], brand]) {
    if (first && m.toLowerCase().startsWith(first.toLowerCase() + ' ')) m = m.slice(first.length + 1);
  }
  if (brand === 'SONY') {
    // ILCE-7RM5 → α7R V, ILCE-6700 → α6700, ILCE-1M2 → α1 II, ILCE-7RM3A → α7R IIIA
    const s = m.match(/^ILCE-(\d+)([A-Z]*?)(?:M(\d))?(A)?$/);
    if (s) return `α${s[1]}${s[2]}${s[3] ? ' ' + ROMAN[+s[3]] : ''}${s[4] || ''}`;
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

const pad2 = (n) => String(n).padStart(2, '0');
const validDate = (d) => d instanceof Date && !isNaN(d);
export const formatDate = (d) => (validDate(d) ? `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}` : '');
export const formatTime = (d) => (validDate(d) ? `${pad2(d.getHours())}:${pad2(d.getMinutes())}` : '');

export function formatLocation(lat, lon) {
  if (typeof lat !== 'number' || typeof lon !== 'number') return '';
  const fmt = (v, pos, neg) => `${Math.abs(v).toFixed(4)}°${v >= 0 ? pos : neg}`;
  return `${fmt(lat, 'N', 'S')} ${fmt(lon, 'E', 'W')}`;
}

/**
 * Reads coordinates typed in Details: "37.5215°N 127.1207°E", "37.5215, 127.1207",
 * or degrees-minutes-seconds like 37°31'17"N 127°07'14"E. Returns { lat, lon } or null.
 */
export function parseLocation(text) {
  const s = String(text || '').trim();
  if (!s) return null;
  const part = String.raw`(-?\d+(?:\.\d+)?)\s*°?\s*(?:(\d+(?:\.\d+)?)\s*['′]\s*)?(?:(\d+(?:\.\d+)?)\s*["″]\s*)?([NSEW])?`;
  const m = s.match(new RegExp(`^${part}\\s*[,\\s]\\s*${part}$`, 'i'));
  if (!m) return null;
  const toDeg = (d, mi, se, h) => {
    let v = Math.abs(+d) + (+mi || 0) / 60 + (+se || 0) / 3600;
    if (+d < 0 || /[SW]/i.test(h || '')) v = -v;
    return v;
  };
  let a = toDeg(m[1], m[2], m[3], m[4]);
  let b = toDeg(m[5], m[6], m[7], m[8]);
  if (/[EW]/i.test(m[4] || '') && /[NS]/i.test(m[8] || '')) [a, b] = [b, a]; // "127°E 37°N"
  if (!(Math.abs(a) <= 90 && Math.abs(b) <= 180)) return null;
  return { lat: a, lon: b };
}

/** Editable, display-ready fields for one photo. */
export function toFields(tags) {
  const taken = tags.DateTimeOriginal || tags.CreateDate || tags.ModifyDate;
  const lens = String(tags.LensModel || tags.Lens || '').trim();
  return {
    make: prettyMake(tags.Make, tags.Model),
    model: prettyModel(tags.Model, tags.Make),
    lens: lens.replace(/\0/g, ''),
    lensMake: String(tags.LensMake || '').trim(), // not shown; used to pick the lens logo
    focal: formatFocal(tags.FocalLength),
    aperture: formatAperture(tags.FNumber),
    shutter: formatShutter(tags.ExposureTime),
    iso: formatIso(tags.ISO ?? tags.ISOSpeedRatings ?? tags.RecommendedExposureIndex),
    date: formatDate(taken),
    time: formatTime(taken),
    location: formatLocation(tags.latitude, tags.longitude),
    // Not shown as rows; used by map frames.
    altitude: typeof tags.GPSAltitude === 'number' ? `${Math.round(tags.GPSAltitudeRef === 1 ? -tags.GPSAltitude : tags.GPSAltitude)} m` : '',
    heading: typeof tags.GPSImgDirection === 'number' ? `${Math.round(tags.GPSImgDirection) % 360}°` : '',
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
