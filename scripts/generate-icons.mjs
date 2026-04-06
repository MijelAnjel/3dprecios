/**
 * generate-icons.mjs
 * Generates PWA PNG icons from the 3DPrecios brand hexagon.
 * No external dependencies — uses only Node.js built-ins.
 */
import { deflateSync } from 'zlib';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── CRC32 (required for PNG chunks) ─────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++)
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type);
  const lenBuf = Buffer.allocUnsafe(4);
  lenBuf.writeUInt32BE(data.length);
  const crcBuf = Buffer.allocUnsafe(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([lenBuf, t, data, crcBuf]);
}

// ── Brand colors ─────────────────────────────────────────────────────────────
const BG  = [10,  10,  15];   // #0A0A0F  (dark background)
const HEX = [255, 107, 53];   // #FF6B35  (primary orange)

// ── Hexagon geometry (pointy-top, 88% scale) ─────────────────────────────────
// Original points for 512×512:
//   429.52,156  256,56  83.48,156  83.48,356  256,456  429.52,356
// Scaled ×0.88 centered:  (orig - 256) * 0.88 + 256
const RAW_HEX = [
  [404.52, 167.12],
  [256,     76.32],
  [107.48, 167.12],
  [107.48, 344.88],
  [256,    435.68],
  [404.52, 344.88],
];

function scaleHex(size) {
  const s = size / 512;
  return RAW_HEX.map(([x, y]) => [x * s, y * s]);
}

function pointInPolygon(px, py, poly) {
  let inside = false;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

// ── Pixel generator with 4× supersampling ────────────────────────────────────
function generatePixels(size) {
  const SS = 4;
  const poly = scaleHex(size);
  const buf = Buffer.allocUnsafe(size * size * 3);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hexSamples = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          if (pointInPolygon(px, py, poly)) hexSamples++;
        }
      }
      const t = hexSamples / (SS * SS);
      const off = (y * size + x) * 3;
      buf[off]     = Math.round(HEX[0] * t + BG[0] * (1 - t));
      buf[off + 1] = Math.round(HEX[1] * t + BG[1] * (1 - t));
      buf[off + 2] = Math.round(HEX[2] * t + BG[2] * (1 - t));
    }
  }
  return buf;
}

// ── Write PNG ─────────────────────────────────────────────────────────────────
function writePNG(size, pixels) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8]  = 8; // bit depth
  ihdr[9]  = 2; // color type: RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // Raw scanlines: filter-byte(0) + RGB row
  const rowBytes = 1 + size * 3;
  const raw = Buffer.allocUnsafe(size * rowBytes);
  for (let y = 0; y < size; y++) {
    raw[y * rowBytes] = 0;
    pixels.copy(raw, y * rowBytes + 1, y * size * 3, (y + 1) * size * 3);
  }

  const idat = deflateSync(raw, { level: 9 });

  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ── Main ──────────────────────────────────────────────────────────────────────
const outDir = join(__dirname, '../public/icons');
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

for (const size of sizes) {
  process.stdout.write(`  ${size}×${size} … `);
  const pixels = generatePixels(size);
  const png = writePNG(size, pixels);
  writeFileSync(join(outDir, `icon-${size}x${size}.png`), png);
  console.log('✓');
}
console.log('\nAll icons generated successfully.');
