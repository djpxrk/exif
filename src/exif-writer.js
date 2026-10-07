// Writes a compact EXIF APP1 segment (camera, lens, exposure, date) into a JPEG.
// Canvas exports carry no metadata, so this restores the essentials. GPS is
// deliberately never written.

const ASCII = 2, SHORT = 3, LONG = 4, RATIONAL = 5, UNDEFINED = 7;

const enc = new TextEncoder();
const ascii = (s) => { const b = enc.encode(String(s) + '\0'); return { type: ASCII, count: b.length, bytes: b }; };
const short = (n) => { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, n); return { type: SHORT, count: 1, bytes: b }; };
const long = (n) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n); return { type: LONG, count: 1, bytes: b }; };

function rational(v) {
  let num, den;
  if (v > 0 && v < 1 && Math.abs(1 / v - Math.round(1 / v)) < 0.01) { num = 1; den = Math.round(1 / v); }
  else { den = 1000; num = Math.round(v * den); const g = gcd(num, den); num /= g; den /= g; }
  const b = new Uint8Array(8);
  const dv = new DataView(b.buffer);
  dv.setUint32(0, num);
  dv.setUint32(4, den);
  return { type: RATIONAL, count: 1, bytes: b };
}
const gcd = (a, b) => (b ? gcd(b, a % b) : a || 1);

function exifDate(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}:${p(d.getMonth() + 1)}:${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function buildIfd(entries, start, nextIfd = 0) {
  entries.sort((a, b) => a.tag - b.tag);
  const headerSize = 2 + entries.length * 12 + 4;
  const extra = entries.reduce((n, e) => n + (e.bytes.length > 4 ? e.bytes.length + (e.bytes.length & 1) : 0), 0);
  const out = new Uint8Array(headerSize + extra);
  const dv = new DataView(out.buffer);
  dv.setUint16(0, entries.length);
  let data = headerSize;
  entries.forEach((e, i) => {
    const p = 2 + i * 12;
    dv.setUint16(p, e.tag);
    dv.setUint16(p + 2, e.type);
    dv.setUint32(p + 4, e.count);
    if (e.bytes.length <= 4) out.set(e.bytes, p + 8);
    else {
      dv.setUint32(p + 8, start + data);
      out.set(e.bytes, data);
      data += e.bytes.length + (e.bytes.length & 1);
    }
  });
  dv.setUint32(2 + entries.length * 12, nextIfd);
  return out;
}

/** Builds TIFF-structured EXIF bytes from metadata collected at import. */
export function buildExif(meta, software = 'EXIF Frame') {
  const ifd0 = [
    { tag: 0x0112, ...short(1) },
    { tag: 0x0131, ...ascii(software) },
  ];
  if (meta.Make) ifd0.push({ tag: 0x010f, ...ascii(meta.Make) });
  if (meta.Model) ifd0.push({ tag: 0x0110, ...ascii(meta.Model) });
  if (meta.Artist) ifd0.push({ tag: 0x013b, ...ascii(meta.Artist) });
  if (meta.Copyright) ifd0.push({ tag: 0x8298, ...ascii(meta.Copyright) });

  const exif = [{ tag: 0x9000, type: UNDEFINED, count: 4, bytes: enc.encode('0232') }];
  if (meta.ExposureTime) exif.push({ tag: 0x829a, ...rational(meta.ExposureTime) });
  if (meta.FNumber) exif.push({ tag: 0x829d, ...rational(meta.FNumber) });
  if (meta.ISO) exif.push({ tag: 0x8827, ...short(Math.min(65535, meta.ISO)) });
  if (meta.DateTimeOriginal instanceof Date && !isNaN(meta.DateTimeOriginal)) {
    exif.push({ tag: 0x9003, ...ascii(exifDate(meta.DateTimeOriginal)) });
  }
  if (meta.FocalLength) exif.push({ tag: 0x920a, ...rational(meta.FocalLength) });
  if (meta.FocalLengthIn35mmFormat) exif.push({ tag: 0xa405, ...short(meta.FocalLengthIn35mmFormat) });
  if (meta.LensMake) exif.push({ tag: 0xa433, ...ascii(meta.LensMake) });
  if (meta.LensModel) exif.push({ tag: 0xa434, ...ascii(meta.LensModel) });

  // IFD0 needs the EXIF pointer before its own size is known; the pointer is
  // a 4-byte LONG so the IFD0 size doesn't depend on its value.
  ifd0.push({ tag: 0x8769, ...long(0) });
  const ifd0Size = buildIfd([...ifd0], 8).length;
  ifd0[ifd0.length - 1] = { tag: 0x8769, ...long(8 + ifd0Size) };
  const a = buildIfd(ifd0, 8);
  const b = buildIfd(exif, 8 + a.length);

  const tiff = new Uint8Array(8 + a.length + b.length);
  tiff.set([0x4d, 0x4d, 0x00, 0x2a, 0, 0, 0, 8]);
  tiff.set(a, 8);
  tiff.set(b, 8 + a.length);
  return tiff;
}

/** Inserts an EXIF APP1 segment right after the JPEG SOI marker. */
export async function injectExif(jpegBlob, meta) {
  const jpeg = new Uint8Array(await jpegBlob.arrayBuffer());
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) return jpegBlob;
  const tiff = buildExif(meta);
  const len = 2 + 6 + tiff.length;
  if (len > 0xffff) return jpegBlob;
  const app1 = new Uint8Array(2 + len);
  app1.set([0xff, 0xe1, len >> 8, len & 0xff, 0x45, 0x78, 0x69, 0x66, 0, 0]);
  app1.set(tiff, 10);
  return new Blob([jpeg.subarray(0, 2), app1, jpeg.subarray(2)], { type: 'image/jpeg' });
}
