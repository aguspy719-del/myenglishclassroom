/**
 * Generate all PWA icons from public/icons/logonew.png (the source logo).
 *
 * - icon-192.png / icon-512.png  → transparent RGBA (logo only, NO background)
 * - icon-maskable-*.png          → brand emerald gradient + logo at 80% safe zone
 *                                  (Android home-screen icons cannot be transparent:
 *                                  launchers render transparency as black. Emerald
 *                                  keeps it clean, on-brand, and never white/black-boxed)
 * - apple-touch-icon.png         → same brand gradient (iOS also renders
 *                                  transparent home-screen icons as black)
 *
 * Usage: node scripts/gen-icons-from-logo.cjs
 */
const zlib = require("zlib");
const fs = require("fs");

const SOURCE = "public/icons/logonew.png";

// ── PNG decode (supports RGB + RGBA) ────────────────────────
function readPNG(path) {
  const buf = fs.readFileSync(path);
  let pos = 8, ihdr = null;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.slice(pos + 8, pos + 8 + len);
    if (type === "IHDR") ihdr = { w: data.readUInt32BE(0), h: data.readUInt32BE(4), colorType: data[9] };
    if (type === "IDAT") idat.push(data);
    pos += 12 + len;
  }
  const ch = ihdr.colorType === 6 ? 4 : 3;
  const stride = ihdr.w * ch;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(ihdr.h * stride);
  let rp = 0;
  for (let y = 0; y < ihdr.h; y++) {
    const f = raw[rp++];
    const row = y * stride, prev = row - stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? out[row + x - ch] : 0;
      const b = y > 0 ? out[prev + x] : 0;
      const c = x >= ch && y > 0 ? out[prev + x - ch] : 0;
      let v = raw[rp + x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      out[row + x] = v & 0xff;
    }
    rp += stride;
  }
  return { w: ihdr.w, h: ihdr.h, ch, px: out };
}

// ── Trim fully-transparent borders (logo fills the icon) ────
function trim(img, marginPct = 0.02) {
  let minX = img.w, minY = img.h, maxX = 0, maxY = 0;
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      const a = img.px[(y * img.w + x) * img.ch + 3];
      if (a > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (minX > maxX || minY > maxY) return img; // fully transparent — leave as-is
  const mw = maxX - minX + 1, mh = maxY - minY + 1;
  const mx = Math.round(mw * marginPct), my = Math.round(mh * marginPct);
  minX = Math.max(0, minX - mx); minY = Math.max(0, minY - my);
  maxX = Math.min(img.w - 1, maxX + mx); maxY = Math.min(img.h - 1, maxY + my);
  const w = maxX - minX + 1, h = maxY - minY + 1;
  const px = Buffer.alloc(w * h * img.ch);
  for (let y = 0; y < h; y++) {
    img.px.copy(px, y * w * img.ch, ((y + minY) * img.w + minX) * img.ch, ((y + minY) * img.w + minX + w) * img.ch);
  }
  return { w, h, ch: img.ch, px };
}

// ── Encode PNG (colorType 2 = RGB opaque, 6 = RGBA transparent) ─
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(w, h, px, colorType) {
  const ch = colorType === 6 ? 4 : 3;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = colorType;
  const stride = w * ch;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filter none
    px.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── Area-average resize (premultiplied alpha, no dark halo) ─
function resize(src, tw, th) {
  const out = Buffer.alloc(tw * th * 4); // always RGBA internally
  const sx = src.w / tw, sy = src.h / th;
  for (let y = 0; y < th; y++) {
    const y0 = Math.floor(y * sy), y1 = Math.min(Math.floor((y + 1) * sy), src.h);
    for (let x = 0; x < tw; x++) {
      const x0 = Math.floor(x * sx), x1 = Math.min(Math.floor((x + 1) * sx), src.w);
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const o = (yy * src.w + xx) * src.ch;
          const al = src.ch === 4 ? src.px[o + 3] : 255;
          r += src.px[o] * al; g += src.px[o + 1] * al; b += src.px[o + 2] * al; a += al; n++;
        }
      }
      const o2 = (y * tw + x) * 4;
      if (a > 0) {
        out[o2] = Math.round(r / a); out[o2 + 1] = Math.round(g / a); out[o2 + 2] = Math.round(b / a); out[o2 + 3] = Math.round(a / n);
      } else out[o2 + 3] = 0;
    }
  }
  return { w: tw, h: th, px: out };
}

