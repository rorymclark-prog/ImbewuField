import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { translationGaps } from '../lib/lang-coverage.ts';
import { formatDesignTranslation, sectorCompassWord } from '../lib/design-studio-i18n.ts';
import { actualPaletteTools, actualDrawControls, actualDrawingHint, actualSectorSummary, hostElements, hostButtons, nodeText, controlLocales, controlT, type ControlLanguage, type DrawMode } from './control-icon-renderers.ts';
import { beforeControlIconDictionary, beforeControlIconTranslations } from './ui-dictionary-preservation.ts';
const read=(p:string)=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const packet=JSON.parse(read('docs/translation/four-language-completion/control-icon-drafts.json'));
const languages=['zu','st','ts','ve']as const;
const all=['en',...languages]as const;
const html=(element:React.ReactNode)=>renderToStaticMarkup(React.createElement(React.Fragment,null,element));
const figures=(s:string)=>(s.match(/\d+(?:[.,]\d+)?/g)??[]).sort();
const glyph=/[\p{Extended_Pictographic}\uFE0F\u200D\u2713\u2715\u2605]/u;
const stripped=(s:string)=>s.replace(/[☀💨💧🔥✕✓🗑★↖↩↪📋🧹🧲📐\uFE0F\u200D]/gu,'').replace(/ {2,}/g,' ').trim();

test('fixed controls bind all four drafts to the source while removing only pictographs from English and retaining one set of placeholders',()=>{
 assert.match(packet.status,/Unreviewed AI drafts/);assert.equal(new Set(packet.entries.map((r:any)=>r.key)).size,packet.entries.length);
 for(const r of packet.entries){const before=packet.beforeValues.en[r.key];assert.equal(controlLocales.en[r.key],r.english);assert.equal(r.english,stripped(before)===before.trim()?before:stripped(before),'English meaning cannot change when an icon moves into markup');for(const lang of languages){assert.equal(controlLocales[lang][r.key],r[lang]);assert.deepEqual(translationGaps({[r.key]:r.english},controlLocales[lang]),[]);assert.deepEqual(figures(r[lang]),figures(r.english));assert.ok(!glyph.test(r[lang]),`${lang}/${r.key}: a translated label may not choose the picture`);}}
 for(const lang of all){const name='Saved {zone}';assert.equal(formatDesignTranslation(controlT(lang)('designCanvasFinish'),{thing:name}),controlT(lang)('designCanvasFinish').replace('{thing}',name));for(const[degree,key]of[[0,'North'],[45,'NorthEast'],[90,'East'],[135,'SouthEast'],[180,'South'],[225,'SouthWest'],[270,'West'],[315,'NorthWest']]as const)assert.equal(sectorCompassWord(degree,controlT(lang)),controlT(lang)('designSectorDirection'+key));}
});

test('historical learning guards reverse only the complete exact declared UI change, never an altered control or learning field',async()=>{
 for(const lang of languages){const dictionary=controlLocales[lang],before=beforeControlIconDictionary(dictionary,lang)as Record<string,string>;
  for(const row of packet.entries)assert.equal(before[row.key],packet.beforeValues[lang][row.key]);
  const broken={...dictionary,designCanvasFinish:dictionary.designCanvasFinish+' changed'};assert.equal(beforeControlIconDictionary(broken,lang),broken,'an altered layer cannot be disguised as its predecessor');
  const lesson={...dictionary,studentContinue:dictionary.studentContinue+' changed'};assert.equal((beforeControlIconDictionary(lesson,lang)as any).studentContinue,lesson.studentContinue);
  const source=read('lib/locales/'+lang+'.ts'),rewound=beforeControlIconTranslations(source,lang);assert.ok(!rewound.includes('// Native design controls:'));
  const afterLine='  designCanvasFinish: '+JSON.stringify(dictionary.designCanvasFinish)+',\n';assert.ok(source.includes(afterLine));const altered=source.replace(afterLine,afterLine.replace('Finish','Finish changed').replace('Qeda','Qeda changed').replace('Qetella','Qetella changed').replace('Hetisa','Hetisa changed').replace('Fhedzisani','Fhedzisani changed'));assert.notEqual(altered,source);assert.equal(beforeControlIconTranslations(altered,lang),altered);
  const changedLesson=source.replace('studentKeyPoints:','studentKeyPointsChanged:');assert.notEqual(beforeControlIconTranslations(changedLesson,lang),rewound,'unrelated learning source remains visible to the original hash');
 }
 const{assertStudyRemainingControlsLocale}=await import('./study-remaining-controls-next-history-checks.ts');assertStudyRemainingControlsLocale(controlLocales.ve);
 assert.throws(()=>assertStudyRemainingControlsLocale({...controlLocales.ve,designCanvasFinish:'Broken'}),/unlisted or altered locale value/);
 assert.throws(()=>assertStudyRemainingControlsLocale({...controlLocales.ve,studentContinue:'Broken'}),/unlisted or altered locale value/);
});

