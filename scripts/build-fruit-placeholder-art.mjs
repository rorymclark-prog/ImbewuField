// Writes placeholder fruit icons to public/fruit-art/<speciesId>.svg — one per species in
// lib/perennial-harvest-data.ts — so the crop calendar can show the fruit, nut or berry a tree
// gives rather than a picture of the tree. These are flat stand-ins; Codex replaces them with
// painted PNGs per docs/FRUIT-ART-BRIEF.md, and lib/species-art.ts prefers a PNG when one exists.
//
//   node scripts/build-fruit-placeholder-art.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(process.cwd(), 'public', 'fruit-art');
const STEM = '#6B4A2B';
const LEAF = '#4E8A3A';

const leaf = (x, y, rot = -30) =>
  `<path d="M0 0 C6 -7 16 -6 20 0 C16 6 6 7 0 0Z" fill="${LEAF}" transform="translate(${x} ${y}) rotate(${rot})"/>`;
const stem = (x1, y1, x2, y2) =>
  `<path d="M${x1} ${y1} Q${(x1 + x2) / 2 + 2} ${(y1 + y2) / 2} ${x2} ${y2}" stroke="${STEM}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
const shine = (x, y, r) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.6}" fill="#fff" opacity="0.35" transform="rotate(-35 ${x} ${y})"/>`;

// Shapes. Each returns SVG markup inside a 64×64 box.
const round = (c, { r = 20, cy = 38, crease, dots, crown, stemLeaf = true } = {}) => [
  stemLeaf ? stem(32, cy - r + 2, 34, cy - r - 8) + leaf(34, cy - r - 6) : '',
  `<circle cx="32" cy="${cy}" r="${r}" fill="${c}"/>`,
  crease ? `<path d="M32 ${cy - r + 2} Q26 ${cy} 32 ${cy + r - 2}" stroke="#000" stroke-opacity="0.18" stroke-width="2" fill="none"/>` : '',
  dots ? Array.from({ length: 14 }, (_, i) => {
    const a = (i * 137.5 * Math.PI) / 180, d = r * 0.75 * Math.sqrt((i + 1) / 14);
    return `<circle cx="${(32 + d * Math.cos(a)).toFixed(1)}" cy="${(cy + d * Math.sin(a)).toFixed(1)}" r="1.4" fill="${dots}"/>`;
  }).join('') : '',
  crown ? `<path d="M26 ${cy - r + 3} L28 ${cy - r - 5} L31 ${cy - r + 1} L33 ${cy - r - 6} L35 ${cy - r + 1} L38 ${cy - r - 5} L38 ${cy - r + 3}Z" fill="${crown}"/>` : '',
  shine(24, cy - r * 0.45, r * 0.3),
].join('');

const oval = (c, { rx = 15, ry = 21, rot = 0, nubs = false } = {}) => [
  stem(32, 38 - ry + 1, 34, 38 - ry - 7) + leaf(34, 38 - ry - 5),
  `<g transform="rotate(${rot} 32 38)">`,
  nubs ? `<circle cx="32" cy="${38 - ry}" r="3" fill="${c}"/><circle cx="32" cy="${38 + ry}" r="3" fill="${c}"/>` : '',
  `<ellipse cx="32" cy="38" rx="${rx}" ry="${ry}" fill="${c}"/>`,
  shine(26, 38 - ry * 0.45, rx * 0.35),
  '</g>',
].join('');

const pear = (c, { cut } = {}) => [
  stem(32, 14, 34, 7) + leaf(34, 9),
  `<path d="M32 14 C24 14 24 26 22 32 C16 42 20 58 32 58 C44 58 48 42 42 32 C40 26 40 14 32 14Z" fill="${c}"/>`,
  cut ? `<ellipse cx="32" cy="44" rx="7" ry="8" fill="${cut}"/>` : '',
  shine(26, 26, 4),
].join('');

const teardrop = (c, { inner } = {}) => [
  stem(32, 12, 32, 6),
  `<path d="M32 10 C27 18 14 30 14 42 C14 52 22 58 32 58 C42 58 50 52 50 42 C50 30 37 18 32 10Z" fill="${c}"/>`,
  inner ? `<path d="M32 50 C27 50 24 46 26 41 L32 34 L38 41 C40 46 37 50 32 50Z" fill="${inner}"/>` : '',
  shine(24, 36, 4),
].join('');

const cluster = (c, { r = 8, pts, ry, stemFrom = [32, 11] } = {}) => {
  const P = pts ?? [[32, 22], [22, 34], [42, 34], [28, 47], [40, 48]];
  const [sx, sy] = stemFrom;
  return [
    P.map(([x, y]) => stem(sx, sy, x, y - (ry ?? r) + 1)).join(''),
    leaf(sx, sy + 2, -150),
    P.map(([x, y]) => (ry ? `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${ry}" fill="${c}"/>` : `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`) + shine(x - r * 0.35, y - (ry ?? r) * 0.4, r * 0.3)).join(''),
  ].join('');
};

