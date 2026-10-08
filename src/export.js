import { Capacitor, registerPlugin } from '@capacitor/core';
import { zipSync } from 'fflate';
import { layout, renderFrame } from './render.js';
import { injectExif } from './exif-writer.js';

export const SIZES = { full: Infinity, 4096: 4096, 2048: 2048 };

// File name styles offered in Settings.
export const FILE_NAMES = {
  framed: 'Original name + “-framed”',
  same: 'Original name',
  dated: 'Date, time and camera',
};
function fileBase(photo, style = 'framed') {
  const base = photo.name.replace(/\.[^.]+$/, '');
  if (style === 'same') return base;
  const taken = new Date(photo.fields.taken || NaN);
  if (style === 'dated' && !isNaN(taken)) {
    const p = (n) => String(n).padStart(2, '0');
    const stamp = `${taken.getFullYear()}${p(taken.getMonth() + 1)}${p(taken.getDate())}_${p(taken.getHours())}${p(taken.getMinutes())}${p(taken.getSeconds())}`;
    const camera = String(photo.fields.model || '').replace(/[\\/:*?"<>|]+/g, '').trim().replace(/\s+/g, '-');
    return camera ? `${stamp}_${camera}` : stamp;
  }
  return `${base}-framed`;
}
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
  return { blob, name: `${fileBase(photo, opts.fileName)}.${FORMATS[format].ext}`, strips, format, width, height };
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

// ---------- Where saved files go ----------

// iOS app: the "Rebate" album in Photos (ios/App/App/PhotoLibraryPlugin.swift).
const PhotoLibrary = registerPlugin('PhotoLibrary');
export const ALBUM = 'Rebate';

/**
 * Save destinations this device offers, as [key, label, detail]:
 * - iOS app: an album in Photos, the app's folder in the Files app, or the share sheet
 * - desktop Chrome/Edge: a "Rebate" folder the user picks once, or Downloads
 * - other browsers: the share sheet on phones (Save to Photos/Files), Downloads otherwise
 */
export function saveTargets() {
  if (Capacitor.isNativePlatform()) {
    return [
      ['album', `Photos album “${ALBUM}”`, 'Framed photos are added to their own album in Photos.'],
      ['files', 'Files app', `Saved in Files → On My iPhone → ${ALBUM}.`],
      ['share', 'Share…', 'Opens the share sheet each time.'],
    ];
  }
  const touch = matchMedia('(pointer: coarse)').matches;
  const targets = [];
  if ('showDirectoryPicker' in window) targets.push(['folder', `“${ALBUM}” folder`, 'Every save goes into one folder you pick once.']);
  if (touch && navigator.canShare) targets.push(['share', 'Photos / Files', 'Opens the share sheet: choose Save Image(s), or Save to Files and pick a folder (iOS remembers it).']);
  targets.push(['download', 'Downloads', 'Saved by the browser. Several photos at once come as one .zip.']);
  return targets;
}

// The picked folder is kept in IndexedDB (handles can't go in localStorage).
function idb(mode, fn) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('rebate', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('kv');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction('kv', mode);
      const req = fn(tx.objectStore('kv'));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
    };
  });
}

/** The saved folder, as { dir, label }, or null. */
export async function savedFolder() {
  try { return (await idb('readonly', (s) => s.get('folder'))) || null; } catch { return null; }
}

/** Asks for a location and makes (or reuses) a "Rebate" folder in it. Needs a user gesture. */
export async function chooseFolder() {
  const parent = await window.showDirectoryPicker({ id: 'rebate', mode: 'readwrite', startIn: 'pictures' });
  const inside = parent.name === ALBUM;
  const dir = inside ? parent : await parent.getDirectoryHandle(ALBUM, { create: true });
  const folder = { dir, label: inside ? ALBUM : `${parent.name}/${ALBUM}` };
  await idb('readwrite', (s) => s.put(folder, 'folder'));
  return folder;
}

/** Forgets the picked folder (the folder itself and its files stay). */
export async function forgetFolder() {
  try { await idb('readwrite', (s) => s.delete('folder')); } catch { /* nothing saved */ }
}

/**
 * The saved folder with write access granted, asking again if the browser
 * has forgotten. Call at the start of a click: the prompt needs the gesture.
 */
