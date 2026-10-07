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
import './styles.css';

import { Capacitor } from '@capacitor/core';
import { ACCEPT, decodeFile, makePreview } from './decode.js';
import { DEFAULT_SETTINGS, FONTS, RATIOS, TEMPLATES, layout, ratioLabel, renderFrame } from './render.js';
import { FORMATS, deliver, exportPhoto, maxCanvasPixels, needsStrips, outputSize } from './export.js';

const $ = (sel) => document.querySelector(sel);
const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};

// ---------- State ----------

const FIELD_ROWS = [
  ['make', 'Brand'], ['model', 'Camera'], ['lens', 'Lens'], ['focal', 'Focal length'],
  ['aperture', 'Aperture'], ['shutter', 'Shutter'], ['iso', 'ISO'], ['date', 'Date'],
  ['location', 'Location'], ['artist', 'Artist'], ['caption', 'Caption'],
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
const exportOpts = { format: 'jpeg', quality: 0.92, size: 'full', keepExif: true, ...load('rebate:export', {}) };
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
      const preview = makePreview(d.image, 2000, d.orientation);
      photos.push({
        id: crypto.randomUUID?.() || String(Math.random()),
        name: file.name,
        ...d,
        preview,
        thumb: makePreview(preview, 320),
        original: { ...d.fields },
      });
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
    const L = layout(photo.width, photo.height, settings);
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
  };
});

// ---------- Frame tab ----------

let templateTimer;
function drawTemplates() {
  clearTimeout(templateTimer);
  templateTimer = setTimeout(() => {
    const photo = photos[current];
    const sample = photo || samplePhoto();
    $('#templates').replaceChildren(
      ...Object.entries(TEMPLATES).map(([key, tpl]) => {
        const s = { ...settings, template: key, ratio: 'auto', background: 'template', font: 'template' };
        const L = layout(sample.width, sample.height, s);
        const k = 240 / Math.max(L.width, L.height);
        const c = el('canvas');
        c.width = Math.round(L.width * k);
        c.height = Math.round(L.height * k);
        renderFrame(c.getContext('2d'), { img: sample.thumb, W: sample.width, H: sample.height, fields: sample.fields, settings: s, scale: k });
        const b = el('button', { className: 'template af', type: 'button' }, el('div', { className: 'template-art' }, c), el('span', { textContent: tpl.label }));
        b.setAttribute('aria-pressed', String(settings.template === key));
        b.onclick = () => { settings.template = key; changed(); };
        return b;
      }),
    );
  }, 60);
}

let sample;
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
    fields: { make: 'SONY', model: 'α7 IV', lens: 'FE 35mm F1.4 GM', focal: '35mm', focal35: '35mm', aperture: 'f/1.4', shutter: '1/500s', iso: 'ISO100', date: '2026.10.07 17:42', location: '', artist: '', caption: '' },
  };
  return sample;
}

// ---------- Details tab ----------

function drawFields() {
  const photo = photos[current];
  $('#details-hint').textContent = photo
    ? 'Turn a line off to leave it out of the frame. Text edits apply to the selected photo.'
    : 'Add a photo to edit its details.';
  const rows = FIELD_ROWS.map(([key, label]) => {
    // The focal length row edits whichever value is shown: actual or 35mm equivalent.
    const prop = key === 'focal' && settings.focal35 && photo?.fields.focal35 ? 'focal35' : key;
    const id = `f-${key}`;
    const check = el('input', { type: 'checkbox', className: 'check', checked: settings.show[key], title: `Show ${label.toLowerCase()}` });
    check.setAttribute('aria-label', `Show ${label.toLowerCase()}`);
    const input = el('input', {
      type: 'text', id, value: photo?.fields[prop] || '', disabled: !photo, autocomplete: 'off',
      placeholder: key === 'caption' ? 'Add a caption' : key === 'artist' ? 'Your name' : photo ? 'Not in EXIF' : '',
    });
    input.spellcheck = false;
    check.onchange = () => { settings.show[key] = check.checked; changed(); };
    input.oninput = () => { photo.fields[prop] = input.value; drawPreview(); drawTemplatesLater(); };
    const row = el('div', { className: 'field' }, check, el('label', { htmlFor: id, textContent: prop === 'focal35' ? 'Focal (35mm)' : label }), input);
    if (key !== 'focal') return row;

    const toggle = el('input', { type: 'checkbox', id: 'focal35', checked: settings.focal35 });
    toggle.onchange = () => { settings.focal35 = toggle.checked; changed(); drawFields(); };
    const missing = settings.focal35 && photo && !photo.fields.focal35;
    const actual = photo?.original.focal;
    const eq = photo?.original.focal35;
    const detail = missing
      ? 'This photo has no 35mm-equivalent value, so the actual focal length is shown.'
      : actual && eq && actual !== eq ? `${actual} on this camera equals ${eq} on full frame.`
      : 'Shows the focal length as it would be on a full-frame (35mm) camera.';
    return [row, el('label', { className: 'toggle focal35' }, toggle, el('span', {}, 'Use 35mm-equivalent focal length', el('small', { textContent: detail })))];
  });
  $('#fields').replaceChildren(...rows.flat());
}
const drawTemplatesLater = () => { if (!$('[data-body="frame"]').hidden) drawTemplates(); };

