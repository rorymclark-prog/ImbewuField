import assert from 'node:assert/strict';
import { CROP_EXPORT_COPY } from '../../lib/crop-export-copy-data.ts';
import { cropExportText } from '../../lib/crop-export-copy.ts';
import { productGuideText, type ProductGuideContext } from '../../lib/production-product-guidance.ts';
import { enterprisesForHousing, HOUSING_LABEL, PRODUCT_LABEL } from '../../lib/animal-enterprises.ts';
import { formatRange, formatMonthSpan } from '../../lib/perennial-harvest.ts';
import type { ProductionGuideItem } from '../../lib/crop-export-schedule.ts';

type Guide = { foodForest: ProductionGuideItem[]; animalProducts: ProductionGuideItem[] };
const rows = (CROP_EXPORT_COPY as readonly {english:string;generatedScope?:string}[]).filter(row=>row.generatedScope==='product-guidance');
const escape=(text:string)=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const patterns=rows.filter(row=>row.english.includes('{')).map(row=>{const keys:string[]=[];const pattern=row.english.split(/(\{\w+\})/g).map(part=>{if(!/^\{\w+\}$/.test(part))return escape(part);keys.push(part.slice(1,-1));return '(.+?)';}).join('');return{source:row.english,keys,regex:new RegExp('^'+pattern+'$')};});

/** This adapter reads immutable English test snapshots, never farmer data in production.
 * It expands only the declared new presentation layer. Unmatched text and every source
 * field remain in the whole-object comparison so a missing row or changed gate still fails. */
export function translateAdditionalProductPresentation(expected:Guide,original:Guide,context:ProductGuideContext,language:string):void {
 const t=(source:string,values?:Record<string,string|number>)=>productGuideText(source,language,values);
 for(const group of ['foodForest','animalProducts']as const){assert.equal(expected[group].length,original[group].length);for(const[index,item]of expected[group].entries()){
  const source=original[group][index];assert.equal(item.lines.length,source.lines.length);
  if(group==='animalProducts'){
   const housing=context.animals[index].housing,label=HOUSING_LABEL[housing];assert.ok(source.title.startsWith(label+': '));
   item.title=source.title===label+': choose the product'?t('{housing}: choose the product',{housing:t(label)}):t(label)+source.title.slice(label.length);
  }
  item.lines=item.lines.map((current,i)=>{
   const sourceLine=source.lines[i];if(current!==sourceLine)return current;
   if(rows.some(row=>row.english===sourceLine))return t(sourceLine);
   if(group==='foodForest'){const reference=context.trees[index].harvest.supplementaryReferences?.find(reference=>sourceLine===`${reference.title}: ${reference.note}`);if(reference)return `${t(reference.title)}: ${t(reference.note)}`;}
   if(group==='foodForest'&&sourceLine.startsWith('Reference only')){
    // Source region names may themselves contain ': '. Bind the whole original row
    // to its typed window rather than treating punctuation as a field boundary.
    const prefix=context.trees[index].harvest.speciesId==='moringa-oleifera'?'Reference only (pods, not leaf-picking dates)':'Reference only';
    const window=context.trees[index].harvest.windows.find(window=>sourceLine===`${prefix} — ${window.region}: ${formatMonthSpan(window.months)}.`);assert.ok(window,'reference rows keep their exact source window');
    return t(prefix+' — {region}: {months}.',{region:t(window.region),months:formatMonthSpan(window.months,language)});
   }
   if(group==='foodForest'&&sourceLine.startsWith('Production reference:')){
    // Tree kg/plant keeps its older canonical yield wording; the new animal-unit
    // template must not become a second authority for that established dimension.
    const reference=context.trees[index].harvest.yieldKgPerTree;if(!reference)return current;
    const template='Production reference: {range} kg/plant. {note}',note=reference.note??'This source result is not a locally confirmed annual forecast.';
    assert.equal(sourceLine,productGuideText(template,'en',{range:formatRange(reference.value),note}));return t(template,{range:formatRange(reference.value),note:t(note)});
   }
   for(const row of patterns){const found=row.regex.exec(sourceLine);if(!found)continue;const values:Record<string,string>=Object.fromEntries(row.keys.map((key,i)=>[key,found[i+1]]));
    for(const key of ['note','pattern','point','type'])if(values[key])values[key]=t(values[key]);
    if(group==='animalProducts'&&row.source==='Production reference: {range} {unit}. {note}')values.unit=t(values.unit);
    if(values.product){const nonFood=values.product.endsWith(' (non-food)'),product=values.product.replace(/ \(non-food\)$/,'');assert.ok(Object.hasOwn(PRODUCT_LABEL,product),'a source product enum must not acquire an unknown identity');const label=t(PRODUCT_LABEL[product as keyof typeof PRODUCT_LABEL]).toLowerCase();values.product=nonFood?t('{product} (non-food)',{product:label}):label;}
    if(values.options){const options=enterprisesForHousing(context.animals[index].housing);values.options=options.map(option=>option.product==='wool'?t('{name} ({product}, non-food)',{name:option.name,product:t(PRODUCT_LABEL[option.product]).toLowerCase()}):`${option.name} (${t(PRODUCT_LABEL[option.product]).toLowerCase()})`).join('; ');}
    if(values.months){assert.equal(group,'foodForest');const window=context.trees[index].harvest.windows.find(window=>window.region===values.region&&formatMonthSpan(window.months)===values.months);assert.ok(window,'reference months must come from the original source window');values.months=formatMonthSpan(window.months,language);values.region=t(window.region);}
    return cropExportText(row.source,language,values);
   }
   return current;
  });
 }}
}
