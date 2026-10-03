import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildCropPlanPdf, availabilityIconKeys, resolveAvailability } from '@/lib/crop-export-pdf';
import { printableAvailability } from '@/lib/crop-export-availability';
import { placedTreeGroups, unidentifiedPlantGroups } from '@/lib/perennial-harvest';
import { placedAnimalGroups } from '@/lib/animal-enterprises';
import { pdfIconUrl } from '@/lib/pdf-icons';

const out = process.argv[2] ?? join(process.cwd(), 'output', 'pdf', 'production-empty-sections');
mkdirSync(out, { recursive: true });
const items = [
  { defId: 'tree_avocado', status: 'existing' },
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
  beds: [], plantings: [], tasks: [], now: new Date('2026-10-03T08:00:00Z'),
  meta: { planTitle:'Food forest and animals - example', siteLine:'Synthetic map fixture, not a saved farmer design',
    bedsSummary:'No vegetable beds', dateLabel:'3 October 2026', estimatedKgPerYear:null, lossPercent:0 },
  sections:['availability'], availability,
};
for (const [name,data] of [['mapped',base],['empty',{...base,availability:undefined}],['hidden',{...base,availability:{...availability,includeTrees:false,includeAnimals:false}}]]) {
  const icons = {};
  for(const key of availabilityIconKeys(data)) {
    const url=pdfIconUrl(key);
    if(url) try { icons[key]=`data:image/png;base64,${readFileSync(join(process.cwd(),'public',url)).toString('base64')}`; } catch {}
  }
  const pdf=await buildCropPlanPdf({...data,icons});
  writeFileSync(join(out,`food-forest-animals-${name}.pdf`),Buffer.from(await pdf.arrayBuffer()));
  console.log(JSON.stringify({name,bands:resolveAvailability(data,10).bands.map(b=>({key:b.key,dated:b.cells.flat().length,undated:b.undated?.map(e=>e.label)}))}));
}