// ── RGBA → opaque RGB over a brand gradient (top → bottom) ──
// Brand colors from the app theme: emerald-700 → emerald-900
const BRAND_TOP = [4, 120, 87];    // #047857
const BRAND_BOTTOM = [6, 78, 59];  // #064e3b
function overGradient(img, top = BRAND_TOP, bottom = BRAND_BOTTOM) {
  const out = Buffer.alloc(img.w * img.h * 3);
  for (let y = 0; y < img.h; y++) {
    const t = img.h > 1 ? y / (img.h - 1) : 0;
    const br = Math.round(top[0] + (bottom[0] - top[0]) * t);
    const bg = Math.round(top[1] + (bottom[1] - top[1]) * t);
    const bb = Math.round(top[2] + (bottom[2] - top[2]) * t);
    for (let x = 0; x < img.w; x++) {
      const i = (y * img.w + x) * 4, j = (y * img.w + x) * 3;
      const a = img.px[i + 3] / 255;
      out[j] = Math.round(img.px[i] * a + br * (1 - a));
      out[j + 1] = Math.round(img.px[i + 1] * a + bg * (1 - a));
      out[j + 2] = Math.round(img.px[i + 2] * a + bb * (1 - a));
    }
  }
  return out;
}

// ── Maskable: logo at 80% centered on brand gradient full-bleed ─
function maskable(src, size) {
  const inner = resize(src, Math.round(size * 0.8), Math.round(size * 0.8));
  // Gradient canvas row by row (matches overGradient interpolation)
  const rgb = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y++) {
    const t = size > 1 ? y / (size - 1) : 0;
    const br = Math.round(BRAND_TOP[0] + (BRAND_BOTTOM[0] - BRAND_TOP[0]) * t);
    const bg = Math.round(BRAND_TOP[1] + (BRAND_BOTTOM[1] - BRAND_TOP[1]) * t);
    const bb = Math.round(BRAND_TOP[2] + (BRAND_BOTTOM[2] - BRAND_TOP[2]) * t);
    for (let x = 0; x < size; x++) {
      const j = (y * size + x) * 3;
      rgb[j] = br; rgb[j + 1] = bg; rgb[j + 2] = bb;
    }
  }
  const off = Math.floor((size - inner.w) / 2);
  for (let y = 0; y < inner.h; y++) {
    const line = overGradient({ w: inner.w, h: 1, px: inner.px.slice(y * inner.w * 4, (y + 1) * inner.w * 4) });
    line.copy(rgb, ((y + off) * size + off) * 3);
  }
  return encodePNG(size, size, rgb, 2);
}

// ── Main ────────────────────────────────────────────────────
const original = readPNG(SOURCE);
const src = trim(original);
console.log(`Source: ${SOURCE} ${original.w}x${original.h} → trimmed ${src.w}x${src.h}`);

// Standard "any" icons — TRANSPARENT, logo only (RGBA, no background)
fs.writeFileSync("public/icons/icon-192.png", encodePNG(192, 192, resize(src, 192, 192).px, 6));
fs.writeFileSync("public/icons/icon-512.png", encodePNG(512, 512, resize(src, 512, 512).px, 6));
// Maskable — brand gradient full-bleed safe zone (Android requirement:
// opaque background, transparency renders as black on home screen)
fs.writeFileSync("public/icons/icon-maskable-192.png", maskable(src, 192));
fs.writeFileSync("public/icons/icon-maskable-512.png", maskable(src, 512));
// Apple touch — brand gradient (iOS renders transparency as black)
const appleInner = resize(src, Math.round(180 * 0.9), Math.round(180 * 0.9));
const appleCanvas = Buffer.alloc(180 * 180 * 3);
for (let y = 0; y < 180; y++) {
  const t = y / 179;
  const br = Math.round(BRAND_TOP[0] + (BRAND_BOTTOM[0] - BRAND_TOP[0]) * t);
  const bg = Math.round(BRAND_TOP[1] + (BRAND_BOTTOM[1] - BRAND_TOP[1]) * t);
  const bb = Math.round(BRAND_TOP[2] + (BRAND_BOTTOM[2] - BRAND_TOP[2]) * t);
  for (let x = 0; x < 180; x++) {
    const j = (y * 180 + x) * 3;
    appleCanvas[j] = br; appleCanvas[j + 1] = bg; appleCanvas[j + 2] = bb;
  }
}
const appleLine = overGradient(appleInner);
const aOff = Math.floor((180 - appleInner.w) / 2);
for (let y = 0; y < appleInner.h; y++) {
  appleLine.slice(y * appleInner.w * 3, (y + 1) * appleInner.w * 3).copy(
    appleCanvas, ((y + aOff) * 180 + aOff) * 3
  );
}
fs.writeFileSync("public/apple-touch-icon.png", encodePNG(180, 180, appleCanvas, 2));
console.log("Generated: icon-192 (transparent), icon-512 (transparent), icon-maskable-192, icon-maskable-512, apple-touch-icon (brand gradient)");
