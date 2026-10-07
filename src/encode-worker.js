// Streaming image encoders. The main thread renders a frame in horizontal
// strips and posts each strip here, so a full-resolution image never needs to
// exist as one canvas (iOS caps a canvas at ~16.7 MP).
//
// Messages in:  { type: 'start', format: 'jpeg'|'png', width, height, quality }
//               { type: 'strip', rgba: Uint8ClampedArray, rows }
//               { type: 'finish' }
// Messages out: { type: 'ack' } after each strip, { type: 'done', blob }

import { Zlib } from 'fflate';

let encoder = null;

self.onmessage = (e) => {
  const msg = e.data;
  try {
    if (msg.type === 'start') {
      encoder = msg.format === 'png' ? new PngStream(msg.width, msg.height) : new JpegStream(msg.width, msg.height, msg.quality);
    } else if (msg.type === 'strip') {
      encoder.strip(msg.rgba, msg.rows);
      self.postMessage({ type: 'ack' });
    } else if (msg.type === 'finish') {
      self.postMessage({ type: 'done', blob: encoder.finish() });
      encoder = null;
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message });
  }
};

// ---------------------------------------------------------------------------
// Growable byte sink that flushes into Blob parts.

class Sink {
  constructor() { this.parts = []; this.buf = new Uint8Array(1 << 20); this.pos = 0; }
  byte(b) {
    if (this.pos === this.buf.length) this.flush();
    this.buf[this.pos++] = b;
  }
  word(w) { this.byte((w >> 8) & 0xff); this.byte(w & 0xff); }
  bytes(arr) { for (const b of arr) this.byte(b); }
  flush() {
    if (this.pos) this.parts.push(this.buf.slice(0, this.pos));
    this.pos = 0;
  }
}

// ---------------------------------------------------------------------------
// Baseline JPEG, 4:4:4 (no chroma subsampling), standard Huffman tables.

const ZIGZAG = [
  0, 1, 5, 6, 14, 15, 27, 28, 2, 4, 7, 13, 16, 26, 29, 42,
  3, 8, 12, 17, 25, 30, 41, 43, 9, 11, 18, 24, 31, 40, 44, 53,
  10, 19, 23, 32, 39, 45, 52, 54, 20, 22, 33, 38, 46, 51, 55, 60,
  21, 34, 37, 47, 50, 56, 59, 61, 35, 36, 48, 49, 57, 58, 62, 63,
];
const YQT = [
  16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55,
  14, 13, 16, 24, 40, 57, 69, 56, 14, 17, 22, 29, 51, 87, 80, 62,
  18, 22, 37, 56, 68, 109, 103, 77, 24, 35, 55, 64, 81, 104, 113, 92,
  49, 64, 78, 87, 103, 121, 120, 101, 72, 92, 95, 98, 112, 100, 103, 99,
];
const UVQT = [
  17, 18, 24, 47, 99, 99, 99, 99, 18, 21, 26, 66, 99, 99, 99, 99,
  24, 26, 56, 99, 99, 99, 99, 99, 47, 66, 99, 99, 99, 99, 99, 99,
  ...new Array(32).fill(99),
];
const AASF = [1.0, 1.387039845, 1.306562965, 1.175875602, 1.0, 0.785694958, 0.5411961, 0.275899379];

const DC_LUM_CODES = [0, 0, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0];
const DC_LUM_VALUES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const AC_LUM_CODES = [0, 0, 2, 1, 3, 3, 2, 4, 3, 5, 5, 4, 4, 0, 0, 1, 0x7d];
const AC_LUM_VALUES = [
  0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06, 0x13, 0x51, 0x61, 0x07,
  0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08, 0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0,
  0x24, 0x33, 0x62, 0x72, 0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28,
  0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49,
  0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69,
  0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
  0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7,
  0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5,
  0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2,
  0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8,
  0xf9, 0xfa,
];
const DC_CHR_CODES = [0, 0, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0];
const DC_CHR_VALUES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const AC_CHR_CODES = [0, 0, 2, 1, 2, 4, 4, 3, 4, 7, 5, 4, 4, 0, 1, 2, 0x77];
const AC_CHR_VALUES = [
  0x00, 0x01, 0x02, 0x03, 0x11, 0x04, 0x05, 0x21, 0x31, 0x06, 0x12, 0x41, 0x51, 0x07, 0x61, 0x71,
  0x13, 0x22, 0x32, 0x81, 0x08, 0x14, 0x42, 0x91, 0xa1, 0xb1, 0xc1, 0x09, 0x23, 0x33, 0x52, 0xf0,
  0x15, 0x62, 0x72, 0xd1, 0x0a, 0x16, 0x24, 0x34, 0xe1, 0x25, 0xf1, 0x17, 0x18, 0x19, 0x1a, 0x26,
  0x27, 0x28, 0x29, 0x2a, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48,
  0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68,
  0x69, 0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87,
  0x88, 0x89, 0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5,
  0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3,
  0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda,
  0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8,
  0xf9, 0xfa,
];

