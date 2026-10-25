import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import typescript from 'typescript';
import * as React from 'react';
import { Compass } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { jsPDF } from 'jspdf';
import { cropExportText, cropPlanNoteText, isCropExportDraftLanguage, CROP_EXPORT_DRAFT_LANGUAGES } from '../lib/crop-export-copy.ts';
import { CROP_EXPORT_COPY } from '../lib/crop-export-copy-data.ts';
import { PLAN_NOTES_PANEL_COPY, autoSuggestPlan, chosenWithNoSowingMonthNote, chosenButUnplacedNote, type PlanNote, type AutoSuggestAnswers } from '../lib/crop-autosuggest.ts';
import { planNotesDateLabel, occupiedMonthsForPlanting, plantingBedEntryOffsets, type Planting } from '../lib/crop-plan.ts';
import { IDEAL_PLAN_COPY, suggestIdealYearPlan } from '../lib/crop-plan-ideal.ts';
import { CROPS, cropByKey } from '../lib/crop-catalog.ts';
import { monthShort } from '../lib/crop-export-schedule.ts';
import { registerReportPdfFont } from '../lib/report-pdf-font.ts';
import { drawCropPlanPages, type CropPlanPdfInput } from '../lib/crop-export-pdf.ts';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const raw=gunzipSync(readFileSync(new URL('./fixtures/plan-note-translation/source-before.json.gz',import.meta.url)));
const before=JSON.parse(raw.toString()) as {base:string;sources:Array<{file:string;source:string;sha256:string}>};
const packet=JSON.parse(read('docs/translation/four-language-completion/plan-note-drafts.json')) as {noteSources:string[];rows:Array<{english:string;zu:string;st:string;ts:string;ve:string;generatedScope?:string}>;sourceCaptureSha256:string;status:string};
const original=(file:string)=>before.sources.find(row=>row.file===file)!.source;
function functionSource(source:string,name:string):string{
  const file=typescript.createSourceFile('source.tsx',source,typescript.ScriptTarget.Latest,true,typescript.ScriptKind.TSX);
  const node=file.statements.find(statement=>typescript.isFunctionDeclaration(statement)&&statement.name?.text===name);
  assert.ok(node,`missing component ${name}`);return node.getText(file);
}
function presenters(source:string,language:string){
  const names=['PlanNoteGroups','AcceptedPlanNotesCard'];if(source.includes('function SavedPlanNote('))names.unshift('SavedPlanNote');
  const code=typescript.transpileModule(names.map(name=>functionSource(source,name)).join('\n'),{compilerOptions:{jsx:typescript.JsxEmit.React,module:typescript.ModuleKind.CommonJS,target:typescript.ScriptTarget.ES2022}}).outputText;
  return new Function('React','useLanguage','cropExportText','cropPlanNoteText','isCropExportDraftLanguage','planNotesDateLabel','PLAN_NOTES_PANEL_COPY','Compass',code+';return {PlanNoteGroups,AcceptedPlanNotesCard};')(React,()=>({lang:language}),cropExportText,cropPlanNoteText,isCropExportDraftLanguage,planNotesDateLabel,PLAN_NOTES_PANEL_COPY,Compass) as {PlanNoteGroups:React.ComponentType<{notes:PlanNote[]}>;AcceptedPlanNotesCard:React.ComponentType<{notes:PlanNote[];generatedAt:number}>};
}
const page=read('app/facilitator/crops/page.tsx');
const noteRows=packet.rows.filter(row=>row.generatedScope==='plan-note');
const noteSamples:PlanNote[]=noteRows.map((row,i)=>({kind:(['warning','choice','gap','basis'] as const)[i%4],text:row.english,bedIds:[`bed-${i%2}`]}));
const token=(text:string)=>text.match(/\{\w+\}/g)?.sort()??[];
const compact=(text:string)=>text.replace(/\s/g,'');
// Only this complete gap-note suffix is an intentional source correction. Every other field stays exact.
function restorePlotExplanation<T>(value:T):T{
  const correction=JSON.parse(read('docs/translation/four-language-completion/plan-note-drafts.json')).plotRestCorrection;
  return JSON.parse(JSON.stringify(value),(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)&&item.kind==='gap'&&typeof item.text==='string'&&item.text.endsWith(correction.afterReason)?{...item,text:item.text.slice(0,-correction.afterReason.length)+correction.beforeReason}:item) as T;
}


