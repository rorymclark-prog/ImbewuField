import { ELEMENT_CATALOG } from './design-elements';
import { REPORT_ZU } from './report-localisation';
import type { ReportChart, ReportVisuals } from './report-visuals';
import { stripLeadingNumber } from './report-structure';

export type ChapterGraphic = { id:string; title:string; note:string; svg?:string; chart?:ReportChart; trees?:{name:string;image:string}[] };
const xml=(s:string)=>s.replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]!));
const svg=(body:string)=>`<svg xmlns="http://www.w3.org/2000/svg" width="820" height="370" viewBox="0 0 820 370"><rect width="820" height="370" rx="18" fill="#f2f6ef"/>${body}</svg>`;
const label=(x:number,y:number,text:string,size=18)=>`<text x="${x}" y="${y}" font-family="Arial,sans-serif" font-size="${size}" fill="#244b34">${xml(text)}</text>`;
const layers=svg(`<path d="M0 283 Q170 255 480 280V370H0Z" fill="#d9b57b"/><path d="M0 285 Q250 256 480 278" stroke="#7a6639" stroke-width="12" fill="none"/><path d="M258 279V114M258 201L218 158M258 167L301 123" stroke="#876143" stroke-width="14" stroke-linecap="round"/><g fill="#3c6843"><ellipse cx="248" cy="106" rx="89" ry="51"/><circle cx="187" cy="121" r="43"/><circle cx="321" cy="112" r="43"/><circle cx="244" cy="62" r="39"/></g><g fill="#698553"><ellipse cx="143" cy="232" rx="51" ry="32"/><ellipse cx="375" cy="233" rx="51" ry="36"/></g><g fill="#95a65c"><ellipse cx="89" cy="269" rx="35" ry="13"/><ellipse cx="329" cy="270" rx="32" ry="13"/><ellipse cx="423" cy="266" rx="30" ry="15"/></g><path d="M258 283q-21 46-79 61M258 283q28 36 78 48M258 283v65" stroke="#997546" stroke-width="4" fill="none"/><g stroke="#66815f" stroke-width="1.5" stroke-dasharray="4 5"><path d="M350 90H489M421 223H489M459 270H489M341 325H489"/></g>${label(510,83,'Tree canopy',22)}${label(510,108,'Upper growing layer',15)}${label(510,218,'Shrubs & understory',22)}${label(510,243,'Space below the canopy',15)}${label(510,279,'Ground cover & leaf litter',19)}${label(510,331,'Roots & living soil',20)}`);
const water=svg(`<g fill="#f4fcff" stroke="#4a8094" stroke-width="2"><path d="M94 37q-20 28 0 28q20 0 0-28Z"/><path d="M129 48q-20 28 0 28q20 0 0-28Z"/><path d="M164 31q-20 28 0 28q20 0 0-28Z"/></g><path d="M54 169L172 100L288 169" fill="#bd9670" stroke="#725d45" stroke-width="6"/><path d="M83 174H262V280H83Z" fill="#ede6d5"/><path d="M239 280v-65h-53v65" fill="#9caa91"/><path d="M280 171H370V200" stroke="#477a88" stroke-width="8" fill="none"/><rect x="366" y="166" width="115" height="125" rx="18" fill="#6c8f76"/><ellipse cx="423" cy="166" rx="57" ry="14" fill="#8da995"/><path d="M374 197h100M374 222h100M374 248h100" stroke="#4b6e5b" stroke-width="3"/><path d="M480 269h94v-41h145" stroke="#427c93" stroke-width="8" fill="none"/><path d="M713 217l20 11-20 11" fill="#427c93"/><path d="M551 282h217l-28 33H530Z" fill="#a58253"/><path d="M578 280v-25m0 13q-21-14-22-6m22 3q17-18 22-10M642 280v-25m0 13q-21-14-22-6m22 3q17-18 22-10M706 280v-25m0 13q-21-14-22-6m22 3q17-18 22-10" stroke="#497640" stroke-width="5" fill="none"/>${label(79,334,'1  Capture',20)}${label(373,334,'2  Store',20)}${label(575,350,'3  Distribute',20)}`);
const soil=svg(`<path d="M42 97Q246 87 469 97V132H42Z" fill="#95a15c"/><path d="M42 130H469V199H42Z" fill="#76573c"/><path d="M42 199H469V300H42Z" fill="#c09666"/><g stroke="#e2ccab" stroke-width="3" fill="none"><path d="M238 100v143m0-103-66 34m66-10 70 34m-70 9-52 47m52-18 27 33"/><path d="M134 106v92m0-48-33 18m33-5 34 19"/></g><g fill="#dfc7a6"><circle cx="91" cy="253" r="5"/><circle cx="349" cy="272" r="7"/><circle cx="401" cy="221" r="4"/></g><g stroke="#9a865f" stroke-width="1.5" stroke-dasharray="4 5"><path d="M469 111h43M469 163h43M469 253h43"/></g>${label(529,111,'Surface cover',22)}${label(529,141,'Record mulch and bare ground',15)}${label(529,184,'Root zone',22)}${label(529,213,'Observe structure and roots',15)}${label(529,269,'Soil sample',22)}${label(529,298,'Record location, depth and date',15)}${label(44,343,'Illustrative profile · no measured depths or test results',16)}`);

