import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { buildCompleteProductionExample } from '@/lib/sample-production-plan';
import { buildCropPlanPdf, availabilityIconKeys, ALL_SECTIONS } from '@/lib/crop-export-pdf';
import { pdfIconUrl } from '@/lib/pdf-icons';

const sharp = createRequire(import.meta.url)('sharp');
const out = process.argv[2] ?? '/Users/roryclark/ImbewuField/output/pdf/complete-production-example-2026-10-10';
mkdirSync(out, { recursive: true });
const sample = buildCompleteProductionExample();
const input = sample.input;
const icons = {};

// Use the same product artwork and PDF input as the read-only app example. Nothing
// is saved to a farmer's plan, and this renderer adds no dates or farming quantities.
for (const key of availabilityIconKeys(input)) {
  const url = pdfIconUrl(key);
  if (!url) continue;
  const buffer = await sharp(readFileSync(join(process.cwd(), 'public', url)))
    .resize(128, 128, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer();
  icons[key] = 'data:image/png;base64,' + buffer.toString('base64');
}

const documents = [];
for (const [filename, options] of [
  ['fictional-complete-production-plan-a4.pdf', { pageFormat: 'a4', sections: ALL_SECTIONS, availabilityDetails: true }],
  ['complete-production-example-booklet.pdf', {
    pageFormat: 'a4', sections: ['calendar', 'availability', 'projection', 'taskSummary'], availabilityDetails: false,
  }],
  ['fictional-complete-production-calendar-a2.pdf', {
    pageFormat: 'a2', sections: ['availability'], availabilityDetails: false,
  }],
]) {
  const buffer = Buffer.from(await (await buildCropPlanPdf({ ...input, ...options, icons })).arrayBuffer());
  writeFileSync(join(out, filename), buffer);
  documents.push({ filename, bytes: buffer.length, ...options });
  console.log(JSON.stringify(documents.at(-1)));
}

// The small manifest makes fictional farm records and researched reference windows
// inspectable without embedding PNG data or duplicating the shared builder's rules.
writeFileSync(join(out, 'example-manifest.json'), JSON.stringify({
  generatedBy: 'docs/audits/2026-10-10/render-complete-production-example.mjs',
  fictionNotice: sample.fictionNotice,
  fictionalRecords: sample.fictionalRecords,
  meta: input.meta,
  now: sample.now,
  months: sample.months,
  dates: sample.dates,
  zones: sample.zones,
  conditions: sample.conditions,
  farmZones: sample.farmZones,
  plantings: input.plantings,
  beds: input.beds,
  trees: sample.trees,
  treeSeasons: sample.treeSeasons,
  planningTrees: sample.planningTrees,
  animals: sample.animals,
  animalChoices: sample.animalChoices,
  animalSeasons: sample.animalSeasons,
  availability: input.availability,
  productionProjection: input.productionProjection,
  iconKeys: Object.keys(icons),
  documents,
}, null, 2) + '\n');
