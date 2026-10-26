import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import * as React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import type {AnimalEnterprise} from '../../lib/animal-enterprises.ts';
import type {ProductionGuideItem} from '../../lib/crop-export-schedule.ts';
import {productGuideText} from '../../lib/production-product-guidance.ts';
import {formatRange} from '../../lib/perennial-harvest.ts';
const read=(file:string)=>readFileSync(new URL('../../'+file,import.meta.url),'utf8');
export const legalPacket=JSON.parse(read('docs/translation/four-language-completion/animal-legal-drafts.json')) as {
 rows:Array<Record<string,string>>;historicalDraftRows:Array<Record<string,string>>;correctedReferenceRows:Array<Record<string,string>>;sourceChanges:Array<{before:string;after:string}>;
 rendererChange?:{file:string;before:string;after:string};sourceCorrections:Array<{enterpriseId:string;field:'legal'|'outputPerAnimal';index?:number;before:any;after:any}>;
};
export const legalBefore=JSON.parse(gunzipSync(readFileSync(new URL('../fixtures/animal-legal-translation/before.json.gz',import.meta.url))).toString()) as {enterprises:Record<string,AnimalEnterprise>;sources:Array<{file:string;source:string}>;registry:Array<Record<string,string>>};
const toPoint=(point:any)=>({point:point.point,source:point.evidence});
export const correctedAnimalLegalEnterprises:Record<string,AnimalEnterprise>=structuredClone(legalBefore.enterprises);
for(const edit of legalPacket.sourceCorrections){const e=correctedAnimalLegalEnterprises[edit.enterpriseId];if(edit.field==='legal'){assert.deepEqual(e.legal[edit.index!],toPoint(edit.before));e.legal[edit.index!]=toPoint(edit.after);}else{assert.equal(e.outputPerAnimal!.note,edit.before);e.outputPerAnimal!.note=edit.after;}}

/** Reverse only the independently checked source corrections. All other source
 * fields remain in the original full-object comparison, including every quantity. */
export function historicalAnimalEnterprise<T extends AnimalEnterprise>(value:T):T {
 const e=structuredClone(value);for(const edit of [...legalPacket.sourceCorrections].reverse().filter(edit=>edit.enterpriseId===e.enterpriseId)){
  if(edit.field==='legal'){if(JSON.stringify(e.legal[edit.index!])===JSON.stringify(toPoint(edit.after)))e.legal[edit.index!]=toPoint(edit.before);}
  else if(e.outputPerAnimal && e.outputPerAnimal.note===edit.after)e.outputPerAnimal.note=edit.before;
 }return e;
}
export function restoreAnimalLegalEnterprises(value:Readonly<Record<string,AnimalEnterprise>>):Record<string,AnimalEnterprise>{
 assert.deepEqual(value,correctedAnimalLegalEnterprises,'only the exact source-reviewed legal records and permission clause may change; all farming data remains captured');return Object.fromEntries(Object.entries(value).map(([id,e])=>[id,historicalAnimalEnterprise(e)]));
}
export function restoreAnimalLegalPresentation(source:string):string {for(const edit of [...legalPacket.sourceChanges].reverse()){assert.equal(source.split(edit.after).length-1,1,'a declared legal presentation change must remain exact');source=source.replace(edit.after,edit.before);}return source;}
export function restoreAnimalLegalFile(file:string,source:string):string {
 if(file===legalPacket.rendererChange?.file){const edit=legalPacket.rendererChange;assert.equal(source.split(edit.after).length-1,1);const original=legalBefore.sources.find(row=>row.file===file)!.source,restored=source.replace(edit.after,edit.before);assert.equal(restored,original,'only the measured native paragraph preflight change may alter the renderer');return restored;}
 if(file!=='lib/animal-enterprises-data.ts')return source;
 const original=legalBefore.sources.find(row=>row.file===file)!.source,oldData=JSON.stringify(legalBefore.enterprises,null,2);assert.equal(original.split(oldData).length-1,1);const expected=original.replace(oldData,JSON.stringify(correctedAnimalLegalEnterprises,null,2));assert.equal(source,expected,'regenerated data must differ solely by the eight exact source corrections');return original;
}
export function stripDeclaredAnimalLegalOriginals(html:string):string {
 const escaped=(text:string)=>renderToStaticMarkup(React.createElement('span',null,text)).slice(6,-7);
 return html.replace(/<details data-original-animal-legal="true"[^>]*>[\s\S]*?<\/details>/g,block=>{assert.ok(legalPacket.rows.some(row=>block.includes(escaped(row.english))),'an unknown or changed original law note cannot be ignored');return '';});
}

