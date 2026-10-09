import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/700.css';
import '@fontsource/fraunces/400.css';
import '@fontsource/fraunces/400-italic.css';
import '@fontsource/fraunces/600.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/600.css';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/700.css';
import '@fontsource/unbounded/400.css';
import '@fontsource/unbounded/700.css';
import '@fontsource/eb-garamond/400.css';
import '@fontsource/eb-garamond/700.css';
import '@fontsource/eb-garamond/400-italic.css';
import '@fontsource/noto-serif-display/400.css';
import '@fontsource/noto-serif-display/700.css';
import '@fontsource/noto-serif-display/400-italic.css';
import '@fontsource/courier-prime/400.css';
import '@fontsource/courier-prime/700.css';
import '@fontsource/caveat/400.css';
import '@fontsource/caveat/700.css';
import '@fontsource/nanum-pen-script/400.css';
// Korean faces: selectable themselves, and the Hangul fallback for the Latin faces.
import '@fontsource/ibm-plex-sans-kr/400.css';
import '@fontsource/ibm-plex-sans-kr/700.css';
import '@fontsource/gowun-batang/400.css';
import '@fontsource/gowun-batang/700.css';
import '@fontsource/nanum-gothic-coding/korean-400.css';
import '@fontsource/nanum-gothic-coding/korean-700.css';
// Code and digital faces.
import '@fontsource/fira-code/400.css';
import '@fontsource/fira-code/700.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/700.css';
import '@fontsource/source-code-pro/400.css';
import '@fontsource/source-code-pro/700.css';
import '@fontsource/space-mono/400.css';
import '@fontsource/space-mono/700.css';
import '@fontsource/orbitron/400.css';
import '@fontsource/orbitron/700.css';
import '@fontsource/vt323/400.css';
import '@fontsource/anton/400.css';
import '@fontsource/pacifico/400.css';
import '@fontsource/press-start-2p/400.css';
import dsegUrl from 'dseg/fonts/DSEG7-Classic/DSEG7Classic-Bold.woff2?url';
import lcdRegularUrl from 'dseg/fonts/DSEG14-Classic/DSEG14Classic-Regular.woff2?url';
import lcdBoldUrl from 'dseg/fonts/DSEG14-Classic/DSEG14Classic-Bold.woff2?url';
import './styles.css';

import { Capacitor } from '@capacitor/core';
import { ACCEPT, decodeFile, makePreview } from './decode.js';
import { equivalentFocal, formatForCrop, lookupCamera } from './crop.js';
import { cameraLogo, lensLogo } from './brands.js';
import { LOGOS } from './logos.js';
import { DATE_FORMATS, formatDate, formatTime, prettyModel } from './exif.js';
import { DATE_STAMP_FONT, DEFAULT_SETTINGS, FONTS, FONT_GROUPS, MAP_SCALES, RATIOS, TEMPLATES, layout, ratioLabel, renderFrame } from './render.js';
import { coordsOf, loadMaps, maps, placeOf } from './map.js';
import { ALBUM, FILE_NAMES, FORMATS, SITE_URL, canShare, chooseFolder, deliver, exportPhoto, folderReady, forgetFolder, maxCanvasPixels, needsStrips, outputSize, saveTargets, savedFolder, shareFiles } from './export.js';

const $ = (sel) => document.querySelector(sel);
const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};

// ---------- State ----------

// [key, label, width in twelfths]: related values share a row to keep Details short.
const FIELD_ROWS = [
  ['make', 'Brand', 5], ['model', 'Camera', 7], ['lens', 'Lens', 12],
  ['focal', 'Focal', 3], ['aperture', 'Aperture', 3], ['shutter', 'Shutter', 3], ['iso', 'ISO', 3],
  ['date', 'Date', 6], ['time', 'Time', 6], ['location', 'Location', 7], ['place', 'Place', 5],
  ['artist', 'Artist', 5], ['caption', 'Caption', 7],
];
const BACKGROUNDS = [
  ['template', 'Template default', 'auto'],
  ['#ffffff', 'White'],
  ['#f6f5f1', 'Paper'],
  ['#777777', 'Gray card'],
  ['#1c1c1c', 'Charcoal'],
  ['#000000', 'Black'],
  ['blur', 'Blurred photo', 'blur'],
];

const stored = load('rebate:settings', {});
const settings = { ...structuredClone(DEFAULT_SETTINGS), ...stored, show: { ...DEFAULT_SETTINGS.show, ...stored.show } };
// Ratios saved by earlier versions ('3:2', '16:9') map to their short:long preset.
if (!RATIOS[settings.ratio]) settings.ratio = { '3:2': '2:3', '16:9': '9:16' }[settings.ratio] || 'auto';
const exportOpts = { format: 'jpeg', quality: 0.92, size: 'full', keepExif: true, fileName: 'framed', ...load('rebate:export', {}) };
// Where saves go; the first destination this device offers is the default.
if (!saveTargets().some(([k]) => k === exportOpts.target)) exportOpts.target = saveTargets()[0][0];
const photos = [];
let current = -1;

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function persist() {
  try {
    localStorage.setItem('rebate:settings', JSON.stringify(settings));
    localStorage.setItem('rebate:export', JSON.stringify(exportOpts));
  } catch { /* private mode */ }
}

// ---------- Importing ----------

const fileInput = $('#file-input');
fileInput.accept = ACCEPT;
$('#add-btn').onclick = $('#empty-add').onclick = () => fileInput.click();
fileInput.onchange = () => { addFiles([...fileInput.files]); fileInput.value = ''; };

const stage = $('#stage');
['dragenter', 'dragover'].forEach((t) => window.addEventListener(t, (e) => { e.preventDefault(); stage.classList.add('dragging'); }));
['dragleave', 'drop'].forEach((t) => window.addEventListener(t, (e) => { e.preventDefault(); stage.classList.remove('dragging'); }));
window.addEventListener('drop', (e) => addFiles([...(e.dataTransfer?.files || [])]));
window.addEventListener('paste', (e) => {
  const files = [...(e.clipboardData?.files || [])];
  if (files.length) addFiles(files);
});

