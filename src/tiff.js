// Minimal TIFF structure walker. Used to find the JPEG previews that cameras
// embed inside RAW files (DNG, ARW and other TIFF-based RAW formats).

const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8, 13: 4 };

export function isTiff(bytes) {
  return (bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
         (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a);
}

/** Parses every IFD reachable from the header (IFD chain, SubIFDs, EXIF IFD). */
export function readIfds(buffer) {
  const view = new DataView(buffer);
  const le = view.getUint8(0) === 0x49;
  const u16 = (o) => view.getUint16(o, le);
  const u32 = (o) => view.getUint32(o, le);
  const seen = new Set();
  const ifds = [];

  function values(type, count, offset) {
    const size = TYPE_SIZE[type] || 1;
    const at = size * count <= 4 ? offset : u32(offset);
    if (at + size * count > buffer.byteLength) return [];
    if (type === 2) return [new TextDecoder().decode(new Uint8Array(buffer, at, count)).replace(/\0+$/, '')];
    const out = [];
    const n = Math.min(count, 4096);
    for (let i = 0; i < n; i++) {
      const p = at + i * size;
      if (type === 3) out.push(u16(p));
      else if (type === 4 || type === 13) out.push(u32(p));
      else if (type === 5) out.push(u32(p) / (u32(p + 4) || 1));
      else out.push(view.getUint8(p));
    }
    return out;
  }

  function walk(offset, depth) {
    while (offset && offset + 2 <= buffer.byteLength && !seen.has(offset) && depth < 8) {
      seen.add(offset);
      const count = u16(offset);
      if (count === 0 || count > 1000 || offset + 2 + count * 12 > buffer.byteLength) return;
      const tags = new Map();
      for (let i = 0; i < count; i++) {
        const e = offset + 2 + i * 12;
        tags.set(u16(e), values(u16(e + 2), u32(e + 4), e + 8));
      }
      ifds.push(tags);
      for (const ptr of tags.get(0x014a) || []) walk(ptr, depth + 1); // SubIFDs
      for (const ptr of tags.get(0x8769) || []) walk(ptr, depth + 1); // EXIF IFD
      offset = u32(offset + 2 + count * 12);
    }
  }

  walk(u32(4), 0);
  return ifds;
}

/** Every embedded JPEG stream found in the file, largest first. */
export function findEmbeddedJpegs(buffer) {
  const bytes = new Uint8Array(buffer);
  const found = [];
  const add = (offset, length) => {
    if (!offset || !length || offset + length > buffer.byteLength) return;
    if (bytes[offset] !== 0xff || bytes[offset + 1] !== 0xd8) return;
    if (!isBrowserDecodableJpeg(bytes, offset, length)) return;
    if (!found.some((f) => f.offset === offset)) found.push({ offset, length });
  };

  for (const tags of readIfds(buffer)) {
    // JPEGInterchangeFormat / Length (classic thumbnail & Sony PreviewImage)
    add(tags.get(0x0201)?.[0], tags.get(0x0202)?.[0]);
    // Strip/tile stored JPEG (DNG previews use Compression 7 with YCbCr/RGB)
    const compression = tags.get(0x0103)?.[0];
    const photometric = tags.get(0x0106)?.[0];
    const offsets = tags.get(0x0111) || tags.get(0x0144);
    const counts = tags.get(0x0117) || tags.get(0x0145);
    if ((compression === 6 || compression === 7) && (photometric === 2 || photometric === 6) &&
        offsets?.length === 1 && counts?.length === 1) {
      add(offsets[0], counts[0]);
    }
  }

  return found
    .sort((a, b) => b.length - a.length)
    .map(({ offset, length }) => new Blob([bytes.subarray(offset, offset + length)], { type: 'image/jpeg' }));
}

// Lossless JPEG (SOF3) holds raw sensor data and can't be shown by a browser.
function isBrowserDecodableJpeg(bytes, start, length) {
  const end = Math.min(start + length, start + 65536);
  let p = start + 2;
  while (p + 4 < end) {
    if (bytes[p] !== 0xff) return false;
    const marker = bytes[p + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return marker === 0xc0 || marker === 0xc1 || marker === 0xc2;
    }
    p += 2 + ((bytes[p + 2] << 8) | bytes[p + 3]);
  }
  return false;
}
