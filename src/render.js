import { LOGOS } from './logos.js';
import { cameraLogo, lensLogo } from './brands.js';
import { compassPoint, coordsOf, fieldOfView, formatDms, headingOf, maps, placeOf } from './map.js';

// Frame renderer. Every measurement is derived from the photo's short edge (S),
// so the live preview and the full-resolution export are pixel-for-pixel alike.

// `stack` adds fallbacks for what a face lacks (canvas falls back per glyph):
// α for Sony model names, and Hangul from a Korean face of the same style.
// `scale` evens out x-heights (Caveat's is tiny); it applies relative to the
// frame's own default face, so each frame keeps its tuned look.
const KR_SANS = '"IBM Plex Sans KR"';
const KR_SERIF = '"Gowun Batang"';
const KR_MONO = '"Nanum Gothic Coding"';
const KR_HAND = '"Nanum Pen Script"';
export const FONTS = {
  inter: { group: 'sans', family: 'Inter', label: 'Inter', regular: 400, bold: 700, stack: KR_SANS },
  manrope: { group: 'sans', family: 'Manrope', label: 'Manrope', regular: 400, bold: 700, stack: KR_SANS },
  unbounded: { group: 'sans', family: 'Unbounded', label: 'Unbounded', regular: 400, bold: 700, stack: `"Manrope", ${KR_SANS}`, scale: 0.92 },
  barlow: { group: 'sans', family: 'Barlow Condensed', label: 'Barlow Condensed', regular: 500, bold: 700, stack: `"Inter", ${KR_SANS}` },
  fraunces: { group: 'serif', family: 'Fraunces', label: 'Fraunces', regular: 400, bold: 600, italic: true, stack: `"EB Garamond", ${KR_SERIF}` },
  garamond: { group: 'serif', family: 'EB Garamond', label: 'EB Garamond', regular: 400, bold: 700, italic: true, stack: KR_SERIF, scale: 1.15 },
  didone: { group: 'serif', family: 'Noto Serif Display', label: 'Noto Serif Display', regular: 400, bold: 700, italic: true, stack: KR_SERIF },
  mono: { group: 'mono', family: 'JetBrains Mono', label: 'JetBrains Mono', regular: 400, bold: 600, stack: KR_MONO },
  firacode: { group: 'mono', family: 'Fira Code', label: 'Fira Code', regular: 400, bold: 700, stack: KR_MONO },
  plexmono: { group: 'mono', family: 'IBM Plex Mono', label: 'IBM Plex Mono', regular: 400, bold: 700, stack: `"JetBrains Mono", ${KR_MONO}` },
  sourcecode: { group: 'mono', family: 'Source Code Pro', label: 'Source Code Pro', regular: 400, bold: 700, stack: KR_MONO },
  spacemono: { group: 'mono', family: 'Space Mono', label: 'Space Mono', regular: 400, bold: 700, stack: `"JetBrains Mono", ${KR_MONO}` },
  courier: { group: 'mono', family: 'Courier Prime', label: 'Courier Prime', regular: 400, bold: 700, stack: `"JetBrains Mono", ${KR_MONO}`, scale: 1.2 },
  // Digital: a 14-segment LCD (capitals only, registered in main.js), a display face, a CRT terminal and pixels.
  lcd: { group: 'digital', family: 'DSEG14 Classic', label: 'DSEG14 LCD', regular: 400, bold: 700, upper: true, stack: `"JetBrains Mono", ${KR_MONO}`, scale: 0.9, sample: '1/250 F2' },
  orbitron: { group: 'digital', family: 'Orbitron', label: 'Orbitron', regular: 400, bold: 700, stack: `"Manrope", ${KR_SANS}`, scale: 0.9 },
  vt323: { group: 'digital', family: 'VT323', label: 'VT323', regular: 400, bold: 400, stack: `"JetBrains Mono", ${KR_MONO}`, scale: 1.2 },
  pixel: { group: 'digital', family: 'Press Start 2P', label: 'Press Start 2P', regular: 400, bold: 400, stack: `"Inter", ${KR_SANS}`, scale: 0.7 },
  caveat: { group: 'hand', family: 'Caveat', label: 'Caveat', regular: 400, bold: 700, stack: `${KR_HAND}, "Manrope"`, scale: 1.3 },
  nanumpen: { group: 'hand', family: 'Nanum Pen Script', label: 'Nanum Pen Script', regular: 400, bold: 400, stack: '"Manrope"', scale: 1.3, sample: '오늘의 사진' },
  plexkr: { group: 'korean', family: 'IBM Plex Sans KR', label: 'IBM Plex Sans KR', regular: 400, bold: 700, stack: '"Inter"', sample: '서울 1/250' },
  batang: { group: 'korean', family: 'Gowun Batang', label: 'Gowun Batang', regular: 400, bold: 700, stack: '"EB Garamond"', sample: '여름 f/2.8' },
};
export const FONT_GROUPS = { sans: 'Sans', serif: 'Serif', mono: 'Code & mono', digital: 'Digital', hand: 'Handwriting', korean: '한글' };

/** CSS font shorthand for canvas, with the face's fallback stack. */
export function fontSpec(font, weight, px, italic = false) {
  return `${italic ? 'italic ' : ''}${weight} ${px}px "${font.family}", ${font.stack ? `${font.stack}, ` : ''}system-ui, sans-serif`;
}

// 7-segment LCD face for camera date stamps (registered in main.js).
export const DATE_STAMP_FONT = { family: 'DSEG7 Classic', regular: 700, bold: 700, stack: '"JetBrains Mono"' };

// `map` frames draw the offline map (map.js); `fonts` are extra faces a
// frame always uses alongside the selectable one.
export const TEMPLATES = {
  strip: { label: 'Strip', font: 'inter', background: '#ffffff' },
  polaroid: { label: 'Instant', font: 'fraunces', background: '#f6f5f1' },
  gallery: { label: 'Gallery mat', font: 'inter', background: '#ffffff' },
  backdrop: { label: 'Backdrop', font: 'inter', background: 'blur' },
  viewfinder: { label: 'Viewfinder', font: 'barlow', background: '#000000' },
  film: { label: 'Film rebate', font: 'mono', background: '#000000' },
  lightroom: { label: 'Lightroom', font: 'inter', background: '#262626' },
  atlas: { label: 'Atlas', font: 'manrope', background: '#f5f2eb', map: true },
  postcard: { label: 'Postcard', font: 'caveat', background: '#f3eee3', map: true, fonts: ['courier'] },
  slide: { label: 'Slide mount', font: 'courier', background: '#e9e5db', fonts: ['caveat'] },
  cinema: { label: 'Cinema', font: 'manrope', background: '#000000' },
};