async function addFiles(files) {
  if (!files.length) return;
  const errors = [];
  let lastNote = '';
  for (const [i, file] of files.entries()) {
    busy(`Reading ${file.name}${files.length > 1 ? ` (${i + 1} of ${files.length})` : ''}`);
    try {
      const d = await decodeFile(file);
      d.fields.file = file.name; // not a Details row; the Lightroom and Slide frames use it
      const preview = makePreview(d.image, 2000, d.orientation);
      photos.push({
        id: crypto.randomUUID?.() || String(Math.random()),
        name: file.name,
        ...d,
        preview,
        thumb: makePreview(preview, 320),
        original: { ...d.fields },
        originalCrop: d.crop,
        originalFocalMm: d.focalMm,
        edited: {}, // Details fields the user typed in, which Settings then leave alone
      });
      applyPrefs(photos[photos.length - 1]);
      if (d.note) lastNote = `${file.name}: ${d.note}`;
      if (current === -1 || i === 0) current = photos.length - 1;
    } catch (err) {
      console.error(err);
      errors.push(err.message === 'decode-failed' ? `${file.name} couldn't be decoded in this browser.` : err.message);
    }
  }
  busy(null);
  if (errors.length) note(errors.join(' '), true);
  else if (lastNote) note(lastNote);
  else note(null);
  refreshAll();
}

// ---------- Status ----------

function busy(text) {
  $('#busy').hidden = !text;
  if (text) $('#busy-text').textContent = text + '…';
}
let noteTimer;
function note(text, error = false) {
  const n = $('#note');
  clearTimeout(noteTimer);
  n.hidden = !text;
  n.classList.toggle('error', error);
  if (text) {
    n.textContent = text;
    noteTimer = setTimeout(() => (n.hidden = true), error ? 9000 : 6000);
  }
}

// ---------- Fonts ----------

// The 7-segment date-stamp face isn't on Fontsource; register it directly.
const dateStampFace = new FontFace(DATE_STAMP_FONT.family, `url(${dsegUrl}) format("woff2")`, { weight: '700' });
document.fonts.add(dateStampFace);
const dateStampReady = dateStampFace.load().catch(() => null);
// The 14-segment LCD face is a selectable typeface; it loads when first used.
for (const [url, weight] of [[lcdRegularUrl, '400'], [lcdBoldUrl, '700']]) {
  document.fonts.add(new FontFace(FONTS.lcd.family, `url(${url}) format("woff2")`, { weight }));
}

