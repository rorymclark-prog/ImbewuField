import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { buildCropPlanPdf, availabilityIconKeys } from '@/lib/crop-export-pdf';
import { printableAvailability } from '@/lib/crop-export-availability';
import { placedTreeGroups, buildTreeAvailability } from '@/lib/perennial-harvest';
import { placedAnimalGroups } from '@/lib/animal-enterprises';
import { planningTreeSeasons } from '@/lib/production-product-guidance';
import { GROWING_ZONES } from '@/lib/growing-zones';
import { pdfIconUrl } from '@/lib/pdf-icons';
const out = process.argv[2] ?? join(process.cwd(), 'output/pdf/regional-production-calendar-2026-10-04');
// The desktop runtime bundles sharp; NODE_PATH also permits a normal local install.
const sharp = createRequire(import.meta.url)('sharp');
mkdirSync(out, {recursive:true});
const tropical = ['persea-americana','musa-acuminata-aaa-group','carica-papaya','macadamia-integrifolia','mangifera-indica','litchi-chinensis','citrus-limon','fragaria-x-ananassa','sclerocarya-birrea-subsp-caffra','syzygium-cordatum','harpephyllum-caffrum','carissa-macrocarpa'];
const cases = {
  'subtropical-coast': tropical,
  'lowveld-bushveld': [...tropical.slice(0,10), 'vitis-vinifera','vangueria-infausta'],
  'midlands-mistbelt': ['persea-americana','citrus-limon','rubus-idaeus','passiflora-edulis','fragaria-x-ananassa','englerophytum-magalismontanum','grewia-occidentalis','vangueria-infausta'],
  'western-cape': ['prunus-persica','prunus-salicina','citrus-reticulata','ficus-carica','vaccinium-corymbosum','fragaria-x-ananassa','vitis-vinifera','punica-granatum','carpobrotus-edulis','grewia-occidentalis','pappea-capensis'],
  'highveld': ['carya-illinoinensis','englerophytum-magalismontanum','vangueria-infausta','grewia-occidentalis','pappea-capensis','fragaria-x-ananassa','prunus-persica'],
  'karoo-arid': ['carya-illinoinensis','vitis-vinifera','punica-granatum','grewia-occidentalis','pappea-capensis','ficus-carica'],
  'southern-cape': ['citrus-reticulata','harpephyllum-caffrum','phoenix-reclinata','syzygium-cordatum','rhoicissus-tomentosa','grewia-occidentalis','pappea-capensis'],
  'high-mountain': ['prunus-persica','fragaria-x-ananassa','vaccinium-corymbosum','grewia-occidentalis'],
  unknown: tropical,
};
const months = Array.from({length:12},(_,i)=>(9+i)%12+1);
const manifest=[];
for (const [zone,species] of Object.entries(cases)) {
  const groups=placedTreeGroups(species.map(speciesId=>({defId:speciesId==='musa-acuminata-aaa-group'?'banana_circle':'tree_other',speciesId,status:'proposed'})));
  const conditions={drySeasonWater:'reliable',drainage:'drains-well',sunlight:'full-sun',frost:zone==='midlands-mistbelt'||zone==='highveld'||zone==='karoo-arid'||zone==='high-mountain'?'yes':'no'};
  const planning=planningTreeSeasons(groups,zone==='unknown'?[]:[zone],conditions);
  const animals=placedAnimalGroups([{defId:'chicken_coop',status:'proposed'},{defId:'beehive',status:'proposed'}]);
  const availability=printableAvailability({yearMode:'fromToday',veg:[],utilization:[],trees:buildTreeAvailability(groups,months,true),treeGroups:groups,animalGroups:animals,animalChoices:{chicken:'chicken-layer',bee:'bees'},planning:{months,trees:planning}});
  const area=GROWING_ZONES[zone]?.name ?? 'Climate not resolved';
  const input={beds:[],plantings:[],tasks:[],now:new Date('2026-10-04T08:00:00Z'),sections:['availability'],availability,
    meta:{planTitle:`${area} - example production plan`,siteLine:'Synthetic proposed planting example, not a saved farmer design or a planting recommendation',climateLine:area,bedsSummary:'Fruit, nuts, berries and indigenous foods',dateLabel:'4 October 2026',estimatedKgPerYear:null,lossPercent:0}};
  const icons={};
  for(const key of availabilityIconKeys(input)) { const url=pdfIconUrl(key); if(url) icons[key]=`data:image/png;base64,${(await sharp(readFileSync(join(process.cwd(),'public',url))).resize(128,128,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer()).toString('base64')}`; }
  const pdf=await buildCropPlanPdf({...input,icons});
  writeFileSync(join(out,`${zone}.pdf`),Buffer.from(await pdf.arrayBuffer()));
  manifest.push({zone,area,conditions,plants:groups.map(g=>({speciesId:g.harvest.speciesId,name:g.harvest.name,proposed:g.proposed})),references:planning.map(t=>({name:t.name,...t.season}))});
  console.log(JSON.stringify({area,plants:groups.length,marked:planning.length,confirmed:availability.forest.flat().length}));
}
writeFileSync(join(out,'sample-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