test('saved-note translation keeps original producers, saved schemas and all unreviewed source pairs intact',()=>{
  const manifest=JSON.parse(read('tests/fixtures/plan-note-translation/capture-manifest.json'));
  assert.equal(createHash('sha256').update(raw).digest('hex'),manifest.uncompressedSha256);
  for(const row of before.sources)assert.equal(createHash('sha256').update(row.source).digest('hex'),row.sha256);
  assert.equal(read('lib/crop-plan.ts'),original('lib/crop-plan.ts'),'saved schemas, geometry and calculations remain exact');
  const plotCorrection=JSON.parse(read('docs/translation/four-language-completion/plan-note-drafts.json')).plotRestCorrection;
  assert.equal(read('lib/crop-autosuggest.ts').replace(plotCorrection.afterDeclaration,plotCorrection.beforeDeclaration),original('lib/crop-autosuggest.ts'),'only the proven unsupported spent-course display claim may change; the whole planning engine otherwise remains byte-exact');
  const correction=JSON.parse(read('docs/translation/four-language-completion/plan-note-drafts.json')).starterCorrection;
  assert.equal(read('lib/crop-plan-ideal.ts').replace(correction.addedImport,'').replace(correction.after,correction.before),original('lib/crop-plan-ideal.ts'),'only the proven-false display sentence and its copy import may change; the full yearly planner remains exact');
  assert.match(packet.status,/IN PROGRESS.*unreviewed/);assert.equal(noteRows.length,13);
  assert.deepEqual(noteRows.map(row=>row.english),packet.noteSources);
  const sourceFile=typescript.createSourceFile('source.ts',original('lib/crop-autosuggest.ts'),typescript.ScriptTarget.Latest,true),sources:string[]=[];
  function visit(node:typescript.Node){if(typescript.isCallExpression(node)&&node.expression.getText(sourceFile)==='planNote'&&typescript.isStringLiteral(node.arguments[1]))sources.push(node.arguments[1].text);typescript.forEachChild(node,visit);}visit(sourceFile);
  assert.deepEqual(packet.noteSources,sources,'the first batch covers each complete direct static note, without silently dropping its second sentence');
  for(const row of packet.rows){assert.deepEqual(CROP_EXPORT_COPY.find(copy=>copy.english===row.english),row);for(const language of CROP_EXPORT_DRAFT_LANGUAGES){assert.notEqual(row[language],row.english);assert.deepEqual(token(row[language]),token(row.english));assert.deepEqual(row[language].match(/\d+(?:[.,]\d+)?/g)??[],row.english.match(/\d+(?:[.,]\d+)?/g)??[]);}}
  for(const [source,names]of [[noteRows[0].english,['kg/m²']],[noteRows[4].english,['FAO','Thornthwaite']],[noteRows[6].english,['KZN DARD','KwaZulu-Natal']],[noteRows[9].english,['Maize','maize']],[noteRows[12].english,['broad beans','oats']]] as const){for(const language of CROP_EXPORT_DRAFT_LANGUAGES)for(const name of names)assert.ok(cropPlanNoteText(source,language).includes(name),`${language}: lost original identity or unit ${name}`);}
});

test('unknown and edited saved notes stay verbatim with a native label, including private delimiters and placeholders',()=>{
  const originals=['Private bed, east; {note} $& <kept> 03.50 m²',noteRows[0].english+' Changed saved detail.',noteRows[4].english.replace('at least half','at least all'),''];
  for(const language of ['en','xx',...CROP_EXPORT_DRAFT_LANGUAGES])for(const source of originals){const text=cropPlanNoteText(source,language);assert.equal(text,isCropExportDraftLanguage(language)?cropExportText('Original saved plan note: {note}',language,{note:source}):source);if(source)assert.ok(text.endsWith(source));}
  for(const row of noteRows)for(const language of ['en','xx'])assert.equal(cropPlanNoteText(row.english,language),row.english);
  for(const row of noteRows)for(const language of CROP_EXPORT_DRAFT_LANGUAGES)assert.equal(cropPlanNoteText(row.english,language),row[language]);
  assert.notEqual(cropPlanNoteText(noteRows[0].english,'ve'),cropPlanNoteText(noteRows[0].english+' Changed saved detail.','ve'),'the exact complete-source guard must reject an altered saved note');
});