const bunch = (c) => {
  const P = [[22, 20], [32, 20], [42, 20], [17, 30], [27, 30], [37, 30], [47, 30], [22, 40], [32, 40], [42, 40], [27, 50], [37, 50], [32, 59]];
  return stem(32, 16, 34, 5) + leaf(35, 8) + P.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6" fill="${c}"/>` + shine(x - 2, y - 2, 1.8)).join('');
};

const berries = (c, crown) => {
  const P = [[22, 38], [42, 36], [32, 50], [32, 26]];
  return leaf(14, 20, -20) + leaf(34, 14, 20) + P.map(([x, y]) =>
    `<circle cx="${x}" cy="${y}" r="10" fill="${c}"/><path d="M${x - 3} ${y - 6} L${x} ${y - 3} L${x + 3} ${y - 6}" stroke="${crown}" stroke-width="1.6" fill="none"/>` + shine(x - 4, y - 3, 2.4)).join('');
};

const drupelets = (c) => {
  const P = [];
  for (let row = 0; row < 5; row++) {
    const n = [3, 4, 4, 3, 2][row];
    for (let i = 0; i < n; i++) P.push([32 + (i - (n - 1) / 2) * 7.5, 24 + row * 7.5]);
  }
  return `<path d="M22 20 L26 12 L32 18 L38 12 L42 20Z" fill="${LEAF}"/>` + P.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.6" fill="${c}"/><circle cx="${x - 1.4}" cy="${y - 1.4}" r="1.2" fill="#fff" opacity="0.45"/>`).join('');
};

const strawberry = () => [
  `<path d="M32 58 C18 50 12 36 14 26 C16 18 26 18 32 22 C38 18 48 18 50 26 C52 36 46 50 32 58Z" fill="#D2303A"/>`,
  `<path d="M20 20 L25 12 L30 19 L32 9 L34 19 L39 12 L44 20 L36 24 L28 24Z" fill="${LEAF}"/>`,
  [[24, 30], [32, 30], [40, 30], [22, 38], [30, 38], [38, 38], [44, 36], [26, 45], [34, 46], [30, 52]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="1" ry="1.6" fill="#F6D65A"/>`).join(''),
].join('');

const banana = () => [0, 1, 2].map((i) =>
  `<path d="M${16 + i * 6} ${14 + i * 2} C${8 + i * 6} ${34} ${22 + i * 4} ${54 - i * 2} ${50 - i * 2} ${50 - i * 5} C${34 + i * 2} ${46 - i * 4} ${24 + i * 6} ${36} ${22 + i * 6} ${16 + i * 2}Z" fill="${['#E8C23A', '#F2D24A', '#F6DC5C'][i]}" stroke="#B89224" stroke-width="1"/>`).join('')
  + `<rect x="15" y="9" width="16" height="8" rx="3" fill="${STEM}"/>`;

const nut = (c, { husk } = {}) => [
  husk ? `<path d="M10 40 C10 24 22 16 32 16 C26 26 26 42 32 56 C20 56 10 50 10 40Z" fill="${husk}"/>` : '',
  `<ellipse cx="36" cy="36" rx="16" ry="${husk ? 17 : 21}" fill="${c}"/>`,
  husk ? '' : `<path d="M36 16 L36 56" stroke="#000" stroke-opacity="0.22" stroke-width="2"/><path d="M28 22 Q24 36 28 50 M44 22 Q48 36 44 50" stroke="#000" stroke-opacity="0.14" stroke-width="1.6" fill="none"/>`,
  husk ? `<path d="M36 24 Q30 36 38 48" stroke="#000" stroke-opacity="0.2" stroke-width="1.6" fill="none"/>` : '',
  shine(30, 26, 4),
].join('');

const pods = () => [
  `<path d="M14 8 C18 30 24 46 36 58" stroke="#5E7F2E" stroke-width="6" fill="none" stroke-linecap="round"/>`,
  `<path d="M26 6 C28 28 36 44 52 54" stroke="#6F8F3A" stroke-width="6" fill="none" stroke-linecap="round"/>`,
  [[16, 18], [20, 32], [27, 45], [28, 16], [33, 30], [42, 44]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6" fill="#3E5A20"/>`).join(''),
  [[46, 12, 20], [52, 22, 50], [40, 18, -10], [8, 44, -60], [12, 52, -20]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="4.5" ry="3" fill="${LEAF}" transform="rotate(${r} ${x} ${y})"/>`).join(''),
].join('');

const husked = (c) => [
  `<path d="M32 10 C20 16 12 30 16 44 C20 54 28 58 32 58 C36 58 44 54 48 44 C52 30 44 16 32 10Z" fill="#E6D4A4" opacity="0.9"/>`,
  `<path d="M32 10 C28 24 26 40 32 58 M32 10 C36 24 38 40 32 58 M32 10 C20 22 18 40 24 54 M32 10 C44 22 46 40 40 54" stroke="#B89A5A" stroke-width="1.2" fill="none"/>`,
  `<circle cx="32" cy="42" r="10" fill="${c}"/>`,
  shine(29, 38, 2.6),
].join('');

const crossberry = (c) => [
  stem(32, 18, 34, 8) + leaf(34, 10),
  [[26, 32], [38, 32], [26, 44], [38, 44]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="${c}"/>` + shine(x - 3, y - 3, 2.2)).join(''),
].join('');

