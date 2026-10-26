import ts from 'typescript';
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import * as React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {CROP_EXPORT_COPY} from '../lib/crop-export-copy-data.ts';
import {cropExportText,CROP_EXPORT_DRAFT_LANGUAGES} from '../lib/crop-export-copy.ts';
import {recordsMonthShort} from '../lib/records-months.ts';
import {firstCropAgeLabel} from '../lib/perennial-harvest.ts';
import {productGuideText} from '../lib/production-product-guidance.ts';
import {treeGuideControlPresenters,TREE_GUIDE_CONTROL_FILES} from './helpers/tree-guide-control-presenter.ts';
import {restoreTreeGuideControlSource} from './helpers/tree-guide-control-expectation.ts';
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8'),hash=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex'),packed=readFileSync(new URL('./fixtures/tree-guide-control-translation/before.json.gz',import.meta.url)),raw=gunzipSync(packed),before=JSON.parse(raw.toString()),packet=JSON.parse(read('docs/translation/four-language-completion/tree-guide-control-drafts.json')),sources=Object.fromEntries(TREE_GUIDE_CONTROL_FILES.map(file=>[file,read(file)]));
class FixedDate extends Date{constructor(value?:string|number){super(value??before.fixedNow)}}
const presenter=(lang:string)=>treeGuideControlPresenters(sources,lang,FixedDate);
const noop=()=>{};
function render(Component:React.ComponentType<any>,props:any){return renderToStaticMarkup(React.createElement(Component,{...props,onChange:noop,onChoose:noop,onSurvey:noop}));}
function elements(value:React.ReactNode):React.ReactElement<any>[] {
 const found:React.ReactElement<any>[]=[];
 React.Children.forEach(value,child=>{if(!React.isValidElement(child))return;found.push(child);found.push(...elements((child.props as any).children));});return found;
}
function ageElements(lang:string,props:any,onChange:(v:any)=>void){const Component=presenter(lang).Age as (p:any)=>React.ReactNode;return elements(Component({...props,onChange}));}
const text=(value:React.ReactNode):string=>React.Children.toArray(value).map(c=>React.isValidElement(c)?text((c.props as any).children):String(c)).join('');

test('tree controls retain all original model bytes and registry rows; only declared complete UI substitutions can pass the source guard',()=>{
 const manifest=JSON.parse(read('tests/fixtures/tree-guide-control-translation/capture-manifest.json'));assert.equal(hash(packed),manifest.compressedSha256);assert.equal(hash(raw),manifest.uncompressedSha256);
 for(const s of before.sources){assert.equal(hash(s.source),s.sha256);if(s.file!=='lib/crop-export-copy-data.ts')assert.equal(restoreTreeGuideControlSource(s.file,read(s.file)),s.source,'the entire source outside the enumerated presentation must remain identical');}
 assert.deepEqual(CROP_EXPORT_COPY.slice(0,before.registry.length),before.registry);assert.deepEqual(CROP_EXPORT_COPY.slice(before.registry.length,before.registry.length+packet.rows.length),packet.rows);assert.equal(new Set(CROP_EXPORT_COPY.map(row=>row.english)).size,CROP_EXPORT_COPY.length);
 assert.deepEqual(JSON.parse(read('docs/translation/four-language-completion/crop-export-drafts.json')).rows,CROP_EXPORT_COPY);assert.match(packet.status,/IN PROGRESS.*Unreviewed/);
 for(const row of packet.rows)for(const lang of CROP_EXPORT_DRAFT_LANGUAGES){assert.equal(cropExportText(row.english,lang),row[lang]);assert.notEqual(row[lang],row.english);assert.deepEqual((row[lang].match(/\{\w+\}/g)??[]).sort(),(row.english.match(/\{\w+\}/g)??[]).sort());assert.deepEqual(row[lang].match(/\d+(?:[.,]\d+)?/g)??[],row.english.match(/\d+(?:[.,]\d+)?/g)??[]);assert.ok(!/[\u0400-\u04ff\ufffd\u00ad]/.test(row[lang]));}
 const file=TREE_GUIDE_CONTROL_FILES[0],original=before.sources.find((s:any)=>s.file===file).source;
 assert.throws(()=>assert.equal(restoreTreeGuideControlSource(file,sources[file].replace('plants: 1, planted:', 'plants: 2, planted:')),original),'a model/default change cannot hide behind translated controls');
 assert.throws(()=>restoreTreeGuideControlSource(file,sources[file].replace("t('Age group {number}'", "t('Age group {count}'")),'a missing or changed declared phrase must fail');
});

