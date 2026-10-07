// Frame renderer. Every measurement is derived from the photo's short edge (S),
// so the live preview and the full-resolution export are pixel-for-pixel alike.

export const FONTS = {
  inter: { family: 'Inter', label: 'Inter', regular: 400, bold: 700 },
  barlow: { family: 'Barlow Condensed', label: 'Barlow Condensed', regular: 500, bold: 700 },
  fraunces: { family: 'Fraunces', label: 'Fraunces', regular: 400, bold: 600, italic: true },
  mono: { family: 'JetBrains Mono', label: 'JetBrains Mono', regular: 400, bold: 600 },
};

export const TEMPLATES = {
  strip: { label: 'Strip', font: 'inter', background: '#ffffff' },
  polaroid: { label: 'Instant', font: 'fraunces', background: '#f6f5f1' },
  gallery: { label: 'Gallery mat', font: 'inter', background: '#ffffff' },
  backdrop: { label: 'Backdrop', font: 'inter', background: 'blur' },
  viewfinder: { label: 'Viewfinder', font: 'barlow', background: '#000000' },
  film: { label: 'Film rebate', font: 'mono', background: '#000000' },
};

// Presets are stored short:long; orientation decides which way round they go.
export const RATIOS = {
  auto: { label: 'Original' },
  '1:1': { label: '1:1', r: [1, 1] },
  '4:5': { label: '4:5', r: [4, 5] },
  '3:4': { label: '3:4', r: [3, 4] },
  '2:3': { label: '2:3', r: [2, 3] },
  '5:7': { label: '5:7', r: [5, 7] },
  '9:16': { label: '9:16', r: [9, 16] },
  a4: { label: 'A4', r: [1, Math.SQRT2] },
  custom: { label: 'Custom' },
};

export const DEFAULT_SETTINGS = {
  template: 'strip',
  ratio: 'auto',
  orient: 'auto',        // 'auto' follows the photo; 'portrait' | 'landscape' force it
  custom: [4, 5],        // free ratio, width:height as typed
  border: 1,
  radius: 0,
  background: 'template',
  font: 'template',
  focal35: false,        // show the 35mm-equivalent focal length
  show: {
    make: true, model: true, lens: true, focal: true, aperture: true, shutter: true,
    iso: true, date: true, location: false, artist: false, caption: true,
  },
};

/**
 * Canvas width/height ratio for content of size cw×ch, or null to keep the
 * content's own shape. The frame is only ever extended, never cropped.
 */
export function targetRatio(settings, cw, ch) {
  const landscape = cw >= ch;
  const wantLandscape = settings.orient === 'auto' ? landscape : settings.orient === 'landscape';
  if (settings.ratio === 'auto' || !RATIOS[settings.ratio]) {
    return wantLandscape === landscape ? null : ch / cw;
  }
  if (settings.ratio === 'custom') {
    let [w, h] = settings.custom;
    if (!(w > 0 && h > 0)) return null;
    if (settings.orient !== 'auto' && wantLandscape !== w >= h) [w, h] = [h, w];
    return w / h;
  }
  const [a, b] = RATIOS[settings.ratio].r;
  return wantLandscape ? b / a : a / b;
}

/** Ratio chip label as it will actually apply (4:5 reads 5:4 when horizontal). */
export function ratioLabel(key, settings, cw, ch) {
  const def = RATIOS[key];
  if (!def.r || def.r[0] === def.r[1] || key === 'a4') return def.label;
  const wantLandscape = settings.orient === 'auto' ? cw >= ch : settings.orient === 'landscape';
  return wantLandscape ? `${def.r[1]}:${def.r[0]}` : def.label;
}

const FILM_AMBER = '#f39a2c';

// ---------- Text composition ----------

function compose(fields, show, focal35) {
  const pick = (k) => (show[k] && fields[k] ? fields[k] : '');
  const join = (parts, sep = '  ') => parts.filter(Boolean).join(sep);
  return {
    make: pick('make'),
    model: pick('model'),
    camera: join([pick('make'), pick('model')], ' '),
    lens: pick('lens'),
    exposure: join([show.focal ? (focal35 && fields.focal35) || fields.focal || '' : '', pick('aperture'), pick('shutter'), pick('iso')]),
    when: join([pick('date'), pick('location')], '   '),
    artist: pick('artist') ? `© ${fields.artist}` : '',
    caption: pick('caption'),
    date: pick('date'),
  };
}

