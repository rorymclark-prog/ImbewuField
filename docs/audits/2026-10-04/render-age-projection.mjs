import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { buildProductionProjection } from '@/lib/production-projection';
import { buildCropPlanPdf, availabilityIconKeys } from '@/lib/crop-export-pdf';
import { printableAvailability } from '@/lib/crop-export-availability';
import { placedTreeGroups, buildTreeAvailability } from '@/lib/perennial-harvest';
import { placedAnimalGroups } from '@/lib/animal-enterprises';
import { buildFoodAvailability, buildFieldUtilizationByMonth } from '@/lib/crop-plan';
import { planningTreeSeasons } from '@/lib/production-product-guidance';
import { pdfIconUrl } from '@/lib/pdf-icons';
const sharp = createRequire(import.meta.url)('sharp');
const out = process.argv[2] ?? 'output/pdf/production-age-visuals-2026-10-04';
mkdirSync(out, { recursive: true });
const now = new Date(2026, 9, 4);
const trees = placedTreeGroups([
  { defId: 'tree_avocado', status: 'existing' }, { defId: 'tree_avocado', status: 'proposed' },
  { defId: 'banana_circle', status: 'proposed' },
  { defId: 'tree_macadamia', status: 'proposed' }, { defId: 'tree_mango', status: 'existing' },
  { defId: 'tree_other', speciesId: 'syzygium-cordatum', status: 'proposed' },
]);
// Artificial inputs to demonstrate the controls, not recommended agricultural yields.
const choices = {
  'persea-americana': { months: [6, 7, 8, 9, 10], bearing: true, production: [
    { status: 'existing', plants: 1, planted: '2020-10', yields: [{ age: 6, kg: 4 }] },
    { status: 'proposed', plants: 1, planted: '2026-10', yields: [{ age: 0, kg: 0 }, { age: 3, kg: 1 }, { age: 6, kg: 3 }] },
  ] },
  'musa-acuminata-aaa-group': { months: [], bearing: false, production: [{ status: 'proposed', plants: 3, planted: '2026-10', yields: [{ age: 0, kg: 0 }, { age: 2, kg: 2 }] }] },
  'macadamia-integrifolia': { months: [], bearing: false, production: [{ status: 'proposed', plants: 1, planted: '2026-10', yields: [] }] },
  'mangifera-indica': { months: [], bearing: false, production: [{ status: 'existing', plants: 1, planted: '2016-10', yields: [{ age: 10, kg: 5 }] }] },
};
const beds = [{ id: 'demo', label: 'Example vegetable bed', kind: 'bed', areaM2: 10 }];
const plantings = [{ id: 'recurring', bedId: 'demo', cropKey: 'carrots', sowMonth: 10 }];
const dates = Array.from({ length: 12 }, (_, i) => ({ year: Math.floor((2026 * 12 + 9 + i) / 12), month: (9 + i) % 12 + 1 }));
const months = dates.map(d => d.month);
const planning = planningTreeSeasons(trees, ['subtropical-coast'], undefined, choices);
const animals = placedAnimalGroups([{ defId: 'chicken_coop' }, { defId: 'beehive' }]);
const availability = printableAvailability({ now, yearMode: 'fromToday', veg: buildFoodAvailability(plantings, beds, 10, 12), utilization: buildFieldUtilizationByMonth(plantings, beds, 10, 12), trees: buildTreeAvailability(trees, months, true, choices), treeGroups: trees, treeSeasons: choices, animalGroups: animals, planning: { months, trees: planning, dates } });
const productionProjection = buildProductionProjection({ plantings, beds, trees, choices, now });
const input = { plantings, beds, tasks: [], now, sections: ['availability'], availability, treeGroups: trees, treeSeasons: choices, productionProjection,
  meta: { planTitle: 'Plant age and production - demonstration', siteLine: 'Synthetic age groups and artificial tree kg, not the saved Ubhejane design or yield advice', climateLine: 'Subtropical coast example', bedsSummary: 'Example vegetable bed and mixed-age plants', dateLabel: '4 October 2026', estimatedKgPerYear: null, lossPercent: 0 } };
const icons = {};
for (const key of availabilityIconKeys(input)) {
  const url = pdfIconUrl(key);
  if (url) icons[key] = `data:image/png;base64,${(await sharp(readFileSync(join(process.cwd(), 'public', url))).resize(128, 128, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()).toString('base64')}`;
}
writeFileSync(join(out, 'age-production-demonstration.pdf'), Buffer.from(await (await buildCropPlanPdf({ ...input, icons })).arrayBuffer()));
writeFileSync(join(out, 'age-production-demonstration.json'), JSON.stringify({ choices, projection: productionProjection }, null, 2));
