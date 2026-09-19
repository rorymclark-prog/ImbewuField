import { ELEMENT_CATALOG } from './design-elements';
import { REPORT_ZU } from './report-localisation';
import type { ReportChart, ReportVisuals } from './report-visuals';
import { stripLeadingNumber } from './report-structure';

export type ChapterGraphic = { id:string; title:string; note:string; svg?:string; chart?:ReportChart; trees?:{name:string;image:string}[]; art?:{src:string;alt:string;width:number;height:number} };

/** The "how it works" pictures. Drawn once (docs/REPORT-ART-BRIEF.md), committed under
 * public/report-art and identical in every report — so each is captioned as a concept and never
 * as a picture of this site. `when` reads the English chapter title; `body`, when given, must also
 * match the chapter's own text, so a technique is only pictured where the report talks about it. */
const NOT_THIS_SITE='Concept illustration, the same in every report. It is not a picture of this site.';
const REPORT_ART:Array<{id:string;when:RegExp;body?:RegExp;title:string;alt:string;note:string}>=[
  {id:'roof-to-tank',when:/water harvesting|water plan|water strategy|water, soil and|amanzi, umhlabathi/i,title:'Follow the water through the site',alt:'Rain runs off a roof into a gutter, through a first-flush pipe into a tank, and the overflow is led to a mulched basin around a fruit tree.',note:`${NOT_THIS_SITE} It does not confirm a tank is installed, a pipe is correctly sized or water is safe to use.`},
  {id:'swale-section',when:/water harvesting|water plan|water strategy|earthwork|slope/i,body:/swale|contour|berm/i,title:'How a swale holds water on a slope',alt:'Cut through a slope: runoff drops into a level ditch, soaks in and spreads under a fruit tree planted on the mound below it.',note:`${NOT_THIS_SITE} A swale must be set out level on the contour and sized for the slope; on steep or unstable ground get advice before digging.`},
  {id:'drip-bed',when:/irrigation/i,title:'Water at the roots, not on the leaves',alt:'A raised tank feeds drip lines laid under mulch along rows of cabbage and spinach.',note:`${NOT_THIS_SITE} Pipe sizes, tank height and watering times still have to be worked out for the real beds.`},
  {id:'soil-layers',when:/soil strategy|soil plan|soil management|water, soil and|amanzi, umhlabathi/i,title:'Look below the surface',alt:'Cut through garden soil: mulch on top, dark living topsoil with roots and earthworms, paler subsoil with stones below, and compost being added by hand.',note:`${NOT_THIS_SITE} Use the site evidence checklist to add soil observations and laboratory results. This illustration does not describe measured conditions at this site.`},
  {id:'trench-bed',when:/soil|planting|food production|production spaces|year 1/i,body:/trench/i,title:'Inside a trench bed',alt:'Cut through a trench bed: branches and bones at the bottom, then dry grass, green material, manure and topsoil, with cabbages growing in mulch on top.',note:`${NOT_THIS_SITE} Depth and fill depend on what the household has to hand.`},
  {id:'compost-bays',when:/soil|year 1/i,body:/compost/i,title:'Compost in three stages',alt:'Three compost bays side by side: fresh material, a heap half broken down, and finished dark compost ready for the beds.',note:`${NOT_THIS_SITE} Any container or heap works; the point is the three stages.`},
  {id:'crop-rotation',when:/crop rotation|crop plan/i,title:'Move each crop family on, every season',alt:'Four beds seen from above — leaf crops, fruiting crops, legumes and root crops — with arrows showing each group moving to the next bed.',note:`${NOT_THIS_SITE} The report's own calendar says what is planted where; this shows only the principle.`},
  {id:'guild-layers',when:/guild|food forest/i,title:'A guild, layer by layer',alt:'A fruit tree with a climber, a berry shrub, a clumping plant, ground cover and root crops sharing one mulched bed, roots drawn below ground.',note:`${NOT_THIS_SITE} Species and spacing must be chosen for this site; this is not its planting plan.`},
  {id:'windbreak-section',when:/wind/i,title:'How a windbreak lifts the wind',alt:'Wind meets a belt of tall trees, smaller trees and shrubs, rises over it and comes down well beyond the vegetable beds sheltered behind.',note:`${NOT_THIS_SITE} Which side to plant follows the wind directions recorded for the site, not this drawing.`},
  {id:'sun-house',when:/sun (&|and) solar|solar/i,title:'Low winter sun in, high summer sun out',alt:'A house with a wide eave: the high summer sun is stopped by the roof overhang while the low winter sun reaches in under it.',note:`${NOT_THIS_SITE} The real sun angles for this latitude are in the sun and wind figure.`},
  {id:'zones',when:/zone design|zones/i,title:'Zones: what you visit most sits closest',alt:'A homestead seen from above: herb and vegetable beds at the door, then chickens and fruit trees, then field crops, grazing and a belt of trees at the edge.',note:`${NOT_THIS_SITE} The zones mapped for this site are in its own site plan.`},
  {id:'chicken-tractor',when:/animals|livestock/i,title:'Let the chickens prepare the next bed',alt:'A movable wire chicken run on wheels stands on one bed while the bed beside it, already cleared and manured, is ready for planting.',note:`${NOT_THIS_SITE} Stock numbers, housing and by-laws still need checking locally.`},
  {id:'firebreak',when:/fire/i,title:'Keep a bare or green ring between grass and home',alt:'A house and water tank on a green lawn, ringed by a bare cleared strip and a gravel road that separate them from dry grassland.',note:`${NOT_THIS_SITE} Break widths and burning rules come from the local fire protection association.`},
  {id:'food-all-year',when:/year-round food|food production|production spaces|planting calendar|seasonal calendar/i,title:'Something to harvest in every season',alt:'Four beds side by side: maize, beans, pumpkin and sweet potato under a high summer sun; cabbage, carrots, onions, peas and young seedlings under a low winter sun.',note:`${NOT_THIS_SITE} The crops and months for this site are in its planting calendar.`},
  {id:'market-table',when:/economic|market|income/i,title:'From the garden to a table at the gate',alt:'A shaded roadside table with crates of spinach, cabbage, tomatoes and pumpkins, seedling trays, eggs and a scale.',note:`${NOT_THIS_SITE} Prices and demand have to be checked in the local market.`},
  {id:'five-year-change',when:/5-year|five-year/i,title:'Bare plot to food garden, in stages',alt:'The same sloping plot three times: bare ground with a house and tank, then young contour beds and saplings, then a full garden with fruit trees.',note:`${NOT_THIS_SITE} How fast the real site changes depends on water, labour and money.`},
];
/** Pictures that exist in public/report-art. Anything not listed is skipped, so a picture still
 * being drawn can never leave a broken image in a report. */