test('actual accepted-note components preserve default markup, original text and deduplicated bed counts',()=>{
  const notes=[...noteSamples,{kind:'gap',bedIds:['bed-0','bed-1'],text:'PRIVATE {count}, {note}; $& <kept> 03.50'}] as PlanNote[],stamp=new Date(2026,9,21,12).getTime(),serialized=JSON.stringify(notes);
  const old=presenters(original('app/facilitator/crops/page.tsx'),'en');
  for(const language of ['en','xx']){const current=presenters(page,language);assert.equal(renderToStaticMarkup(React.createElement(current.AcceptedPlanNotesCard,{notes,generatedAt:stamp})),renderToStaticMarkup(React.createElement(old.AcceptedPlanNotesCard,{notes,generatedAt:stamp})));}
  for(const language of CROP_EXPORT_DRAFT_LANGUAGES){const current=presenters(page,language),markup=renderToStaticMarkup(React.createElement(current.AcceptedPlanNotesCard,{notes,generatedAt:stamp}));assert.ok(markup.includes('lang="en"'),'each translated note must retain its complete English source');assert.ok(markup.includes('PRIVATE {count}, {note}; $&amp; &lt;kept&gt; 03.50'));assert.ok(!markup.includes('<kept>'));const expected=renderToStaticMarkup(React.createElement('span',null,cropExportText('Ground with no new sowing',language)+' (2)')).replace(/^<span>|<\/span>$/g,'');assert.ok(markup.includes(expected),'the same bed named by multiple gap notes counts only once');assert.ok(markup.includes(planNotesDateLabel(stamp,language)));for(const row of noteRows){assert.ok(markup.includes(renderToStaticMarkup(React.createElement('span',null,row[language])).slice(6,-7)));assert.ok(markup.includes(renderToStaticMarkup(React.createElement('p',{lang:'en',style:{marginTop:4}},row.english))));}}
  assert.equal(JSON.stringify(notes),serialized);
  const originalGroup=functionSource(original('app/facilitator/crops/page.tsx'),'PlanNoteGroups'),currentGroup=functionSource(page,'PlanNoteGroups');const countBody=(source:string)=>source.slice(source.indexOf('const seen ='),source.indexOf('return seen.size + unattributed;')+'return seen.size + unattributed;'.length);assert.equal(countBody(currentGroup),countBody(originalGroup),'saved-note grouping cannot acquire a new bed-count authority');
});

test('real planner output is translated only as presentation and never regenerated during display',()=>{
  const base:AutoSuggestAnswers={goal:'family',groups:[],cropKeys:['swiss-chard','maize','oats'],rhythm:'few-big',rotateCrops:true,allowVinesInBeds:false,allowMixedCropsInBed:true,reliableIrrigation:true};
  const beds=[{id:'private-bed',label:'PRIVATE {note}; east, $&',areaM2:9,minDimM:1.4}];
  const cases=[autoSuggestPlan({...base,reliableIrrigation:false},'summer',beds,[],8),autoSuggestPlan(base,'summer',beds,[],0),autoSuggestPlan(base,'all-year',beds,[],8)];let translated=0;
  // The original13-source inventory must not require later legitimate drafts to stay English.
  // Exercise unknown/private-note handling explicitly, so completing another source cannot erase it.
  for(const result of cases){const saved=JSON.stringify(result);for(const language of CROP_EXPORT_DRAFT_LANGUAGES){
    const current=presenters(page,language),markup=renderToStaticMarkup(React.createElement(current.PlanNoteGroups,{notes:result.notes}));
    for(const note of result.notes){const text=cropPlanNoteText(note.text,language,note),source=cropExportText('Original saved plan note: {note}',language,{note:note.text});
      if(text===source)assert.ok(text.endsWith(note.text));else{
        translated++;assert.notEqual(text,note.text);assert.deepEqual(text.match(/\d+(?:[.,]\d+)?/g)??[],note.text.match(/\d+(?:[.,]\d+)?/g)??[]);
        const escaped=renderToStaticMarkup(React.createElement('span',null,text)).slice(6,-7);assert.ok(markup.includes(escaped));assert.ok(markup.includes(renderToStaticMarkup(React.createElement('p',{lang:'en',style:{marginTop:4}},note.text))));
      }
    }
    const privateNote='PRIVATE {note}, east; $& <kept> 03.50';assert.equal(cropPlanNoteText(privateNote,language),cropExportText('Original saved plan note: {note}',language,{note:privateNote}));
  }assert.equal(JSON.stringify(result),saved);}
  assert.ok(translated>0,'the real cases must still exercise native source-bound presentation');
});

test('native PDF pages print complete saved-note drafts followed by their exact source',async()=>{
  const meta={planTitle:'PRIVATE {note}; plan',siteLine:'No site set',locationLine:'No site set',climateLine:'',bedsSummary:'',dateLabel:'21 Oct 2026',estimatedKgPerYear:null,lossPercent:0};
  for(const language of CROP_EXPORT_DRAFT_LANGUAGES){const doc=new jsPDF({unit:'pt',format:'a4'}),fontFamily=await registerReportPdfFont(doc),painted:string[]=[],pages=new Map<number,string[]>();const oldText=doc.text.bind(doc);doc.text=((text:unknown,...args:unknown[])=>{const chunks=Array.isArray(text)?text.flat().map(String):[String(text)];painted.push(...chunks);const number=doc.getCurrentPageInfo().pageNumber;pages.set(number,[...(pages.get(number)??[]),...chunks]);return(oldText as (...args:unknown[])=>jsPDF)(text,...args);}) as typeof doc.text;
    const input:CropPlanPdfInput={plantings:[],beds:[],tasks:[],meta:{...meta,language},planNotes:noteSamples,planNotesAt:new Date(2026,9,21,12).getTime(),now:new Date(2026,9,21,12),sections:['dashboard']};const saved=JSON.stringify(input);drawCropPlanPages(doc,input,false,{font:fontFamily});const text=compact(painted.join(' '));for(const row of noteRows){assert.ok(text.includes(compact(row[language])),`${language}: full saved draft missing`);assert.ok(text.includes(compact(row.english)),`${language}: English source missing`);assert.ok([...pages.values()].some(lines=>compact(lines.join(' ')).includes(compact(row[language]))&&compact(lines.join(' ')).includes(compact(row.english))),`${language}: the saved note and its complete original must stay together`);}assert.equal(JSON.stringify(input),saved);assert.ok(doc.getNumberOfPages()>1,'long complete notes must paginate');
  }
});

