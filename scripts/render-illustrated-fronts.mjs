#!/usr/bin/env node
// Illustrated fronts add a clear teaching picture without replacing a single reading paragraph.
// Text stays outside the shared artwork, so reviewed language copies can reuse the same scene.
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { COURSE_NARRATION } from '../lib/course-audio.ts';
const sharp = createRequire(import.meta.url)('sharp');
const rows = JSON.parse(readFileSync('docs/course-production/illustrated-fronts.json', 'utf8'));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function lines(text, max) {
  const out = []; let line = '';
  for (const word of text.split(/\s+/)) {
    if (line && (line + ' ' + word).length > max) { out.push(line); line = word; }
    else line += (line ? ' ' : '') + word;
  }
  if (line) out.push(line);
  return out;
}
for (const row of rows) {
  const track = COURSE_NARRATION[row.module]?.tracks.find(t => t.slide === row.slide);
  if (!track) throw new Error(`No narration block: ${row.module}/${row.slide}`);
  const source = readFileSync(`docs/narration/${row.module}.en.md`, 'utf8');
  const block = source.split(new RegExp(`\\*\\*Slide ${row.slide} [—-]`))[1]?.split(/\*\*Slide \d+ [—-]/)[0];
  if (!block?.includes(row.caption)) throw new Error(`Caption must occur in its own source block: ${row.module}/${row.slide}`);
  const titleLines = lines(track.title, 53), captionLines = lines(row.caption, 83);
  if (titleLines.length > 2 || captionLines.length > 2) throw new Error(`Needs editorial fitting: ${row.module}/${row.slide}`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900">
    <rect width="1600" height="900" fill="#F7F2E9"/>
    <text x="70" y="38" font-family="DejaVu Sans" font-size="18" fill="#8A4B2A">IMBEWUFIELD</text>
    <text x="1530" y="38" text-anchor="end" font-family="DejaVu Sans" font-size="18" fill="#8A4B2A">${row.slide} / ${COURSE_NARRATION[row.module].tracks.length}</text>
    ${titleLines.map((t,i)=>`<text x="70" y="${92+i*54}" font-family="DejaVu Serif" font-weight="bold" font-size="44" fill="#1F4D2B">${esc(t)}</text>`).join('')}
    <rect x="239" y="169" width="1122" height="632" fill="none" stroke="#B07A1E" stroke-width="2"/>
    ${captionLines.map((t,i)=>`<text x="800" y="${838+i*32}" text-anchor="middle" font-family="DejaVu Sans" font-size="27" font-weight="bold" fill="#1F4D2B">${esc(t)}</text>`).join('')}
  </svg>`;
  const art = await sharp(resolve('public', row.art)).resize(1120,630,{fit:'contain',background:'#F7F2E9'}).toBuffer();
  const out = `public/course-decks/${row.module}/en/slide-${String(row.slide).padStart(2,'0')}-front.jpg`;
  mkdirSync(dirname(out), {recursive:true});
  await sharp(Buffer.from(svg)).composite([{input:art,left:240,top:170}]).jpeg({quality:84,mozjpeg:true}).toFile(out);
  console.log(out);
}
