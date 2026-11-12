// Measures contrast from the rendered pixels of each element box recorded by g.cjs.
//   node contrast-from-pixels.cjs ../outputs/G.json ../screenshots > ../outputs/G-contrast.txt
// For each box: the background is the most common pixel colour in the box; the ink is the per-channel
// median of the 3% of pixels farthest from that background (the solid cores of the glyphs). Contrast is
// the WCAG 2 ratio of the two. This reads what was painted, including fills that CSS mixes or layers.
// It is a measurement of these screenshots, not an accessibility certification.
const fs = require('fs'); const path = require('path');
const { PNG } = require(require.resolve('pngjs', { paths: [path.resolve(__dirname, '../../../../..')] })); // the repository's own copy
const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0').toUpperCase()).join('');
const data = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); const shots = process.argv[3];
const pad = (s, n) => String(s).padEnd(n); const lpad = (s, n) => String(s).padStart(n);
console.log(pad('case', 26) + pad('element', 17) + lpad('ink', 9) + lpad('on', 9) + lpad('ratio', 7) + '  ' + lpad('size', 6) + ' ' + lpad('weight', 6) + '  text');
for (const r of data.results) {
  const png = PNG.sync.read(fs.readFileSync(path.join(shots, r.screenshot)));
  for (const e of r.elements) {
    if (!e.found) continue;
    const b = e.pixelBox; const x0 = Math.max(0, b.x), y0 = Math.max(0, b.y), x1 = Math.min(png.width, b.x + b.w), y1 = Math.min(png.height, b.y + b.h);
    if (x1 <= x0 || y1 <= y0) { console.log(pad(r.case, 26) + pad(e.label, 17) + ' outside the screenshot'); continue; }
    const px = []; const count = new Map();
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (png.width * y + x) * 4; const c = [png.data[i], png.data[i + 1], png.data[i + 2]]; px.push(c); const k = c.join(','); count.set(k, (count.get(k) || 0) + 1); }
    const bg = [...count].sort((a, z) => z[1] - a[1])[0][0].split(',').map(Number);
    const d2 = (c) => (c[0] - bg[0]) ** 2 + (c[1] - bg[1]) ** 2 + (c[2] - bg[2]) ** 2;
    const far = px.sort((a, z) => d2(z) - d2(a)).slice(0, Math.max(8, Math.floor(px.length * 0.03)));
    const ink = [0, 1, 2].map((i) => far.map((c) => c[i]).sort((a, z) => a - z)[Math.floor(far.length / 2)]);
    console.log(pad(r.case, 26) + pad(e.label, 17) + lpad(hex(ink), 9) + lpad(hex(bg), 9) + lpad(ratio(ink, bg).toFixed(2), 7) + '  ' + lpad(e.fontSizePx, 6) + ' ' + lpad(e.fontWeight, 6) + '  ' + e.text.slice(0, 60));
  }
}