test('each actual palette button uses a stable Lucide icon and native accessible name while calling only its original action',()=>{
 const actions={Select:'setTool',Undo:'undo',Redo:'redo',Duplicate:'duplicate',Tidy:'tidy',Snap:'snap',Cleanup:'cleanup',Delete:'delete'};
 for(const lang of all){const view=actualPaletteTools(lang),buttons=hostButtons(view.element);assert.equal(view.calls.length,0,'rendering a translated toolbar must not perform an edit');
  const strip=hostElements(view.element,'div').find(d=>d.props.onFocusCapture);assert.ok(strip);let scrollOptions:unknown;strip.props.onFocusCapture({target:{scrollIntoView:(options:unknown)=>{scrollOptions=options;}}});assert.deepEqual(scrollOptions,{block:'nearest',inline:'nearest'},'keyboard focus must fully reveal its action in the horizontal tool strip');
  for(const[key,action]of Object.entries(actions)){const name=controlT(lang)('designPalette'+key);const button=buttons.find(b=>b.props['aria-label']===name);assert.ok(button,`${lang}/${key}: native accessible action`);assert.equal(nodeText(button.props.children),'','the action picture never comes from translated label text');const markup=html(button);assert.ok(markup.includes('<svg'));assert.ok(markup.includes('aria-hidden="true"'));assert.ok(!glyph.test(button.props['aria-label']));view.calls.length=0;button.props.onClick();assert.equal(view.calls[0].action,action);assert.equal(view.calls.filter(c=>c.action===action).length,1);if(key==='Select'){assert.equal(view.calls[0].value,'select');assert.equal(view.calls[1].action,'setHintDefId');}else assert.equal(view.calls.length,1);}
  const disabled=hostButtons(actualPaletteTools(lang,{onDeleteSelected:undefined,onDuplicateSelected:undefined,onTidySelected:undefined,onSnapSelected:undefined,onCleanupSelected:undefined,canUndo:false,canRedo:false}).element);for(const suffix of['Undo','Redo','Duplicate','Tidy','Snap','Cleanup','Delete'])assert.equal(disabled.find(b=>b.props['aria-label']===controlT(lang)('designPalette'+suffix))?.props.disabled,true);
 }
});

test('actual draft controls preserve transient geometry and confirmation gates in every language',()=>{
 for(const lang of all)for(const mode of['line','zone','tidy','tidy-empty','snap','snap-empty','cleanup','cleanup-empty']as DrawMode[]){
  const points=[[0,0],[1,0],[1,1]],before=JSON.stringify(points),view=actualDrawControls(lang,mode,points),buttons=hostButtons(view.element);assert.equal(view.calls.length,0);assert.equal(JSON.stringify(points),before,'changing a label cannot mutate saved/draft geometry while rendering');
  for(const button of buttons){assert.ok(html(button).includes('aria-hidden="true"'));assert.ok(!glyph.test(nodeText(button)));}
  if(mode==='line'||mode==='zone'){
   const cancel=buttons.find(b=>nodeText(b).trim()===controlT(lang)('designCanvasCancel'));assert.ok(cancel);cancel.props.onClick();assert.deepEqual(view.calls.pop(),{action:'draft',value:[]});
   const undo=buttons.find(b=>nodeText(b).trim()===controlT(lang)('designCanvasPoint'));assert.ok(undo);undo.props.onClick();const updater=view.calls.pop()!.value as (v:unknown[])=>unknown[];assert.deepEqual(updater(points),points.slice(0,-1));
   const finish=buttons.find(b=>nodeText(b).includes(formatDesignTranslation(controlT(lang)('designCanvasFinish'),{thing:mode==='line'?controlT(lang)('designCanvasLine'):formatDesignTranslation(controlT(lang)('designCanvasZone'),{zone:1})})));assert.ok(finish);finish.props.onClick();assert.deepEqual(view.calls.pop(),{action:mode,value:points});
  }else{const kind=mode.split('-')[0],cancel=buttons[0];cancel.props.onClick();assert.equal(view.calls.pop()!.action,'cancel-'+kind);if(mode.endsWith('empty')){assert.equal(buttons.length,1,'a translated unavailable preview must not acquire a destructive confirm');assert.equal(nodeText(cancel).trim(),controlT(lang)('designCanvasClose'));}else{assert.equal(buttons.length,2);buttons[1].props.onClick();assert.equal(view.calls.pop()!.action,'confirm-'+kind);}}
  assert.equal(JSON.stringify(points),before);
 }
});

test('the actual line hint keeps its English source separately from the native primary wording',()=>{
 for(const lang of all){const output=html(actualDrawingHint(lang));assert.ok(output.includes(controlT(lang)('designPaletteTapCorners')));if(lang!=='en'){assert.ok(output.includes('lang="'+lang+'"'));assert.ok(output.includes('lang="en"'));assert.ok(output.includes(controlT('en')('designPaletteTapCorners')));}}
});

test('the actual sector card has native field words, English source backing, language metadata and draft status without changing the site record',()=>{
 const original=JSON.parse(read('tests/fixtures/report-costs-translation/source-cases.json')).location;
 const site={biome:original.biome.name,rainfallMm:original.rainfall.annual,elevation:original.elevation,climate:original.climate},before=JSON.stringify(site);
 for(const lang of all)for(const props of[{lat:original.lat,lon:original.lon,site},{lat:original.lat,lon:original.lon,site:null},{}]){const output=html(actualSectorSummary(lang,props));assert.equal(JSON.stringify(site),before);assert.ok(output.includes(controlT(lang)('designSectorTitle')));assert.ok(output.includes(controlT(lang)('designSectorLooksRight')));if(lang!=='en'){assert.ok(output.includes('lang="'+lang+'"'));assert.ok(output.includes('role="note"'));assert.ok(output.includes(controlT(lang)('languageDraftNoticeText')));if(props.lat!==undefined)assert.ok(output.includes('lang="en"'));}assert.ok(!/[☀💨💧🔥]/u.test(output));}
});