$('#reset-fields').onclick = () => {
  const photo = photos[current];
  if (!photo) return;
  photo.fields = { ...photo.original, artist: photo.fields.artist, caption: photo.fields.caption };
  drawFields(); drawPreview();
};
$('#copy-fields').onclick = () => {
  const photo = photos[current];
  if (!photo) return;
  photos.forEach((p) => { p.fields.artist = photo.fields.artist; p.fields.caption = photo.fields.caption; });
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
  const L0 = layout(photo.width, photo.height, { ...settings, ratio: 'auto', orient: 'auto' });
  chipGroup($('#orients'), [['auto', 'Match photo'], ['portrait', 'Vertical'], ['landscape', 'Horizontal']],
    (v) => settings.orient === v, (v) => { settings.orient = v; changed(); });
  chipGroup($('#ratios'), Object.keys(RATIOS).map((k) => [k, ratioLabel(k, settings, L0.content.w, L0.content.h)]),
    (v) => settings.ratio === v, (v) => { settings.ratio = v; changed(); });
  $('#custom-ratio').hidden = settings.ratio !== 'custom';
  $('#custom-w').value = settings.custom[0];
  $('#custom-h').value = settings.custom[1];
  const L = layout(photo.width, photo.height, settings);
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

  const tplFont = FONTS[TEMPLATES[settings.template].font];
  $('#fonts').replaceChildren(
    ...[['template', `Template default`, tplFont], ...Object.entries(FONTS).map(([k, f]) => [k, f.label, f])].map(([key, label, f]) => {
      const b = el('button', { className: 'font-opt af', type: 'button' },
        el('b', { textContent: '1/250s f/2.8', style: `font-family:"${f.family}";${f.italic && key === 'fraunces' ? 'font-style:italic;' : ''}` }),
        el('small', { textContent: key === 'template' ? `${label} (${f.label})` : label }));
      b.setAttribute('aria-pressed', String(settings.font === key));
      b.onclick = () => { settings.font = key; changed(); };
      return b;
    }),
  );
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
    const L = layout(photo.width, photo.height, settings);
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

async function save(list) {
  const buttons = [$('#save-one'), $('#save-all')];
  buttons.forEach((b) => (b.disabled = true));
  try {
    canvasLimitKnown = maxCanvasPixels();
    const out = [];
    for (const [i, photo] of list.entries()) {
      const label = `Rendering ${photo.name}${list.length > 1 ? ` (${i + 1} of ${list.length})` : ''}`;
      busy(label);
      await new Promise((r) => setTimeout(r, 30)); // let the status paint
      out.push(await exportPhoto(photo, settings, exportOpts, (p) => busy(`${label} ${Math.round(p * 100)}%`)));
    }
    busy(list.length > 1 ? 'Packing' : 'Saving');
    const result = await deliver(out);
    busy(null);
    if (result === 'downloaded') note(list.length > 1 ? `Saved ${list.length} photos as framed-photos.zip.` : `Saved ${out[0].name} (${out[0].width} × ${out[0].height} px).`);
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
$('#save-one').onclick = () => photos[current] && save([photos[current]]);
$('#save-all').onclick = () => save(photos);

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

// Canvas text needs the faces loaded before the first draw.
const faces = Object.values(FONTS).flatMap((f) => [`${f.regular} 20px "${f.family}"`, `${f.bold} 20px "${f.family}"`])
  .concat(['italic 400 20px "Fraunces"']);
Promise.allSettled(faces.map((f) => document.fonts.load(f, 'Aa1/α'))).then(refreshAll);
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