// ---------- Layout ----------

/** Computes canvas size and the photo rectangle at full resolution. */
export function layout(W, H, settings) {
  const S = Math.min(W, H);
  const b = settings.border;
  let pad;
  switch (settings.template) {
    case 'strip': {
      const m = S * 0.025 * b;
      pad = { top: m, left: m, right: m, bottom: m + S * 0.12 };
      break;
    }
    case 'polaroid': {
      const m = S * 0.055 * b;
      pad = { top: m, left: m, right: m, bottom: Math.max(m * 2, S * 0.24) };
      break;
    }
    case 'gallery': {
      const m = S * 0.1 * b;
      pad = { top: m, left: m, right: m, bottom: m + S * 0.07 };
      break;
    }
    case 'backdrop': {
      const m = S * 0.08 * b;
      pad = { top: m, left: m, right: m, bottom: m + S * 0.13 };
      break;
    }
    case 'viewfinder': {
      const m = S * 0.03 * b;
      pad = { top: m, left: m, right: m, bottom: m };
      break;
    }
    case 'film': {
      const m = S * 0.05 * b;
      pad = { top: m, left: m, right: m, bottom: m + S * 0.08 };
      break;
    }
    default:
      pad = { top: 0, left: 0, right: 0, bottom: 0 };
  }
  let width = W + pad.left + pad.right;
  let height = H + pad.top + pad.bottom;
  let ox = 0;
  let oy = 0;
  const r = targetRatio(settings, width, height);
  if (r) {
    if (width / height < r) { const nw = height * r; ox = (nw - width) / 2; width = nw; }
    else { const nh = width / r; oy = (nh - height) / 2; height = nh; }
  }
  return {
    S,
    width: Math.round(width),
    height: Math.round(height),
    photo: { x: ox + pad.left, y: oy + pad.top, w: W, h: H },
    content: { x: ox, y: oy, w: W + pad.left + pad.right, h: H + pad.top + pad.bottom },
  };
}

// ---------- Drawing ----------

/**
 * Draws a framed photo.
 * @param ctx      2D context sized to layout × scale
 * @param img      drawable image (may be a downscaled preview)
 * @param W,H      full-resolution photo size
 * @param fields   editable EXIF text fields
 * @param settings frame settings
 * @param scale    output pixels per full-resolution pixel
 * @param orientation EXIF orientation still to apply to img (1 = upright)
 * @param blurImg  small upright copy used for the blurred backdrop
 * @param offsetX/Y top-left of this tile in output pixels (strip rendering)
 */
export function renderFrame(ctx, { img, orientation = 1, blurImg, W, H, fields, settings, scale = 1, offsetX = 0, offsetY = 0 }) {
  const L = layout(W, H, settings);
  const tpl = TEMPLATES[settings.template];
  const font = FONTS[settings.font === 'template' ? tpl.font : settings.font];
  const bg = settings.background === 'template' ? tpl.background : settings.background;
  const t = compose(fields, settings.show, settings.focal35);
  const { S, photo } = L;
  const radius = settings.radius * S * 0.05;

  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, -offsetX, -offsetY);
  ctx.textBaseline = 'alphabetic';

  // Background
  if (bg === 'blur') drawBlurBackground(ctx, blurImg || img, L.width, L.height);
  else { ctx.fillStyle = bg; ctx.fillRect(0, 0, L.width, L.height); }

  const ink = bg === 'blur' ? palette('#000000') : palette(bg);

  // Photo
  ctx.save();
  if (settings.template === 'backdrop') {
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = S * 0.035 * scale;
    ctx.shadowOffsetY = S * 0.012 * scale;
    ctx.fillStyle = '#000';
    roundRect(ctx, photo.x, photo.y, photo.w, photo.h, radius);
    ctx.fill();
    ctx.shadowColor = 'transparent';
  }
  roundRect(ctx, photo.x, photo.y, photo.w, photo.h, radius);
  ctx.clip();
  ctx.imageSmoothingQuality = 'high';
  drawOriented(ctx, img, orientation, photo.x, photo.y, photo.w, photo.h);
  ctx.restore();

  const draw = { ctx, font, ink, S, L, t, scale };
  ({
    strip: drawStrip,
    polaroid: drawPolaroid,
    gallery: drawGallery,
    backdrop: drawBackdrop,
    viewfinder: drawViewfinder,
    film: drawFilm,
  })[settings.template](draw);

  ctx.restore();
  return L;
}

