import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {productGuideText,type ProductGuideContext} from '../../lib/production-product-guidance.ts';
import type {ProductionGuideItem} from '../../lib/crop-export-schedule.ts';
type Row={english:string;zu:string;st:string;ts:string;ve:string};
type Binding={english:string;fields:Array<{speciesId:string;referenceIndex:number;field:'title'|'note'}>};
const packet=JSON.parse(readFileSync(new URL('../../docs/translation/four-language-completion/source-reference-drafts.json',import.meta.url),'utf8'))as{rows:Row[];fieldBindings:Binding[]};
const rows=new Map(packet.rows.map(row=>[row.english,row]));
/** Keep ancestor whole-guide assertions. Only the complete title/note at its
 * captured species and reference index can change; every other line remains compared. */
export function applyExpectedSourceReferences(items:ProductionGuideItem[],context:ProductGuideContext,language:string):void {
 if(language!=='zu'&&language!=='st'&&language!=='ts'&&language!=='ve')return;
 assert.equal(items.length,context.trees.length);
 for(const[index,group]of context.trees.entries())for(const[referenceIndex,reference]of(group.harvest.supplementaryReferences??[]).entries()){
  const allowed=(field:'title'|'note')=>packet.fieldBindings.some(binding=>binding.english===reference[field]&&binding.fields.some(bound=>bound.speciesId===group.harvest.speciesId&&bound.referenceIndex===referenceIndex&&bound.field===field));
  const title=allowed('title'),note=allowed('note');if(!title&&!note)continue;
  const oldTitle:string=title?reference.title:productGuideText(reference.title,language);
  const oldNote:string=note?reference.note:productGuideText(reference.note,language);
  const old:string=oldTitle+': '+oldNote;
  const next:string=(title?rows.get(reference.title)![language]:oldTitle)+': '+(note?rows.get(reference.note)![language]:oldNote);
  const oldCount:number=items[index].lines.filter(line=>line===old).length;
  const nextCount:number=items[index].lines.filter(line=>line===next).length;
  assert.equal(oldCount+nextCount,1,'the whole source paragraph must retain its species,position and final conditions');
  items[index].lines=items[index].lines.map(line=>line===old?next:line);
 }
}