export const REPORT_ART_READY=new Set(['roof-to-tank','swale-section','drip-bed','soil-layers','trench-bed','compost-bays','crop-rotation','guild-layers','windbreak-section','sun-house','zones','chicken-tractor','firebreak','food-all-year','market-table','five-year-change']);
export const reportArtSrc=(id:string)=>`/report-art/${id}.jpg`;
/** Pixel size of each picture file, so the page keeps its place while a picture loads. Margins are trimmed, so the shapes differ. */
export const REPORT_ART_SIZE:Record<string,[number,number]>={'chicken-tractor':[1424,786],'compost-bays':[1426,702],'crop-rotation':[1336,786],'drip-bed':[1426,784],'firebreak':[1426,658],'five-year-change':[1427,617],'food-all-year':[1428,585],'guild-layers':[1338,787],'market-table':[1340,788],'roof-to-tank':[1427,764],'soil-layers':[1425,739],'sun-house':[1426,643],'swale-section':[1425,730],'trench-bed':[1358,786],'windbreak-section':[1426,558],'zones':[1426,739]};
const xml=(s:string)=>s.replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]!));
const svg=(body:string)=>`<svg xmlns="http://www.w3.org/2000/svg" width="820" height="370" viewBox="0 0 820 370"><rect width="820" height="370" rx="18" fill="#f2f6ef"/>${body}</svg>`;
const label=(x:number,y:number,text:string,size=18)=>`<text x="${x}" y="${y}" font-family="Arial,sans-serif" font-size="${size}" fill="#244b34">${xml(text)}</text>`;
const layers=svg(`<path d="M0 283 Q170 255 480 280V370H0Z" fill="#d9b57b"/><path d="M0 285 Q250 256 480 278" stroke="#7a6639" stroke-width="12" fill="none"/><path d="M258 279V114M258 201L218 158M258 167L301 123" stroke="#876143" stroke-width="14" stroke-linecap="round"/><g fill="#3c6843"><ellipse cx="248" cy="106" rx="89" ry="51"/><circle cx="187" cy="121" r="43"/><circle cx="321" cy="112" r="43"/><circle cx="244" cy="62" r="39"/></g><g fill="#698553"><ellipse cx="143" cy="232" rx="51" ry="32"/><ellipse cx="375" cy="233" rx="51" ry="36"/></g><g fill="#95a65c"><ellipse cx="89" cy="269" rx="35" ry="13"/><ellipse cx="329" cy="270" rx="32" ry="13"/><ellipse cx="423" cy="266" rx="30" ry="15"/></g><path d="M258 283q-21 46-79 61M258 283q28 36 78 48M258 283v65" stroke="#997546" stroke-width="4" fill="none"/><g stroke="#66815f" stroke-width="1.5" stroke-dasharray="4 5"><path d="M350 90H489M421 223H489M459 270H489M341 325H489"/></g>${label(510,83,'Tree canopy',22)}${label(510,108,'Upper growing layer',15)}${label(510,218,'Shrubs & understory',22)}${label(510,243,'Space below the canopy',15)}${label(510,279,'Ground cover & leaf litter',19)}${label(510,331,'Roots & living soil',20)}`);

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
/** Where each drawn figure belongs, best chapter first. A figure is shown ONCE: under the first of
 * these headings the report actually has, and otherwise in the overview. 'rainfall' is the climate
 * figure. The site plan, land use and built/planned figures always stay in the overview. */