function drawStrip({ ctx, font, ink, S, L, t }) {
  const { photo } = L;
  const barTop = photo.y + photo.h;
  const barH = S * 0.12; // bar height is independent of the border
  const inset = Math.max(S * 0.035, photo.x - L.content.x + S * 0.01);
  const left = L.content.x + inset;
  const right = L.content.x + L.content.w - inset;
  const big = barH * 0.2;
  const small = barH * 0.15;
  const l1 = barTop + barH * 0.47;
  const l2 = barTop + barH * 0.47 + small * 1.55;
  const half = (right - left) / 2;

  // Left: camera model over lens
  const model = t.model || t.make;
  const sub = t.lens || t.caption;
  text(ctx, model, left, sub ? l1 : (l1 + l2) / 2 - small * 0.3, { font, size: big, weight: 'bold', color: ink.primary, maxWidth: half * 0.95 });
  text(ctx, sub, left, model ? l2 : l1, { font, size: small, color: ink.muted, maxWidth: half * 0.95 });

  // Right: exposure over date, preceded by the make as a wordmark
  const second = [t.when, t.artist].filter(Boolean).join('   ');
  const rightTop = second ? l1 : (l1 + l2) / 2 - small * 0.3;
  const w1 = text(ctx, t.exposure, right, rightTop, { font, size: big, weight: 'bold', color: ink.primary, align: 'right', maxWidth: half * 0.72 });
  const w2 = text(ctx, second, right, t.exposure ? l2 : l1, { font, size: small, color: ink.muted, align: 'right', maxWidth: half * 0.72 });
  const blockW = Math.max(w1, w2);
  if (t.make && t.model) {
    const gap = S * 0.018;
    let x = right;
    if (blockW > 0) {
      x = right - blockW - gap;
      ctx.fillStyle = ink.rule;
      ctx.fillRect(x, barTop + barH * 0.27, Math.max(1, S * 0.0018), barH * 0.46);
      x -= gap;
    }
    text(ctx, t.make, x, barTop + barH * 0.5 + big * 0.42, { font, size: big * 1.25, weight: 'bold', color: ink.primary, align: 'right', maxWidth: half * 0.5 });
  }
}

function drawPolaroid({ ctx, font, ink, S, L, t }) {
  const { photo } = L;
  const cx = photo.x + photo.w / 2;
  const top = photo.y + photo.h;
  const area = L.content.y + L.content.h - top;
  const headline = t.caption || t.camera;
  const lines = [
    headline && { s: headline, size: S * 0.05, weight: 'regular', italic: font.italic, color: ink.primary },
    t.exposure && { s: t.exposure, size: S * 0.026, weight: 'regular', color: ink.muted },
    (t.caption ? [t.camera, t.lens] : [t.lens]).filter(Boolean).join('  ') && { s: (t.caption ? [t.camera, t.lens] : [t.lens]).filter(Boolean).join('   '), size: S * 0.022, color: ink.muted },
    [t.when, t.artist].filter(Boolean).join('   ') && { s: [t.when, t.artist].filter(Boolean).join('   '), size: S * 0.022, color: ink.muted },
  ].filter(Boolean);
  stackCentered(ctx, lines, cx, top + area / 2, photo.w * 0.92, font);
}

function drawGallery({ ctx, font, ink, S, L, t }) {
  const { photo } = L;
  const cx = photo.x + photo.w / 2;
  const top = photo.y + photo.h;
  const area = L.content.y + L.content.h - top;
  const lines = [
    t.caption && { s: t.caption, size: S * 0.03, weight: 'bold', color: ink.primary },
    [t.camera, t.lens].filter(Boolean).join('   ') && { s: [t.camera, t.lens].filter(Boolean).join('   '), size: S * 0.021, weight: t.caption ? 'regular' : 'bold', color: t.caption ? ink.muted : ink.primary },
    t.exposure && { s: t.exposure, size: S * 0.019, color: ink.muted },
    [t.when, t.artist].filter(Boolean).join('   ') && { s: [t.when, t.artist].filter(Boolean).join('   '), size: S * 0.017, color: ink.muted },
  ].filter(Boolean);
  stackCentered(ctx, lines, cx, top + area * 0.45, photo.w, font);
}

