import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import type {AnimalEnterprise,AnimalRangeField} from '../../lib/animal-enterprises.ts';
import {productGuideText} from '../../lib/production-product-guidance.ts';
import {formatRange} from '../../lib/perennial-harvest.ts';
import type {ProductionGuideItem} from '../../lib/crop-export-schedule.ts';
const packet=JSON.parse(readFileSync(new URL('../../docs/translation/four-language-completion/animal-reference-drafts.json',import.meta.url),'utf8'))as{rows:Array<Record<string,string>>;sourceBindings:Array<{english:string;bindings:Array<{enterpriseId:string;field:string;index?:number;source:unknown;sourceValue?:[number,number]}>}>;sourceChanges:Array<{before:string;after:string}>};
const escaped=(s:string)=>renderToStaticMarkup(React.createElement('span',null,s)).slice(6,-7);

/** Parent snapshots still compare the complete card. Only this new, independently
 * checked original-English disclosure is removed from their figure count. */
export function stripDeclaredAnimalReferenceOriginals(html:string):string {
 return html.replace(/<details data-original-animal-reference="true"[^>]*>[\s\S]*?<\/details>/g,block=>{
  assert.ok(packet.rows.some(row=>block.includes(escaped(row.english))),'an undeclared or changed original reference cannot be ignored');return '';
 });
}

export function restoreAnimalReferencePresentation(source:string):string {
 for(const edit of [...packet.sourceChanges].reverse()){assert.ok(source.includes(edit.after),'the declared reference presentation edit must remain exact');source=source.replace(edit.after,edit.before);}return source;
}

/** These expectations expand only complete original typed notes inside their
 * original frames. The rest of each guide, including all sources and missing
 * yields, remains subject to the parent's whole-object comparison. */
export function translateExpectedAnimalReferenceNotes(items:ProductionGuideItem[],e:AnimalEnterprise,language:string,outputUnit=productGuideText(e.outputUnit,language)):number {
 let total=0;
 for(const[index,row]of packet.sourceBindings.entries())for(const binding of row.bindings.filter(binding=>binding.enterpriseId===e.enterpriseId)){
  let frame:string|undefined,values:Record<string,string>={};
  if(binding.field==='productionReferences'){
   const point=e.productionReferences?.[binding.index!];assert.ok(point);assert.equal(point.point,row.english);assert.deepEqual(point.source,binding.source);frame='Age/system reference: {point}';values={point:row.english};
  }else{
   const source=e[binding.field as AnimalRangeField];assert.ok(source);assert.equal(source.note,row.english);assert.deepEqual(source.source,binding.source);assert.deepEqual(source.value,binding.sourceValue);
   if(binding.field==='outputPerAnimal'){frame='Production reference: {range} {unit}. {note}';values={range:formatRange(source.value),unit:outputUnit,note:row.english};}
   if(binding.field==='productiveLifeYears'){frame='Productive-life reference: {range} years. {note}';values={range:formatRange(source.value),note:row.english};}
   // Layers deliberately use the existing hatch/point-of-lay clarification in the
   // guide; translating a dossier note cannot replace that separate source gate.
   if(binding.field==='weeksToFirstProduct'&&e.enterpriseId!=='chicken-layer'){frame='First product reference: {range} weeks. {note}';values={range:formatRange(source.value),note:row.english};}
  }
  if(!frame)continue;
  const old=productGuideText(frame,language,values),key=binding.field==='productionReferences'?'point':'note',translated=productGuideText(frame,language,{...values,[key]:packet.rows[index][language]});let replaced=0;
  for(const item of items)item.lines=item.lines.map(line=>{if(line!==old)return line;replaced++;return translated;});assert.equal(replaced,1,'one complete captured source field changes inside its own original frame');total+=replaced;
 }
 return total;
}