const splitCapsule = () => [
  stem(32, 16, 34, 8) + leaf(34, 10),
  `<circle cx="32" cy="38" r="20" fill="#7C9A3E"/>`,
  `<path d="M32 18 C20 26 20 50 32 58 C44 50 44 26 32 18Z" fill="#D8452F"/>`,
  `<ellipse cx="32" cy="38" rx="5" ry="8" fill="#2B1F1A"/>`,
].join('');

const wedge = (c) => [
  `<path d="M20 12 L44 12 L40 40 C38 52 26 52 24 40Z" fill="${c}"/>`,
  `<path d="M20 12 L24 40 M44 12 L40 40 M32 12 L32 48" stroke="#000" stroke-opacity="0.15" stroke-width="1.4"/>`,
  `<ellipse cx="32" cy="12" rx="12" ry="3.5" fill="#E8D9A0"/>`,
].join('');

const SPECIES = {
  'carica-papaya': oval('#EBA23A', { rx: 14, ry: 22 }),
  'carissa-macrocarpa': cluster('#C8323A', { r: 8, ry: 11, pts: [[24, 38], [40, 40]] }),
  'carpobrotus-edulis': wedge('#C9A24A'),
  'carya-illinoinensis': nut('#8B5A2B'),
  'citrus-limon': oval('#F2D23A', { rx: 17, ry: 20, rot: 90, nubs: true }),
  'citrus-reticulata': round('#F08A24', { r: 21, dots: '#D8741A' }),
  'dovyalis-afra': round('#F2B43A', { r: 17 }),
  'englerophytum-magalismontanum': cluster('#B8303C', { r: 7, ry: 9, pts: [[24, 30], [40, 30], [32, 46]] }),
  'ficus-carica': teardrop('#6B3A5A', { inner: '#D8667A' }),
  'fragaria-x-ananassa': strawberry(),
  'garcinia-livingstonei': cluster('#F0922E', { r: 10, pts: [[24, 34], [40, 36], [32, 50]] }),
  'grewia-occidentalis': crossberry('#9A4B2A'),
  'harpephyllum-caffrum': cluster('#A8263A', { r: 8, ry: 10, pts: [[22, 32], [40, 30], [30, 48]] }),
  'litchi-chinensis': round('#C8363C', { r: 19, dots: '#8E1E28' }),
  'macadamia-integrifolia': nut('#7A4E2A', { husk: '#6E8F3A' }),
  'mangifera-indica': oval('#F0A030', { rx: 16, ry: 21, rot: 25 }),
  'mimusops-zeyheri': cluster('#E8A640', { r: 7, ry: 9, pts: [[22, 30], [36, 28], [28, 44], [42, 44]] }),
  'moringa-oleifera': pods(),
  'musa-acuminata-aaa-group': banana(),
  'pappea-capensis': splitCapsule(),
  'passiflora-edulis': round('#5A2E5C', { r: 20, dots: '#7A4A7C' }),
  'persea-americana': pear('#3E5A2A', { cut: '#C8D86A' }),
  'phoenix-reclinata': cluster('#D98A2B', { r: 5, ry: 7, pts: [[20, 26], [30, 24], [40, 26], [16, 38], [26, 38], [36, 38], [46, 38], [22, 50], [32, 50], [42, 50]] }),
  'physalis-peruviana': husked('#F0A428'),
  'prunus-persica': round('#EE8A5E', { r: 20, crease: true }),
  'prunus-salicina': round('#7A2A4A', { r: 18, crease: true }),
  'psidium-guajava': pear('#C8D25A', { cut: '#F08A8A' }),
  'punica-granatum': round('#B8282E', { r: 20, crown: '#8E1E24', stemLeaf: false }),
  'rhoicissus-tomentosa': bunch('#3E2448'),
  'rubus-idaeus': drupelets('#C8284A'),
  'sclerocarya-birrea-subsp-caffra': cluster('#E8C842', { r: 11, ry: 13, pts: [[24, 38], [42, 40]] }),
  'strychnos-spinosa': round('#C8B838', { r: 24, cy: 36 }),
  'syzygium-cordatum': cluster('#4A2A5A', { r: 7, ry: 9, pts: [[20, 28], [34, 26], [46, 32], [26, 42], [40, 44], [32, 56]] }),
  'vaccinium-corymbosum': berries('#3F5A9A', '#243A6A'),
  'vangueria-infausta': round('#B88A3A', { r: 18 }),
  'vitis-vinifera': bunch('#9CB84A'),
};

mkdirSync(OUT, { recursive: true });
for (const [id, body] of Object.entries(SPECIES)) {
  writeFileSync(join(OUT, `${id}.svg`),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">${body}</svg>\n`);
}
console.log(`wrote ${Object.keys(SPECIES).length} placeholder fruit icons to public/fruit-art/`);