function drawBackdrop({ ctx, font, S, L, t }) {
  const { photo } = L;
  const cx = photo.x + photo.w / 2;
  const top = photo.y + photo.h;
  const area = L.content.y + L.content.h - top;
  const lines = [
    (t.caption || t.camera) && { s: t.caption || t.camera, size: S * 0.034, weight: 'bold', color: '#ffffff' },
    (t.caption ? [t.camera, t.lens] : [t.lens]).filter(Boolean).join('   ') && { s: (t.caption ? [t.camera, t.lens] : [t.lens]).filter(Boolean).join('   '), size: S * 0.022, color: 'rgba(255,255,255,0.78)' },
    t.exposure && { s: t.exposure, size: S * 0.024, weight: 'bold', color: 'rgba(255,255,255,0.92)' },
    [t.when, t.artist].filter(Boolean).join('   ') && { s: [t.when, t.artist].filter(Boolean).join('   '), size: S * 0.02, color: 'rgba(255,255,255,0.66)' },
  ].filter(Boolean);
  stackCentered(ctx, lines, cx, top + area * 0.52, photo.w, font);
}

function drawViewfinder({ ctx, font, S, L, t, scale }) {
  const { photo } = L;
  const grad = ctx.createLinearGradient(0, photo.y + photo.h * 0.62, 0, photo.y + photo.h);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.62)');
  ctx.fillStyle = grad;
  ctx.fillRect(photo.x, photo.y + photo.h * 0.62, photo.w, photo.h * 0.38);

  const m = S * 0.05;
  const left = photo.x + m;
  const right = photo.x + photo.w - m;
  const base = photo.y + photo.h - m;
  const size = S * 0.045;
  const sub = S * 0.024;
  const exposure = t.exposure.replace(/  /g, '   ');
  const below = [t.camera, t.lens].filter(Boolean).join('   ');
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = S * 0.006 * scale;
  const top = below ? base - sub * 1.6 : base;
  text(ctx, exposure || t.caption, left, top, { font, size, weight: 'bold', color: '#ffffff', maxWidth: photo.w * 0.62 });
  text(ctx, below, left, base, { font, size: sub, color: 'rgba(255,255,255,0.82)', maxWidth: photo.w * 0.62 });
  const rightLines = [t.when, t.artist, exposure ? t.caption : ''].filter(Boolean);
  rightLines.reverse().forEach((s, i) => {
    text(ctx, s, right, base - i * sub * 1.6, { font, size: sub, color: 'rgba(255,255,255,0.82)', align: 'right', maxWidth: photo.w * 0.34 });
  });
  ctx.restore();
}

function drawFilm({ ctx, font, S, L, t, scale }) {
  const { photo } = L;
  // Date imprint in the photo corner, like a 90s compact camera back.
  if (t.date) {
    const d = t.date.match(/^(\d{4})\.(\d{2})\.(\d{2})/);
    const stamp = d ? `'${d[1].slice(2)} ${d[2]} ${d[3]}` : t.date;
    ctx.save();
    ctx.shadowColor = 'rgba(255,120,20,0.85)';
    ctx.shadowBlur = S * 0.012 * scale;
    text(ctx, stamp, photo.x + photo.w - S * 0.05, photo.y + photo.h - S * 0.045, {
      font: FONTS.mono, size: S * 0.042, weight: 'bold', color: '#ffb347', align: 'right',
    });
    ctx.restore();
  }
  const barTop = photo.y + photo.h;
  const barH = L.content.y + L.content.h - barTop;
  const base = barTop + barH * 0.5 + S * 0.008;
  const size = S * 0.022;
  const left = photo.x;
  const right = photo.x + photo.w;
  const lhs = [t.caption, t.camera, t.lens].filter(Boolean).join('   ').toUpperCase();
  const rhs = [t.exposure.toUpperCase(), t.artist].filter(Boolean).join('   ');
  const w = text(ctx, rhs, right, base, { font, size, weight: 'bold', color: FILM_AMBER, align: 'right', maxWidth: photo.w * 0.48 });
  text(ctx, lhs, left, base, { font, size, color: FILM_AMBER, maxWidth: photo.w - w - S * 0.04 });
  // Sprocket-ish frame counter marks along the top rebate.
  const topY = L.content.y + (photo.y - L.content.y) * 0.62;
  if (photo.y - L.content.y > size * 1.4) {
    text(ctx, '▸ 1', left, topY, { font, size: size * 0.9, color: FILM_AMBER });
    text(ctx, '1A', right, topY, { font, size: size * 0.9, color: FILM_AMBER, align: 'right' });
  }
}