const FIGURE_CHAPTERS:Array<[string,RegExp[]]>=[
  ['rainfall',[/^site conditions/i,/climate/i]],
  ['sectors',[/sun (&|and) solar/i,/wind (&|and) windbreaks/i,/sector/i]],
  ['water-budget',[/water harvesting/i,/irrigation/i,/water plan|water strategy|water, soil and|amanzi, umhlabathi/i]],
  ['soil',[/soil strategy|soil plan|soil management/i,/water, soil and|amanzi, umhlabathi/i]],
  ['timeline',[/year 1 priorities/i,/next actions/i,/implementation|phasing|5-year vision/i]],
];
const englishTitle=(heading:string)=>{const plain=stripLeadingNumber(heading);return Object.entries(REPORT_ZU).find(([,value])=>value===plain)?.[0]??plain;};
/** heading → the figure charts that belong under it, for the headings this report really has. */
export function placeReportFigures(headings:string[],visuals:ReportVisuals):Record<string,ReportChart[]> {
  const placed:Record<string,ReportChart[]>={};
  for(const [id,rules] of FIGURE_CHAPTERS){
    const chart=visuals.charts.find(c=>c.kind==='figure'&&c.id===id);
    if(!chart)continue;
    for(const rule of rules){
      const heading=headings.find(h=>rule.test(englishTitle(h)));
      if(heading){(placed[heading]??=[]).push(chart);break;}
    }
  }
  return placed;
}
export function chapterGraphics(heading:string, body:string, visuals:ReportVisuals, figures:ReportChart[]=[]):ChapterGraphic[] {
  const title=englishTitle(heading);
  // This site's own data first; the general "how it works" picture after it.
  const result:ChapterGraphic[]=figures.map(chart=>({id:`figure-${chart.id}`,title:chart.title,note:chart.note,chart}));
  if(/vegetation|biome/i.test(title))result.push({id:'layers',title:'A living landscape, layer by layer',note:'Concept illustration. Species, spacing and the layers present must be checked for this site; this is not its measured vegetation profile.',svg:layers});
  // At most two concept pictures a chapter: they explain an idea, they are not the content.
  for(const art of REPORT_ART.filter(a=>REPORT_ART_READY.has(a.id)&&a.when.test(title)&&(!a.body||a.body.test(body))).slice(0,2))result.push({id:`art-${art.id}`,title:art.title,note:art.note,art:{src:reportArtSrc(art.id),alt:art.alt,width:REPORT_ART_SIZE[art.id]?.[0]??1600,height:REPORT_ART_SIZE[art.id]?.[1]??800}});
  if(/tree|fruit|vegetation|biome|guild|agroecosystem|full design inventory/i.test(title)) {
    const trees=reportTreeIllustrations(body);
    if(trees.length)result.push({id:'trees',title:'Trees mentioned in this section',note:'Catalogue illustrations, not site photographs or identification evidence. Read the advice and confirm local suitability before choosing plants.',trees});
  }
  // The overview owns the plain site charts; the crop-plan section owns its calendar. Repeating
  // them under matching chapter headings added pages without new information. A drawn figure is
  // different: it moves to its chapter (placeReportFigures) and leaves the overview.
  return result;
}
export function reportChapterGraphics(report:string,visuals:ReportVisuals) {
  const sections=report.split(/^## /m).slice(1).map(section=>{const [heading,...body]=section.split('\n');return {heading,body:body.join('\n')};});
  const placed=placeReportFigures(sections.map(s=>s.heading),visuals);
  return Object.fromEntries(sections.map(({heading,body})=>[heading,chapterGraphics(heading,body,visuals,placed[heading])]));
}
/** Ids of the figure charts that found a chapter, so the overview can leave them out. */
export const placedFigureIds=(chapters:Record<string,ChapterGraphic[]>)=>new Set(Object.values(chapters).flat().filter(g=>g.chart?.kind==='figure').map(g=>g.chart!.id));