// The check must reject the observed split, rather than merely finding both halves somewhere.
test('the real old PDF fails when a short saved note loses its final condition to the next sheet',()=>{
  const observed=JSON.parse(read('tests/fixtures/plan-note-translation/source-condition-split-before.json'));
  assert.ok(!observed.pages.some((page:string)=>compact(page).includes(compact(observed.source))));
  assert.ok(compact(observed.pages.join(' ')).includes(compact('you have checked the real row layout.')),'the failing render retained the condition but detached it');
});

test('the observed source-only tail page fails the draft-and-original context rule',()=>{
  const observed=JSON.parse(read('tests/fixtures/plan-note-translation/paired-source-split-before.json'));
  assert.ok(!observed.pages.some((page:string)=>compact(page).includes(compact(observed.english))&&compact(page).includes(compact(observed.draft))));
  assert.ok(observed.pages.some((page:string)=>compact(page).includes(compact(observed.english))));
  assert.ok(observed.pages.some((page:string)=>compact(page).includes(compact(observed.draft))));
});

function starterPresenter(language:string){
  const code=typescript.transpileModule(functionSource(page,'StarterPlanNote'),{compilerOptions:{jsx:typescript.JsxEmit.React,module:typescript.ModuleKind.CommonJS,target:typescript.ScriptTarget.ES2022}}).outputText;
  return new Function('React','useLanguage','IDEAL_PLAN_COPY','cropByKey','monthShort','isCropExportDraftLanguage','cropExportText',code+';return StarterPlanNote;')(React,()=>({lang:language}),IDEAL_PLAN_COPY,cropByKey,monthShort,isCropExportDraftLanguage,cropExportText) as React.ComponentType<{plantings:Planting[];lineStyle:React.CSSProperties}>;
}

test('one-time starters cannot promise next-year coverage that the real repeating plan does not provide',()=>{
  const proof=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/plan-note-translation/starter-claim-before.json.gz',import.meta.url))).toString());
  const saved=proof.cases.find((row:{pattern:string;rhythm:string})=>row.pattern==='summer'&&row.rhythm==='few-big');
  const result=suggestIdealYearPlan({...proof.answers,rhythm:saved.rhythm},saved.pattern,proof.beds,[],8,2026);
  assert.equal(JSON.stringify(restorePlotExplanation(result)),JSON.stringify(saved.result),'the two declared display corrections must not change any planting, source prefix or planner decision');
  const cycle=result.best.result.plantings.filter(p=>typeof p.once!=='string'),starters=result.best.result.plantings.filter(p=>typeof p.once==='string');assert.ok(starters.length>0);
  const load=new Map<string,number>();for(const p of cycle)for(const start of plantingBedEntryOffsets(p,8,24))for(let i=0;i<occupiedMonthsForPlanting(p).length;i++){const offset=start+i;if(offset<0||offset>=24)continue;const key=p.bedId+':'+offset;load.set(key,(load.get(key)??0)+(p.areaFraction??1));}
  const holes=[];for(const p of starters)for(const start of plantingBedEntryOffsets(p,8,24))for(let i=0;i<occupiedMonthsForPlanting(p).length;i++){const offset=start+i;if(offset>=0&&offset<12&&(load.get(p.bedId+':'+(offset+12))??0)===0)holes.push({bedId:p.bedId,cropKey:p.cropKey,monthOffset:offset});}
  assert.ok(holes.length>0,'the existing fixture must actually disprove the old promise');
  assert.match(IDEAL_PLAN_COPY.starterLine('Carrots (Aug)'),/Each runs once\. Check the repeating plan before next year: these months may need another one-time sowing unless the plan changes\./);
  assert.doesNotMatch(IDEAL_PLAN_COPY.starterLine('Carrots (Aug)'),/from next year the repeating plan covers those months itself/);
  assert.ok(original('lib/crop-plan-ideal.ts').includes('from next year the repeating plan covers those months itself'),'retain the actual false claim as the negative control');
  const before=JSON.stringify(result.best.result.plantings);
  for(const language of ['en','xx',...CROP_EXPORT_DRAFT_LANGUAGES]){
    const Component=starterPresenter(language),markup=renderToStaticMarkup(React.createElement(Component,{plantings:result.best.result.plantings,lineStyle:{fontSize:11.5}}));
    // Xitsonga's December abbreviation contains an apostrophe; React correctly escapes it.
    for(const p of starters){const label=`${cropByKey(p.cropKey)!.name} (${monthShort(p.sowMonth,language)})`;const rendered=renderToStaticMarkup(React.createElement('span',null,label)).slice(6,-7);assert.ok(markup.includes(rendered),`${language}: wrong crop/month pairing or lost source identity`);}
    if(isCropExportDraftLanguage(language)){assert.ok(markup.includes('lang="en"'));assert.ok(!markup.includes('from next year the repeating plan covers those months itself'));}
    const privateValue='PRIVATE {crops} $& <kept>';assert.ok(IDEAL_PLAN_COPY.starterLine(privateValue,language).includes(privateValue));
  }
  assert.equal(JSON.stringify(result.best.result.plantings),before);
  const Empty=starterPresenter('ve');assert.equal(renderToStaticMarkup(React.createElement(Empty,{plantings:cycle,lineStyle:{}})),'','no one-time sowings means no starter claim');
});

