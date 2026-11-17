import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) {
    c = (c >>> 8) ^ crcTable[(c ^ buf[i]) & 0xff];
  }
  return (c ^ -1) >>> 0;
}

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  const combined = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(combined), 0);
  return Buffer.concat([lenBuf, combined, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const compressed = zlib.deflateSync(raw, { level: 6 });

  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function renderIcon(size, maskable = false) {
  const buf = Buffer.alloc(size * size * 4);
  const scale = size / 512;
  const safeScale = maskable ? 0.72 : 1.0;
  const offset = (512 * (1 - safeScale)) / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const gx = x / scale;
      const gy = y / scale;

      // Gradient background (#1E40AF -> #2563EB)
      const t = (gx + gy) / 1024;
      let r = Math.round(30 + (37 - 30) * t);
      let g = Math.round(64 + (99 - 64) * t);
      let b = Math.round(175 + (235 - 175) * t);
      let a = 255;

      if (!maskable) {
        // Rounded rect mask (rx = 112)
        const rad = 112;
        const cx = gx < rad ? rad : gx > 512 - rad ? 512 - rad : gx;
        const cy = gy < rad ? rad : gy > 512 - rad ? 512 - rad : gy;
        const d = Math.hypot(gx - cx, gy - cy);
        if (d > rad + 1) {
          a = 0;
        } else if (d > rad - 1) {
          a = Math.round(255 * Math.max(0, Math.min(1, rad + 1 - d) / 2));
        }
      }

      // Transform coords into icon space
      const ix = (gx - offset) / safeScale;
      const iy = (gy - offset) / safeScale;

      // Calendar outline box: x in [104..408], y in [124..404], rx=40
      const boxLeft = 104, boxTop = 124, boxRight = 408, boxBottom = 404, boxRad = 40;
      const bx = ix < boxLeft + boxRad ? boxLeft + boxRad : ix > boxRight - boxRad ? boxRight - boxRad : ix;
      const by = iy < boxTop + boxRad ? boxTop + boxRad : iy > boxBottom - boxRad ? boxBottom - boxRad : iy;
      const bd = Math.hypot(ix - bx, iy - by);
      const inBox = ix >= boxLeft && ix <= boxRight && iy >= boxTop && iy <= boxBottom && bd <= boxRad;
      const onBoxBorder = Math.abs(bd - boxRad) <= 10 && ix >= boxLeft - 10 && ix <= boxRight + 10 && iy >= boxTop - 10 && iy <= boxBottom + 10 &&
        (ix <= boxLeft + boxRad || ix >= boxRight - boxRad || iy <= boxTop + boxRad || iy >= boxBottom - boxRad);

      // Straight edges of box
      const onBoxEdge =
        ((Math.abs(ix - boxLeft) <= 9 || Math.abs(ix - boxRight) <= 9) && iy >= boxTop + boxRad && iy <= boxBottom - boxRad) ||
        ((Math.abs(iy - boxTop) <= 9 || Math.abs(iy - boxBottom) <= 9) && ix >= boxLeft + boxRad && ix <= boxRight - boxRad);

      if (inBox) {
        r = Math.round(r * 0.85 + 255 * 0.15);
        g = Math.round(g * 0.85 + 255 * 0.15);
        b = Math.round(b * 0.85 + 255 * 0.15);
      }

      // Divider line at y = 196
      const onDivider = ix >= 112 && ix <= 400 && Math.abs(iy - 196) <= 7;

      // Calendar rings
      const dRing1 = distToSegment(ix, iy, 174, 92, 174, 148);
      const dRing2 = distToSegment(ix, iy, 338, 92, 338, 148);

      // Checkmark
      const dCheck1 = distToSegment(ix, iy, 184, 294, 234, 342);
      const dCheck2 = distToSegment(ix, iy, 234, 342, 338, 242);

      const whiteStroke =
        onBoxBorder ||
        onBoxEdge ||
        dRing1 <= 12 ||
        dRing2 <= 12 ||
        dCheck1 <= 15 ||
        dCheck2 <= 15;

      if (whiteStroke) {
        r = 255; g = 255; b = 255;
      } else if (onDivider) {
        r = Math.round(r * 0.5 + 255 * 0.5);
        g = Math.round(g * 0.5 + 255 * 0.5);
        b = Math.round(b * 0.5 + 255 * 0.5);
      }

      buf[idx] = r;
      buf[idx + 1] = g;
      buf[idx + 2] = b;
      buf[idx + 3] = a;
    }
  }
  return encodePNG(size, size, buf);
}

const outDir = path.resolve(process.cwd(), 'public');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'pwa-192x192.png'), renderIcon(192, false));
fs.writeFileSync(path.join(outDir, 'pwa-512x512.png'), renderIcon(512, false));
fs.writeFileSync(path.join(outDir, 'pwa-maskable-512x512.png'), renderIcon(512, true));
fs.writeFileSync(path.join(outDir, 'apple-touch-icon.png'), renderIcon(180, false));
console.log('Generated PWA PNG icons in public/');