/** Immutable earlier guides can change only their complete typed legal lines,
 * the corrected fish permission clause, and the citations those corrections use.
 * No current guide output is read to manufacture an expected result. */
export function applyExpectedAnimalLegalGuide(items:ProductionGuideItem[],enterprise:AnimalEnterprise,language:string):void {
 const original=legalBefore.enterprises[enterprise.enterpriseId],current=correctedAnimalLegalEnterprises[enterprise.enterpriseId];assert.ok(original&&current);assert.equal(items.length,1,'this adapter is for one captured selected enterprise');const item=items[0];
 for(const[index,point]of original.legal.entries()){
  const old=[point.point,productGuideText(point.point,language)],replacement=productGuideText(current.legal[index].point,language);let count=0;
  item.lines=item.lines.map(line=>{if(!old.includes(line))return line;count++;return replacement;});assert.equal(count,1,'exactly one complete original legal field receives its bound draft or source correction');
 }
 if(original.enterpriseId!=='fish-tilapia')return;
 const frame='Production reference: {range} {unit}. {note}',r=original.outputPerAnimal!;
 const old=[original.outputUnit,productGuideText(original.outputUnit,language)].flatMap(unit=>[r.note!,productGuideText(r.note!,language)].map(note=>productGuideText(frame,language,{range:formatRange(r.value),unit,note})));let count=0;
 item.lines=item.lines.map(line=>{if(!old.includes(line))return line;count++;const unit=line===productGuideText(frame,language,{range:formatRange(r.value),unit:original.outputUnit,note:r.note!})?original.outputUnit:productGuideText(original.outputUnit,language);return productGuideText(frame,language,{range:formatRange(r.value),unit,note:productGuideText(current.outputPerAnimal!.note!,language)});});assert.equal(count,1,'only the full fish reference frame loses its unsupported blanket permission claim');
 // The first three legal citations now share one Gazette entry. The remaining
 // research references keep their exact source order and page-specific identity.
 const fields=[...current.welfare.map(p=>p.source),...current.legal.map(p=>p.source),...(current.productionReferences??[]).map(p=>p.source),...[current.feedKgPerDay,current.waterLPerDay,current.spaceM2,current.outputPerAnimal,current.productiveLifeYears,current.weeksToFirstProduct].flatMap(value=>value?[value.source]:[])];
 const unique=fields.filter((source,index)=>fields.findIndex(other=>source.url===other.url&&source.doc===other.doc&&source.page===other.page)===index);
 item.sources=unique.map(source=>({label:source.doc+(source.page?', p. '+source.page:''),url:source.url}));
}

export function expectedGuideWithAnimalLegal<T extends {animalProducts?:ProductionGuideItem[]}>(guide:T,context:{animals:readonly {housing:string}[];animalChoices?:Partial<Record<string,string>>}|undefined,language='en'):T {
 const expected=structuredClone(guide);if(!context||!expected.animalProducts)return expected;
 for(const[index,group]of context.animals.entries()){const id=context.animalChoices?.[group.housing];if(id&&legalBefore.enterprises[id])applyExpectedAnimalLegalGuide([expected.animalProducts[index]],legalBefore.enterprises[id],language);}return expected;
}
export function expectedMarkdownWithAnimalLegal(markdown:string,original:{foodForest:ProductionGuideItem[];animalProducts:ProductionGuideItem[]},updated:typeof original):string {
 for(const[group,index]of(['foodForest','animalProducts']as const).flatMap(group=>original[group].map((_item,index)=>[group,index]as const))){const block=(item:ProductionGuideItem)=>['### '+item.title,...item.lines,...(item.sources??[]).map(source=>`Source: [${source.label}](${source.url})`)].join('\n\n'),old=block(original[group][index]),replacement=block(updated[group][index]);if(old===replacement)continue;assert.equal(markdown.split(old).length-1,1,'only the complete captured purchasing section may change with its source correction');markdown=markdown.replace(old,replacement);}return markdown;
}
export function currentAnimalReferenceRow<T extends Record<string,string>>(row:T):T {
 const edit=legalPacket.sourceCorrections.find(edit=>edit.field==='outputPerAnimal'&&edit.before===row.english);if(!edit)return row;const current=legalPacket.correctedReferenceRows.find(current=>current.english===edit.after);assert.ok(current);return current as T;
}
