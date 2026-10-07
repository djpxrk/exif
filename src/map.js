// Offline maps and place names for the location frames. The data (Natural
// Earth countries, GeoNames places) ships with the app but is only fetched on
// first use, and nothing about a photo's location ever leaves the device.

import { parseLocation } from './exif.js';

let mod = null;
let loading = null;

/** The loaded map module, or null until loadMaps() resolves. */
export const maps = () => mod;

export function loadMaps() {
  loading ||= import('./map-draw.js').then((m) => (mod = m)).catch((err) => {
    loading = null; // allow a retry, e.g. after coming back online
    throw err;
  });
  return loading;
}

/** Coordinates from the Location field (EXIF or typed), or null. */
export const coordsOf = (fields) => parseLocation(fields?.location);

/** Place name for the frame: typed in Details, else looked up from the coordinates. */
export function placeOf(fields) {
  if (fields?.place) return { label: fields.place, city: fields.place, region: '', country: '' };
  const c = coordsOf(fields);
  if (!c || !mod) return null;
  return mod.placeName(c.lat, c.lon);
}

/** Horizontal angle of view in degrees from the 35mm-equivalent focal length. */
export function fieldOfView(fields, portrait) {
  const f = parseFloat(fields?.focal35) || parseFloat(fields?.focal);
  if (!(f > 0)) return 0;
  return (2 * Math.atan((portrait ? 24 : 36) / (2 * f)) * 180) / Math.PI;
}

/** Compass heading in degrees, or null. */
export function headingOf(fields) {
  const h = parseFloat(fields?.heading);
  return Number.isFinite(h) ? ((h % 360) + 360) % 360 : null;
}

const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
export const compassPoint = (deg) => POINTS[Math.round(deg / 45) % 8];

/** "37°31′17″N 127°07′14″E" */
export function formatDms({ lat, lon }) {
  const dms = (v, pos, neg) => {
    const a = Math.abs(v);
    let d = Math.floor(a);
    let m = Math.floor((a - d) * 60);
    let s = Math.round(((a - d) * 60 - m) * 60);
    if (s === 60) { s = 0; m += 1; }
    if (m === 60) { m = 0; d += 1; }
    return `${d}°${String(m).padStart(2, '0')}′${String(s).padStart(2, '0')}″${v >= 0 ? pos : neg}`;
  };
  return `${dms(lat, 'N', 'S')} ${dms(lon, 'E', 'W')}`;
}