// ---------- Helpers ----------

function stackCentered(ctx, lines, cx, cy, maxWidth, font) {
  const heights = lines.map((l) => l.size * 1.55);
  let y = cy - heights.reduce((a, b) => a + b, 0) / 2;
  lines.forEach((l, i) => {
    y += heights[i];
    text(ctx, l.s, cx, y - heights[i] * 0.3, { font, size: l.size, weight: l.weight, italic: l.italic, color: l.color, align: 'center', maxWidth });
  });
}

/** Draws text, shrinking it to fit maxWidth. Returns the drawn width. */
function text(ctx, s, x, y, { font, size, weight = 'regular', italic = false, color, align = 'left', maxWidth = Infinity }) {
  if (!s) return 0;
  const w = weight === 'bold' ? font.bold : font.regular;
  let px = size;
  const spec = (p) => `${italic ? 'italic ' : ''}${w} ${p}px "${font.family}", system-ui, sans-serif`;
  ctx.font = spec(px);
  let width = ctx.measureText(s).width;
  if (width > maxWidth) {
    px = Math.max(size * 0.55, px * (maxWidth / width));
    ctx.font = spec(px);
    width = ctx.measureText(s).width;
  }
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(s, x, y);
  return width;
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  if (r <= 0) { ctx.rect(x, y, w, h); return; }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Draws img into the box (x, y, w, h) — the box is in upright orientation —
 * applying an EXIF orientation on the fly so no rotated copy is ever made.
 */
export function drawOriented(ctx, img, o, x, y, w, h) {
  if (!o || o === 1) { ctx.drawImage(img, x, y, w, h); return; }
  const swap = o >= 5;
  ctx.save();
  ctx.translate(x, y);
  const m = {
    2: [-1, 0, 0, 1, w, 0], 3: [-1, 0, 0, -1, w, h], 4: [1, 0, 0, -1, 0, h],
    5: [0, 1, 1, 0, 0, 0], 6: [0, 1, -1, 0, w, 0], 7: [0, -1, -1, 0, w, h], 8: [0, -1, 1, 0, 0, h],
  }[o];
  ctx.transform(...m);
  ctx.drawImage(img, 0, 0, swap ? h : w, swap ? w : h);
  ctx.restore();
}

// Soft blur by repeated downscaling; works in every browser, unlike ctx.filter.
// Cached because strip rendering draws the backdrop once per tile.
const blurCache = new WeakMap();
function blurredCopy(img, width, height) {
  const key = `${Math.round(width)}x${Math.round(height)}`;
  const hit = blurCache.get(img);
  if (hit?.key === key) return hit.canvas;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const tiny = document.createElement('canvas');
  const k = 28 / Math.max(width, height);
  tiny.width = Math.max(2, Math.round(width * k));
  tiny.height = Math.max(2, Math.round(height * k));
  const tc = tiny.getContext('2d');
  const cover = Math.max(tiny.width / iw, tiny.height / ih) * 1.15;
  tc.imageSmoothingQuality = 'high';
  tc.drawImage(img, (tiny.width - iw * cover) / 2, (tiny.height - ih * cover) / 2, iw * cover, ih * cover);
  const mid = document.createElement('canvas');
  mid.width = tiny.width * 3;
  mid.height = tiny.height * 3;
  const mc = mid.getContext('2d');
  mc.imageSmoothingQuality = 'high';
  mc.drawImage(tiny, 0, 0, mid.width, mid.height);
  blurCache.set(img, { key, canvas: mid });
  return mid;
}

function drawBlurBackground(ctx, img, width, height) {
  ctx.save();
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(blurredCopy(img, width, height), 0, 0, width, height);
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function palette(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const light = 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.32;
  return light
    ? { primary: '#141414', muted: '#6e6e6e', rule: '#c9c9c9' }
    : { primary: '#f3f3f1', muted: '#a3a3a0', rule: '#555555' };
}