function huffmanTable(codes, values) {
  const table = [];
  let code = 0;
  let pos = 0;
  for (let len = 1; len <= 16; len++) {
    for (let j = 0; j < codes[len]; j++) table[values[pos++]] = [code++, len];
    code *= 2;
  }
  return table;
}

// Magnitude category and bit pattern for every coefficient value.
const CATEGORY = new Int32Array(65535);
const BITCODE = new Array(65535);
for (let cat = 1, lower = 1, upper = 2; cat <= 15; cat++, lower <<= 1, upper <<= 1) {
  for (let n = lower; n < upper; n++) { CATEGORY[32767 + n] = cat; BITCODE[32767 + n] = [n, cat]; }
  for (let n = -(upper - 1); n <= -lower; n++) { CATEGORY[32767 + n] = cat; BITCODE[32767 + n] = [upper - 1 + n, cat]; }
}

const HT_DC_Y = huffmanTable(DC_LUM_CODES, DC_LUM_VALUES);
const HT_AC_Y = huffmanTable(AC_LUM_CODES, AC_LUM_VALUES);
const HT_DC_C = huffmanTable(DC_CHR_CODES, DC_CHR_VALUES);
const HT_AC_C = huffmanTable(AC_CHR_CODES, AC_CHR_VALUES);

class JpegStream {
  constructor(width, height, quality = 0.92) {
    this.width = width;
    this.height = height;
    this.out = new Sink();
    this.bitBuf = 0;
    this.bitPos = 7;
    this.dc = [0, 0, 0];
    this.y = 0;
    this.carry = null; // rows waiting for a full 8-row block band
    this.blocks = [new Float32Array(64), new Float32Array(64), new Float32Array(64)];
    this.du = new Int32Array(64);
    this.quant = new Int32Array(64);
    this.setQuality(Math.round(Math.min(1, Math.max(0.01, quality)) * 100));
    this.writeHeaders();
  }

