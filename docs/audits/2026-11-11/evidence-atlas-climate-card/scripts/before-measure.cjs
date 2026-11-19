// Measures the ORIGINAL dark screenshot of candidate eaa5b98b (evidence-decisions/F-atlas-complete-phone-dark.png,
// captured 09:02:15 UTC on 11 November; not regenerated) with the same method as contrast-from-pixels.cjs.
//   node before-measure.cjs ../outputs/G.json > ../outputs/before-eaa5b98b-dark-contrast.txt
// Only elements whose position did not change are measured: the climate code and name, and the first two
// lines of the class note (the old note was two lines long and started at the same place). The old chips
// sat one line higher than the new ones, so their boxes are shifted up by the height of one note line.
const fs = require('fs'); const path = require('path');
const { PNG } = require(require.resolve('pngjs', { paths: [path.resolve(__dirname, '../../../../..')] }));
const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0').toUpperCase()).join('');
const r = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).results.find((x) => x.case === 'complete-phone-dark');
const png = PNG.sync.read(fs.readFileSync(path.resolve(__dirname, '../../evidence-decisions/F-atlas-complete-phone-dark.png')));
const el = Object.fromEntries(r.elements.filter((e) => e.found).map((e) => [e.label, e.pixelBox]));
const line = Math.round(el['class note'].h / 3);
// Chip boxes are shrunk by 10 pixels a side so the box lies inside the pill and the card around it is not read as ink.
const inset = (b) => ({ x: b.x + 10, y: b.y + 10, w: b.w - 20, h: b.h - 20 });
const boxes = [['climate code', el['climate code']], ['climate name', el['climate name']],
  ['class note (old, 2 lines)', { ...el['class note'], h: line * 2 }],
  ['rain chip (old place)', inset({ ...el['rain chip'], y: el['rain chip'].y - line })],
  ['calendar chip (old place)', inset({ ...el['calendar chip'], y: el['calendar chip'].y - line })]];
console.log('original screenshot: evidence-decisions/F-atlas-complete-phone-dark.png (' + png.width + 'x' + png.height + ')');
for (const [label, b] of boxes) {
  const px = []; const count = new Map();
  for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) { const i = (png.width * y + x) * 4; const c = [png.data[i], png.data[i + 1], png.data[i + 2]]; px.push(c); const k = c.join(','); count.set(k, (count.get(k) || 0) + 1); }
  const bg = [...count].sort((a, z) => z[1] - a[1])[0][0].split(',').map(Number);
  const d2 = (c) => (c[0] - bg[0]) ** 2 + (c[1] - bg[1]) ** 2 + (c[2] - bg[2]) ** 2;
  const far = px.sort((a, z) => d2(z) - d2(a)).slice(0, Math.max(8, Math.floor(px.length * 0.03)));
  const ink = [0, 1, 2].map((i) => far.map((c) => c[i]).sort((a, z) => a - z)[Math.floor(far.length / 2)]);
  console.log(label.padEnd(28) + hex(ink).padStart(9) + ' on ' + hex(bg) + '  ratio ' + ratio(ink, bg).toFixed(2));
}
