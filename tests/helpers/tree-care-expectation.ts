import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {productGuideText,type ProductGuideContext} from '../../lib/production-product-guidance.ts';
import type {ProductionGuideItem} from '../../lib/crop-export-schedule.ts';
const read=(file:string)=>readFileSync(new URL('../../'+file,import.meta.url),'utf8');
export const treeCarePacket=JSON.parse(read('docs/translation/four-language-completion/tree-care-drafts.json'))as{rows:Array<Record<string,string>>;fieldBindings:Array<{english:string;fields:Array<{speciesId:string;field:'care'|'purchase';index:number}>}>};
const captured=JSON.parse(gunzipSync(readFileSync(new URL('../fixtures/tree-care-translation/before.json.gz',import.meta.url))).toString())as{profiles:Record<string,{care:string[];purchase:string[]}>;rows:Array<{context:ProductGuideContext}>};
const sourceTrees=captured.rows.find(row=>row.context.trees.length===103)!.context.trees;

/** Ancestor snapshots keep their whole-guide rule. Only complete care/purchase
 * fields bound to this original species, array and index receive the new draft. */
export function applyExpectedTreeCareGuide(items:ProductionGuideItem[],context:ProductGuideContext,language:string):void {
 if(!['zu','st','ts','ve'].includes(language))return;
 assert.equal(items.length,context.trees.length);
 for(const[index,group]of context.trees.entries()){
  const h=group.harvest,original=sourceTrees.find(tree=>tree.harvest.speciesId===h.speciesId);if(!original)continue;
  const profile=captured.profiles[h.speciesId]??original.harvest.productionGuidance;
  for(const binding of treeCarePacket.fieldBindings)for(const field of binding.fields.filter(field=>field.speciesId===h.speciesId)){
   assert.ok(profile,'every declared care/purchase binding must have a captured profile; unbound trees need no new profile');
   assert.equal(profile[field.field][field.index],binding.english,'the new expectation must retain the captured field identity');
   const draft=treeCarePacket.rows.find(row=>row.english===binding.english);assert.ok(draft?.[language]);
   const old=field.field==='care'?binding.english:productGuideText('Buying advice: {advice}',language,{advice:binding.english}),next=field.field==='care'?draft[language]:productGuideText('Buying advice: {advice}',language,{advice:draft[language]});
   const originalCount=items[index].lines.filter(line=>line===old).length,currentCount=items[index].lines.filter(line=>line===next).length;
   assert.equal(originalCount+currentCount,1,'one complete typed source condition occupies its original guide position');
   items[index].lines=items[index].lines.map(line=>line===old?next:line);
  }
 }
}