  setQuality(q) {
    const sf = q < 50 ? Math.floor(5000 / q) : Math.floor(200 - q * 2);
    this.yTable = new Uint8Array(64);
    this.uvTable = new Uint8Array(64);
    for (let i = 0; i < 64; i++) {
      this.yTable[ZIGZAG[i]] = Math.min(255, Math.max(1, Math.floor((YQT[i] * sf + 50) / 100)));
      this.uvTable[ZIGZAG[i]] = Math.min(255, Math.max(1, Math.floor((UVQT[i] * sf + 50) / 100)));
    }
    this.fdY = new Float32Array(64);
    this.fdUV = new Float32Array(64);
    for (let row = 0, k = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++, k++) {
        this.fdY[k] = 1 / (this.yTable[ZIGZAG[k]] * AASF[row] * AASF[col] * 8);
        this.fdUV[k] = 1 / (this.uvTable[ZIGZAG[k]] * AASF[row] * AASF[col] * 8);
      }
    }
  }

  writeHeaders() {
    const o = this.out;
    o.word(0xffd8);
    // JFIF APP0
    o.word(0xffe0); o.word(16); o.bytes([0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0]); o.word(1); o.word(1); o.byte(0); o.byte(0);
    // Quantisation tables (stored in zigzag order)
    o.word(0xffdb); o.word(132);
    o.byte(0); o.bytes(this.yTable);
    o.byte(1); o.bytes(this.uvTable);
    // Start of frame: baseline, 3 components, 1×1 sampling (4:4:4)
    o.word(0xffc0); o.word(17); o.byte(8); o.word(this.height); o.word(this.width); o.byte(3);
    o.bytes([1, 0x11, 0, 2, 0x11, 1, 3, 0x11, 1]);
    // Huffman tables
    o.word(0xffc4); o.word(0x01a2);
    for (const [cls, codes, values] of [[0x00, DC_LUM_CODES, DC_LUM_VALUES], [0x10, AC_LUM_CODES, AC_LUM_VALUES],
      [0x01, DC_CHR_CODES, DC_CHR_VALUES], [0x11, AC_CHR_CODES, AC_CHR_VALUES]]) {
      o.byte(cls);
      for (let i = 1; i <= 16; i++) o.byte(codes[i]);
      o.bytes(values);
    }
    // Start of scan
    o.word(0xffda); o.word(12); o.byte(3); o.bytes([1, 0x00, 2, 0x11, 3, 0x11]); o.byte(0); o.byte(0x3f); o.byte(0);
  }

  writeBits([value, length]) {
    for (let p = length - 1; p >= 0; p--) {
      if (value & (1 << p)) this.bitBuf |= 1 << this.bitPos;
      if (--this.bitPos < 0) {
        this.out.byte(this.bitBuf);
        if (this.bitBuf === 0xff) this.out.byte(0);
        this.bitPos = 7;
        this.bitBuf = 0;
      }
    }
  }

  /** Accepts any number of RGBA rows; encodes complete 8-row bands. */
  strip(rgba, rows) {
    let data = rgba;
    let total = rows;
    if (this.carry) {
      data = new Uint8ClampedArray(this.carry.length + rgba.length);
      data.set(this.carry);
      data.set(rgba, this.carry.length);
      total += this.carry.length / (this.width * 4);
      this.carry = null;
    }
    const last = this.y + total >= this.height;
    const full = last ? total : total - (total % 8);
    for (let by = 0; by < full; by += 8) this.encodeBand(data, by, Math.min(8, full - by));
    if (full < total) this.carry = data.slice(full * this.width * 4);
    this.y += full;
  }

  encodeBand(data, top, bandRows) {
    const w = this.width;
    const [Y, U, V] = this.blocks;
    for (let bx = 0; bx < w; bx += 8) {
      for (let r = 0; r < 8; r++) {
        const row = top + Math.min(r, bandRows - 1); // replicate the last row as padding
        for (let c = 0; c < 8; c++) {
          const x = Math.min(bx + c, w - 1);
          const p = (row * w + x) * 4;
          const R = data[p], G = data[p + 1], B = data[p + 2];
          const k = r * 8 + c;
          Y[k] = 0.299 * R + 0.587 * G + 0.114 * B - 128;
          U[k] = -0.16874 * R - 0.33126 * G + 0.5 * B;
          V[k] = 0.5 * R - 0.41869 * G - 0.08131 * B;
        }
      }
      this.dc[0] = this.encodeBlock(Y, this.fdY, this.dc[0], HT_DC_Y, HT_AC_Y);
      this.dc[1] = this.encodeBlock(U, this.fdUV, this.dc[1], HT_DC_C, HT_AC_C);
      this.dc[2] = this.encodeBlock(V, this.fdUV, this.dc[2], HT_DC_C, HT_AC_C);
    }
  }

  encodeBlock(d, fdtbl, prevDC, htDC, htAC) {
    fdct(d);
    const q = this.quant;
    for (let i = 0; i < 64; i++) {
      const v = d[i] * fdtbl[i];
      q[i] = v > 0 ? (v + 0.5) | 0 : (v - 0.5) | 0;
    }
    const du = this.du;
    for (let i = 0; i < 64; i++) du[ZIGZAG[i]] = Math.max(-32767, Math.min(32767, q[i]));

    const diff = du[0] - prevDC;
    if (diff === 0) this.writeBits(htDC[0]);
    else { this.writeBits(htDC[CATEGORY[32767 + diff]]); this.writeBits(BITCODE[32767 + diff]); }

    let end = 63;
    while (end > 0 && du[end] === 0) end--;
    if (end === 0) { this.writeBits(htAC[0x00]); return du[0]; }
    let i = 1;
    while (i <= end) {
      const start = i;
      while (du[i] === 0 && i <= end) i++;
      let zeros = i - start;
      if (zeros >= 16) {
        for (let m = zeros >> 4; m > 0; m--) this.writeBits(htAC[0xf0]);
        zeros &= 0xf;
      }
      const pos = 32767 + du[i];
      this.writeBits(htAC[(zeros << 4) + CATEGORY[pos]]);
      this.writeBits(BITCODE[pos]);
      i++;
    }
    if (end !== 63) this.writeBits(htAC[0x00]);
    return du[0];
  }

  finish() {
    if (this.carry) {
      // Only reached if fewer rows arrived than the declared height.
      const rows = this.carry.length / (this.width * 4);
      for (let by = 0; by < rows; by += 8) this.encodeBand(this.carry, by, Math.min(8, rows - by));
      this.carry = null;
    }
    if (this.bitPos !== 7) this.writeBits([(1 << (this.bitPos + 1)) - 1, this.bitPos + 1]);
    this.out.word(0xffd9);
    this.out.flush();
    return new Blob(this.out.parts, { type: 'image/jpeg' });
  }
}