const chosenRaw=gunzipSync(readFileSync(new URL('./fixtures/plan-note-translation/chosen-warnings-before.json.gz',import.meta.url)));
const chosenBefore=JSON.parse(chosenRaw.toString()) as {crops:Array<{key:string;name:string}>;cases:Array<{kind:'no-window'|'unplaced';cropKeys:string[];pattern:import('../lib/crop-catalog.ts').RainPattern;beds?:import('../lib/crop-plan.ts').PlanBed[];expected:PlanNote}>};
const calendarSources:Record<import('../lib/crop-catalog.ts').RainPattern,string>={summer:'the summer-rainfall, hard-frost calendar',winter:'the winter-rainfall calendar','all-year':'the frost-free calendar','mild-frost':'the summer-rainfall, light-frost calendar'};
const frame=(scope:string)=>packet.rows.find(row=>row.generatedScope===scope)!.english;
function expectedChosen(row:typeof chosenBefore.cases[number],language:string):string{
  const names=row.cropKeys.map(key=>chosenBefore.crops.find(crop=>crop.key===key)!.name).join(', '),count=row.cropKeys.length===1?'one':'many';
  if(row.kind==='no-window')return cropExportText(frame('plan-note-window-'+count),language,{crops:names,calendar:cropExportText(calendarSources[row.pattern],language)});
  const head=cropExportText(frame('plan-note-unplaced-'+count),language,{crops:names}),veg=row.beds?.filter(bed=>bed.kind!=='plot')??[];
  return head+(veg.length?cropExportText(frame('plan-note-space-'+(veg.length===1?'one':'many')),language,{beds:veg.length,area:Math.round(veg.reduce((sum,bed)=>sum+bed.areaM2,0))}):'');
}

test('every source crop-choice warning keeps its full calendar, extension condition, counts and snapshot area in all four languages',()=>{
  const dynamic=JSON.parse(read('docs/translation/four-language-completion/plan-note-drafts.json')).dynamicChosenWarnings;
  assert.equal(createHash('sha256').update(chosenRaw).digest('hex'),dynamic.uncompressedSha256);
  assert.equal(chosenBefore.cases.length,dynamic.cases);
  assert.deepEqual(CROPS.map(crop=>({key:crop.key,name:crop.name})),chosenBefore.crops,'use the exact checked catalogue identities, not new translated species names');
  const snapshot=JSON.stringify(chosenBefore),catalogue=JSON.stringify(CROPS),scopes=['plan-note-window-one','plan-note-window-many','plan-note-unplaced-one','plan-note-unplaced-many','plan-note-space-one','plan-note-space-many'];
  for(const scope of scopes)assert.equal(packet.rows.filter(row=>row.generatedScope===scope).length,1,'one source frame per complete message variant');
  assert.deepEqual(packet.rows.filter(row=>row.generatedScope==='plan-note-calendar').map(row=>row.english),Object.values(calendarSources));
  for(const row of chosenBefore.cases){
    const crops=row.cropKeys.map(key=>cropByKey(key)!);
    const regenerated=row.kind==='no-window'?chosenWithNoSowingMonthNote(crops,row.pattern):chosenButUnplacedNote(crops,row.beds);
    assert.deepEqual(regenerated,row.expected,'each immutable fixture must still be an actual complete producer message');
    assert.equal(expectedChosen(row,'en'),row.expected.text,'the presentation grammar must match the entire original, including optional source tail');
    for(const language of ['en','xx'])assert.equal(cropPlanNoteText(row.expected.text,language,row.expected),row.expected.text);
    for(const language of CROP_EXPORT_DRAFT_LANGUAGES){
      const native=cropPlanNoteText(row.expected.text,language,row.expected);
      assert.equal(native,expectedChosen(row,language),`${language}/${row.kind}/${row.cropKeys.join(',')}: whole-source translation missing or truncated`);
      assert.deepEqual(native.match(/\d+(?:[.,]\d+)?/g)??[],row.expected.text.match(/\d+(?:[.,]\d+)?/g)??[],'snapshot numbers must survive in their original order');
      for(const crop of crops)assert.ok(native.includes(crop.name),'source crop identity is opaque display data');
      if(row.expected.text.includes('m²'))assert.ok(native.includes('m²'),'a total growing area cannot become a per-bed rate');
      const changedCurrentContext={...row.expected,beds:[{id:'current-map',areaM2:999}],rainPattern:'all-year'};
      assert.equal(cropPlanNoteText(row.expected.text,language,changedCurrentContext),native,'current geometry or climate must not rewrite a saved suggestion');
    }
  }
  assert.equal(JSON.stringify(chosenBefore),snapshot);assert.equal(JSON.stringify(CROPS),catalogue);
});

