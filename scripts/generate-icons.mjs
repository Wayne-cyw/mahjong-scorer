// Regenerate the PWA icon set: `node scripts/generate-icons.mjs`.
// The 中 glyph is rendered from a system CJK font, so one must be installed.
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const GREEN = '#0f5132';

// A cream tile with a red "中" glyph on a green field. `scale` shrinks the tile so
// maskable icons keep the glyph inside the 80% safe zone.
function svg(size, scale) {
  const w = size * 0.46 * scale;
  const h = size * 0.6 * scale;
  const x = (size - w) / 2;
  const y = (size - h) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${GREEN}"/>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w * 0.12}" fill="#f5efdc" stroke="#c9bd94" stroke-width="${size * 0.012}"/>
  <text x="${size / 2}" y="${y + h * 0.7}" font-family="PingFang TC, Noto Sans CJK TC, Heiti TC, sans-serif" font-size="${h * 0.62}" font-weight="700" fill="#c0392b" text-anchor="middle">中</text>
</svg>`;
}

const targets = [
  ['icon-192.png', 192, 1],
  ['icon-512.png', 512, 1],
  ['maskable-512.png', 512, 0.8],
  ['apple-touch-icon.png', 180, 1],
];

await mkdir('public/icons', { recursive: true });
for (const [name, size, scale] of targets) {
  const png = await sharp(Buffer.from(svg(size, scale)))
    .png()
    .toBuffer();
  await writeFile(`public/icons/${name}`, png);
  console.log(`wrote public/icons/${name}`);
}