export async function folderReady() {
  const folder = await savedFolder();
  if (!folder) return null;
  let state = await folder.dir.queryPermission({ mode: 'readwrite' });
  if (state === 'prompt') state = await folder.dir.requestPermission({ mode: 'readwrite' });
  return state === 'granted' ? folder : null;
}

/** "name.jpg", or "name-2.jpg" and so on when that's taken, so nothing is overwritten. */
async function freeName(exists, name) {
  const dot = name.lastIndexOf('.');
  for (let i = 1; ; i++) {
    const candidate = i === 1 ? name : `${name.slice(0, dot)}-${i}${name.slice(dot)}`;
    if (!(await exists(candidate))) return candidate;
  }
}

// ---------- System share sheet ----------

export const SITE_URL = 'https://djpxrk.github.io/rebate/';

/** True when this device has a share sheet (iOS app, and most phone and desktop browsers). */
export const canShare = () => Capacitor.isNativePlatform() || typeof navigator.share === 'function';

/**
 * Opens the operating system's share sheet with finished files, or with a
 * link when `files` is empty. Returns 'shared' | 'cancelled' | 'unsupported',
 * or 'needs-tap' when the browser wants a fresh tap first (Safari, after a
 * long render): call again from the next click.
 */
export async function shareFiles(files, { title = 'Rebate', text = '', url = '' } = {}) {
  if (Capacitor.isNativePlatform()) {
    const { Share } = await import('@capacitor/share');
    const shared = { title, text: text || undefined, url: url || undefined };
    if (files.length) {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      shared.files = [];
      for (const f of files) {
        const { uri } = await Filesystem.writeFile({ path: f.name, data: await toBase64(f.blob), directory: Directory.Cache });
        shared.files.push(uri);
      }
    }
    try { await Share.share(shared); return 'shared'; } catch { return 'cancelled'; }
  }
  const data = files.length
    ? { files: files.map((f) => new File([f.blob], f.name, { type: f.blob.type })), title }
    : { title, text, url };
  if (typeof navigator.share !== 'function' || (navigator.canShare && !navigator.canShare(data))) return 'unsupported';
  try {
    await navigator.share(data);
    return 'shared';
  } catch (err) {
    if (err.name === 'AbortError') return 'cancelled';
    if (err.name === 'NotAllowedError') return 'needs-tap';
    throw err;
  }
}

/**
 * Hands finished files over. `target` is a saveTargets() key; `folder` is the
 * result of folderReady() for the 'folder' target. Returns what happened:
 * 'album' | 'files' | 'folder' | 'shared' | 'downloaded' | 'cancelled'.
 */
export async function deliver(files, target = 'download', folder = null) {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    if (target === 'files') {
      const exists = (path) => Filesystem.stat({ path, directory: Directory.Documents }).then(() => true, () => false);
      for (const f of files) {
        const path = await freeName(exists, f.name);
        await Filesystem.writeFile({ path, data: await toBase64(f.blob), directory: Directory.Documents });
        f.savedAs = path;
      }
      return 'files';
    }
    const uris = [];
    for (const f of files) {
      const { uri } = await Filesystem.writeFile({ path: f.name, data: await toBase64(f.blob), directory: Directory.Cache });
      uris.push(uri);
    }
    if (target === 'album') {
      try {
        await PhotoLibrary.saveToAlbum({ paths: uris, album: ALBUM });
        return 'album';
      } catch (err) {
        console.warn('Photos album save failed; falling back to the share sheet.', err);
      }
    }
    const { Share } = await import('@capacitor/share');
    await Share.share({ files: uris });
    return 'shared';
  }

  if (target === 'folder' && folder) {
    const exists = (name) => folder.dir.getFileHandle(name).then(() => true, () => false);
    for (const f of files) {
      f.savedAs = await freeName(exists, f.name);
      const handle = await folder.dir.getFileHandle(f.savedAs, { create: true });
      const out = await handle.createWritable();
      await out.write(f.blob);
      await out.close();
    }
    return 'folder';
  }

  const asFiles = files.map((f) => new File([f.blob], f.name, { type: f.blob.type }));
  if (target === 'share' && navigator.canShare?.({ files: asFiles })) {
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
