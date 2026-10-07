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
/** Largest canvas area this browser can actually draw into (iOS caps at ~16.7 MP). */
export function maxCanvasPixels() {
  if (canvasLimit) return canvasLimit;
  for (const side of [10000, 8192, 6144, 4096]) {
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

/** Renders one photo at export size and returns { blob, name, scale }. */
export async function exportPhoto(photo, settings, opts) {
  const L = layout(photo.width, photo.height, settings);
  const longEdge = Math.max(L.width, L.height);
  let scale = Math.min(1, SIZES[opts.size] / longEdge);
  const limit = maxCanvasPixels();
  if (L.width * L.height * scale * scale > limit) scale = Math.sqrt(limit / (L.width * L.height)) * 0.995;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(L.width * scale);
  canvas.height = Math.round(L.height * scale);
  const ctx = canvas.getContext('2d');
  renderFrame(ctx, { img: photo.image, W: photo.width, H: photo.height, fields: photo.fields, settings, scale });

  const fmt = FORMATS[opts.format];
  let blob = await new Promise((res) => canvas.toBlob(res, fmt.mime, opts.quality));
  canvas.width = canvas.height = 1; // release memory early on iOS
  if (!blob) throw new Error('This device ran out of memory while saving. Try a smaller export size.');
  if (blob.type !== fmt.mime) {
    // Safari can't encode WebP and silently returns PNG.
    opts = { ...opts, format: blob.type === 'image/jpeg' ? 'jpeg' : 'png' };
  }
  if (opts.keepExif && blob.type === 'image/jpeg') blob = await injectExif(blob, photo.meta);
  const base = photo.name.replace(/\.[^.]+$/, '');
  return { blob, name: `${base}-framed.${FORMATS[opts.format].ext}`, scale };
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
