import ts from 'typescript';
import * as React from 'react';
import * as Icons from 'lucide-react';
import * as harvest from '../../lib/perennial-harvest.ts';
import {MONTHS_SHORT} from '../../lib/crop-catalog.ts';
import {speciesFruitArtworkUrl} from '../../lib/species-art.ts';
import {cropExportText,isCropExportDraftLanguage} from '../../lib/crop-export-copy.ts';
import {productGuideText} from '../../lib/production-product-guidance.ts';
import {recordsMonthShort,recordsMonthLong} from '../../lib/records-months.ts';
export const TREE_GUIDE_CONTROL_FILES=['components/crops/TreeAgeEditor.tsx','components/crops/TreeSeasonsCard.tsx','components/crops/ProductionGuideCard.tsx']as const;
export function treeGuideControlPresenters(sources:Record<string,string>,language:string,date:new()=>Date=Date){
 function load(file:string,extra:Record<string,unknown>={}){const source=sources[file];if(!source)throw Error('Missing actual component '+file);const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),body=ast.statements.filter(node=>!ts.isImportDeclaration(node)).map(node=>node.getFullText(ast)).join('\n'),code=ts.transpileModule(body,{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,scope={React,Trees:Icons.Trees,ClipboardList:Icons.ClipboardList,...harvest,MONTHS_SHORT,speciesFruitArtworkUrl,cropExportText,isCropExportDraftLanguage,productGuideText,recordsMonthShort,recordsMonthLong,useLanguage:()=>({lang:language}),Date:date,exports:{},...extra};return new Function(...Object.keys(scope),code+';return exports.default;')(...Object.values(scope))as React.ComponentType<any>;}
 const Age=load(TREE_GUIDE_CONTROL_FILES[0]),Seasons=load(TREE_GUIDE_CONTROL_FILES[1],{TreeAgeEditor:Age}),Guide=load(TREE_GUIDE_CONTROL_FILES[2]);return{Age,Seasons,Guide};
}