test('edited warnings, missing crop metadata and private lookalikes stay exact source instead of acquiring a new claim',()=>{
  const window=chosenBefore.cases.find(row=>row.kind==='no-window'&&row.cropKeys.length===2)!,space=chosenBefore.cases.find(row=>row.kind==='unplaced'&&row.beds?.length===1&&row.beds[0].kind!=='plot'&&row.beds[0].areaM2===9)!;
  const edited=[
    {...window.expected,text:window.expected.text.replace('Ask your extension officer before trying them here.','')},
    {...window.expected,text:window.expected.text+' PRIVATE {note} $& <kept>'},
    {...window.expected,text:window.expected.text.replace(chosenBefore.crops.find(c=>c.key===window.cropKeys[0])!.name,'PRIVATE bed, east; {crops} $&')},
    {...space.expected,text:space.expected.text.replace('1 veg bed','01 veg bed')},
    {...space.expected,text:space.expected.text.replace('1 veg bed','1 veg beds')},
    {...space.expected,text:space.expected.text.replace('(9 m²','(9.0 m²')},
    {...space.expected,text:space.expected.text.replace(' Add it by hand if you want to make room.','')},
    {...space.expected,text:space.expected.text+' Extra private observation.'},
    {kind:'warning' as const,text:'the frost-free calendar',unplacedCropKeys:space.cropKeys},
  ];
  for(const language of CROP_EXPORT_DRAFT_LANGUAGES){
    const original=(note:PlanNote)=>cropExportText('Original saved plan note: {note}',language,{note:note.text});
    for(const note of edited)assert.equal(cropPlanNoteText(note.text,language,note),original(note));
    for(const unplacedCropKeys of [undefined,[],['not-a-catalogue-crop'],[...window.cropKeys].reverse()])assert.equal(cropPlanNoteText(window.expected.text,language,{unplacedCropKeys}),original(window.expected));
    assert.equal(cropPlanNoteText(window.expected.text,language),original(window.expected),'a source-looking private string without its recorded crop identities must remain source');
    assert.notEqual(cropPlanNoteText(space.expected.text,language,space.expected),original(space.expected),'the positive actual producer case must translate, so fallback assertions cannot pass vacuously');
  }
});

const plotBaseline=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/plan-note-translation/plot-rest-before.json.gz',import.meta.url))).toString());
const plotRepresentative=autoSuggestPlan(plotBaseline.answers,plotBaseline.pattern,plotBaseline.beds,plotBaseline.existingPlantings,plotBaseline.month).notes.find(note=>note.kind==='gap')!;
const chosenRepresentatives:PlanNote[]=[...Object.keys(calendarSources).map(pattern=>chosenBefore.cases.find(row=>row.kind==='no-window'&&row.pattern===pattern&&row.cropKeys.length===2)!.expected),...['one','many'].flatMap(count=>[undefined,0,9,9.6,21].map(area=>chosenBefore.cases.find(row=>row.kind==='unplaced'&&row.cropKeys.length===(count==='one'?1:2)&&(area===undefined?!row.beds:row.beds&&row.beds.some(b=>b.kind!=='plot')&&row.beds.filter(b=>b.kind!=='plot').reduce((sum,b)=>sum+b.areaM2,0)===area))!.expected)),...packet.rows.filter(row=>row.generatedScope==='plan-note-authored').map((row,i)=>({kind:i<3?'warning' as const:'basis' as const,text:row.english})),plotRepresentative];

