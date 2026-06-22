/**
 * Generate the OCTION favicon set from app/icon.svg.
 *
 *   node scripts/brand/generate-icons.mjs
 *
 * Outputs:
 *   app/favicon.ico   — multi-size (16/32/48) PNG-encoded ICO (legacy + tab)
 *   app/apple-icon.png — 180×180 (iOS home-screen / Safari pinned)
 *
 * app/icon.svg itself is served as-is to modern browsers; Next.js App Router
 * auto-detects all three by filename and injects the <link> tags — no
 * metadata config needed.
 *
 * sharp can't write .ico, so we render PNGs and pack them into an ICO
 * container by hand (PNG-encoded entries, valid since Windows Vista and
 * accepted by every current browser).
 */
import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { tmpdir } from "node:os";

const root = process.cwd();
const svg = readFileSync(resolve(root, "app/icon.svg"));

// Render one crisp 512 master, then downscale (lanczos) for each target.
const master = await sharp(svg, { density: 512 })
  .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();

const pngAt = (size) => sharp(master).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

/** Pack PNG buffers into a single .ico (icon-dir + entries + PNG blobs). */
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = icon
  header.writeUInt16LE(images.length, 4);

  const entries = Buffer.alloc(16 * images.length);
  let offset = 6 + 16 * images.length;
  for (let i = 0; i < images.length; i++) {
    const { size, buf } = images[i];
    const e = entries.subarray(i * 16, i * 16 + 16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); // width  (0 ⇒ 256)
    e.writeUInt8(size >= 256 ? 0 : size, 1); // height
    e.writeUInt8(0, 2); // palette count
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // color planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(buf.length, 8); // bytes in resource
    e.writeUInt32LE(offset, 12); // offset from file start
    offset += buf.length;
  }
  return Buffer.concat([header, entries, ...images.map((i) => i.buf)]);
}

const icoSizes = [16, 32, 48];
const icoImages = await Promise.all(
  icoSizes.map(async (size) => ({ size, buf: await pngAt(size) }))
);

const write = (rel, data) => {
  const p = resolve(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, data);
  console.log(`  wrote ${rel} (${data.length.toLocaleString()} bytes)`);
};

console.log("OCTION icons:");
write("app/favicon.ico", buildIco(icoImages));
write("app/apple-icon.png", await pngAt(180));
// 512 preview for eyeballing the mark — temp dir, never committed.
const previewPath = join(tmpdir(), "oction-icon-preview-512.png");
writeFileSync(previewPath, await pngAt(512));
console.log(`  preview → ${previewPath}`);
console.log("done.");
