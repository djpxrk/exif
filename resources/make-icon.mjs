// Rasterises the app icon (a framed photo with an exposure strip) to PNG, no deps.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

function png(size) {
  const px = new Uint8Array(size * size * 4);
  const u = size / 1024;
  const set = (x, y, [r, g, b], a = 255) => { const i = (y * size + x) * 4; px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a; };
  const rect = (x0, y0, x1, y1, c) => { for (let y = Math.round(y0 * u); y < Math.round(y1 * u); y++) for (let x = Math.round(x0 * u); x < Math.round(x1 * u); x++) set(x, y, c); };
  rect(0, 0, 1024, 1024, [119, 119, 119]);              // gray card
  rect(212, 232, 812, 792, [255, 255, 255]);            // frame
  // photo with a vertical gradient (dusk sky to warm ground)
  for (let y = Math.round(252 * u); y < Math.round(652 * u); y++) {
    const t = (y / u - 252) / 400;
    const c = [77 + (217 - 77) * t, 90 + (205 - 90) * t, 99 + (177 - 99) * t].map(Math.round);
    for (let x = Math.round(232 * u); x < Math.round(792 * u); x++) set(x, y, c);
  }
  rect(262, 700, 452, 724, [26, 26, 26]);               // model line
  rect(262, 742, 392, 756, [150, 150, 150]);            // lens line
  rect(592, 700, 762, 724, [26, 26, 26]);               // exposure line
  rect(572, 696, 576, 760, [200, 200, 200]);            // divider
  // AF brackets
  const k = [255, 255, 255], L = 70, T = 14;
  for (const [x, y, dx, dy] of [[150, 170, 1, 1], [874, 170, -1, 1], [150, 854, 1, -1], [874, 854, -1, -1]]) {
    rect(Math.min(x, x + dx * L), Math.min(y, y + dy * T), Math.max(x, x + dx * L), Math.max(y, y + dy * T), k);
    rect(Math.min(x, x + dx * T), Math.min(y, y + dy * L), Math.max(x, x + dx * T), Math.max(y, y + dy * L), k);
  }
  // Opaque RGB output: the App Store rejects icons with an alpha channel.
  const row = size * 3 + 1;
  const raw = Buffer.alloc(size * row);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    raw[y * row + 1 + x * 3] = px[i]; raw[y * row + 2 + x * 3] = px[i + 1]; raw[y * row + 3 + x * 3] = px[i + 2];
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function crc32(buf) { let c, crc = 0xffffffff; for (const b of buf) { c = (crc ^ b) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return crc ^ 0xffffffff; }

mkdirSync('public', { recursive: true }); mkdirSync('resources', { recursive: true });
for (const s of [180, 192, 512]) writeFileSync(`public/icon-${s}.png`, png(s));
writeFileSync('resources/icon-1024.png', png(1024));
writeFileSync('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', png(1024));