test('all captured English and unknown-language controls retain their complete markup and supplied content',()=>{
 let states=0;for(const lang of['en','xx']){const p=presenter(lang);for(const[kind,key]of[['Age','ages'],['Seasons','seasons'],['Guide','guides']]as const)for(const row of before[key]){const props=kind==='Guide'?row.props[lang]:row.props,snapshot=JSON.stringify(props);assert.equal(render(p[kind],props),row.markup[lang],lang+'/'+kind+'/'+row.id);assert.equal(JSON.stringify(props),snapshot);states++;}}
 assert.equal(states,84,'all captured states, including both survey availability states, must participate');
});

test('native age controls expose complete translated warnings, source ages, numbered accessible labels and exactly the same recorded month/year values',()=>{
 for(const lang of CROP_EXPORT_DRAFT_LANGUAGES)for(const row of before.ages){const p=structuredClone(row.props),snapshot=JSON.stringify(p),calls:any[]=[],nodes=ageElements(lang,p,value=>calls.push(value)),html=render(presenter(lang).Age,p),t=(s:string,v?:Record<string,string|number>)=>cropExportText(s,lang,v);
  for(const s of ['Plant ages & future harvest','Put plants planted together in one group. Keep older and younger plants separate. Dates and expected kg stay on this device with your picking months.','+ Add age group','Tree and harvest translations are unreviewed drafts. Some source references remain in English.'])assert.ok(html.includes(renderToStaticMarkup(React.createElement('span',null,t(s))).slice(6,-7)),lang+'/'+s);
  const h=p.group.harvest;if(h.yearsToFirstCrop)assert.ok(text(nodes[0]).includes(t('First-crop reference: {age} after planting.',{age:firstCropAgeLabel(h.yearsToFirstCrop.value,(age,unit)=>productGuideText(`{age} ${unit}`,lang,{age}))})));
  const selects=nodes.filter(n=>n.type==='select');assert.equal(selects.length,(p.choice.production??[]).length*3);
  for(let i=0;i<(p.choice.production??[]).length;i++){const g=p.choice.production[i],[status,month,year]=selects.slice(i*3,i*3+3);assert.equal(status.props.value,g.status);assert.equal(month.props.value,g.planted.split('-')[1]??'');assert.equal(year.props.value,g.planted.split('-')[0]);assert.equal(status.props['aria-label'],t('{plant} group {number} status',{plant:h.name,number:i+1}));const options=elements(month.props.children).filter(n=>n.type==='option');assert.deepEqual(options.slice(1).map(n=>[n.props.value,text(n.props.children)]),Array.from({length:12},(_,m)=>[String(m+1).padStart(2,'0'),recordsMonthShort(lang,m+1)]));assert.equal(options[0].props.value,'');}
  const alert=nodes.find(n=>n.props.role==='alert');assert.equal(Boolean(alert),row.id.endsWith('overassigned'));assert.equal(calls.length,0,'rendering or switching language must not write records');assert.equal(JSON.stringify(p),snapshot);
 }
});

