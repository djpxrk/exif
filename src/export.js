import { Capacitor } from '@capacitor/core';
import { zipSync } from 'fflate';
import { layout, renderFrame } from './render.js';
import { injectExif } from './exif-writer.js';

export const SIZES = { full: Infinity, 4096: 4096, 2048: 2048 };
export const FORMATS = {
  jpeg: { mime: 'image/jpeg', ext: 'jpg', label: 'JPEG' },
  png: { mime: 'image/png', ext: 'png', label: 'PNG' },
  webp: { mime: 'image/webp', ext: 'webp', label: 'WebP' },
};

let canvasLimit;
/** Largest canvas area this browser can draw into (iOS caps at ~16.7 MP). */
export function maxCanvasPixels() {
  if (canvasLimit) return canvasLimit;
  for (const side of [8192, 6144, 4096]) {
    try {
      const c = document.createElement('canvas');
      c.width = side;
      c.height = side;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#f00';
      ctx.fillRect(side - 1, side - 1, 1, 1);
      const ok = ctx.getImageData(side - 1, side - 1, 1, 1).data[3] === 255;
      c.width = c.height = 1;
      if (ok) return (canvasLimit = side * side);
    } catch { /* try smaller */ }
  }
  return (canvasLimit = 4096 * 4096);
}

/** Output pixel size for a photo with the current settings. */
export function outputSize(photo, settings, size) {
  const L = layout(photo.width, photo.height, settings, photo.fields);
  const scale = Math.min(1, SIZES[size] / Math.max(L.width, L.height));
  return { L, scale, width: Math.round(L.width * scale), height: Math.round(L.height * scale) };
}

/** True when the frame is too big for one canvas and is rendered in strips. */
export function needsStrips(width, height, limit = maxCanvasPixels()) {
  return width * height > limit || Math.max(width, height) > 16384;
}

/**
 * Renders one photo at export size and returns { blob, name, strips, format }.
 * The photo is always drawn at its native resolution (unless a smaller size is
 * chosen); frames too big for one canvas are rendered in strips and encoded
 * in a worker, so nothing is downscaled to fit device limits.
 */
export async function exportPhoto(photo, settings, opts, onProgress = () => {}) {
  const { scale, width, height } = outputSize(photo, settings, opts.size);
  const strips = needsStrips(width, height, opts.maxPixels);
  let format = opts.format;
  if (strips && format === 'webp') format = 'jpeg'; // no streaming WebP encoder
  const frame = {
    img: photo.image, orientation: photo.orientation, blurImg: photo.preview,
    W: photo.width, H: photo.height, fields: photo.fields, settings, scale,
  };

  let blob;
  if (strips) {
    blob = await renderInStrips(frame, width, height, format, opts.quality, onProgress);
  } else {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    renderFrame(canvas.getContext('2d'), frame);
    const fmt = FORMATS[format];
    blob = await new Promise((res) => canvas.toBlob(res, fmt.mime, opts.quality));
    canvas.width = canvas.height = 1; // release memory early on iOS
    if (!blob) throw new Error('This device ran out of memory while saving. Try a smaller export size.');
    if (blob.type !== fmt.mime) format = blob.type === 'image/jpeg' ? 'jpeg' : 'png'; // Safari: no WebP encoder
  }
  if (opts.keepExif && format === 'jpeg') {
    // Fill in the 35mm-equivalent focal length when the camera didn't record one.
    const meta = { ...photo.meta };
    if (!meta.FocalLengthIn35mmFormat && photo.focalMm && photo.crop) meta.FocalLengthIn35mmFormat = Math.round(photo.focalMm * photo.crop.value);
    blob = await injectExif(blob, meta);
  }
  const base = photo.name.replace(/\.[^.]+$/, '');
  return { blob, name: `${base}-framed.${FORMATS[format].ext}`, strips, format, width, height };
}

const STRIP_ROWS = 256;  // multiple of 8 for JPEG blocks
const TILE_COLS = 4096;  // keeps every tile canvas well under iOS limits

async function renderInStrips(frame, width, height, format, quality, onProgress) {
  const worker = new Worker(new URL('./encode-worker.js', import.meta.url), { type: 'module' });
  const replies = [];
  let waiting = null;
  worker.onmessage = (e) => { replies.push(e.data); waiting?.(); };
  worker.onerror = (e) => { replies.push({ type: 'error', message: e.message }); waiting?.(); };
  const next = async () => {
    while (!replies.length) await new Promise((r) => (waiting = r));
    const msg = replies.shift();
    if (msg.type === 'error') throw new Error(`Encoding failed: ${msg.message}`);
    return msg;
  };

  try {
    worker.postMessage({ type: 'start', format, width, height, quality });
    const tileW = Math.min(width, TILE_COLS);
    const tile = document.createElement('canvas');
    tile.width = tileW;
    tile.height = Math.min(STRIP_ROWS, height);
    const ctx = tile.getContext('2d', { willReadFrequently: true });

    for (let y = 0; y < height; y += STRIP_ROWS) {
      const rows = Math.min(STRIP_ROWS, height - y);
      const strip = new Uint8ClampedArray(width * rows * 4);
      for (let x = 0; x < width; x += tileW) {
        const cols = Math.min(tileW, width - x);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, tile.width, tile.height);
        renderFrame(ctx, { ...frame, offsetX: x, offsetY: y });
        const px = ctx.getImageData(0, 0, cols, rows).data;
        for (let r = 0; r < rows; r++) strip.set(px.subarray(r * cols * 4, (r + 1) * cols * 4), (r * width + x) * 4);
      }
      worker.postMessage({ type: 'strip', rgba: strip, rows }, [strip.buffer]);
      await next(); // one strip in flight keeps memory flat
      onProgress((y + rows) / height);
    }
    tile.width = tile.height = 1;
    worker.postMessage({ type: 'finish' });
    return (await next()).blob;
  } finally {
    worker.terminate();
  }
}

const toBase64 = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(',')[1]);
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

/** Hands finished files to the user: share sheet on iOS, download on desktop. */
export async function deliver(files) {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const uris = [];
    for (const f of files) {
      const { uri } = await Filesystem.writeFile({ path: f.name, data: await toBase64(f.blob), directory: Directory.Cache });
      uris.push(uri);
    }
    await Share.share({ files: uris });
    return 'shared';
  }

  const asFiles = files.map((f) => new File([f.blob], f.name, { type: f.blob.type }));
  const touch = matchMedia('(pointer: coarse)').matches;
  if (touch && navigator.canShare?.({ files: asFiles })) {
    try { await navigator.share({ files: asFiles }); return 'shared'; }
    catch (err) { if (err.name === 'AbortError') return 'cancelled'; }
  }

  if (files.length === 1) { download(files[0].blob, files[0].name); return 'downloaded'; }
  const entries = {};
  for (const f of files) entries[f.name] = [new Uint8Array(await f.blob.arrayBuffer()), { level: 0 }];
  download(new Blob([zipSync(entries)], { type: 'application/zip' }), 'framed-photos.zip');
  return 'downloaded';
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
