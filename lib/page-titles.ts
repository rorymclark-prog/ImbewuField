/** Exact metadata identities only: a farmer's name or a document's own title is never a template. */
export const PAGE_TITLE_CONTROLS:Readonly<Record<string,string>> = {
  'Reports — ImbewuField':'tabReports',
  'Saved on this phone — ImbewuField':'offlineTitle',
  'Funder — ImbewuField':'homeRoleFunderLabel',
  'Planting calendar — ImbewuField':'plantingCalendarHeader',
  'Network — ImbewuField':'navNetwork',
  'My records — ImbewuField':'myRecordsTitle',
  "What's new — ImbewuField":'navWhatsNew',
  'Example farm — ImbewuField':'demoBannerLabel',
  'Map — ImbewuField':'tabMap',
  'Contact — ImbewuField':'homeQuickContact',
  'Sign in — ImbewuField':'loginSignIn',
  'Farm-gate prices — ImbewuField':'pricesFarmGateTitle',
  'Community — ImbewuField':'communityHubTitle',
  'Lima Vision — ImbewuField':'homeLimaVisionLabel',
  'Profile — ImbewuField':'communityMemberTitle',
  'Project assessments — ImbewuField':'navAssessments',
  'Take a tour — ImbewuField':'navTour',
  'Design studio — ImbewuField':'navDesignStudio',
  'Tips and help — ImbewuField':'navTipsHelp',
  'Study — ImbewuField':'homeQuickStudy',
  'Home — ImbewuField':'tabHome',
  'Mentor — ImbewuField':'homeRoleMentorLabel',
  'Permaculture manual — ImbewuField':'navManual',
  'Surveys — ImbewuField':'homeSurveysLabel',
  'Field journal — ImbewuField':'navFieldJournal',
  'Messages — ImbewuField':'communityTabMessages',
  'Atlas — ImbewuField':'navAtlas',
  'Organisation — ImbewuField':'navSectionOrganisation',
  'Account — ImbewuField':'tabAccount',
};
export type PageTitleLanguage='zu'|'st'|'ts'|'ve';
export interface PageTitleDraft {english:string;zu?:string;st?:string;ts?:string;ve?:string}
/** Unreviewed machine drafts. The packet records exact source metadata and reused UI authorities. */
export const PAGE_TITLE_DRAFTS:readonly PageTitleDraft[]=[
 {english:'Printable plan — ImbewuField',zu:'Uhlelo oluphrintekayo — ImbewuField',st:'Moralo o ka printwang — ImbewuField',ts:'Pulani leyi nga printiwaka — ImbewuField',ve:'Pulane ine ya nga gandiswa — ImbewuField'},
 {english:'Invoice — ImbewuField',zu:'I-invoyisi — ImbewuField',st:'Invoese — ImbewuField',ts:'Invhoyisi — ImbewuField',ve:'Invhoisi — ImbewuField'},
 {english:'Farm Finance — ImbewuField teaching preview',zu:'Izimali zepulazi — umbukiso wokufundisa we-ImbewuField',st:'Ditjhelete tsa polasi — ponelopele ya ho ruta ya ImbewuField',ts:'Timali ta purasi — nkombiso wo dyondzisa wa ImbewuField',ve:'Masheleni a bulasi — mbonelaphanḓa ya u funza ya ImbewuField'},
 {english:'Farmer exchange — ImbewuField',zu:'Ukuhwebelana kwabalimi — ImbewuField',st:'Phapanyetsano ya balemi — ImbewuField',ts:'Ku cincana ka varimi — ImbewuField',ve:'U tshintshana ha vhalimi — ImbewuField'},
 {english:'Farm Finance lesson — ImbewuField teaching preview',zu:'Isifundo sezimali zepulazi — umbukiso wokufundisa we-ImbewuField',st:'Thuto ya ditjhelete tsa polasi — ponelopele ya ho ruta ya ImbewuField',ts:'Dyondzo ya timali ta purasi — nkombiso wo dyondzisa wa ImbewuField',ve:'Ngudo ya masheleni a bulasi — mbonelaphanḓa ya u funza ya ImbewuField'},
 {english:'ACT Teach the Teachers | two-day facilitator refresher',zu:'ACT Teach the Teachers | ukubuyekeza kwabagqugquzeli kwezinsuku ezimbili',st:'ACT Teach the Teachers | kgopotso ya batsamaisi ba thuto ya matsatsi a mabedi',ts:'ACT Teach the Teachers | mpfuxeto wa vafambisi va tidyondzo wa masiku mambirhi',ve:'ACT Teach the Teachers | mvusuludzo ya vhatshimbidzi vha ngudo ya maḓuvha mavhili'},
 {english:'ImbewuField — permaculture planning for South African farmers',zu:'ImbewuField — ukuhlelwa kwe-permaculture kwabalimi baseNingizimu Afrika',st:'ImbewuField — moralo wa permaculture bakeng sa balemi ba Afrika Borwa',ts:'ImbewuField — ku pulana ka permaculture ka varimi va Afrika Dzonga',ve:'ImbewuField — u pulana ha permaculture ha vhalimi vha Afrika Tshipembe'},
 {english:'Farm Finance practical project — teaching preview',zu:'Iphrojekthi yokuzijwayeza izimali zepulazi — umbukiso wokufundisa',st:'Projeke ya tshebetso ya ditjhelete tsa polasi — ponelopele ya ho ruta',ts:'Phurojeke yo titoloveta ya timali ta purasi — nkombiso wo dyondzisa',ve:'Thandela ya nyito ya masheleni a bulasi — mbonelaphanḓa ya u funza'},
 {english:'ImbewuField for NGOs and funders',zu:'ImbewuField yama-NGO nabaxhasi',st:'ImbewuField bakeng sa di-NGO le batshehetsi',ts:'ImbewuField ya ti-NGO ni vaseketeri va mali',ve:'ImbewuField ya dzi-NGO na vhalambedzi'},
 {english:'Design a working homestead — teaching preview',zu:'Klama ikhaya elisebenzayo — umbukiso wokufundisa',st:'Rala lehae le sebetsang — ponelopele ya ho ruta',ts:'Dizayina muti lowu tirhaka — nkombiso wo dyondzisa',ve:'Pulanani muḓi une wa shuma — mbonelaphanḓa ya u funza'},
 {english:'The busy yard — design practice case',zu:'Igceke elimatasa — isibonelo sokuzijwayeza ukuklama',st:'Jarete e phetheselang — mohlala wa ho itlwaetsa ho rala',ts:'Rivala leri nga ni migingiriko — mhaka yo titoloveta ku dizayina',ve:'Luvhande lu re na mishumo minzhi — tsumbo ya u ḓiḓowedza u pulana'},
 {english:'Report a bug or suggest a feature — ImbewuField',zu:'Bika iphutha noma uphakamise isici — ImbewuField',st:'Tlaleha phoso kapa sisinya tshebetso — ImbewuField',ts:'Vika xihoxo kumbe ringanyeta xitirhisiwa — ImbewuField',ve:'Vhigani vhukhakhi kana ni dzinginye tshumelo — ImbewuField'},
 {english:'Permaculture design lesson — teaching preview',zu:'Isifundo sokuklama i-permaculture — umbukiso wokufundisa',st:'Thuto ya ho rala permaculture — ponelopele ya ho ruta',ts:'Dyondzo yo dizayina permaculture — nkombiso wo dyondzisa',ve:'Ngudo ya u pulana permaculture — mbonelaphanḓa ya u funza'},
 {english:'Choose a view — ImbewuField',zu:'Khetha ukubuka — ImbewuField',st:'Kgetha pono — ImbewuField',ts:'Hlawula mavonelo — ImbewuField',ve:'Nangani mbonalo — ImbewuField'},
 {english:'Example gardens — ImbewuField',zu:'Izingadi eziyisibonelo — ImbewuField',st:'Dirapa tsa mohlala — ImbewuField',ts:'Swirhapa swa swikombiso — ImbewuField',ve:'Ngade dza tsumbo — ImbewuField'},
 {english:'Your design learning folder — ImbewuField',zu:'Ifolda yakho yokufunda ukuklama — ImbewuField',st:'Foldara ya hao ya ho ithuta ho rala — ImbewuField',ts:'Foludara ya wena yo dyondza ku dizayina — ImbewuField',ve:'Foḽuda yaṋu ya u guda u pulana — ImbewuField'},
 {english:'Example production — ImbewuField',zu:'Ukukhiqiza okuyisibonelo — ImbewuField',st:'Tlhahiso ya mohlala — ImbewuField',ts:'Vuhumelerisi bya xikombiso — ImbewuField',ve:'Vhubveledzi ha tsumbo — ImbewuField'},
 {english:'Worked design demonstration — teaching preview',zu:'Umbukiso wesibonelo esenziwe sokuklama — umbukiso wokufundisa',st:'Pontsho ya mohlala o sebetsitsweng wa ho rala — ponelopele ya ho ruta',ts:'Nkombiso wa dizayini leyi tirhiweke — nkombiso wo dyondzisa',ve:'Tsumbedzo ya pulane yo shumwaho — mbonelaphanḓa ya u funza'},
 {english:'Read the scale, check the space — design practice',zu:'Funda isikali, hlola indawo — ukuzijwayeza ukuklama',st:'Bala sekala, hlahloba sebaka — boitlwaetso ba ho rala',ts:'Hlaya xikalo, kambela ndhawu — ku titoloveta ku dizayina',ve:'Vhalani tshikalo, ṱolani tshikhala — u ḓiḓowedza u pulana'},
 {english:'Example farm — ImbewuField',st:'Polasi ya mohlala — ImbewuField',ts:'Purasi ra xikombiso — ImbewuField',ve:'Bulasi ḽa tsumbo — ImbewuField'},
 {english:'Farm-gate prices — ImbewuField',st:'Ditheko hekeng ya polasi — ImbewuField',ts:'Minxavo ya le nyangweni wa purasi — ImbewuField',ve:'Mitengo ya khoroni ya bulasi — ImbewuField'},
];
const drafts=new Map(PAGE_TITLE_DRAFTS.map(row=>[row.english,row]));
export const PAGE_TITLE_SOURCES=Array.from(new Set([...Object.keys(PAGE_TITLE_CONTROLS),...drafts.keys()]));
const sources=new Set(PAGE_TITLE_SOURCES);
export interface PresentedPageTitle {source:string;value:string}
export function keepsDocumentTitleOwner(path:string):boolean {
  // A manual's URL chooses its output language; the partner deck already owns its own title.
  return /^\/manual\//.test(path)||/^\/pitch(?:\/|$)/.test(path);
}
export function nativePageTitle(source:string,lang:string,t:(key:string)=>string):string {
  if(!['zu','st','ts','ve'].includes(lang))return source;
  const local=drafts.get(source)?.[lang as PageTitleLanguage];
  if(local?.trim())return local;
  const key=PAGE_TITLE_CONTROLS[source];
  if(!key)return source;
  const text=t(key);
  return text?.trim()&&text!==key?`${text} — ImbewuField`:source;
}
export function resolvePageTitle(current:string,previous:PresentedPageTitle|null,lang:string,t:(key:string)=>string):PresentedPageTitle|null {
  const source=sources.has(current)?current:previous?.value===current?previous.source:null;
  if(!source||!sources.has(source))return null;
  return{source,value:nativePageTitle(source,lang,t)};
}
