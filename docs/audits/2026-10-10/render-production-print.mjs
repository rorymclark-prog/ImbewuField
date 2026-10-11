import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { buildProductionProjection } from '@/lib/production-projection';
import { buildCropPlanPdf, availabilityIconKeys } from '@/lib/crop-export-pdf';
import { printableAvailability } from '@/lib/crop-export-availability';
import { placedTreeGroups, buildTreeAvailability } from '@/lib/perennial-harvest';
import { placedAnimalGroups, buildAnimalAvailability } from '@/lib/animal-enterprises';
import { cropByKey } from '@/lib/crop-catalog';
import { STAPLE_CROP_KEYS } from '@/lib/staple-crops';
import { buildFoodAvailability, buildFieldUtilizationByMonth } from '@/lib/crop-plan';
import { planningTreeSeasons } from '@/lib/production-product-guidance';
import { pdfIconUrl } from '@/lib/pdf-icons';
const sharp = createRequire(import.meta.url)('sharp');
const out = process.argv[2] ?? '/Users/roryclark/ImbewuField/output/pdf/production-reaudit-2026-10-10/print';
mkdirSync(out, { recursive: true });
const now = new Date(2026, 9, 10);
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
const input = { plantings, beds, tasks: [], now, sections: ['availability', 'projection'], availability, treeGroups: trees, treeSeasons: choices, productionProjection,
  meta: { planTitle: 'Plant age and production - demonstration', siteLine: 'Synthetic age groups and artificial tree kg, not the saved Ubhejane design or yield advice', climateLine: 'Subtropical coast example', bedsSummary: 'Example vegetable bed and mixed-age plants', dateLabel: '10 October 2026', estimatedKgPerYear: null, lossPercent: 0 } };
const icons = {};
async function addIcons(data) {
  for (const key of availabilityIconKeys(data)) {
    if (icons[key]) continue;
    const url = pdfIconUrl(key);
    if (url) icons[key] = `data:image/png;base64,${(await sharp(readFileSync(join(process.cwd(), 'public', url))).resize(128, 128, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()).toString('base64')}`;
  }
}

async function save(name, extra = {}) {
  const data = { ...input, ...extra };
  await addIcons(data);
  writeFileSync(join(out, name + '.pdf'), Buffer.from(await (await buildCropPlanPdf({ ...data, icons })).arrayBuffer()));
}
await save('ordinary-age-plan');
for (const pageFormat of ['a4','a3','a2']) await save(`quick-print-${pageFormat}`, { sections: ['availability', 'calendar', 'taskSummary'], availabilityDetails:false, pageFormat });
await save('future-harvest', {sections:['projection']});
const manyTrees = placedTreeGroups(Array.from({ length: 60 }, () => ({ defId: 'tree_avocado', status: 'existing' })));
const manyChoices = { 'persea-americana': { bearing: true, months: [6,7], production: Array.from({length:60}, (_,i) => ({status:'existing',plants:1,planted:`${1966+i}-10`,yields:[{age:0,kg:0.4}]})) } };
for (const pageFormat of ['a4','a3','a2']) await save(`sixty-age-groups-${pageFormat}`, {pageFormat, treeGroups:manyTrees, treeSeasons:manyChoices, availability: { yearMode:'fromToday', veg:[],forest:[],animals:[]}, productionProjection: buildProductionProjection({ plantings:[],beds:[],trees:manyTrees, choices:manyChoices,now}) });
await save('long-farm-name', { meta: {...input.meta,planTitle:'Ubhejane garden by the school for family production and learning '.repeat(6)} });
const longScheduleTrees=placedTreeGroups([{defId:'tree_avocado',status:'existing'}]);
const longScheduleChoices={'persea-americana':{bearing:true,months:[],production:[{status:'existing',plants:1,planted:'2000-10',yields:Array.from({length:300},(_,i)=>({age:i/2,kg:0.4}))}]}};
await save('long-yield-schedule',{sections:['projection'],treeGroups:longScheduleTrees,treeSeasons:longScheduleChoices,productionProjection:buildProductionProjection({plantings:[],beds:[],trees:longScheduleTrees,choices:longScheduleChoices,now})});

// A January planting makes an entered age checkpoint fall within an October-to-September year.
const changingChoices={...choices,'persea-americana':{...choices['persea-americana'],production:choices['persea-americana'].production.map((cohort,i)=>i===1?{...cohort,planted:'2027-01'}:cohort)}};
for (const pageFormat of ['a4','a3','a2']) await save(`age-range-demonstration-${pageFormat}`,{sections:['projection'],pageFormat,treeSeasons:changingChoices,productionProjection:buildProductionProjection({plantings,beds,trees,choices:changingChoices,now})});

// These explicit invented month inputs exercise graphics, not agronomic seasons or a farmer's
// saved design. Storage appears only for a catalog crop with its own sourced conditions.
const pictureTrees = placedTreeGroups(['mangifera-indica', 'musa-acuminata-aaa-group', 'macadamia-integrifolia', 'carya-illinoinensis', 'vaccinium-corymbosum'].map(speciesId => ({defId:'tree_other',speciesId,status:'existing'})));
const pictureTreeChoices = Object.fromEntries(pictureTrees.map((g,i) => [g.harvest.speciesId, {bearing:true,months:[months[(i*2)%12],months[(i*2+1)%12]]}]));
const pictureAnimals = placedAnimalGroups(['chicken_coop','goat_pen','beehive','pig_pen','pond_small','rabbit_hutch'].map(defId => ({defId,status:'existing'})));
const pictureAnimalChoices = {chicken:'chicken-layer',goat:'goat-dairy',bee:'bees',pig:'pig-pork',pond:'fish-tilapia'};
const pictureAnimalSeasons = Object.fromEntries(Object.entries(pictureAnimalChoices).map(([housing,enterpriseId],i) => [housing,{enterpriseId,months:[months[(i*2)%12],months[(i*2+1)%12]]}]));
const pictureVeg = Array.from({length:12},()=>[]);
for (const [i,key] of [...STAPLE_CROP_KEYS,'tomatoes','carrots'].entries()) {
  const crop = cropByKey(key);
  const at = (i*2)%12;
  for (const month of [at,(at+1)%12]) pictureVeg[month].push({cropKey:key,name:crop.name,icon:crop.icon,status:'fresh'});
  if (crop.storageMonths && crop.storageConditions) pictureVeg[(at+2)%12].push({cropKey:key,name:crop.name,icon:crop.icon,status:'stored'});
}
const pictureAvailability = printableAvailability({now,yearMode:'fromToday',veg:pictureVeg,utilization:[],trees:buildTreeAvailability(pictureTrees,months,true,pictureTreeChoices),treeGroups:pictureTrees,treeSeasons:pictureTreeChoices,animals:buildAnimalAvailability(pictureAnimals,pictureAnimalChoices,months,true,pictureAnimalSeasons),animalGroups:pictureAnimals,animalChoices:pictureAnimalChoices,animalSeasons:pictureAnimalSeasons});
for (const pageFormat of ['a4','a3','a2']) await save(`all-produce-synthetic-demonstration-${pageFormat}`,{
  sections:['availability'],availabilityDetails:false,pageFormat,plantings:[],beds:[],treeGroups:pictureTrees,treeSeasons:pictureTreeChoices,availability:pictureAvailability,
  meta:{...input.meta,planTitle:'All produce - synthetic demonstration',siteLine:'Invented months for picture testing only; not a saved farm or a planting recommendation',climateLine:'Artificial illustration: vegetables, eight field staples, fruit, nuts and five animal foods',bedsSummary:'The eight catalog storage windows remain subject to their sourced conditions',},
});