// Ground distance from the map's centre to its rim.
export const MAP_SCALES = {
  city: { label: 'City', km: 30 },
  region: { label: 'Region', km: 150 },
  country: { label: 'Country', km: 600 },
  continent: { label: 'Continent', km: 2500 },
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
  logo: 'both',          // 'both' camera + lens logos | 'camera' | 'text' (brand as plain text)
  mapScale: 'region',    // Atlas map zoom, a MAP_SCALES key
  show: {
    make: true, model: true, lens: true, focal: true, aperture: true, shutter: true,
    iso: true, date: true, time: true, location: false, place: false, artist: false, caption: true,
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
  const place = show.place ? placeOf(fields)?.label || '' : '';
  return {
    make: pick('make'),
    model: pick('model'),
    camera: join([pick('make'), pick('model')], ' '),
    lens: pick('lens'),
    exposure: join([show.focal ? (focal35 && fields.focal35) || fields.focal || '' : '', pick('aperture'), pick('shutter'), pick('iso')]),
    when: join([join([pick('date'), pick('time')], '  '), place, pick('location')], '   '),
    artist: pick('artist') ? `© ${fields.artist}` : '',
    caption: pick('caption'),
    date: pick('date'),
    datetime: join([pick('date'), pick('time')], '  '), // `when` without place or coordinates
  };
}

// ---------- Brands ----------

/**
 * Brand marks to draw: the camera logo (or its name as text when there's no
 * logo or logos are off) and a lens logo when the lens maker differs.
 */
export function brandsFor(fields, settings) {
  const show = settings.show;
  const make = show.make ? fields?.make || '' : '';
  const mode = settings.logo || 'both';
  const camLogo = make && mode !== 'text' ? cameraLogo(make) : null;
  const lensKey = mode === 'both' && show.lens && fields?.lens ? lensLogo(fields.lens, fields.lensMake) : null;
  const items = [camLogo ? { logo: camLogo } : make && { text: make }, lensKey && lensKey !== camLogo && { logo: lensKey }].filter(Boolean);
  return { items, camLogo, hasLogo: items.some((b) => b.logo) };
}

// ---------- Layout ----------

/**
 * Computes canvas size and the photo rectangle at full resolution. Pass the
 * photo's fields so caption areas grow to fit a row of brand logos.
 */
export function layout(W, H, settings, fields) {
  const S = Math.min(W, H);
  const b = settings.border;
  const logoRow = fields ? brandsFor(fields, settings).hasLogo : false;
  let pad;
  switch (settings.template) {
    case 'strip': {
      const m = S * 0.025 * b;
      pad = { top: m, left: m, right: m, bottom: m + S * (logoRow ? 0.14 : 0.12) };
      break;
    }
    case 'polaroid': {
      const m = S * 0.055 * b;
      pad = { top: m, left: m, right: m, bottom: Math.max(m * 2, S * (logoRow ? 0.3 : 0.24)) };
      break;
    }
    case 'gallery': {
      const m = S * 0.1 * b;
      pad = { top: m, left: m, right: m, bottom: m + S * (logoRow ? 0.11 : 0.07) };
      break;
    }
    case 'backdrop': {
      const m = S * 0.08 * b;
      pad = { top: m, left: m, right: m, bottom: m + S * (logoRow ? 0.2 : 0.13) };
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
    case 'lightroom': {
      const m = S * 0.04 * b;
      pad = { top: m, left: m, right: m, bottom: m + S * 0.19 };
      break;
    }
    case 'atlas': {
      const m = S * 0.035 * b;
      pad = { top: m, left: m, right: m, bottom: m + S * 0.22 };
      break;
    }
    case 'postcard': {
      const m = S * 0.045 * b;
      pad = { top: m, left: m, right: m, bottom: m + S * 0.23 };
      break;
    }
    case 'slide': {
      // A slide mount is square: the window's long sides get the narrow card.
      const side = Math.max(W, H) + 2 * S * 0.2 * b;
      pad = { top: (side - H) / 2, bottom: (side - H) / 2, left: (side - W) / 2, right: (side - W) / 2 };
      break;
    }
    case 'cinema': {
      const m = S * 0.14 * b;
      pad = { top: m, left: 0, right: 0, bottom: m };
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
  const L = layout(W, H, settings, fields);
  const tpl = TEMPLATES[settings.template];
  const face = FONTS[settings.font === 'template' ? tpl.font : settings.font] || FONTS[tpl.font];
  const font = { ...face, k: (face.scale || 1) / (FONTS[tpl.font].scale || 1) };
  const bg = settings.background === 'template' ? tpl.background : settings.background;
  const t = compose(fields, settings.show, settings.focal35);
  // Brand logos replace the brand name; a lens logo is added when the lens
  // maker differs from the camera maker (e.g. SONY | ZEISS, Nikon | SIGMA).
  const brands = brandsFor(fields, settings);
  t.brands = brands.items;
  t.hasLogo = brands.hasLogo;
  if (brands.camLogo) t.camera = t.model; // the logo already names the brand
  const { S, photo } = L;
  const radius = settings.radius * S * 0.05;

  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, -offsetX, -offsetY);
  ctx.textBaseline = 'alphabetic';

  // Background
  if (bg === 'blur') drawBlurBackground(ctx, blurImg || img, L.width, L.height, scale);
  else { ctx.fillStyle = bg; ctx.fillRect(0, 0, L.width, L.height); }

  const ink = bg === 'blur' ? palette('#000000') : palette(bg);

  // Photo
  ctx.save();
  if (settings.template === 'backdrop' || settings.template === 'slide') {
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = S * 0.035 * scale;
    ctx.shadowOffsetY = S * 0.012 * scale;
    ctx.fillStyle = '#000';
    roundRect(ctx, photo.x, photo.y, photo.w, photo.h, settings.template === 'slide' ? Math.max(radius, S * 0.022) : radius);
    ctx.fill();
    ctx.shadowColor = 'transparent';
  }
  const r = settings.template === 'slide' ? Math.max(radius, S * 0.022) : radius; // slide windows are always rounded
  roundRect(ctx, photo.x, photo.y, photo.w, photo.h, r);
  ctx.clip();
  ctx.imageSmoothingQuality = 'high';
  drawOriented(ctx, img, orientation, photo.x, photo.y, photo.w, photo.h);
  ctx.restore();

  // `small` is an upright copy of the photo for histograms and thumbnails.
  const draw = { ctx, font, ink, S, L, t, scale, fields, settings, bg, W, H, small: blurImg || img };
  ({
    strip: drawStrip,
    polaroid: drawPolaroid,
    gallery: drawGallery,
    backdrop: drawBackdrop,
    viewfinder: drawViewfinder,
    film: drawFilm,
    lightroom: drawLightroom,
    atlas: drawAtlas,
    postcard: drawPostcard,
    slide: drawSlide,
    cinema: drawCinema,
  })[settings.template](draw);

  ctx.restore();
  return L;
}

function drawStrip({ ctx, font, ink, S, L, t }) {
  const { photo } = L;
  const barTop = photo.y + photo.h;
  const unit = S * 0.12; // bar height is independent of the border
  const barH = t.hasLogo ? S * 0.14 : unit; // taller for the logo row (see layout)
  const inset = Math.max(S * 0.035, photo.x - L.content.x + S * 0.01);
  const left = L.content.x + inset;
  const right = L.content.x + L.content.w - inset;
  const big = unit * 0.2;
  const small = unit * 0.15;
  const l1 = barTop + barH / 2 - unit * 0.03;
  const l2 = l1 + small * 1.55;
  const half = (right - left) / 2;

  // Left: camera model over lens
  const model = t.model || t.make;
  const sub = t.lens || t.caption;
  text(ctx, model, left, sub ? l1 : (l1 + l2) / 2 - small * 0.3, { font, size: big, weight: 'bold', color: ink.primary, maxWidth: half * 0.95 });
  text(ctx, sub, left, model ? l2 : l1, { font, size: small, color: ink.muted, maxWidth: half * 0.95 });

  const second = [t.when, t.artist].filter(Boolean).join('   ');
  // The brand is skipped when the model is hidden and the brand alone already shows on the left.
  const brands = t.model ? t.brands : t.brands.filter((b) => b.logo && b.logo !== cameraLogo(t.make));

  // With logos: the camera and lens logos on top, the shot details beneath.
  if (brands.some((b) => b.logo)) {
    stack(ctx, [
      { row: brands, size: S * 0.017, color: ink.primary, rule: ink.rule },
      t.exposure && { s: t.exposure, size: S * 0.022, weight: 'bold', color: ink.primary },
      second && { s: second, size: S * 0.016, color: ink.muted },
    ].filter(Boolean), right, barTop + barH / 2, half * 0.9, font, 'right');
    return;
  }

  // Right: exposure over date/time, preceded by the make as a wordmark
  const rightTop = second ? l1 : (l1 + l2) / 2 - small * 0.3;
  const w1 = text(ctx, t.exposure, right, rightTop, { font, size: big, weight: 'bold', color: ink.primary, align: 'right', maxWidth: half * 0.72 });
  const w2 = text(ctx, second, right, t.exposure ? l2 : l1, { font, size: small, color: ink.muted, align: 'right', maxWidth: half * 0.72 });
  const blockW = Math.max(w1, w2);
  // The brand name sits beside the exposure block.
  if (brands.length) {
    const gap = S * 0.018;
    let x = right;
    if (blockW > 0) {
      x = right - blockW - gap;
      ctx.fillStyle = ink.rule;
      ctx.fillRect(x, barTop + barH * 0.27, Math.max(1, S * 0.0018), barH * 0.46);
      x -= gap;
    }
    brandRow(ctx, brands, x, barTop + barH * 0.5, barH * 0.19, { color: ink.primary, rule: ink.rule, align: 'right', font, maxWidth: half * 0.62 });
  }
}

function drawPolaroid({ ctx, font, ink, S, L, t }) {
  const { photo } = L;
  const cx = photo.x + photo.w / 2;
  const top = photo.y + photo.h;
  const area = L.content.y + L.content.h - top;
  const headline = t.caption || t.camera;
  const gear = (t.caption ? [t.camera, t.lens] : [t.lens]).filter(Boolean).join('   ');
  const exposure = t.exposure && { s: t.exposure, size: S * 0.026, weight: 'regular', color: ink.muted };
  const gearLine = gear && { s: gear, size: S * 0.022, color: ink.muted };
  const lines = [
    t.hasLogo && { row: t.brands, size: S * 0.03, color: ink.primary, rule: ink.rule },
    headline && { s: headline, size: S * 0.05, weight: 'regular', italic: font.italic, color: ink.primary },
    // With logos, camera and lens sit up with the logo row and the shot details go below.
    ...(t.hasLogo ? [gearLine, exposure] : [exposure, gearLine]),
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
    t.hasLogo && { row: t.brands, size: S * 0.022, color: ink.primary, rule: ink.rule },
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
    t.hasLogo && { row: t.brands, size: S * 0.028, color: '#ffffff', rule: 'rgba(255,255,255,0.45)' },
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
  if (t.hasLogo) {
    // Logos, then camera and lens, then the shot details on the bottom line.
    const main = exposure || t.caption;
    const gearY = main ? base - size * 1.25 : base;
    const logoH = S * 0.026;
    text(ctx, main, left, base, { font, size, weight: 'bold', color: '#ffffff', maxWidth: photo.w * 0.62 });
    text(ctx, below, left, gearY, { font, size: sub, color: 'rgba(255,255,255,0.82)', maxWidth: photo.w * 0.62 });
    brandRow(ctx, t.brands, left, (below ? gearY - sub * 1.05 : gearY - size * 0.95) - logoH * 0.8, logoH, { color: '#ffffff', rule: 'rgba(255,255,255,0.5)', font, maxWidth: photo.w * 0.6 });
  } else {
    const top = below ? base - sub * 1.6 : base;
    text(ctx, exposure || t.caption, left, top, { font, size, weight: 'bold', color: '#ffffff', maxWidth: photo.w * 0.62 });
    text(ctx, below, left, base, { font, size: sub, color: 'rgba(255,255,255,0.82)', maxWidth: photo.w * 0.62 });
  }
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
    const stamp = d ? `'${d[1].slice(2)} ${+d[2]} ${+d[3]}` : t.date; // like a 90s date back: '26 5 16
    ctx.save();
    ctx.shadowColor = 'rgba(255,120,20,0.85)';
    ctx.shadowBlur = S * 0.012 * scale;
    text(ctx, stamp, photo.x + photo.w - S * 0.05, photo.y + photo.h - S * 0.045, {
      font: DATE_STAMP_FONT, size: S * 0.038, weight: 'bold', color: '#ffb347', align: 'right',
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
  if (t.hasLogo) t.brands = t.brands.map((b) => (b.text ? { text: b.text.toUpperCase() } : b));
  const rhs = [t.exposure.toUpperCase(), t.artist].filter(Boolean).join('   ');
  const w = text(ctx, rhs, right, base, { font, size, weight: 'bold', color: FILM_AMBER, align: 'right', maxWidth: photo.w * 0.48 });
  let x = left;
  if (t.hasLogo) {
    x += brandRow(ctx, t.brands, left, base - size * 0.36, size * 0.78, { color: FILM_AMBER, rule: 'rgba(243,154,44,0.5)', font, maxWidth: photo.w * 0.3 }) + size * 1.2;
  }
  text(ctx, lhs, x, base, { font, size, color: FILM_AMBER, maxWidth: right - w - S * 0.04 - x });
  // Sprocket-ish frame counter marks along the top rebate.
  const topY = L.content.y + (photo.y - L.content.y) * 0.62;
  if (photo.y - L.content.y > size * 1.4) {
    text(ctx, '▸ 1', left, topY, { font, size: size * 0.9, color: FILM_AMBER });
    text(ctx, '1A', right, topY, { font, size: size * 0.9, color: FILM_AMBER, align: 'right' });
  }
}

// ---------- Lightroom ----------

const LR = { panel: '#1b1b1b', text: '#d6d6d6', muted: '#8f8f8f' };

function drawLightroom({ ctx, font, ink, S, L, t, fields, settings, W, H, small }) {
  const { photo, content } = L;
  const top = photo.y + photo.h;
  const area = content.y + content.h - top;
  const inset = Math.max(S * 0.04, photo.x - content.x);
  const left = content.x + inset;
  const right = content.x + content.w - inset;

  // Histogram panel, as in Lightroom's Library and Develop modules.
  const hw = Math.min(S * 0.42, (right - left) * 0.46);
  const hh = area * 0.5;
  const hx = right - hw;
  const hy = top + area * 0.17;
  drawHistogram(ctx, histogramOf(small), hx, hy, hw, hh, S);
  const show = settings.show;
  const readouts = [
    show.iso && fields.iso ? fields.iso.replace(/^ISO\s*/i, 'ISO ') : '',
    show.focal ? ((settings.focal35 && fields.focal35) || fields.focal || '').replace(/mm$/, ' mm') : '',
    show.aperture && fields.aperture ? fields.aperture.replace('/', ' / ') : '',
    show.shutter && fields.shutter ? fields.shutter.replace(/s$/, ' sec') : '',
  ];
  const ry = hy + hh + area * 0.18;
  readouts.forEach((s, i) => {
    text(ctx, s, hx + (hw * (i + 0.5)) / 4, ry, { font, size: S * 0.0175, color: ink.muted, align: 'center', maxWidth: hw / 4.2 });
  });

  // Loupe info: what you'd see over the photo with Info Overlay on.
  const colW = hx - left - S * 0.05;
  const title = t.caption || t.camera;
  const info = [
    t.hasLogo && { row: t.brands, size: S * 0.022, color: ink.primary, rule: ink.rule },
    title && { s: title, size: S * 0.034, weight: 'bold', color: ink.primary },
    (t.caption ? [t.camera, t.lens] : [t.lens]).filter(Boolean).join('   ') && { s: (t.caption ? [t.camera, t.lens] : [t.lens]).filter(Boolean).join('   '), size: S * 0.02, color: ink.muted },
    [t.when, `${W} × ${H}`, t.artist].filter(Boolean).join('   ') && { s: [t.when, `${W} × ${H}`, t.artist].filter(Boolean).join('   '), size: S * 0.018, color: ink.muted },
  ].filter(Boolean);
  stack(ctx, info, left, top + area * 0.5, colW, font, 'left');
}

const histCache = new WeakMap();
/** RGB histogram of a small copy of the photo, smoothed and scaled to 0–1. */
function histogramOf(img) {
  if (!img) return null;
  if (histCache.has(img)) return histCache.get(img);
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const k = Math.min(1, 360 / Math.max(iw, ih));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(iw * k));
  c.height = Math.max(1, Math.round(ih * k));
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, c.width, c.height);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  const bins = [new Float32Array(256), new Float32Array(256), new Float32Array(256)];
  for (let i = 0; i < d.length; i += 4) { bins[0][d[i]]++; bins[1][d[i + 1]]++; bins[2][d[i + 2]]++; }
  const smooth = bins.map((b) => b.map((_, i) => {
    let sum = 0;
    let n = 0;
    for (let j = Math.max(0, i - 2); j <= Math.min(255, i + 2); j++) { sum += b[j]; n++; }
    return sum / n;
  }));
  // Scale to the tallest bar away from the clipped ends, like Lightroom does.
  let max = 1;
  for (const b of smooth) for (let i = 3; i < 253; i++) max = Math.max(max, b[i]);
  const out = smooth.map((b) => b.map((v) => Math.min(1, v / max)));
  histCache.set(img, out);
  return out;
}

function drawHistogram(ctx, hist, x, y, w, h, S) {
  ctx.save();
  ctx.fillStyle = LR.panel;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (let i = 1; i < 4; i++) ctx.fillRect(x + (w * i) / 4, y, Math.max(1, S * 0.001), h);
  if (hist) {
    ctx.globalCompositeOperation = 'lighter';
    ['rgba(225,60,55,0.75)', 'rgba(60,200,80,0.7)', 'rgba(70,110,235,0.8)'].forEach((color, c) => {
      ctx.beginPath();
      ctx.moveTo(x, y + h);
      for (let i = 0; i < 256; i++) ctx.lineTo(x + (i / 255) * w, y + h - hist[c][i] * h * 0.94);
      ctx.lineTo(x + w, y + h);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    });
    ctx.globalCompositeOperation = 'source-over';
  }
  // Clipping indicators in the top corners.
  const a = h * 0.07;
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  for (const [tx, dir] of [[x + a * 0.6, 1], [x + w - a * 0.6, -1]]) {
    ctx.beginPath();
    ctx.moveTo(tx, y + a * 0.6);
    ctx.lineTo(tx + dir * a, y + a * 0.6);
    ctx.lineTo(tx, y + a * 1.6);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// ---------- Location frames ----------

const RAD = Math.PI / 180;

function geoFor(fields, portrait) {
  const coords = coordsOf(fields);
  return { coords, place: placeOf(fields), heading: headingOf(fields), fov: fieldOfView(fields, portrait), map: maps() };
}

/** Lines that name a place: headline, then region and country. */
function placeLines(place) {
  if (!place) return ['', ''];
  const head = place.city || place.region || place.country || place.label;
  const rest = [place.city && place.region, head !== place.country && place.country].filter(Boolean).join(', ');
  return [head, rest];
}

function drawAtlas({ ctx, font, ink, S, L, t, fields, settings, bg, scale }) {
  const { photo, content } = L;
  const top = photo.y + photo.h;
  const area = content.y + content.h - top;
  const inset = Math.max(S * 0.04, photo.x - content.x);
  const left = content.x + inset;
  const right = content.x + content.w - inset;
  const geo = geoFor(fields, photo.w < photo.h);
  const dark = ink.primary !== '#141414';

  const R = Math.min(area * 0.42, S * 0.105);
  const cx = right - R;
  const cy = top + area / 2;
  drawCompassMap(ctx, { cx, cy, R, geo, S, scale, dark, bg, font, km: (MAP_SCALES[settings.mapScale] || MAP_SCALES.region).km });

  const textRight = cx - R - S * 0.045;
  const half = (textRight - left - S * 0.04) / 2;
  const lines = [];
  if (geo.coords || fields.place) {
    const [head, rest] = placeLines(geo.place);
    const extra = [
      settings.show.location && geo.coords ? formatDms(geo.coords) : '',
      settings.show.location && fields.altitude ? fields.altitude : '',
      geo.heading != null ? `${compassPoint(geo.heading)} ${Math.round(geo.heading)}°` : '',
    ].filter(Boolean).join('   ');
    if (head) lines.push({ s: head, size: S * 0.042, weight: 'bold', color: ink.primary });
    if (rest) lines.push({ s: rest, size: S * 0.02, color: ink.muted });
    if (extra) lines.push({ s: extra, size: S * 0.017, color: ink.muted, gap: 1.9 });
  } else {
    if (t.hasLogo) lines.push({ row: t.brands, size: S * 0.024, color: ink.primary, rule: ink.rule });
    if (t.model || t.camera) lines.push({ s: t.hasLogo ? t.model : t.camera, size: S * 0.036, weight: 'bold', color: ink.primary });
    if (t.lens) lines.push({ s: t.lens, size: S * 0.02, color: ink.muted });
  }
  stack(ctx, lines, left, cy, half * (geo.coords ? 1.15 : 1), font, 'left');

  const camera = geo.coords || fields.place
    ? [
      t.hasLogo ? { row: t.brands, size: S * 0.02, color: ink.primary, rule: ink.rule } : null,
      (t.hasLogo ? t.model : t.camera) && { s: t.hasLogo ? t.model : t.camera, size: S * 0.022, weight: 'bold', color: ink.primary },
      t.lens && { s: t.lens, size: S * 0.017, color: ink.muted },
      t.exposure && { s: t.exposure, size: S * 0.017, color: ink.muted },
      [t.datetime, t.artist].filter(Boolean).join('   ') && { s: [t.datetime, t.artist].filter(Boolean).join('   '), size: S * 0.017, color: ink.muted },
    ]
    : [
      t.exposure && { s: t.exposure, size: S * 0.026, weight: 'bold', color: ink.primary },
      [t.when, t.artist].filter(Boolean).join('   ') && { s: [t.when, t.artist].filter(Boolean).join('   '), size: S * 0.018, color: ink.muted },
      t.caption && { s: t.caption, size: S * 0.018, color: ink.muted },
    ];
  stack(ctx, camera.filter(Boolean), textRight, cy, half * (geo.coords ? 0.85 : 1), font, 'right');
}

/** The Atlas map: a regional map in a compass bezel, or a compass rose without a location. */
function drawCompassMap(ctx, { cx, cy, R, geo, S, scale, dark, font, km }) {
  const bezel = dark ? '#2b2f33' : '#fbfaf6';
  const tick = dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)';
  const accent = dark ? '#ff7a45' : '#d64532';
  const r = R * 0.8;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.22)';
  ctx.shadowBlur = R * 0.1 * scale;
  ctx.shadowOffsetY = R * 0.03 * scale;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = bezel;
  ctx.fill();
  ctx.restore();

  // Bezel: a tick every 10°, cardinal letters, and the heading marker.
  const letters = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
  ctx.save();
  for (let d = 0; d < 360; d += 10) {
    const a = (d - 90) * RAD;
    if (letters[d]) {
      text(ctx, letters[d], cx + Math.cos(a) * R * 0.9, cy + Math.sin(a) * R * 0.9 + R * 0.045, {
        font, size: R * 0.13, weight: 'bold', color: d === 0 ? accent : tick, align: 'center',
      });
      continue;
    }
    const r0 = R * (d % 30 === 0 ? 0.84 : 0.865);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    ctx.lineTo(cx + Math.cos(a) * R * 0.94, cy + Math.sin(a) * R * 0.94);
    ctx.strokeStyle = tick;
    ctx.lineWidth = R * (d % 30 === 0 ? 0.016 : 0.009);
    ctx.stroke();
  }
  if (geo.heading != null) {
    const a = (geo.heading - 90) * RAD;
    const tip = R * 0.81;
    const base = R * 0.985;
    const w = R * 0.07;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * tip, cy + Math.sin(a) * tip);
    ctx.lineTo(cx + Math.cos(a) * base - Math.sin(a) * w, cy + Math.sin(a) * base + Math.cos(a) * w);
    ctx.lineTo(cx + Math.cos(a) * base + Math.sin(a) * w, cy + Math.sin(a) * base - Math.cos(a) * w);
    ctx.closePath();
    ctx.fillStyle = accent;
    ctx.fill();
  }
  ctx.restore();

  if (geo.coords && geo.map) {
    const style = dark ? geo.map.MAP_STYLES.night : geo.map.MAP_STYLES.paper;
    const { kmPerPx } = geo.map.drawRegion(ctx, { cx, cy, r, lat: geo.coords.lat, lon: geo.coords.lon, radiusKm: km, heading: geo.heading, fov: geo.fov, style });
    // Scale bar along the bottom of the map.
    const kmBar = geo.map.niceScaleKm(km * 2);
    const len = kmBar / kmPerPx;
    const y = cy + r * 0.7;
    ctx.save();
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.75)' : 'rgba(30,30,30,0.7)';
    ctx.fillRect(cx - len / 2, y, len, Math.max(r * 0.018, 0.5));
    ctx.fillRect(cx - len / 2, y - r * 0.03, Math.max(r * 0.012, 0.5), r * 0.048);
    ctx.fillRect(cx + len / 2 - r * 0.012, y - r * 0.03, Math.max(r * 0.012, 0.5), r * 0.048);
    text(ctx, `${kmBar.toLocaleString('en-US')} km`, cx, y - r * 0.05, { font, size: r * 0.085, weight: 'bold', color: ctx.fillStyle, align: 'center' });
    ctx.restore();
  } else {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = dark ? '#1d2226' : '#ece7dc';
    ctx.fill();
    if (geo.coords) {
      // Map data still loading: just the marker, so the preview isn't empty.
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.04, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.fill();
    } else {
      compassRose(ctx, cx, cy, r * 0.78, tick, accent);
    }
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = dark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)';
  ctx.lineWidth = R * 0.012;
  ctx.stroke();
}

function compassRose(ctx, cx, cy, r, ink, accent) {
  const point = (deg, len, width, color) => {
    const a = (deg - 90) * RAD;
    const p = (rr, da) => [cx + Math.cos(a + da) * rr, cy + Math.sin(a + da) * rr];
    ctx.beginPath();
    ctx.moveTo(...p(len, 0));
    ctx.lineTo(...p(width, Math.PI / 2));
    ctx.lineTo(cx, cy);
    ctx.lineTo(...p(width, -Math.PI / 2));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  ctx.globalAlpha = 0.5;
  for (const d of [45, 135, 225, 315]) point(d, r * 0.55, r * 0.1, ink);
  ctx.globalAlpha = 0.85;
  for (const d of [90, 180, 270]) point(d, r, r * 0.14, ink);
  point(0, r, r * 0.14, accent);
  ctx.globalAlpha = 1;
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const dateParts = (date) => {
  const m = String(date || '').match(/^(\d{4})\.(\d{2})\.(\d{2})/);
  return m ? { y: +m[1], m: +m[2] - 1, d: +m[3] } : null;
};

function drawPostcard({ ctx, font, ink, S, L, t, fields, settings, bg, small }) {
  const { photo, content } = L;
  const top = photo.y + photo.h;
  const area = content.y + content.h - top;
  const inset = Math.max(S * 0.045, photo.x - content.x);
  const left = content.x + inset;
  const right = content.x + content.w - inset;
  const geo = geoFor(fields, photo.w < photo.h);
  const pen = '#24305e';
  const typed = '#3b3a36';
  const dp = dateParts(fields.date);

  // Stamp, top right of the back.
  const sh = Math.min(area * 0.8, S * 0.2);
  const sw = sh * 0.8;
  const sx = right - sw;
  const sy = top + Math.max(S * 0.02, (area - sh) * 0.38);
  drawStamp(ctx, { x: sx, y: sy, w: sw, h: sh, geo, fields, settings, small, card: bg.startsWith('#') ? bg : TEMPLATES.postcard.background });

  // Postmark over the stamp's lower-left corner, with wavy cancellation lines.
  const pr = sh * 0.34;
  const pcx = sx + sw * 0.05;
  const pcy = sy + sh * 0.74;
  const [head] = placeLines(geo.place);
  drawPostmark(ctx, {
    cx: pcx, cy: pcy, r: pr, S,
    top: (head || t.make || '').toUpperCase(),
    bottom: (geo.place?.country && geo.place.country !== head ? geo.place.country : t.model || '').toUpperCase(),
    mid: dp ? `${dp.d} ${MONTHS[dp.m]} ${dp.y}` : fields.date || '',
    sub: settings.show.time ? fields.time || '' : '',
    lineEnd: right + inset * 0.6,
  });

  // Divider between message and address, as on a real postcard back.
  const divider = left + (pcx - pr - left) * 0.56;
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(divider, top + area * 0.14, Math.max(S * 0.0012, 0.5), area * 0.72);

  // Message: the caption in handwriting, or a greeting from the place.
  const message = t.caption || (head ? `Greetings from ${head}!` : [t.make, t.model].filter(Boolean).join(' '));
  const msgW = divider - left - S * 0.03;
  const dateLine = settings.show.date && dp ? `${MONTH_NAMES[dp.m]} ${dp.d}, ${dp.y}` : '';
  stack(ctx, [
    message && { s: message, size: S * 0.05, color: pen },
    [dateLine, t.artist].filter(Boolean).join('   ') && { s: [dateLine, t.artist ? t.artist.replace(/^© /, '— ') : ''].filter(Boolean).join('   '), size: S * 0.032, color: pen },
  ].filter(Boolean), left, top + area * 0.5, msgW, font, 'left');

  // Address lines, typed with the camera details.
  const addrX = divider + S * 0.03;
  const addrW = pcx - pr * 1.1 - addrX;
  const addr = [
    [t.make, t.model].filter(Boolean).join(' '), t.lens, t.exposure,
    settings.show.location && geo.coords ? formatDms(geo.coords) : settings.show.place ? geo.place?.label || '' : '',
  ].filter(Boolean);
  const gap = area * 0.2;
  const y0 = top + area * 0.5 - ((addr.length - 1) * gap) / 2;
  addr.forEach((s, i) => {
    const y = y0 + i * gap;
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(addrX, y + S * 0.006, Math.max(0, addrW), Math.max(S * 0.0012, 0.5));
    text(ctx, s, addrX, y, { font: FONTS.courier, size: S * 0.018, color: typed, maxWidth: addrW });
  });
}

function drawStamp(ctx, { x, y, w, h, geo, fields, settings, small, card }) {
  const hole = w * 0.045;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur = w * 0.04;
  ctx.shadowOffsetY = w * 0.01;
  ctx.fillStyle = '#fdfbf6';
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  // Perforations: bites out of every edge, in the card colour.
  const bite = (bx, by) => { ctx.beginPath(); ctx.arc(bx, by, hole, 0, Math.PI * 2); ctx.fill(); };
  ctx.save();
  ctx.fillStyle = card;
  const nx = Math.max(4, Math.round(w / (hole * 3.2)));
  const ny = Math.max(4, Math.round(h / (hole * 3.2)));
  for (let i = 0; i <= nx; i++) { bite(x + (w * i) / nx, y); bite(x + (w * i) / nx, y + h); }
  for (let i = 1; i < ny; i++) { bite(x, y + (h * i) / ny); bite(x + w, y + (h * i) / ny); }
  ctx.restore();

  // Picture: a globe turned to the location, or the photo itself.
  const m = w * 0.11;
  const fx = x + m;
  const fy = y + m;
  const fw = w - m * 2;
  const fh = h - m * 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(fx, fy, fw, fh);
  ctx.clip();
  ctx.fillStyle = '#e4d6b7';
  ctx.fillRect(fx, fy, fw, fh);
  if (geo.coords && geo.map) {
    geo.map.drawGlobe(ctx, { cx: fx + fw / 2, cy: fy + fh * 0.47, r: fw * 0.4, lat: geo.coords.lat, lon: geo.coords.lon, style: geo.map.MAP_STYLES.stamp });
  } else if (small) {
    const iw = small.naturalWidth || small.width;
    const ih = small.naturalHeight || small.height;
    const k = Math.max(fw / iw, fh / ih);
    ctx.drawImage(small, fx + (fw - iw * k) / 2, fy + (fh - ih * k) / 2, iw * k, ih * k);
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(80,60,30,0.45)';
  ctx.lineWidth = w * 0.008;
  ctx.strokeRect(fx, fy, fw, fh);

  // Denomination: the shutter speed, and the country along the bottom.
  const value = settings.show.shutter && fields.shutter ? fields.shutter.replace(/s$/, '') : fields.aperture || '';
  const country = (geo.place?.country || '').toUpperCase();
  ctx.save();
  ctx.shadowColor = 'rgba(255,255,255,0.8)';
  ctx.shadowBlur = w * 0.03;
  text(ctx, value, fx + fw * 0.07, fy + fh * 0.13, { font: FONTS.courier, size: fw * 0.13, weight: 'bold', color: '#5a2d1e', maxWidth: fw * 0.6 });
  text(ctx, country, fx + fw / 2, fy + fh * 0.94, { font: FONTS.courier, size: fw * 0.085, weight: 'bold', color: '#5a2d1e', align: 'center', maxWidth: fw * 0.9 });
  ctx.restore();
}

function drawPostmark(ctx, { cx, cy, r, top, bottom, mid, sub, lineEnd }) {
  const ink = 'rgba(32,36,58,0.74)';
  ctx.save();
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = r * 0.045;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = r * 0.025;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.66, 0, Math.PI * 2);
  ctx.stroke();
  arcText(ctx, top, cx, cy, r * 0.73, -Math.PI / 2, r * 0.2, ink, false);
  arcText(ctx, bottom, cx, cy, r * 0.73, Math.PI / 2, r * 0.16, ink, true);
  text(ctx, mid, cx, cy + (sub ? -r * 0.02 : r * 0.06), { font: FONTS.courier, size: r * 0.19, weight: 'bold', color: ink, align: 'center', maxWidth: r * 1.2 });
  if (sub) text(ctx, sub, cx, cy + r * 0.26, { font: FONTS.courier, size: r * 0.17, weight: 'bold', color: ink, align: 'center' });
  // Cancellation waves running across the stamp.
  ctx.lineWidth = r * 0.04;
  const x0 = cx + r * 1.12;
  for (let i = 0; i < 5; i++) {
    const y = cy - r * 0.6 + i * r * 0.3;
    ctx.beginPath();
    for (let x = x0; x <= lineEnd; x += r * 0.05) {
      const yy = y + Math.sin((x - x0) / (r * 0.28)) * r * 0.08;
      if (x === x0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** Text set along a circle, centred on angle `at`; `under` reads along the bottom. */
function arcText(ctx, s, cx, cy, r, at, size, color, under) {
  if (!s) return;
  ctx.save();
  ctx.font = fontSpec(FONTS.courier, FONTS.courier.bold, size);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  const chars = [...s];
  const widths = chars.map((c) => ctx.measureText(c).width + size * 0.12);
  const maxArc = Math.PI * 0.85;
  const total = widths.reduce((a, b) => a + b, 0) / r;
  const k = total > maxArc ? maxArc / total : 1;
  if (k < 1) { ctx.font = fontSpec(FONTS.courier, FONTS.courier.bold, size * Math.max(0.6, k)); }
  let a = at + (under ? 1 : -1) * (total * k) / 2;
  chars.forEach((c, i) => {
    const step = (widths[i] * k) / r;
    a += (under ? -1 : 1) * step / 2;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.rotate(a + (under ? -Math.PI / 2 : Math.PI / 2));
    ctx.fillText(c, 0, size * 0.36);
    ctx.restore();
    a += (under ? -1 : 1) * step / 2;
  });
  ctx.restore();
}

// ---------- Slide mount ----------

function drawSlide({ ctx, font, S, L, t, fields, settings, scale }) {
  const { photo, content } = L;
  // Card texture: a soft light falloff and a bevel around the window.
  ctx.save();
  const g = ctx.createLinearGradient(content.x, content.y, content.x + content.w, content.y + content.h);
  g.addColorStop(0, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(0,0,0,0.06)');
  ctx.fillStyle = g;
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillRect(content.x, content.y, content.w, photo.y - content.y);
  ctx.fillRect(content.x, photo.y + photo.h, content.w, content.y + content.h - photo.y - photo.h);
  ctx.fillRect(content.x, photo.y, photo.x - content.x, photo.h);
  ctx.fillRect(photo.x + photo.w, photo.y, content.x + content.w - photo.x - photo.w, photo.h);
  ctx.restore();
  const rr = Math.max(settings.radius * S * 0.05, S * 0.022);
  const lip = S * 0.012;
  ctx.save();
  roundRect(ctx, photo.x - lip, photo.y - lip, photo.w + lip * 2, photo.h + lip * 2, rr + lip);
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = S * 0.004;
  ctx.stroke();
  roundRect(ctx, photo.x - lip * 1.35, photo.y - lip * 1.35, photo.w + lip * 2.7, photo.h + lip * 2.7, rr + lip * 1.35);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = S * 0.003;
  ctx.stroke();
  ctx.restore();

  const ink = '#4f4a40';
  const pen = '#22307a';
  const topM = photo.y - content.y;
  const botM = content.y + content.h - photo.y - photo.h;
  const sideM = photo.x - content.x;
  const cx = photo.x + photo.w / 2;
  const dp = dateParts(fields.date);
  const geo = geoFor(fields, photo.w < photo.h);
  const [place] = placeLines(geo.place);

  // Handwritten label above the window.
  const label = t.caption || (settings.show.place && place) || (dp && settings.show.date ? `${MONTH_NAMES[dp.m]} ${dp.d}, ${dp.y}` : t.camera);
  text(ctx, label, cx, photo.y - topM * 0.38, { font: FONTS.caveat, size: Math.min(topM * 0.4, S * 0.07), color: pen, align: 'center', maxWidth: photo.w * 0.9 });

  // Processing stamp below: exposure on the left, month and year on the right, frame number in a circle.
  const by = photo.y + photo.h + botM * 0.55;
  const size = Math.min(botM * 0.17, S * 0.028);
  const num = String(((parseInt(String(fields.file || '').replace(/\D/g, '').slice(-4), 10) || 0) % 36) + 1);
  const nr = size * 0.95;
  ctx.save();
  ctx.strokeStyle = ink;
  ctx.lineWidth = size * 0.09;
  ctx.beginPath();
  ctx.arc(cx, by - size * 0.36, nr, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  text(ctx, num, cx, by, { font, size, weight: 'bold', color: ink, align: 'center' });
  text(ctx, t.exposure.toUpperCase(), photo.x, by, { font, size, weight: 'bold', color: ink, maxWidth: photo.w / 2 - nr * 2 });
  text(ctx, dp ? `${MONTHS[dp.m]} ${String(dp.y).slice(2)}` : '', photo.x + photo.w, by, { font, size, weight: 'bold', color: ink, align: 'right', maxWidth: photo.w / 2 - nr * 2 });

  // Camera and lens printed up the left side, the brand down the right.
  const vsize = Math.min(sideM * 0.2, S * 0.024);
  const side = [t.camera, t.lens].filter(Boolean).join('  ·  ').toUpperCase();
  ctx.save();
  ctx.translate(content.x + sideM * 0.5 + vsize * 0.35, photo.y + photo.h / 2);
  ctx.rotate(-Math.PI / 2);
  text(ctx, side, 0, 0, { font, size: vsize, color: ink, align: 'center', maxWidth: photo.h * 0.95 });
  ctx.restore();
  if (t.hasLogo || t.make) {
    ctx.save();
    ctx.translate(photo.x + photo.w + sideM * 0.5, photo.y + photo.h / 2);
    ctx.rotate(Math.PI / 2);
    if (t.hasLogo) brandRow(ctx, t.brands, 0, 0, vsize * 0.85, { color: ink, rule: 'rgba(79,74,64,0.5)', align: 'center', font, maxWidth: photo.h * 0.6 });
    else text(ctx, t.make.toUpperCase(), 0, vsize * 0.35, { font, size: vsize, weight: 'bold', color: ink, align: 'center' });
    ctx.restore();
  }
}

// ---------- Cinema ----------

/** Spreads letters apart with hair spaces (canvas letterSpacing isn't everywhere yet). */
const tracked = (s) => [...String(s || '')].join(' ');

function drawCinema({ ctx, font, S, L, t, fields, settings }) {
  const { photo, content } = L;
  const topH = photo.y - content.y;
  const botH = content.y + content.h - photo.y - photo.h;
  const cx = photo.x + photo.w / 2;
  const dp = dateParts(fields.date);
  const geo = geoFor(fields, photo.w < photo.h);
  const [place, rest] = placeLines(settings.show.place || TEMPLATES[settings.template].map ? geo.place : null);

  // Opening title card: place (when shown) and date, widely tracked.
  const when = [dp && settings.show.date ? `${MONTH_NAMES[dp.m]} ${dp.d}, ${dp.y}` : '', settings.show.time ? fields.time : ''].filter(Boolean).join('  ·  ');
  const title = [place && [place, rest].filter(Boolean).join(', '), when].filter(Boolean).join('   —   ');
  if (topH > S * 0.03) {
    text(ctx, tracked(title.toUpperCase()), cx, photo.y - topH * 0.42, { font, size: Math.min(topH * 0.17, S * 0.02), color: 'rgba(255,255,255,0.78)', align: 'center', maxWidth: photo.w * 0.9 });
  }

  // Subtitle (the caption), then a credit line with the camera details.
  if (botH > S * 0.03) {
    const camera = [t.make, t.model].filter(Boolean).join(' ');
    const credit = [camera && `Shot on ${camera}`, t.lens, t.exposure, t.artist].filter(Boolean).join('   ·   ');
    const sub = t.caption;
    if (sub) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = S * 0.004;
      text(ctx, sub, cx, photo.y + photo.h + botH * 0.45, { font, size: Math.min(botH * 0.24, S * 0.034), color: '#ffffff', align: 'center', maxWidth: photo.w * 0.9 });
      ctx.restore();
    }
    text(ctx, tracked(credit.toUpperCase()), cx, photo.y + photo.h + botH * (sub ? 0.76 : 0.56), { font, size: Math.min(botH * 0.13, S * 0.016), color: 'rgba(255,255,255,0.55)', align: 'center', maxWidth: photo.w * 0.92 });
  }
}

// ---------- Helpers ----------

function stackCentered(ctx, lines, cx, cy, maxWidth, font) {
  stack(ctx, lines, cx, cy, maxWidth, font, 'center');
}

/** Draws lines (text or brand rows) as a block vertically centred on cy. */
function stack(ctx, lines, x, cy, maxWidth, font, align) {
  const heights = lines.map((l) => (l.row ? l.size * 2.3 : l.size * (l.gap || 1.55)));
  let y = cy - heights.reduce((a, b) => a + b, 0) / 2;
  lines.forEach((l, i) => {
    if (l.row) brandRow(ctx, l.row, x, y + heights[i] * 0.45, l.size, { color: l.color, rule: l.rule, align, font, maxWidth });
    else text(ctx, l.s, x, y + heights[i] * 0.7, { font: l.font || font, size: l.size, weight: l.weight, italic: l.italic, color: l.color, align, maxWidth });
    y += heights[i];
  });
}

// ---------- Brand logos ----------

const pathCache = new Map();
function logoPaths(key) {
  if (!pathCache.has(key)) pathCache.set(key, LOGOS[key].paths.map(([d, evenodd]) => [new Path2D(d), evenodd ? 'evenodd' : 'nonzero']));
  return pathCache.get(key);
}
// Optical size corrections: scripts with flourishes and stacked marks look
// small next to block wordmarks at the same height.
const OPTICAL = { leica: 1.7, voigtlander: 1.4, 'om-system': 1.35, hasselblad: 0.9, schneider: 1.45, vivo: 1.35, oppo: 1.25, htc: 1.2, realme: 1.15 };
function logoHeight(key, h) {
  const [, , w, hh] = LOGOS[key].vb;
  return h * (OPTICAL[key] || (w / hh < 1.6 ? 1.45 : 1)); // compact marks (Apple) need more height
}
function logoWidth(key, h) {
  const [, , w, hh] = LOGOS[key].vb;
  return (logoHeight(key, h) * w) / hh;
}
/** Draws a logo with its left edge at x, vertically centred on cy. Returns its width. */
function drawLogo(ctx, key, x, cy, h, color) {
  const [vx, vy, , vh] = LOGOS[key].vb;
  const eh = logoHeight(key, h);
  const k = eh / vh;
  ctx.save();
  ctx.translate(x, cy - eh / 2);
  ctx.scale(k, k);
  ctx.translate(-vx, -vy);
  ctx.fillStyle = color;
  for (const [path, rule] of logoPaths(key)) ctx.fill(path, rule);
  ctx.restore();
  return logoWidth(key, h);
}

/**
 * Draws brand marks in a row: logos, or the brand name as text where no logo
 * exists, separated by a thin rule. h is the cap height. Returns the width used.
 */
function brandRow(ctx, items, x, cy, h, { color, rule, align = 'left', font, maxWidth = Infinity }) {
  if (font.upper) items = items.map((it) => (it.text ? { text: it.text.toUpperCase() } : it));
  const measure = (hh) => {
    const size = hh * 1.38 * (font.k || 1); // cap height ≈ 0.72 of the font size
    ctx.font = fontSpec(font, font.bold, size);
    const widths = items.map((it) => (it.logo ? logoWidth(it.logo, hh) : ctx.measureText(it.text).width));
    const gap = hh * 0.8;
    return { size, widths, gap, total: widths.reduce((a, b) => a + b, 0) + (items.length - 1) * gap * 2 };
  };
  let m = measure(h);
  if (m.total > maxWidth) { h *= maxWidth / m.total; m = measure(h); }
  let cursor = align === 'left' ? x : align === 'right' ? x - m.total : x - m.total / 2;
  items.forEach((it, i) => {
    if (it.logo) drawLogo(ctx, it.logo, cursor, cy, h, color);
    else {
      ctx.font = fontSpec(font, font.bold, m.size);
      ctx.fillStyle = color;
      ctx.textAlign = 'left';
      ctx.fillText(it.text, cursor, cy + h / 2);
    }
    cursor += m.widths[i];
    if (i < items.length - 1) {
      ctx.fillStyle = rule || color;
      ctx.fillRect(cursor + m.gap - h * 0.04, cy - h * 0.7, Math.max(h * 0.08, 0.5), h * 1.4);
      cursor += m.gap * 2;
    }
  });
  return m.total;
}

/** Draws text, shrinking it to fit maxWidth. Returns the drawn width. */
function text(ctx, s, x, y, { font, size, weight = 'regular', italic = false, color, align = 'left', maxWidth = Infinity }) {
  if (!s) return 0;
  if (font.upper) s = s.toUpperCase();
  const w = weight === 'bold' ? font.bold : font.regular;
  let px = size * (font.k || 1);
  const spec = (p) => fontSpec(font, w, p, italic);
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

// Backdrop blur. The photo is reduced to BLUR_EDGE px, blurred with three
// box-blur passes (a close Gaussian approximation) and then scaled up. At this
// size the blur is smooth when enlarged; the old 28 px version looked blocky.
// Cached because strip rendering draws the backdrop once per tile.
const BLUR_EDGE = 640;
const BLUR_RADIUS = 0.035; // of the long edge; σ ≈ radius for 3 passes
const blurCache = new WeakMap();

function blurredCopy(img, width, height) {
  const key = `${Math.round(width)}x${Math.round(height)}`;
  const hit = blurCache.get(img);
  if (hit?.key === key) return hit.canvas;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const k = BLUR_EDGE / Math.max(width, height);
  const out = document.createElement('canvas');
  out.width = Math.max(2, Math.round(width * k));
  out.height = Math.max(2, Math.round(height * k));
  const ctx = out.getContext('2d', { willReadFrequently: true });
  // Cover-fit with a slight zoom so the photo's edges don't show.
  const cover = Math.max(out.width / iw, out.height / ih) * 1.1;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(stepDown(img, iw * cover, ih * cover), (out.width - iw * cover) / 2, (out.height - ih * cover) / 2, iw * cover, ih * cover);
  const px = ctx.getImageData(0, 0, out.width, out.height);
  const r = Math.max(2, Math.round(BLUR_EDGE * BLUR_RADIUS));
  for (let pass = 0; pass < 3; pass++) {
    boxBlur(px.data, out.width, out.height, r, true);
    boxBlur(px.data, out.width, out.height, r, false);
  }
  ctx.putImageData(px, 0, 0);
  blurCache.set(img, { key, canvas: out });
  return out;
}

// Halves the image until it's near the target size, so the downscale averages
// every pixel instead of sampling a few (which looks noisy before blurring).
function stepDown(img, tw, th) {
  let src = img;
  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;
  while (w / 2 > tw && h / 2 > th) {
    w = Math.round(w / 2);
    h = Math.round(h / 2);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(src, 0, 0, w, h);
    src = c;
  }
  return src;
}

/** One separable box-blur pass over RGBA data, edges clamped. */
function boxBlur(d, w, h, r, horizontal) {
  const len = horizontal ? w : h;
  const lines = horizontal ? h : w;
  const step = horizontal ? 4 : w * 4;
  const line = new Float32Array(len * 3);
  const span = 2 * r + 1;
  for (let l = 0; l < lines; l++) {
    const base = horizontal ? l * w * 4 : l * 4;
    for (let i = 0; i < len; i++) {
      const p = base + i * step;
      line[i * 3] = d[p]; line[i * 3 + 1] = d[p + 1]; line[i * 3 + 2] = d[p + 2];
    }
    let sr = 0, sg = 0, sb = 0;
    for (let i = -r; i <= r; i++) {
      const j = Math.min(len - 1, Math.max(0, i)) * 3;
      sr += line[j]; sg += line[j + 1]; sb += line[j + 2];
    }
    for (let i = 0; i < len; i++) {
      const p = base + i * step;
      d[p] = sr / span; d[p + 1] = sg / span; d[p + 2] = sb / span;
      const add = Math.min(len - 1, i + r + 1) * 3;
      const sub = Math.max(0, i - r) * 3;
      sr += line[add] - line[sub]; sg += line[add + 1] - line[sub + 1]; sb += line[add + 2] - line[sub + 2];
    }
  }
}

// Faint 1-pixel grain over the enlarged blur hides 8-bit banding in smooth gradients.
let grainTile;
function grain() {
  if (grainTile) return grainTile;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const img = g.createImageData(128, 128);
  let seed = 0x2f6b9a1; // fixed seed: preview and export get the same grain
  for (let i = 0; i < img.data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const v = seed >>> 24;
    const light = v & 1;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = light ? 255 : 0;
    img.data[i + 3] = (v >> 1) % 9; // alpha 0–8 of 255 (≤ 3%)
  }
  g.putImageData(img, 0, 0);
  return (grainTile = c);
}

function drawBlurBackground(ctx, img, width, height, scale = 1) {
  ctx.save();
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(blurredCopy(img, width, height), 0, 0, width, height);
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.fillRect(0, 0, width, height);
  const pattern = ctx.createPattern(grain(), 'repeat');
  if (pattern?.setTransform) {
    pattern.setTransform(new DOMMatrix([1 / scale, 0, 0, 1 / scale, 0, 0])); // one grain dot per output pixel
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, width, height);
  }
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