/** Only illustrate trees actually named in this section; no inferred species or new recommendations. */
export function reportTreeIllustrations(text:string) {
  let remaining=text.toLowerCase();
  const trees:{name:string;image:string}[]=[];
  const candidates=ELEMENT_CATALOG.filter(e=>e.id.startsWith('tree_')&&e.category==='growing'&&e.art&&!e.deprecated&&!['tree_other','tree_indigenous'].includes(e.id)).sort((a,b)=>b.name.length-a.name.length);
  for(const tree of candidates){
    const name=tree.name.replace(/ Tree$/,'');
    const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const re=new RegExp(`(?<![a-z]|wild )${escaped}(?: tree)?(?![a-z])`,'gi');
    if(re.test(remaining)){trees.push({name:tree.name,image:tree.art!});remaining=remaining.replace(re,' ');}
  }
  return trees;
}
export function chapterGraphics(heading:string, body:string, visuals:ReportVisuals):ChapterGraphic[] {
  const plain=stripLeadingNumber(heading);
  const title=Object.entries(REPORT_ZU).find(([,value])=>value===plain)?.[0]??plain;
  const result:ChapterGraphic[]=[];
  const waterSection=/water harvesting|irrigation|water plan|water strategy|water, soil and|amanzi, umhlabathi/i.test(title);
  const soilSection=/soil strategy|soil plan|soil management|water, soil and|amanzi, umhlabathi/i.test(title);
  if(/vegetation|biome|guild|food forest/i.test(title))result.push({id:'layers',title:'A living landscape, layer by layer',note:'Concept illustration. Species, spacing and the layers present must be checked for this site; this is not its measured vegetation profile.',svg:layers});
  if(waterSection)result.push({id:'water-flow',title:'Follow the water through the site',note:'Concept illustration of rainwater collection. It does not confirm a tank is installed, a pipe is correctly sized or water is safe to use.',svg:water});
  if(soilSection)result.push({id:'soil-profile',title:'Look below the surface',note:'Use the site evidence checklist to add soil observations and laboratory results. This illustration does not describe measured conditions at this site.',svg:soil});
  if(/tree|fruit|vegetation|biome|guild|agroecosystem|full design inventory/i.test(title)) {
    const trees=reportTreeIllustrations(body);
    if(trees.length)result.push({id:'trees',title:'Trees mentioned in this section',note:'Catalogue illustrations, not site photographs or identification evidence. Read the advice and confirm local suitability before choosing plants.',trees});
  }
  const chartIds=/planting calendar|year-round|crop rotation|crop plan|uhlelo lwezitshalo/i.test(title)?['calendar-']:waterSection?['rainfall','water']:/economic|budget|cost|bill of quantities/i.test(title)?['cost']:[];
  for(const chart of visuals.charts.filter(chart=>chartIds.some(id=>chart.id.startsWith(id))))result.push({id:chart.id,title:chart.title,note:chart.note,chart});
  return result;
}
export function reportChapterGraphics(report:string,visuals:ReportVisuals) {
  return Object.fromEntries(report.split(/^## /m).slice(1).map(section=>{const [heading,...body]=section.split('\n');return [heading,chapterGraphics(heading,body.join('\n'),visuals)];}));
}
