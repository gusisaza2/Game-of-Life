// Generates the app icons (PWA install, iOS home screen, favicon) from one
// piece of flat-vector artwork: the Voyage Map's hexagon node with a winding
// path climbing to an amber node -- the same visual language as the app.
//
//   node scripts/generate-icons.mjs
//
// Outputs are committed, so this only needs re-running if the artwork changes.
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const TEAL = "#0d9488";
const TEAL_DARK = "#0f766e";
const MINT = "#e9f9f0";
const AMBER = "#e2a53a";

// The artwork, drawn on a 512x512 canvas. `scale` shrinks it toward the
// center so it fits inside a platform's safe zone.
function artwork(scale = 1) {
  // Hexagon (pointy-top), same shape as the Voyage Map's nodes.
  const cx = 256, cy = 256, r = 176;
  const hex = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 90);
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  }).join(" ");

  return `
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
    <polygon points="${hex}" fill="${MINT}" />
    <path d="M 196 344 C 196 292 322 306 322 252 C 322 206 204 218 204 176"
          fill="none" stroke="${TEAL}" stroke-width="26" stroke-linecap="round" />
    <circle cx="196" cy="344" r="17" fill="${TEAL}" />
    <circle cx="204" cy="170" r="30" fill="${AMBER}" stroke="${MINT}" stroke-width="10" />
  </g>`;
}

const defs = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${TEAL}" />
      <stop offset="1" stop-color="${TEAL_DARK}" />
    </linearGradient>
  </defs>`;

// "any": a rounded square with breathing room around it, like a macOS app
// icon -- what Chrome/Edge/Safari show in the Dock or taskbar.
const anySvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${defs}
  <rect x="32" y="32" width="448" height="448" rx="104" fill="url(#bg)" />
  ${artwork(0.8)}
</svg>`;

// Full-bleed and opaque: iOS rounds it itself (and paints transparency
// black), and "maskable" icons are cropped by the platform into its own shape.
const bleedSvg = (scale) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${defs}
  <rect width="512" height="512" fill="url(#bg)" />
  ${artwork(scale)}
</svg>`;

const png = (svg, size) => sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();

// ICO container holding PNG images (every current browser reads these).
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

const out = (path, data) => {
  writeFileSync(path, data);
  console.log("wrote", path, `${data.length} bytes`);
};

out("public/icons/icon-192.png", await png(anySvg, 192));
out("public/icons/icon-512.png", await png(anySvg, 512));
// Maskable: artwork kept inside the central ~60% so any crop shows it whole.
out("public/icons/maskable-512.png", await png(bleedSvg(0.62), 512));
out("src/app/icon.png", await png(anySvg, 512));
out("src/app/apple-icon.png", await png(bleedSvg(0.74), 180));
out(
  "src/app/favicon.ico",
  ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(anySvg, size) })))),
);
