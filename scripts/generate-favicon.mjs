/**
 * generate-favicon.mjs
 * Generates favicon.ico (16x16, 32x32, 48x48) from the 3DPrecios brand hexagon.
 * ICO format: ICONDIR header + ICONDIRENTRY[] + raw BMP/DIB pixel data.
 * No external dependencies — pure Node.js built-ins.
 */
import { deflateSync } from 'zlib';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Brand colors ─────────────────────────────────────────────────────────────
const BG  = [10,  10,  15,  255]; // #0A0A0F  (R,G,B,A)
const HEX = [255, 107, 53,  255]; // #FF6B35

// ── Hexagon geometry (pointy-top, 88% scale on 512 grid) ─────────────────────
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

// Returns RGBA pixel buffer (size × size)
function generatePixels(size) {
  const SS = 4; // supersampling
  const poly = scaleHex(size);
  const buf = Buffer.allocUnsafe(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hexSamples = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          if (pointInPolygon(x + (sx + 0.5) / SS, y + (sy + 0.5) / SS, poly)) hexSamples++;
        }
      }
      const t = hexSamples / (SS * SS);
      const off = (y * size + x) * 4;
      buf[off]     = Math.round(HEX[0] * t + BG[0] * (1 - t));
      buf[off + 1] = Math.round(HEX[1] * t + BG[1] * (1 - t));
      buf[off + 2] = Math.round(HEX[2] * t + BG[2] * (1 - t));
      buf[off + 3] = 255; // fully opaque
    }
  }
  return buf;
}

// ── PNG helper (same as generate-icons.mjs) ──────────────────────────────────
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

// Build a PNG from RGBA pixels
function buildPNG(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8]  = 8; // bit depth
  ihdr[9]  = 6; // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const rowBytes = 1 + size * 4;
  const raw = Buffer.allocUnsafe(size * rowBytes);
  for (let y = 0; y < size; y++) {
    raw[y * rowBytes] = 0; // filter: None
    rgba.copy(raw, y * rowBytes + 1, y * size * 4, (y + 1) * size * 4);
  }

  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ── ICO file builder ──────────────────────────────────────────────────────────
// ICO = ICONDIR (6 bytes) + N×ICONDIRENTRY (16 bytes each) + image data
// We embed PNG-compressed images (Windows Vista+ supports this)

function buildICO(sizes) {
  const pngs = sizes.map(s => buildPNG(s, generatePixels(s)));

  const headerSize  = 6;
  const entrySize   = 16;
  const dataOffset  = headerSize + sizes.length * entrySize;

  // Calculate each image's offset
  const offsets = [];
  let off = dataOffset;
  for (const png of pngs) {
    offsets.push(off);
    off += png.length;
  }

  // ICONDIR header
  const iconDir = Buffer.allocUnsafe(6);
  iconDir.writeUInt16LE(0, 0);      // reserved
  iconDir.writeUInt16LE(1, 2);      // type: icon
  iconDir.writeUInt16LE(sizes.length, 4);

  // ICONDIRENTRY × N
  const entries = sizes.map((sz, i) => {
    const e = Buffer.allocUnsafe(16);
    e.writeUInt8(sz >= 256 ? 0 : sz, 0);  // width (0 = 256)
    e.writeUInt8(sz >= 256 ? 0 : sz, 1);  // height
    e.writeUInt8(0, 2);   // color count (0 = no palette)
    e.writeUInt8(0, 3);   // reserved
    e.writeUInt16LE(1, 4); // color planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(pngs[i].length, 8);   // image size
    e.writeUInt32LE(offsets[i], 12);       // offset
    return e;
  });

  return Buffer.concat([iconDir, ...entries, ...pngs]);
}

const ico = buildICO([16, 32, 48]);
writeFileSync(join(__dirname, '../src/favicon.ico'), ico);
console.log('favicon.ico generated (16×16, 32×32, 48×48) ✓');
