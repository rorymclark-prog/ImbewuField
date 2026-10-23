import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildCropPlanPdf, availabilityIconKeys, resolveAvailability } from '@/lib/crop-export-pdf';
import { printableAvailability } from '@/lib/crop-export-availability';
import { placedTreeGroups, unidentifiedPlantGroups } from '@/lib/perennial-harvest';
import { placedAnimalGroups } from '@/lib/animal-enterprises';
import { buildProductionGuide } from '@/lib/crop-export-schedule';
import { productContextFromItems } from '@/lib/production-product-guidance';
import { pdfIconUrl } from '@/lib/pdf-icons';

const out = process.argv[2] ?? join(process.cwd(), 'output', 'pdf', 'production-products');
mkdirSync(out, { recursive: true });
const items = [
  { defId: 'tree_avocado', status: 'existing' },
  { defId: 'tree_pawpaw', status: 'proposed' },
  { defId: 'tree_macadamia', status: 'proposed' },
  { defId: 'tree_waterberry', status: 'existing' },
  { defId: 'banana_clump', status: 'existing' },
  { defId: 'banana_circle', status: 'proposed' },
  { defId: 'beehive', status: 'existing' },
  { defId: 'chicken_coop', status: 'proposed' },
];
const availability = printableAvailability({
  yearMode: 'fromToday', veg: [], utilization: [],
  trees: Array.from({length:12},()=>[]), animals: Array.from({length:12},()=>[]),
  treeGroups: placedTreeGroups(items), unidentifiedPlants: unidentifiedPlantGroups(items),
  animalGroups: placedAnimalGroups(items),
});
const base = {
  beds: [], plantings: [], tasks: [], now: new Date('2026-10-04T08:00:00Z'),
  meta: { planTitle:'Food forest and animals - example', siteLine:'Synthetic map fixture, not a saved farmer design',
    bedsSummary:'No vegetable beds', dateLabel:'4 October 2026', estimatedKgPerYear:null, lossPercent:0 },
  sections:['availability', 'guidance'], availability,
  productionGuide: buildProductionGuide(null, [], ['subtropical-coast'], 10, { ...productContextFromItems(items), animalChoices: { chicken: 'chicken-layer', bee: 'bees' } }),
};
for (const [name,data] of [['warm',base],['cool',{...base,productionGuide:buildProductionGuide(null, [], ['midlands-mistbelt'], 10, productContextFromItems(items))}],['unknown',{...base,productionGuide:buildProductionGuide(null, [], [], 10, productContextFromItems(items))}]]) {
  const icons = {};
  for(const key of availabilityIconKeys(data)) {
    const url=pdfIconUrl(key);
    if(url) try { icons[key]=`data:image/png;base64,${readFileSync(join(process.cwd(),'public',url)).toString('base64')}`; } catch {}
  }
  const pdf=await buildCropPlanPdf({...data,icons});
  writeFileSync(join(out,`food-forest-animals-${name}.pdf`),Buffer.from(await pdf.arrayBuffer()));
  console.log(JSON.stringify({name,bands:resolveAvailability(data,10).bands.map(b=>({key:b.key,dated:b.cells.flat().length,undated:b.undated?.map(e=>e.label)}))}));
}