test('actual saved-note components forward recorded crop identities and keep complete dynamic drafts with their English source',()=>{
  const notes=chosenRepresentatives,before=JSON.stringify(notes);
  for(const language of ['en','xx',...CROP_EXPORT_DRAFT_LANGUAGES]){
    const {AcceptedPlanNotesCard}=presenters(page,language),markup=renderToStaticMarkup(React.createElement(AcceptedPlanNotesCard,{notes,generatedAt:new Date(2026,9,21,12).getTime()}));
    for(const note of notes){const text=cropPlanNoteText(note.text,language,note),escaped=renderToStaticMarkup(React.createElement('span',null,text)).slice(6,-7);assert.ok(markup.includes(escaped),`${language}: actual note component omitted its recorded identities or complete native clause`);if(isCropExportDraftLanguage(language))assert.ok(markup.includes(renderToStaticMarkup(React.createElement('p',{lang:'en',style:{marginTop:4}},note.text))));}
  }
  assert.equal(JSON.stringify(notes),before);
});

test('native PDFs retain every complete dynamic warning, source condition and saved figure beside its original',async()=>{
  for(const language of CROP_EXPORT_DRAFT_LANGUAGES){
    const doc=new jsPDF({unit:'pt',format:'a4'}),font=await registerReportPdfFont(doc),pages=new Map<number,string[]>(),originalText=doc.text.bind(doc);
    doc.text=((value:unknown,...args:unknown[])=>{const chunks=Array.isArray(value)?value.flat().map(String):[String(value)],page=doc.getCurrentPageInfo().pageNumber;pages.set(page,[...(pages.get(page)??[]),...chunks]);return(originalText as(...args:unknown[])=>jsPDF)(value,...args);}) as typeof doc.text;
    const input:CropPlanPdfInput={plantings:[],beds:[],tasks:[],planNotes:chosenRepresentatives,planNotesAt:new Date(2026,9,21,12).getTime(),now:new Date(2026,9,21,12),sections:['dashboard'],meta:{language,planTitle:'PRIVATE {note}, east; $&',siteLine:'No site set',locationLine:'No site set',climateLine:'',bedsSummary:'',dateLabel:'21 Oct 2026',estimatedKgPerYear:null,lossPercent:0}};
    const before=JSON.stringify(input);drawCropPlanPages(doc,input,false,{font});
    for(const note of chosenRepresentatives){const native=cropPlanNoteText(note.text,language,note);assert.ok([...pages.values()].some(lines=>compact(lines.join(' ')).includes(compact(native))&&compact(lines.join(' ')).includes(compact(note.text))),`${language}: complete source/draft pair lost or separated`);}
    assert.equal(JSON.stringify(input),before);
  }
});

test('complete no-space and scheduling-basis notes stay bound to their original helper branches',()=>{
  const bindings=JSON.parse(read('docs/translation/four-language-completion/plan-note-drafts.json')).additionalAuthoredSources as Array<{english:string;function:string;sourceFile:string}>;
  const authored=packet.rows.filter(row=>row.generatedScope==='plan-note-authored');assert.equal(authored.length,5);assert.deepEqual(authored.map(row=>row.english),bindings.map(row=>row.english));
  for(const binding of bindings){const ast=typescript.createSourceFile('producer.ts',functionSource(original(binding.sourceFile),binding.function),typescript.ScriptTarget.Latest,true);const literals:string[]=[];const visit=(node:typescript.Node)=>{if(typescript.isStringLiteral(node))literals.push(node.text);typescript.forEachChild(node,visit);};visit(ast);assert.ok(literals.includes(binding.english),'a helper/conditional source must remain a whole original literal, not a newly invented note');}
  const helperCode=typescript.transpileModule(functionSource(original('lib/crop-autosuggest.ts'),'noSharedBedsNote'),{compilerOptions:{target:typescript.ScriptTarget.ES2022}}).outputText;
  const noShared=new Function(helperCode+';return noSharedBedsNote;')() as (beds:import('../lib/crop-plan.ts').PlanBed[])=>string;
  const bed={id:'private',label:'PRIVATE {note}; east, $&',areaM2:9,minDimM:1.4};
  assert.equal(noShared([]),authored[0].english);assert.equal(noShared([{...bed,kind:'plot'}]),authored[1].english);assert.equal(noShared([bed]),authored[2].english);
  for(const row of authored)for(const language of ['en','xx',...CROP_EXPORT_DRAFT_LANGUAGES]){
    assert.equal(cropPlanNoteText(row.english,language),isCropExportDraftLanguage(language)?row[language]:row.english);
    if(isCropExportDraftLanguage(language))assert.equal(cropPlanNoteText(row.english+' PRIVATE {note} $&',language),cropExportText('Original saved plan note: {note}',language,{note:row.english+' PRIVATE {note} $&'}));
  }
  const base:AutoSuggestAnswers={goal:'family',groups:['leafy_green'],rhythm:'steady',rotateCrops:true,allowVinesInBeds:false,reliableIrrigation:true};
  const exact=autoSuggestPlan({...base,groups:[],cropKeys:['swiss-chard']},'summer',[bed],[],8),broad=autoSuggestPlan(base,'summer',[bed],[],8);
  assert.ok(exact.notes.some(note=>note.text===authored[3].english));assert.ok(broad.notes.some(note=>note.text===authored[4].english));
});