test('native plant age edits preserve decimal yields, empty NaNs, dates, enum values, removals and add-group defaults',()=>{
 const fixture=before.ages.find((row:any)=>row.id.endsWith('-recorded'));
 for(const lang of['en',...CROP_EXPORT_DRAFT_LANGUAGES]){const props=structuredClone(fixture.props),snapshot=JSON.stringify(props),calls:any[]=[],nodes=ageElements(lang,props,v=>calls.push(v)),selects=nodes.filter(n=>n.type==='select'),inputs=nodes.filter(n=>n.type==='input'),buttons=nodes.filter(n=>n.type==='button');
  selects[0].props.onChange({target:{value:'proposed'}});assert.deepEqual(calls.pop(),{...props.choice,production:props.choice.production.map((g:any,i:number)=>i?g:{...g,status:'proposed'})});
  selects[1].props.onChange({target:{value:'02'}});assert.equal(calls.pop().production[0].planted,'2020-02');selects[2].props.onChange({target:{value:'2024'}});assert.equal(calls.pop().production[0].planted,'2024-12');
  inputs[0].props.onChange({target:{value:'2.75'}});assert.equal(calls.pop().production[0].plants,2.75);inputs[0].props.onChange({target:{value:''}});assert.ok(Number.isNaN(calls.pop().production[0].plants));
  inputs[1].props.onChange({target:{value:'1.25'}});assert.equal(calls.pop().production[0].yields[0].age,1.25);inputs[2].props.onChange({target:{value:'0.125'}});assert.equal(calls.pop().production[0].yields[0].kg,0.125);
  const t=(s:string)=>cropExportText(s,lang);buttons.find(n=>text(n.props.children)===t('+ Add age & yield'))!.props.onClick();const added=calls.pop();assert.ok(Number.isNaN(added.production[0].yields.at(-1).age));assert.ok(Number.isNaN(added.production[0].yields.at(-1).kg));
  buttons.find(n=>n.props['aria-label'])!.props.onClick();assert.deepEqual(calls.pop().production[0].yields,[props.choice.production[0].yields[1]]);
  buttons.find(n=>text(n.props.children)===t('Remove age group'))!.props.onClick();assert.deepEqual(calls.pop().production,[props.choice.production[1]]);
  buttons.find(n=>text(n.props.children)===t('+ Add age group'))!.props.onClick();const next=calls.pop();assert.deepEqual(next.production.at(-1),{status:props.group.existing>1?'existing':'proposed',plants:1,planted:'',yields:[]});assert.deepEqual(next.months,props.choice.months);assert.equal(next.bearing,props.choice.bearing);assert.equal(JSON.stringify(props),snapshot);assert.equal(calls.length,0);
 }
});

test('native picking buttons and food holds retain the same numeric choices and survey availability; private braces and dollar text stay opaque',()=>{
 const privateValue='PRIVATE {number} {month2} $& <kept> 03.50';for(const lang of CROP_EXPORT_DRAFT_LANGUAGES){const p=presenter(lang),row=before.seasons.find((r:any)=>r.id==='all103-confirmed'),props=structuredClone(row.props),calls:any[]=[],component=p.Seasons as(p:any)=>React.ReactNode,nodes=elements(component({...props,onChoose:(...v:any[])=>calls.push(v)})),buttons=nodes.filter(n=>n.type==='button'),checkboxes=nodes.filter(n=>n.type==='input');
  assert.ok(buttons.length>0);for(let i=0;i<12;i++)assert.equal(text(buttons[i].props.children),recordsMonthShort(lang,i+1));const first=props.groups.find((g:any)=>nodes.some(n=>n.type==='div'&&n.props['aria-label']===cropExportText('{plant} local picking months',lang,{plant:g.harvest.name})));assert.ok(first);const value=props.choices[first.harvest.speciesId];assert.equal(buttons[0].props['aria-pressed'],true);buttons[0].props.onClick();assert.deepEqual(calls.pop(),[first.harvest.speciesId,{...value,months:[12]}]);buttons[1].props.onClick();assert.deepEqual(calls.pop(),[first.harvest.speciesId,{...value,months:[1,2,12]}]);checkboxes[0].props.onChange({target:{checked:false}});assert.deepEqual(calls.pop(),[first.harvest.speciesId,{...value,bearing:false}]);
  const held=props.groups.find((g:any)=>g.harvest.speciesId==='lycium-cinereum');assert.ok(held);const heldHtml=render(p.Seasons,{groups:[held],choices:props.choices,unidentified:[]});assert.ok(heldHtml.includes(cropExportText('food use needs review',lang)));assert.ok(!heldHtml.includes('type="checkbox"'));assert.ok(!heldHtml.includes('aria-pressed='));
  const proposed=before.seasons.find((r:any)=>r.id==='proposed-only').props;assert.ok(render(p.Seasons,proposed).includes('disabled=""'));
  const privateHtml=render(p.Seasons,{groups:[],unidentified:[{defId:'private-id',label:privateValue,existing:0,proposed:1,legalCheck:privateValue}],choices:{}}),escaped=renderToStaticMarkup(React.createElement('span',null,privateValue)).slice(6,-7);assert.equal(privateHtml.split(escaped).length-1,2,'private content is inserted once in each original field');
  for(const enabled of[false,true]){const g=structuredClone(before.guides.find((r:any)=>r.id==='empty-'+enabled).props[lang]);g.guide.area=privateValue;const guide=p.Guide as(p:any)=>React.ReactNode,controls=elements(guide({...g,onSurvey:()=>calls.push('survey')})),button=controls.find(n=>n.type==='button')!;assert.equal(button.props.disabled,!enabled);assert.equal(text(button.props.children),cropExportText('Update site survey',lang));button.props.onClick();assert.equal(calls.pop(),'survey');assert.ok(render(p.Guide,g).includes(escaped));}assert.equal(calls.length,0);
 }
});

