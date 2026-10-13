// Generates public/tiles.svg: a license-free sprite of all 42 tiles built from
// plain text glyphs (no third-party artwork). Run: node scripts/generate-tiles-sprite.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const NUMERALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const SUIT_GLYPH = { m: '萬', p: '筒', s: '索' };
const SUIT_COLOR = { m: '#b91c1c', p: '#1d4ed8', s: '#15803d' };
const HONORS = {
  z1: ['東', '#111827'],
  z2: ['南', '#111827'],
  z3: ['西', '#111827'],
  z4: ['北', '#111827'],
  z5: ['白', '#6b7280'],
  z6: ['發', '#15803d'],
  z7: ['中', '#b91c1c'],
};
const BONUS = {
  f1: ['梅', '#be185d'],
  f2: ['蘭', '#be185d'],
  f3: ['菊', '#be185d'],
  f4: ['竹', '#be185d'],
  f5: ['春', '#b45309'],
  f6: ['夏', '#b45309'],
  f7: ['秋', '#b45309'],
  f8: ['冬', '#b45309'],
};
const FONT = "'Noto Serif TC','PingFang TC','Microsoft JhengHei',serif";

const face = (inner) =>
  `<rect x="2" y="2" width="56" height="76" rx="7" fill="#fffdf5" stroke="#374151" stroke-width="2"/>${inner}`;
const text = (y, size, color, s) =>
  `<text x="30" y="${y}" font-size="${size}" font-family="${FONT}" font-weight="700" text-anchor="middle" fill="${color}">${s}</text>`;

const symbols = [];
for (const suit of ['m', 'p', 's']) {
  for (let n = 1; n <= 9; n++) {
    symbols.push([
      `${suit}${n}`,
      face(
        text(40, 30, SUIT_COLOR[suit], suit === 'm' ? NUMERALS[n - 1] : String(n)) +
          text(66, 22, SUIT_COLOR[suit], SUIT_GLYPH[suit]),
      ),
    ]);
  }
}
for (const [code, [glyph, color]] of Object.entries(HONORS)) {
  symbols.push([code, face(text(52, 42, color, glyph))]);
}
for (const [code, [glyph, color]] of Object.entries(BONUS)) {
  symbols.push([
    code,
    face(
      `<rect x="6" y="6" width="48" height="68" rx="5" fill="none" stroke="${color}" stroke-width="1.5"/>` +
        text(52, 40, color, glyph),
    ),
  ]);
}

const svg =
  `<svg xmlns="http://www.w3.org/2000/svg">\n` +
  symbols
    .map(([id, body]) => `<symbol id="${id}" viewBox="0 0 60 80">${body}</symbol>`)
    .join('\n') +
  `\n</svg>\n`;

writeFileSync(fileURLToPath(new URL('../public/tiles.svg', import.meta.url)), svg);
console.log(`Wrote ${symbols.length} tile symbols to public/tiles.svg`);