test('an empty plot cannot be told its annual staple course is already used, and only that display claim changes',()=>{
  const captured=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/plan-note-translation/plot-rest-before.json.gz',import.meta.url))).toString()),correction=JSON.parse(read('docs/translation/four-language-completion/plan-note-drafts.json')).plotRestCorrection;
  assert.equal(captured.result.plantings.length,0);const beforeNote=captured.result.notes.find((note:PlanNote)=>note.kind==='gap'&&note.text.endsWith(correction.beforeReason));assert.ok(beforeNote,'retain the actual unsupported spent-course claim as the negative control');
  const current=autoSuggestPlan(captured.answers,captured.pattern,captured.beds,captured.existingPlantings,captured.month),note=current.notes.find(note=>note.kind==='gap'&&note.text.endsWith(correction.afterReason));assert.ok(note);
  assert.equal(current.plantings.length,0);assert.match(correction.afterReason,/Once its course for the year is used, no second staple may follow it\./);assert.ok(!correction.afterReason.includes('is already spent'));
  assert.equal(JSON.stringify(restorePlotExplanation(current)),JSON.stringify(captured.result),'no planting, model decision, saved figure, private label or other source clause may change');
  const sourceTemplate=frame('plan-note-rest-year-one'),place=captured.beds[0].label,original=JSON.stringify(note);
  for(const language of CROP_EXPORT_DRAFT_LANGUAGES){
    const expected=cropExportText(sourceTemplate,language,{count:'1',place,period:cropExportText('All year',language).toLowerCase(),reason:cropExportText(correction.afterReason,language)});
    assert.equal(cropPlanNoteText(note.text,language,note),expected);assert.ok(expected.includes(place));
    assert.equal(cropPlanNoteText(beforeNote.text,language,beforeNote),cropExportText('Original saved plan note: {note}',language,{note:beforeNote.text}),'an older saved assertion must not be silently rewritten as the corrected claim');
    for(const bad of [{...note,bedIds:[]},{...note,bedIds:['one','two']},{...note,text:note.text.replace(' (all year).',' (Jan–Mar).')},{...note,text:note.text+' PRIVATE suffix'}])assert.equal(cropPlanNoteText(bad.text,language,bad),cropExportText('Original saved plan note: {note}',language,{note:bad.text}));
    const privatePlace='PRIVATE (all year), {period}; $& <kept> 03.50',text=cropExportText(sourceTemplate,'en',{count:'1',place:privatePlace,period:'all year',reason:correction.afterReason});
    assert.equal(cropPlanNoteText(text,language,note),cropExportText(sourceTemplate,language,{count:'1',place:privatePlace,period:cropExportText('All year',language).toLowerCase(),reason:cropExportText(correction.afterReason,language)}),'only the final producer-owned period changes; private month-like labels remain opaque');
  }
  assert.equal(JSON.stringify(note),original);
  const changed=structuredClone(current);changed.plantings.push({id:'unexpected',bedId:captured.beds[0].id,cropKey:'swiss-chard',sowMonth:8});assert.notEqual(JSON.stringify(restorePlotExplanation(changed)),JSON.stringify(captured.result),'the exact display-only restoration must still catch a new model planting');
});

test('the actual plot-only suggestion renders all six current source notes natively with original English backing',()=>{
  const captured=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/plan-note-translation/plot-rest-before.json.gz',import.meta.url))).toString()),result=autoSuggestPlan(captured.answers,captured.pattern,captured.beds,captured.existingPlantings,captured.month),snapshot=JSON.stringify(result);
  for(const language of CROP_EXPORT_DRAFT_LANGUAGES){const {AcceptedPlanNotesCard}=presenters(page,language),markup=renderToStaticMarkup(React.createElement(AcceptedPlanNotesCard,{notes:result.notes,generatedAt:new Date(2026,9,21,12).getTime()}));for(const note of result.notes){const native=cropPlanNoteText(note.text,language,note);assert.notEqual(native,cropExportText('Original saved plan note: {note}',language,{note:note.text}),'this actual flow still contains an untranslated source');assert.ok(markup.includes(renderToStaticMarkup(React.createElement('span',null,native)).slice(6,-7)));assert.ok(markup.includes(renderToStaticMarkup(React.createElement('p',{lang:'en',style:{marginTop:4}},note.text))));}}
  assert.equal(JSON.stringify(result),snapshot);
});
