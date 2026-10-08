// Which logo to draw for a camera brand and for a lens.

import { LOGOS } from './logos.js';
import { normModel } from './crop.js';

// Normalised brand text → logo key. Includes what users might type in Details.
const CAMERA_KEYS = {
  sony: 'sony', canon: 'canon', nikon: 'nikon', fujifilm: 'fujifilm', fuji: 'fujifilm',
  lumix: 'lumix', panasonic: 'lumix', omsystem: 'om-system', omdigitalsolutions: 'om-system', olympus: 'olympus',
  leica: 'leica', ricoh: 'ricoh', pentax: 'pentax', sigma: 'sigma', hasselblad: 'hasselblad',
  phaseone: 'phase-one', dji: 'dji', gopro: 'gopro', insta360: 'insta360', apple: 'apple',
  samsung: 'samsung', google: 'google', xiaomi: 'xiaomi', huawei: 'huawei', kodak: 'kodak', zeiss: 'zeiss',
  vivo: 'vivo', oppo: 'oppo', oneplus: 'oneplus', honor: 'honor', motorola: 'motorola', nokia: 'nokia', realme: 'realme',
  meizu: 'meizu', lg: 'lg', asus: 'asus', htc: 'htc', fairphone: 'fairphone', epson: 'epson', seikoepson: 'epson',
  minolta: 'minolta', konicaminolta: 'konica-minolta', mamiya: 'mamiya', rollei: 'rollei', yashica: 'yashica',
};

/** Logo key for a camera brand, or null when there's no logo for it. */
export function cameraLogo(brand) {
  const n = normModel(brand);
  const key = CAMERA_KEYS[n] || Object.entries(CAMERA_KEYS).find(([k]) => n.startsWith(k))?.[1];
  if (key === 'lumix' && !LOGOS.lumix && LOGOS.panasonic) return 'panasonic';
  if (key === 'om-system' && !LOGOS['om-system'] && LOGOS.olympus) return 'olympus';
  return key && LOGOS[key] ? key : null;
}

// Lens name patterns, checked in order. Third-party makers first: their lenses
// often carry a mount prefix (FE, RF, X) that would otherwise look native.
const LENS_RULES = [
  ['sigma', /\bsigma\b|\b(DG|DC)\s?(DN|HSM|OS)\b|\|\s*(art|contemporary|sports|[acs])\b/i],
  ['tamron', /\btamron\b|\b(Di\s?III?|VXD|RXD|USD|VC)\b|\b[ABF]0\d{2}\b/i],
  ['zeiss', /\bzeiss\b|\bZA\b|\bbatis\b|\bloxia\b|\botus\b|\bmilvus\b|\btouit\b|sonnar|planar|distagon|biogon|tessar/i],
  ['voigtlander', /voigtl|nokton|ultron|heliar|skopar|apo-lanthar/i],
  ['viltrox', /\bviltrox\b|^AF \d+(\.\d+)?\/\d/i],
  ['samyang', /\bsamyang\b|\brokinon\b|^AF \d+mm F[\d.]+ (FE|RF|Z|X)\b/i],
  ['tokina', /\btokina\b|\batx\b/i],
  ['laowa', /\blaowa\b/i],
  ['ttartisan', /\bttartisan/i],
  ['7artisans', /\b7\s?artisans\b/i],
  ['sirui', /\bsirui\b/i],
  ['schneider', /schneider|kreuznach|\bxenon\b|super-?angulon|\bxenar\b|apo-?digitar/i],
  ['konica-minolta', /konica\s?minolta/i],
  ['minolta', /\bminolta\b/i],
  ['mamiya', /\bmamiya\b|\bsekor\b/i],
  ['rollei', /\brollei\b/i],
  ['yashica', /\byashica\b/i],
  ['leica', /\bleica\b|summilux|summicron|summarit|elmarit|noctilux|\belmar\b|\bapo-?summicron/i],
  ['fujifilm', /^(XF|XC|GF)\s?\d/i],
  ['canon', /^(RF|EF|EF-S|EF-M)\s?\d/i],
  ['nikon', /\bnikkor\b/i],
  ['olympus', /\bm\.?\s?zuiko\b|\bzuiko\b|^olympus\b/i],
  ['om-system', /^om system\b/i],
  ['lumix', /\blumix\b/i],
  ['pentax', /\bpentax\b|\bsmc\b|^HD\s?(DA|FA|D FA)/i],
  ['hasselblad', /^(XCD|HC|HCD)\s?\d/i],
  ['sony', /^(FE|E)\s?\d|\bG Master\b|\bGM\b|\bSEL\d/i],
];

const THIRD_PARTY = new Set(['sigma', 'tamron', 'zeiss', 'voigtlander', 'viltrox', 'samyang', 'tokina', 'laowa', 'ttartisan', '7artisans', 'sirui',
  'schneider', 'konica-minolta', 'minolta', 'mamiya', 'rollei', 'yashica']);

/**
 * Lens maker key from the lens name and LensMake tag. Third-party name
 * patterns win over LensMake, because some bodies write their own brand
 * into LensMake for any lens.
 */
export function lensBrand(lensName, lensMake = '') {
  const name = String(lensName || '').trim();
  const match = (keys) => LENS_RULES.find(([key, re]) => keys(key) && re.test(name))?.[0] || null;
  return (name && match((k) => THIRD_PARTY.has(k)))
    || (lensMake && CAMERA_KEYS[normModel(lensMake)]) || (lensMake && Object.entries(CAMERA_KEYS).find(([k]) => normModel(lensMake).startsWith(k))?.[1])
    || (name && match((k) => !THIRD_PARTY.has(k)))
    || null;
}

/** Logo key for the lens maker, or null when unknown or there's no logo for it. */
export function lensLogo(lensName, lensMake = '') {
  const key = lensBrand(lensName, lensMake);
  return key && LOGOS[key] ? key : null;
}