// Canvas text only uses a web font once it has loaded, and @font-face
// unicode-range means each script (Latin, Greek, Korean…) loads separately,
// so faces are loaded for the exact text about to be drawn.
const fontsReady = new Set();
function activeFontKey() {
  return settings.font === 'template' ? TEMPLATES[settings.template].font : settings.font;
}
/** The selected face plus any the frame always uses (Postcard's typewriter, Slide's pen). */
function activeFontKeys() {
  return [activeFontKey(), ...(TEMPLATES[settings.template].fonts || [])];
}
function frameText(photo) {
  return photo ? [...Object.values(photo.fields), placeOf(photo.fields)?.label].filter(Boolean).join(' ') : '';
}
function ensureFont(key, text = '') {
  const f = FONTS[key];
  if (!f) return Promise.resolve();
  const sample = `Aa1/α°©'${text}`;
  const id = `${key}|${sample}`;
  if (fontsReady.has(id)) return Promise.resolve();
  const families = [f.family, ...(f.stack ? f.stack.split(',').map((x) => x.trim().replace(/"/g, '')) : [])];
  const specs = families.flatMap((fam) => [`${f.regular} 20px "${fam}"`, `${f.bold} 20px "${fam}"`]);
  if (f.italic) specs.push(`italic ${f.regular} 20px "${f.family}"`);
  return Promise.allSettled([...specs.map((spec) => document.fonts.load(spec, sample)), dateStampReady]).then(() => fontsReady.add(id));
}
/** Redraws once the active face is ready for this photo's text. */
function ensureActiveFont(photo) {
  const missing = activeFontKeys().filter((key) => !fontsReady.has(`${key}|Aa1/α°©'${frameText(photo)}`));
  if (!missing.length) return true;
  Promise.all(missing.map((key) => ensureFont(key, frameText(photo)))).then(() => drawPreview());
  return false;
}

// ---------- Maps ----------

// Map frames and place names need the offline map data (~500 KB), which is
// fetched once on first use.
const needsMaps = (s = settings) => !!TEMPLATES[s.template].map || s.show.place;
let mapsWanted = false;
function ensureMaps() {
  if (maps() || mapsWanted) return;
  mapsWanted = true;
  loadMaps().then(() => { drawPreview(); drawTemplatesLater(); drawFields(); }, () => { mapsWanted = false; });
}

// ---------- Preview ----------

const canvas = $('#preview');
let frame = 0;
function drawPreview() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    const photo = photos[current];
    $('#empty').hidden = !!photo;
    canvas.hidden = !photo;
    if (!photo) return;
    ensureActiveFont(photo); // draws now with what's loaded, again when the face arrives
    if (needsMaps()) ensureMaps();
    const L = layout(photo.width, photo.height, settings, photo.fields);
    const cs = getComputedStyle(stage);
    const availW = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const availH = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const fit = Math.min(availW / L.width, availH / L.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.style.width = `${Math.floor(L.width * fit)}px`;
    canvas.style.height = `${Math.floor(L.height * fit)}px`;
    canvas.width = Math.max(1, Math.round(L.width * fit * dpr));
    canvas.height = Math.max(1, Math.round(L.height * fit * dpr));
    renderFrame(canvas.getContext('2d'), {
      img: photo.preview, W: photo.width, H: photo.height, fields: photo.fields, settings, scale: fit * dpr,
    });
    updateDims();
  });
}
new ResizeObserver(drawPreview).observe(stage);

// ---------- Filmstrip ----------

function drawFilmstrip() {
  const strip = $('#filmstrip');
  strip.hidden = photos.length === 0;
  strip.replaceChildren(
    ...photos.map((p, i) => {
      const b = el('button', { className: 'thumb af', type: 'button', title: p.name });
      b.setAttribute('aria-pressed', String(i === current));
      b.setAttribute('aria-label', p.name);
      const c = el('canvas');
      c.width = p.thumb.width;
      c.height = p.thumb.height;
      c.getContext('2d').drawImage(p.thumb, 0, 0);
      b.append(c);
      b.onclick = () => { current = i; refreshAll(); };
      return b;
    }),
    ...(photos.length ? [el('button', { className: 'thumb-remove', type: 'button', textContent: 'Remove', onclick: removeCurrent })] : []),
  );
}
function removeCurrent() {
  if (current < 0) return;
  photos.splice(current, 1);
  current = Math.min(current, photos.length - 1);
  refreshAll();
}

// ---------- Tabs ----------

document.querySelectorAll('[role="tab"]').forEach((tab) => {
  tab.onclick = () => {
    document.querySelectorAll('[role="tab"]').forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
    document.querySelectorAll('.tab-body').forEach((b) => (b.hidden = b.dataset.body !== tab.dataset.tab));
    if (tab.dataset.tab === 'frame') drawTemplates();
    if (tab.dataset.tab === 'layout') drawLayoutControls();
  };
});

// ---------- Frame tab ----------

let templateTimer;
function drawTemplates() {
  clearTimeout(templateTimer);
  templateTimer = setTimeout(() => {
    ensureMaps(); // the Atlas and Postcard thumbnails show a map
    const photo = photos[current];
    const sample = photo || samplePhoto();
    $('#templates').replaceChildren(
      ...Object.entries(TEMPLATES).map(([key, tpl]) => {
        const s = { ...settings, template: key, ratio: 'auto', background: 'template', font: 'template' };
        const L = layout(sample.width, sample.height, s, sample.fields);
        const k = 240 / Math.max(L.width, L.height);
        const c = el('canvas');
        c.width = Math.round(L.width * k);
        c.height = Math.round(L.height * k);
        renderFrame(c.getContext('2d'), { img: sample.thumb, W: sample.width, H: sample.height, fields: sample.fields, settings: s, scale: k });
        const b = el('button', { className: 'template af', type: 'button' }, el('div', { className: 'template-art' }, c), el('span', { textContent: tpl.label }));
        b.setAttribute('aria-pressed', String(settings.template === key));
        b.onclick = () => { settings.template = key; changed(); drawFields(); };
        return b;
      }),
    );
  }, 60);
}

let sample;
const SAMPLE_TAKEN = new Date(2026, 9, 7, 17, 42);
function samplePhoto() {
  if (sample) return sample;
  const c = el('canvas');
  c.width = 300; c.height = 200;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 300, 200);
  grad.addColorStop(0, '#4d5a63'); grad.addColorStop(0.6, '#a7a08f'); grad.addColorStop(1, '#d9cdb1');
  g.fillStyle = grad; g.fillRect(0, 0, 300, 200);
  sample = {
    width: 6000, height: 4000, thumb: c,
    fields: {
      make: 'SONY', model: 'α7 IV', lens: 'FE 35mm F1.4 GM', focal: '35mm', focal35: '35mm', aperture: 'f/1.4', shutter: '1/500s',
      iso: 'ISO100', date: formatDate(SAMPLE_TAKEN, settings.dateFormat), time: formatTime(SAMPLE_TAKEN, settings.timeFormat),
      location: '33.4581°N 126.9426°E', place: '', heading: '75°', altitude: '',
      artist: '', caption: '', file: 'DSC01234.ARW',
    },
  };
  return sample;
}

// ---------- Details tab ----------

function drawFields() {
  const photo = photos[current];
  $('#details-hint').textContent = !photo
    ? 'Add a photo to edit its details.'
    : TEMPLATES[settings.template].map
      ? `${TEMPLATES[settings.template].label} always shows where the photo was taken${coordsOf(photo.fields) ? '' : ' (type coordinates under Location, e.g. 37.5665, 126.9780)'}; exact coordinates appear only with Location ticked.`
      : 'Untick a line to leave it out. Edits apply to the selected photo.';
  let focalInput;
  let placeInput;
  let cropInput;
  let cropStatus;
  let focalExtras;

  // Recomputes the 35mm value from the focal length and crop factor, and
  // refreshes the crop row without rebuilding inputs (keeps typing focus).
  const syncCrop = (message) => {
    if (!photo) return;
    if (photo.crop && photo.focalMm) photo.fields.focal35 = equivalentFocal(photo.focalMm, photo.crop.value);
    if (cropInput && document.activeElement !== cropInput) cropInput.value = photo.crop ? photo.crop.value.toFixed(2) : '';
    if (cropStatus) cropStatus.textContent = message || cropDescription(photo.crop, photo.fields);
    if (focalInput && settings.focal35 && document.activeElement !== focalInput) focalInput.value = photo.fields.focal35 || photo.fields.focal;
    drawPreview();
    drawTemplatesLater();
  };

  const rows = FIELD_ROWS.map(([key, label, span]) => {
    // The focal length row edits whichever value is shown: actual or 35mm equivalent.
    const prop = key === 'focal' && settings.focal35 && photo?.fields.focal35 ? 'focal35' : key;
    const id = `f-${key}`;
    const check = el('input', { type: 'checkbox', className: 'check', checked: settings.show[key], title: `Show ${label.toLowerCase()}` });
    check.setAttribute('aria-label', `Show ${label.toLowerCase()}`);
    const input = el('input', {
      type: 'text', id, value: photo?.fields[prop] || '', disabled: !photo, autocomplete: 'off',
      placeholder: key === 'caption' ? 'Add a caption' : key === 'artist' ? 'Your name' : key === 'place' ? placeHint(photo) : photo ? 'Not in EXIF' : '',
    });
    if (key === 'place') placeInput = input;
    input.spellcheck = false;
    check.onchange = () => { settings.show[key] = check.checked; changed(); };
    input.oninput = () => {
      photo.fields[prop] = input.value;
      photo.edited[key] = true;
      if (key === 'make' || key === 'model') {
        // New camera entered: look its crop factor up in the database.
        const hit = lookupCamera(photo.fields.make, photo.fields.model);
        if (hit) photo.crop = { value: hit.crop, format: hit.format, source: 'database', model: hit.model, brand: hit.brand, matched: hit.matched };
        syncCrop(hit ? null : photo.fields.model
          ? `“${photo.fields.model}” isn’t in the camera database. ${photo.crop ? `Keeping ${photo.crop.value.toFixed(2)}×.` : 'Enter a crop factor.'}`
          : null);
        return;
      }
      if (prop === 'focal') { photo.focalMm = parseFloat(input.value) || null; syncCrop(); return; }
      if (key === 'location' && placeInput) placeInput.placeholder = placeHint(photo);
      drawPreview();
      drawTemplatesLater();
    };
    const row = el('div', { className: 'field' }, el('div', { className: 'field-head' }, check, el('label', { htmlFor: id, textContent: prop === 'focal35' ? 'Focal 35' : label })), input);
    row.style.gridColumn = `span ${span}`;
    if (key !== 'focal') return row;
    focalInput = input;

    const toggle = el('input', { type: 'checkbox', id: 'focal35', checked: settings.focal35 });
    toggle.onchange = () => { settings.focal35 = toggle.checked; changed(); drawFields(); };

    cropInput = el('input', {
      type: 'number', id: 'crop', min: '0.2', max: '12', step: '0.01', inputMode: 'decimal', disabled: !photo,
      value: photo?.crop ? photo.crop.value.toFixed(2) : '', placeholder: '—',
    });
    cropInput.oninput = () => {
      const v = parseFloat(cropInput.value);
      if (!(v >= 0.2 && v <= 12)) return;
      photo.crop = { value: v, format: formatForCrop(v), source: 'manual' };
      syncCrop();
    };
    cropStatus = el('small', { className: 'crop-status', textContent: photo ? cropDescription(photo.crop, photo.fields) : '' });
    // 35mm switch and crop factor share one line under the exposure row.
    focalExtras = el('div', { className: 'focal-extras' },
      el('label', { className: 'toggle' }, toggle, el('span', { textContent: '35mm equivalent' })),
      el('label', { className: 'crop-input', htmlFor: 'crop' }, el('span', { textContent: 'Crop' }), cropInput, el('span', { textContent: '×', ariaHidden: 'true' })),
      cropStatus);
    return row;
  });
  const iso = rows.findIndex((r) => r.querySelector('#f-iso'));
  rows.splice(iso + 1, 0, focalExtras);
  $('#fields').replaceChildren(...rows);
}

/** Placeholder for the Place field: the name looked up from the coordinates. */
function placeHint(photo) {
  if (!photo) return '';
  if (!coordsOf(photo.fields)) return 'Type a place, or add coordinates';
  if (!maps()) return 'Found from the location';
  return maps().placeName(coordsOf(photo.fields).lat, coordsOf(photo.fields).lon).label || 'No town nearby';
}

function cropDescription(crop, fields) {
  if (!crop) return 'Crop factor not found: type it, e.g. 1.5 for APS-C or 2 for Micro Four Thirds.';
  const where = {
    database: crop.matched === 'series'
      ? 'estimated from the camera’s product line'
      : `camera database${crop.model ? `: ${prettyModel(crop.model, crop.brand || '')}` : ''}`,
    exif: 'from the camera’s EXIF',
    sensor: 'estimated from the sensor size in EXIF',
    manual: 'set by you',
  }[crop.source];
  const eq = fields?.focal && fields.focal35 && fields.focal !== fields.focal35 ? ` ${fields.focal} = ${fields.focal35} on full frame.` : '';
  return `${crop.format || formatForCrop(crop.value)}, ${where}.${eq}`;
}
const drawTemplatesLater = () => { if (!$('[data-body="frame"]').hidden) drawTemplates(); };

$('#reset-fields').onclick = () => {
  const photo = photos[current];
  if (!photo) return;
  photo.fields = { ...photo.original, artist: photo.fields.artist, caption: photo.fields.caption };
  photo.edited = { artist: photo.edited.artist };
  applyPrefs(photo);
  photo.crop = photo.originalCrop;
  photo.focalMm = photo.originalFocalMm;
  drawFields(); drawPreview(); drawTemplatesLater();
};
$('#copy-fields').onclick = () => {
  const photo = photos[current];
  if (!photo) return;
  photos.forEach((p) => { p.fields.artist = photo.fields.artist; p.fields.caption = photo.fields.caption; p.edited.artist = true; });
  note(`Artist and caption copied to ${photos.length} photo${photos.length === 1 ? '' : 's'}.`);
};

// ---------- Layout tab ----------

function chipGroup(container, options, isOn, onPick) {
  container.replaceChildren(
    ...options.map(([value, label]) => {
      const b = el('button', { className: 'chip', type: 'button', textContent: label });
      b.setAttribute('aria-pressed', String(isOn(value)));
      b.onclick = () => onPick(value);
      return b;
    }),
  );
}

function drawLayoutControls() {
  const photo = photos[current] || samplePhoto();
  const L0 = layout(photo.width, photo.height, { ...settings, ratio: 'auto', orient: 'auto' }, photo.fields);
  chipGroup($('#orients'), [['auto', 'Match photo'], ['portrait', 'Vertical'], ['landscape', 'Horizontal']],
    (v) => settings.orient === v, (v) => { settings.orient = v; changed(); });
  chipGroup($('#ratios'), Object.keys(RATIOS).map((k) => [k, ratioLabel(k, settings, L0.content.w, L0.content.h)]),
    (v) => settings.ratio === v, (v) => { settings.ratio = v; changed(); });
  $('#custom-ratio').hidden = settings.ratio !== 'custom';
  $('#custom-w').value = settings.custom[0];
  $('#custom-h').value = settings.custom[1];
  const L = layout(photo.width, photo.height, settings, photo.fields);
  $('#ratio-out').textContent = simpleRatio(L.width, L.height);
  $('#orient-out').textContent = L.width === L.height ? 'Square' : L.width > L.height ? 'Horizontal' : 'Vertical';

  $('#border').value = settings.border;
  $('#border-out').textContent = `${Math.round(settings.border * 100)}%`;
  $('#radius').value = settings.radius;
  $('#radius-out').textContent = settings.radius ? `${Math.round(settings.radius * 100)}%` : 'Square';

  const custom = BACKGROUNDS.every(([v]) => v !== settings.background);
  $('#swatches').replaceChildren(
    ...BACKGROUNDS.map(([value, label, cls]) => {
      const b = el('button', { className: `swatch af ${cls || ''}`, type: 'button', title: label }, el('span', { className: 'swatch-label', textContent: label }));
      if (!cls) b.style.background = value;
      b.setAttribute('aria-pressed', String(settings.background === value));
      b.onclick = () => { settings.background = value; changed(); };
      return b;
    }),
    (() => {
      const input = el('input', { type: 'color', value: custom ? settings.background : '#d8cfc0' });
      input.setAttribute('aria-label', 'Custom color');
      input.oninput = () => { settings.background = input.value; changed({ controls: false }); };
      input.onchange = () => changed();
      const wrap = el('label', { className: 'swatch custom af', title: 'Custom color' }, input);
      if (custom) wrap.style.background = settings.background;
      wrap.setAttribute('aria-pressed', String(custom));
      return wrap;
    })(),
  );

  const tpl = TEMPLATES[settings.template];
  $('#map-group').hidden = !tpl.map;
  $('#map-scales').hidden = settings.template !== 'atlas';
  chipGroup($('#map-scales'), Object.entries(MAP_SCALES).map(([k, m]) => [k, m.label]),
    (v) => (settings.mapScale || 'region') === v, (v) => { settings.mapScale = v; changed(); });

  chipGroup($('#logo-modes'), [['both', 'Camera + lens logos'], ['camera', 'Camera logo'], ['text', 'Name as text']],
    (v) => (settings.logo || 'both') === v, (v) => { settings.logo = v; changed(); });
  $('#logo-hint').textContent = logoHint(photos[current]);

  // Typefaces by kind: the chips switch which kind is listed, so the list stays short.
  const tplFont = FONTS[TEMPLATES[settings.template].font];
  const shown = fontGroup || (settings.font === 'template' ? tplFont : FONTS[settings.font])?.group || 'sans';
  chipGroup($('#font-groups'), Object.entries(FONT_GROUPS), (v) => v === shown, (v) => { fontGroup = v; drawLayoutControls(); });
  const faces = [['template', tplFont, `Default · ${tplFont.label}`], ...Object.entries(FONTS).filter(([, f]) => f.group === shown).map(([k, f]) => [k, f, f.label])];
  $('#fonts').replaceChildren(
    ...faces.map(([key, f, label]) => {
      const b = el('button', { className: 'font-opt af', type: 'button' },
        el('b', { textContent: f.sample || 'Ag 1/250', style: `font-family:"${f.family}";${f.upper ? 'text-transform:uppercase;' : ''}` }),
        el('small', { textContent: label }));
      b.setAttribute('aria-pressed', String(settings.font === key));
      b.onclick = () => { settings.font = key; changed(); };
      return b;
    }),
  );
}
let fontGroup = null; // the kind of typeface the picker lists; follows the selection until a chip is used
function logoHint(photo) {
  if (!photo) return 'Logos appear for supported camera and lens brands. A lens logo is added when the lens maker differs from the camera’s.';
  const cam = cameraLogo(photo.fields.make);
  const lens = lensLogo(photo.fields.lens, photo.fields.lensMake);
  const name = (k) => LOGOS[k]?.name || k;
  const parts = [];
  parts.push(cam ? `Camera: ${name(cam)} logo.` : photo.fields.make ? `No logo for “${photo.fields.make}”, so its name is shown as text.` : 'No camera brand in this photo.');
  if (lens && lens !== cam) parts.push(`Lens: ${name(lens)} logo.`);
  return parts.join(' ');
}

function simpleRatio(w, h) {
  const r = w / h;
  for (let d = 1; d <= 20; d++) {
    const n = Math.round(r * d);
    if (n > 0 && Math.abs(n / d - r) < 0.0015) return `${n}:${d}`;
  }
  return r >= 1 ? `${r.toFixed(2)}:1` : `1:${(1 / r).toFixed(2)}`;
}
for (const [id, i] of [['#custom-w', 0], ['#custom-h', 1]]) {
  $(id).oninput = (e) => {
    const v = parseFloat(e.target.value);
    if (!(v > 0 && v <= 100)) return;
    settings.custom = [...settings.custom];
    settings.custom[i] = v;
    persist();
    drawPreview();
    const photo = photos[current] || samplePhoto();
    const L = layout(photo.width, photo.height, settings, photo.fields);
    $('#ratio-out').textContent = simpleRatio(L.width, L.height);
  };
  $(id).onchange = () => changed();
}
$('#border').oninput = (e) => { settings.border = +e.target.value; $('#border-out').textContent = `${Math.round(settings.border * 100)}%`; changed({ controls: false }); };
$('#radius').oninput = (e) => { settings.radius = +e.target.value; $('#radius-out').textContent = settings.radius ? `${Math.round(settings.radius * 100)}%` : 'Square'; changed({ controls: false }); };

// ---------- Save tab ----------

function drawSaveControls() {
  chipGroup($('#formats'), Object.entries(FORMATS).map(([k, f]) => [k, f.label]), (v) => exportOpts.format === v, (v) => { exportOpts.format = v; persist(); drawSaveControls(); });
  chipGroup($('#sizes'), [['full', 'Full size'], ['4096', '4096 px'], ['2048', '2048 px']], (v) => exportOpts.size === v, (v) => { exportOpts.size = v; persist(); drawSaveControls(); });
  const targets = saveTargets();
  chipGroup($('#targets'), targets.map(([k, label]) => [k, label]), (v) => exportOpts.target === v, (v) => { exportOpts.target = v; persist(); drawSaveControls(); });
  const [, , detail] = targets.find(([k]) => k === exportOpts.target);
  $('#target-hint').textContent = detail;
  $('#change-folder').hidden = exportOpts.target !== 'folder';
  if (exportOpts.target === 'folder') {
    savedFolder().then((f) => {
      $('#target-hint').textContent = f ? `Saving into “${f.label}”. ${detail}` : `${detail} You’ll be asked where on your first save.`;
      $('#change-folder').textContent = f ? 'Change folder' : 'Choose folder';
    });
  }
  $('#forget-folder').hidden = true;
  if (exportOpts.target === 'folder') savedFolder().then((f) => ($('#forget-folder').hidden = !f));
  const label = targets.find(([k]) => k === exportOpts.target)[1];
  $('#save-dest').replaceChildren(`Saves go to ${label}. `, el('button', { className: 'link', type: 'button', textContent: 'Change in Settings', onclick: openSettings }));
  $('#quality-row').hidden = exportOpts.format === 'png';
  $('#quality').value = exportOpts.quality;
  $('#quality-out').textContent = `${Math.round(exportOpts.quality * 100)}`;
  $('#keep-exif').checked = exportOpts.keepExif;
  $('#keep-exif').disabled = exportOpts.format !== 'jpeg';
  $('#save-one').disabled = !photos.length;
  $('#save-all').hidden = photos.length < 2;
  $('#save-all').textContent = `Save all ${photos.length} photos`;
  updateDims();
}
$('#quality').oninput = (e) => { exportOpts.quality = +e.target.value; $('#quality-out').textContent = `${Math.round(exportOpts.quality * 100)}`; persist(); };
$('#keep-exif').onchange = (e) => { exportOpts.keepExif = e.target.checked; persist(); };

function updateDims() {
  const photo = photos[current];
  if (!photo) { $('#dims').textContent = 'Add a photo to see the output size.'; return; }
  const { width, height, scale } = outputSize(photo, settings, exportOpts.size);
  const big = canvasLimitKnown && needsStrips(width, height, canvasLimitKnown);
  $('#dims').textContent = `Output ${width} × ${height} px` +
    (scale === 1 ? ', photo at full resolution' : `, photo scaled to ${Math.round(scale * 100)}%`) +
    (big ? '. Large frames take a little longer to save.' : '.');
}
let canvasLimitKnown = null;

/** Renders photos at export settings, with progress in the status pill. */
async function renderList(list) {
  canvasLimitKnown = maxCanvasPixels();
  const out = [];
  for (const [i, photo] of list.entries()) {
    const label = `Rendering ${photo.name}${list.length > 1 ? ` (${i + 1} of ${list.length})` : ''}`;
    busy(label);
    await new Promise((r) => setTimeout(r, 30)); // let the status paint
    await Promise.all(activeFontKeys().map((key) => ensureFont(key, frameText(photo))));
    if (needsMaps()) await loadMaps().catch(() => { throw new Error('The map data couldn’t be loaded. Check your connection and try again.'); });
    out.push(await exportPhoto(photo, settings, exportOpts, (p) => busy(`${label} ${Math.round(p * 100)}%`)));
  }
  return out;
}

async function save(list) {
  const buttons = [$('#save-one'), $('#save-all')];
  buttons.forEach((b) => (b.disabled = true));
  let target = exportOpts.target;
  let folder = null;
  if (target === 'folder') {
    // Ask for access (or a folder) now, while the click still counts as a user gesture.
    try {
      folder = (await folderReady()) || (await chooseFolder());
    } catch (err) {
      buttons.forEach((b) => (b.disabled = false));
      if (err.name !== 'AbortError') note(`Couldn’t open the folder (${err.message}). Saving to Downloads instead.`, true);
      if (err.name === 'AbortError') return;
      target = 'download';
    }
  }
  try {
    const out = await renderList(list);
    busy(list.length > 1 ? 'Packing' : 'Saving');
    const result = await deliver(out, target, folder);
    busy(null);
    const what = list.length > 1 ? `${list.length} photos` : `${out[0].savedAs || out[0].name} (${out[0].width} × ${out[0].height} px)`;
    if (result === 'downloaded') note(list.length > 1 ? `Saved ${list.length} photos as framed-photos.zip.` : `Saved ${what}.`);
    if (result === 'folder') note(`Saved ${what} to “${folder.label}”.`);
    if (result === 'album') note(`Saved ${what} to the “${ALBUM}” album in Photos.`);
    if (result === 'files') note(`Saved ${what} to Files → On My iPhone → ${ALBUM}.`);
    if (exportOpts.format === 'webp' && out.some((o) => o.format !== 'webp')) {
      note(out.some((o) => o.strips)
        ? 'Saved as JPEG: frames this large can only be saved as JPEG or PNG.'
        : 'Saved as PNG: this browser can’t create WebP files.');
    }
  } catch (err) {
    busy(null);
    console.error(err);
    note(err.message || 'Saving failed.', true);
  } finally {
    buttons.forEach((b) => (b.disabled = false));
    drawSaveControls();
  }
}
$('#forget-folder').onclick = async () => { await forgetFolder(); note('Forgot the folder. You’ll be asked again on your next save.'); drawSaveControls(); };
$('#change-folder').onclick = async () => {
  try { const f = await chooseFolder(); note(`Saves now go to “${f.label}”.`); } catch (err) { if (err.name !== 'AbortError') note(err.message, true); }
  drawSaveControls();
};
$('#save-one').onclick = () => photos[current] && save([photos[current]]);
$('#save-all').onclick = () => save(photos);

// ---------- Settings page ----------

/** Applies Settings to a photo's text: the date and time style, and your name as the default artist. */
function applyPrefs(photo) {
  const taken = new Date(photo.fields.taken || NaN);
  if (!isNaN(taken)) {
    if (!photo.edited.date) photo.fields.date = formatDate(taken, settings.dateFormat);
    if (!photo.edited.time) photo.fields.time = formatTime(taken, settings.timeFormat);
  }
  if (!photo.edited.artist && !photo.original.artist) photo.fields.artist = settings.artist;
}

const settingsSheet = $('#settings');
function openSettings() {
  drawSettings();
  settingsSheet.showModal();
}
$('#settings-btn').onclick = openSettings;
$('#settings-close').onclick = () => settingsSheet.close();
settingsSheet.addEventListener('click', (e) => { if (e.target === settingsSheet) settingsSheet.close(); }); // backdrop
settingsSheet.addEventListener('close', () => refreshAll());

function prefsChanged() {
  photos.forEach(applyPrefs);
  sample = null; // the template thumbnails' sample photo shows the date style too
  persist();
  drawSettings();
  drawPreview();
}

function drawSettings() {
  $('#pref-artist').value = settings.artist || '';
  $('#pref-show-artist').checked = settings.show.artist;
  chipGroup($('#pref-date'), Object.entries(DATE_FORMATS).map(([k, f]) => [k, f.label]), (v) => settings.dateFormat === v, (v) => { settings.dateFormat = v; prefsChanged(); });
  chipGroup($('#pref-time'), [['24', '24-hour · 17:42'], ['12', '12-hour · 5:42 PM']], (v) => settings.timeFormat === v, (v) => { settings.timeFormat = v; prefsChanged(); });
  chipGroup($('#pref-names'), Object.entries(FILE_NAMES), (v) => exportOpts.fileName === v, (v) => { exportOpts.fileName = v; persist(); drawSettings(); });
  $('#pref-show-location').checked = settings.show.location;
  $('#pref-show-place').checked = settings.show.place;
  $('#map-status').textContent = maps()
    ? 'Map data is on this device, so map frames work offline.'
    : 'Map frames download about 520 KB of map data the first time.';
  $('#map-download').hidden = !!maps();
  drawSaveControls(); // Save to and metadata live here too
}
$('#pref-artist').oninput = (e) => { settings.artist = e.target.value.trim(); photos.forEach(applyPrefs); persist(); drawPreview(); };
$('#pref-show-artist').onchange = (e) => { settings.show.artist = e.target.checked; prefsChanged(); };
$('#pref-show-location').onchange = (e) => { settings.show.location = e.target.checked; prefsChanged(); };
$('#pref-show-place').onchange = (e) => { settings.show.place = e.target.checked; prefsChanged(); };
$('#map-download').onclick = () => {
  $('#map-status').textContent = 'Downloading map data…';
  loadMaps().then(drawSettings, () => { $('#map-status').textContent = 'Couldn’t download the map data. Check your connection.'; });
};
$('#build').textContent = typeof __BUILD__ === 'string' ? `build ${__BUILD__}` : '(development build)';

let resetTimer;
$('#reset-all').onclick = async (e) => {
  const button = e.currentTarget;
  if (!button.classList.contains('armed')) {
    // Two taps, so a stray one can't wipe everything.
    button.classList.add('armed');
    button.textContent = 'Tap again: reset settings and clear added photos';
    resetTimer = setTimeout(() => { button.classList.remove('armed'); button.textContent = 'Reset all settings'; }, 4000);
    return;
  }
  clearTimeout(resetTimer);
  try { localStorage.removeItem('rebate:settings'); localStorage.removeItem('rebate:export'); } catch { /* private mode */ }
  await forgetFolder();
  location.reload();
};

// ---------- Magnifier ----------

// Tapping the preview opens it full screen, re-rendered sharper from the
// full-resolution photo, with pinch, double-tap and wheel zoom and panning.
// The page itself can't zoom (see styles.css), so this is the way to look closer.
const viewer = $('#viewer');
const viewerCanvas = $('#viewer-canvas');
const view = { s: 1, x: 0, y: 0, fitW: 0, fitH: 0, photo: null };
const MAX_ZOOM = 8;

canvas.addEventListener('click', () => photos[current] && openViewer(photos[current]));

function openViewer(photo) {
  view.photo = photo;
  // Show the preview at once, then swap in a sharper render.
  viewerCanvas.width = canvas.width;
  viewerCanvas.height = canvas.height;
  viewerCanvas.getContext('2d').drawImage(canvas, 0, 0);
  viewer.showModal();
  fitView();
  const hint = $('#viewer-hint');
  hint.classList.remove('gone');
  setTimeout(() => hint.classList.add('gone'), 2500);
  setTimeout(() => {
    if (view.photo !== photo || !viewer.open) return;
    const L = layout(photo.width, photo.height, settings, photo.fields);
    const limit = maxCanvasPixels() * 0.8;
    let k = Math.min(1, 4096 / Math.max(L.width, L.height));
    if (L.width * k * L.height * k > limit) k = Math.sqrt(limit / (L.width * L.height));
    const sharp = document.createElement('canvas');
    sharp.width = Math.round(L.width * k);
    sharp.height = Math.round(L.height * k);
    renderFrame(sharp.getContext('2d'), {
      img: photo.image, orientation: photo.orientation, blurImg: photo.preview,
      W: photo.width, H: photo.height, fields: photo.fields, settings, scale: k,
    });
    if (view.photo !== photo || !viewer.open) return;
    viewerCanvas.width = sharp.width;
    viewerCanvas.height = sharp.height;
    viewerCanvas.getContext('2d').drawImage(sharp, 0, 0);
    sharp.width = sharp.height = 1;
  }, 60);
}
function closeViewer() {
  viewer.close();
  view.photo = null;
  viewerCanvas.width = viewerCanvas.height = 1; // free the memory on phones
}
$('#viewer-close').onclick = closeViewer;
viewer.addEventListener('cancel', (e) => { e.preventDefault(); closeViewer(); }); // Esc
window.addEventListener('resize', () => viewer.open && fitView());

/** Sizes the image to fit the screen and resets zoom. */
function fitView() {
  const vw = viewer.clientWidth;
  const vh = viewer.clientHeight;
  const r = viewerCanvas.width / viewerCanvas.height;
  view.fitW = Math.min(vw - 24, (vh - 24) * r);
  view.fitH = view.fitW / r;
  viewerCanvas.style.width = `${view.fitW}px`;
  viewerCanvas.style.height = `${view.fitH}px`;
  setView(1, (vw - view.fitW) / 2, (vh - view.fitH) / 2);
}
function setView(s, x, y, settle = false) {
  view.s = s; view.x = x; view.y = y;
  viewer.classList.toggle('settling', settle);
  viewerCanvas.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
  viewerCanvas.style.opacity = '';
}
/** Keeps the zoomed image covering the screen (or centred when smaller). */
function clampView(s, x, y) {
  const vw = viewer.clientWidth;
  const vh = viewer.clientHeight;
  s = Math.min(MAX_ZOOM, Math.max(1, s));
  const w = view.fitW * s;
  const h = view.fitH * s;
  x = w <= vw ? (vw - w) / 2 : Math.min(0, Math.max(vw - w, x));
  y = h <= vh ? (vh - h) / 2 : Math.min(0, Math.max(vh - h, y));
  return [s, x, y];
}
/** Zooms by `factor` around the screen point (px, py). */
function zoomAt(factor, px, py, settle) {
  const s = Math.min(MAX_ZOOM, Math.max(1, view.s * factor));
  const k = s / view.s;
  setView(...clampView(s, px - (px - view.x) * k, py - (py - view.y) * k), settle);
}

const pointers = new Map();
let gesture = null;
let lastTap = { t: 0, x: 0, y: 0 };
viewer.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button')) return;
  try { viewer.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const pts = [...pointers.values()];
  const mid = pts.length === 2 ? { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 } : pts[0];
  gesture = {
    s: view.s, x: view.x, y: view.y, mid, t: Date.now(), moved: false, pinch: pts.length === 2,
    dist: pts.length === 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0,
  };
});
viewer.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId) || !gesture) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const pts = [...pointers.values()];
  if (pts.length === 2) {
    const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    const s = Math.min(MAX_ZOOM, Math.max(0.6, gesture.s * Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) / gesture.dist));
    const k = s / gesture.s;
    // The point under the fingers' midpoint stays under it.
    setView(s, mid.x - (gesture.mid.x - gesture.x) * k, mid.y - (gesture.mid.y - gesture.y) * k);
    gesture.moved = true;
    return;
  }
  if (gesture.pinch) return; // one finger lifted mid-pinch: wait for the other
  const dx = pts[0].x - gesture.mid.x;
  const dy = pts[0].y - gesture.mid.y;
  if (Math.hypot(dx, dy) > 6) gesture.moved = true;
  if (gesture.s > 1.01) {
    setView(gesture.s, gesture.x + dx, gesture.y + dy);
  } else if (gesture.moved) {
    // Not zoomed: drag down to close.
    setView(1, gesture.x, gesture.y + Math.max(0, dy));
    viewerCanvas.style.opacity = String(Math.max(0.3, 1 - Math.max(0, dy) / 400));
  }
});
function endPointer(e) {
  if (!pointers.has(e.pointerId)) return;
  const was = pointers.get(e.pointerId);
  pointers.delete(e.pointerId);
  if (pointers.size || !gesture) {
    if (pointers.size === 1) {
      // Pinch became a one-finger pan: restart from here.
      const p = [...pointers.values()][0];
      gesture = { s: view.s, x: view.x, y: view.y, mid: p, t: Date.now(), moved: true, pinch: false };
    }
    return;
  }
  const g = gesture;
  gesture = null;
  if (!g.moved && Date.now() - g.t < 300) {
    const now = Date.now();
    if (now - lastTap.t < 320 && Math.hypot(was.x - lastTap.x, was.y - lastTap.y) < 30) {
      // Double tap: zoom in to 3× where tapped, or back out.
      lastTap.t = 0;
      if (view.s > 1.01) setView(...clampView(1, 0, 0), true);
      else zoomAt(3, was.x, was.y, true);
      return;
    }
    lastTap = { t: now, x: was.x, y: was.y };
    // A single tap beside the image closes the viewer.
    const r = viewerCanvas.getBoundingClientRect();
    if (was.x < r.left || was.x > r.right || was.y < r.top || was.y > r.bottom) closeViewer();
    return;
  }
  if (g.s <= 1.01 && view.y - g.y > 120) { closeViewer(); return; }
  setView(...clampView(view.s, view.x, view.y), true);
}
viewer.addEventListener('pointerup', endPointer);
viewer.addEventListener('pointercancel', endPointer);
viewer.addEventListener('wheel', (e) => {
  e.preventDefault();
  zoomAt(Math.exp(-e.deltaY * 0.0025), e.clientX, e.clientY);
}, { passive: false });