// AAN forward DCT, in place.
function fdct(d) {
  for (let o = 0; o < 64; o += 8) pass(d, o, 1);
  for (let o = 0; o < 8; o++) pass(d, o, 8);
}
function pass(d, o, s) {
  const d0 = d[o], d1 = d[o + s], d2 = d[o + 2 * s], d3 = d[o + 3 * s];
  const d4 = d[o + 4 * s], d5 = d[o + 5 * s], d6 = d[o + 6 * s], d7 = d[o + 7 * s];
  const t0 = d0 + d7, t7 = d0 - d7, t1 = d1 + d6, t6 = d1 - d6;
  const t2 = d2 + d5, t5 = d2 - d5, t3 = d3 + d4, t4 = d3 - d4;
  let t10 = t0 + t3;
  const t13 = t0 - t3;
  let t11 = t1 + t2;
  let t12 = t1 - t2;
  d[o] = t10 + t11;
  d[o + 4 * s] = t10 - t11;
  const z1 = (t12 + t13) * 0.707106781;
  d[o + 2 * s] = t13 + z1;
  d[o + 6 * s] = t13 - z1;
  t10 = t4 + t5;
  t11 = t5 + t6;
  t12 = t6 + t7;
  const z5 = (t10 - t12) * 0.382683433;
  const z2 = 0.5411961 * t10 + z5;
  const z4 = 1.306562965 * t12 + z5;
  const z3 = t11 * 0.707106781;
  const z11 = t7 + z3;
  const z13 = t7 - z3;
  d[o + 5 * s] = z13 + z2;
  d[o + 3 * s] = z13 - z2;
  d[o + s] = z11 + z4;
  d[o + 7 * s] = z11 - z4;
}

// ---------------------------------------------------------------------------
// PNG, 8-bit RGB, "Sub" row filter, streamed through fflate's zlib.

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(chunks) {
  let c = 0xffffffff;
  for (const bytes of chunks) for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

class PngStream {
  constructor(width, height) {
    this.width = width;
    this.parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])];
    const ihdr = new Uint8Array(13);
    const v = new DataView(ihdr.buffer);
    v.setUint32(0, width);
    v.setUint32(4, height);
    ihdr.set([8, 2, 0, 0, 0], 8);
    this.chunk('IHDR', ihdr);
    this.zlib = new Zlib({ level: 6 }, (data) => { if (data.length) this.chunk('IDAT', data); });
  }

  chunk(type, data) {
    const head = new Uint8Array(8);
    const v = new DataView(head.buffer);
    v.setUint32(0, data.length);
    const name = new TextEncoder().encode(type);
    head.set(name, 4);
    const crc = new Uint8Array(4);
    new DataView(crc.buffer).setUint32(0, crc32([name, data]));
    this.parts.push(head, data, crc);
  }

  strip(rgba, rows) {
    const w = this.width;
    const line = w * 3 + 1;
    const out = new Uint8Array(line * rows);
    for (let r = 0; r < rows; r++) {
      const o = r * line;
      out[o] = 1; // Sub filter
      let pr = 0, pg = 0, pb = 0;
      for (let x = 0; x < w; x++) {
        const p = (r * w + x) * 4;
        const R = rgba[p], G = rgba[p + 1], B = rgba[p + 2];
        out[o + 1 + x * 3] = (R - pr) & 0xff;
        out[o + 2 + x * 3] = (G - pg) & 0xff;
        out[o + 3 + x * 3] = (B - pb) & 0xff;
        pr = R; pg = G; pb = B;
      }
    }
    this.zlib.push(out, false);
  }

  finish() {
    this.zlib.push(new Uint8Array(0), true);
    this.chunk('IEND', new Uint8Array(0));
    return new Blob(this.parts, { type: 'image/png' });
  }
}