test('native production-guide calendars retain every month cell, supplied source paragraph, citation and crop count',()=>{
 const escape=(value:string)=>renderToStaticMarkup(React.createElement('span',null,value)).slice(6,-7);
 for(const lang of CROP_EXPORT_DRAFT_LANGUAGES)for(const row of before.guides){const props=structuredClone(row.props[lang]),snapshot=JSON.stringify(props),html=render(presenter(lang).Guide,props),g=props.guide;assert.ok(html.includes(escape(cropExportText('Check your farm conditions',lang))));assert.ok(html.includes(escape(cropExportText('Tree and harvest translations are unreviewed drafts. Some source references remain in English.',lang))));
  for(const item of[...(g.foodForest??[]),...(g.animalProducts??[]),...g.siteObservations,...g.cropChoices,...g.recordedProduction]){assert.ok(html.includes(escape(item.title)));for(const line of item.lines)assert.ok(html.includes(escape(line)),'provided complete source paragraphs are not reinterpreted by the UI');for(const source of item.sources??[]){assert.ok(html.includes(escape(source.label)));if(source.url)assert.ok(html.includes('href="'+escape(source.url)+'"'));}if(item.expectedSeason){assert.ok(html.includes(escape(cropExportText('{label} · expected when established',lang,{label:item.expectedSeason.label}))));for(let m=1;m<=12;m++)assert.ok(html.includes('>'+escape(recordsMonthShort(lang,m))+'</div>'),'all twelve original month identities stay present');assert.ok(html.includes('grid-cols-6 sm:grid-cols-12'),'draft labels can wrap into two phone rows');}}
  if(g.cropChoices.length)assert.ok(html.includes(escape(cropExportText('Crop varieties to check locally ({count} {unit})',lang,{count:g.cropChoices.length,unit:cropExportText(g.cropChoices.length===1?'crop':'crops',lang)}))));assert.equal(JSON.stringify(props),snapshot);
 }
});

// A rendered English link revealed an unregistered Source key. Check every literal
// passed to the actual presenters, so adding another lookup without drafts fails.
test('every literal UI lookup in the actual tree controls has all four registered drafts',()=>{
 const known=new Map<string,any>(CROP_EXPORT_COPY.map(row=>[row.english,row]));let keys=0;for(const file of TREE_GUIDE_CONTROL_FILES){const ast=ts.createSourceFile(file,sources[file],ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);function visit(n:ts.Node){if(ts.isCallExpression(n)&&n.expression.getText(ast)==='t'){const a=n.arguments[0],literals=ts.isStringLiteral(a)?[a]:ts.isConditionalExpression(a)?[a.whenTrue,a.whenFalse].filter(ts.isStringLiteral):[];for(const literal of literals){const row=known.get(literal.text);assert.ok(row,'unregistered UI source: '+literal.text);for(const lang of CROP_EXPORT_DRAFT_LANGUAGES){assert.ok(row[lang].trim());assert.notEqual(row[lang],literal.text);}keys++;}}ts.forEachChild(n,visit);}visit(ast);}assert.ok(keys>70,'exercise the actual components, including conditional captions and accessibility labels');
});