// ---------- Share ----------

// Top-right button: shares the framed photo (at the Save tab's format and
// size) through the system share sheet, or a link to Rebate when no photo is open.
const shareBtn = $('#share-btn');
shareBtn.hidden = !canShare();
shareBtn.onclick = async () => {
  shareBtn.disabled = true;
  try {
    const photo = photos[current];
    const files = photo ? await renderList([photo]) : [];
    busy(null);
    const extra = photo ? { title: files[0].name } : { title: 'Rebate', text: 'Frame your photos with their camera settings.', url: SITE_URL };
    const result = await shareFiles(files, extra);
    if (result === 'unsupported') note('This browser can’t share images. Use Save instead.', true);
    if (result === 'needs-tap') {
      // The render took long enough that the browser no longer counts the tap: ask for one more.
      const go = el('button', { className: 'link', type: 'button', textContent: 'Tap to share' });
      go.onclick = () => { note(null); shareFiles(files, extra).catch((err) => note(err.message, true)); };
      note('Your photo is ready.');
      clearTimeout(noteTimer);
      noteTimer = setTimeout(() => ($('#note').hidden = true), 20000);
      $('#note').append(' ', go);
    }
  } catch (err) {
    busy(null);
    console.error(err);
    note(err.message || 'Sharing failed.', true);
  } finally {
    shareBtn.disabled = false;
  }
};

