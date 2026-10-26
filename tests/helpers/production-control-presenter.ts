import ts from 'typescript';
import * as React from 'react';
import * as Icons from 'lucide-react';
import * as catalog from '../../lib/crop-catalog.ts';
import * as figures from '../../lib/format-figures.ts';
import * as pdfIcons from '../../lib/pdf-icons.ts';
import * as preservedArt from '../../lib/preserved-food-art.ts';
import * as availability from '../../lib/crop-export-availability.ts';
import * as records from '../../lib/production-records.ts';
import * as projection from '../../lib/production-projection.ts';
import * as speciesArt from '../../lib/species-art.ts';
import * as animals from '../../lib/animal-enterprises.ts';
import * as harvest from '../../lib/perennial-harvest.ts';
import * as copy from '../../lib/crop-export-copy.ts';
import * as months from '../../lib/records-months.ts';
export const PRODUCTION_CONTROL_FILES=['components/crops/ProductionRecordsEditor.tsx','components/crops/ProductionAvailabilityGraphs.tsx','components/crops/ProductionProjectionCard.tsx','components/crops/YearOfFoodCard.tsx','components/crops/PoultryGuidanceCard.tsx']as const;
/** Compile actual components; only module imports/context/CSS names are supplied by the fixture. */
export function productionControlPresenters(sources:Record<string,string>,language:string|(()=>string),onCopy?:(source:string,language:string,values:Record<string,string|number>,wording:string)=>void){
 const modules:Record<string,unknown>={react:React,'lucide-react':Icons,'@/lib/crop-catalog':catalog,'@/lib/format-figures':figures,'@/lib/pdf-icons':pdfIcons,'@/lib/preserved-food-art':preservedArt,'@/lib/crop-export-availability':availability,'@/lib/production-records':records,'@/lib/production-projection':projection,'@/lib/species-art':speciesArt,'@/lib/animal-enterprises':animals,'@/lib/perennial-harvest':harvest,'@/lib/crop-export-copy':{...copy,cropExportText:(source:string,lang='en',values:Record<string,string|number>={})=>{const wording=copy.cropExportText(source,lang,values);onCopy?.(source,lang,values,wording);return wording;}},'@/lib/records-months':months,'@/lib/i18n':{useLanguage:()=>({lang:typeof language==='function'?language():language})},'./AnimalEnterprisesCard':{PRODUCT_ICON:{eggs:Icons.Egg,milk:Icons.Milk,honey:Icons.Hexagon,meat:Icons.Drumstick,fish:Icons.Fish,wool:Icons.Scissors}}};
 return Object.fromEntries(PRODUCTION_CONTROL_FILES.map(file=>{
  const source=sources[file];if(!source)throw Error('Missing actual component '+file);const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),scope:Record<string,unknown>={React,exports:{}};
  for(const node of ast.statements)if(ts.isImportDeclaration(node)&&node.importClause&&!node.importClause.isTypeOnly){const name=(node.moduleSpecifier as ts.StringLiteral).text,css=name.endsWith('.module.css'),module=css?{}:modules[name]as Record<string,unknown>;if(!module)throw Error('Unbound actual import '+name);const clause=node.importClause;if(clause.name)scope[clause.name.text]=css?new Proxy({},{get:(_target,key)=>file.includes('Records')?'record-'+String(key):'graph-'+String(key)}):module.default;if(clause.namedBindings&&ts.isNamedImports(clause.namedBindings))for(const item of clause.namedBindings.elements)if(!item.isTypeOnly)scope[item.name.text]=module[item.propertyName?.text??item.name.text];}
  const body=ast.statements.filter(node=>!ts.isImportDeclaration(node)).map(node=>node.getFullText(ast)).join('\n'),code=ts.transpileModule(body,{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  return[file,new Function(...Object.keys(scope),code+';return exports.default;')(...Object.values(scope))as React.ComponentType<any>];
 }))as Record<typeof PRODUCTION_CONTROL_FILES[number],React.ComponentType<any>>;
}
