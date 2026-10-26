import assert from 'node:assert/strict';
import * as React from 'react';
import {ExternalLink,HeartHandshake,Scale} from 'lucide-react';
import ts from 'typescript';
import {ANIMAL_ENTERPRISES,PRODUCT_LABEL,animalReferenceQualifier,isFoodProduct,sourcedProductMonths,formatAmountRange,type AnimalEnterprise} from '../../lib/animal-enterprises.ts';
import {animalArtUrl} from '../../lib/animal-art.ts';
import {formatMonthSpan,formatRange} from '../../lib/perennial-harvest.ts';
import {productGuideText} from '../../lib/production-product-guidance.ts';
import {isCropExportDraftLanguage} from '../../lib/crop-export-copy.ts';

/** Compile the unchanged real helpers with only the language context substituted.
 * Source links, facts, animal art and numeric formatting keep their actual authorities. */
export function animalCarePresenter(source:string,language:string):React.ComponentType<{e:AnimalEnterprise}>{
 const file=ts.createSourceFile('card.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),names=['formatWeeks','SourceLink','Fact','EnterpriseFacts'];if(source.includes('function enterpriseSourceText('))names.unshift('enterpriseSourceText','enterpriseReferenceText');
 const functions=names.map(name=>{const node=file.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);assert.ok(node,'missing actual card helper: '+name);return node.getText(file);});
 const range=file.statements.find(n=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.name.getText(file)==='rangeText'));assert.ok(range);
 const code=ts.transpileModule(range.getText(file)+'\n'+functions.join('\n'),{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const scope={React,exports:{},useLanguage:()=>({lang:language}),productGuideText,isCropExportDraftLanguage,ANIMAL_ENTERPRISES,PRODUCT_LABEL,animalReferenceQualifier,isFoodProduct,sourcedProductMonths,formatAmountRange,animalArtUrl,formatMonthSpan,formatRange,ExternalLink,HeartHandshake,Scale};
 return new Function(...Object.keys(scope),code+';return EnterpriseFacts;')(...Object.values(scope))as React.ComponentType<{e:AnimalEnterprise}>;
}