// ---------- Refresh ----------

function changed({ controls = true } = {}) {
  persist();
  drawPreview();
  if (controls) { drawLayoutControls(); drawTemplatesLater(); }
}
function refreshAll() {
  drawFilmstrip();
  drawFields();
  drawLayoutControls();
  drawSaveControls();
  drawTemplates();
  drawPreview();
}

// Template default faces are needed for the template thumbnails at once;
// other typefaces load on demand (see ensureFont).
Promise.allSettled([...new Set(Object.values(TEMPLATES).flatMap((t) => [t.font, ...(t.fonts || [])]))].map((k) => ensureFont(k))).then(refreshAll);
refreshAll();

if ('serviceWorker' in navigator && import.meta.env.PROD && !Capacitor.isNativePlatform()) {
  // Relative URL so the app also works from a subpath (GitHub Pages).
  navigator.serviceWorker.register('sw.js').catch(() => {});
  // On hosts that can't send isolation headers (GitHub Pages) the service
  // worker adds them; reload once when it first takes over, before any work.
  if (!crossOriginIsolated && !navigator.serviceWorker.controller) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (photos.length === 0 && !sessionStorage.getItem('rebate:isolated-reload')) {
        sessionStorage.setItem('rebate:isolated-reload', '1');
        location.reload();
      }
    });
  }
}
