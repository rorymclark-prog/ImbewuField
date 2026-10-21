import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as React from 'react';
import * as Icons from 'lucide-react';
import { formatDesignTranslation, sectorCompassWord } from '../lib/design-studio-i18n.ts';
import { deriveSectorModel } from '../lib/sector.ts';
import { isValidEarthLatitude } from '../lib/solar.ts';
import { englishDictionary } from './translation-inventory.ts';
import zu from '../lib/locales/zu.ts';
import st from '../lib/locales/st.ts';
import tx from '../lib/locales/ts.ts';
import ve from '../lib/locales/ve.ts';
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
export const controlLocales={en:englishDictionary(),zu,st,ts:tx,ve};
export type ControlLanguage=keyof typeof controlLocales;
export const controlT=(lang:ControlLanguage)=>(key:string)=>controlLocales[lang][key]??controlLocales.en[key]??key;
const tree=(path:string)=>ts.createSourceFile(path,read(path),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function findFunction(source:ts.SourceFile,name:string):ts.FunctionDeclaration {
 let found:ts.FunctionDeclaration|undefined;function visit(n:ts.Node){if(ts.isFunctionDeclaration(n)&&n.name?.text===name)found=n;else ts.forEachChild(n,visit);}visit(source);assert.ok(found,`actual caller function ${name}`);return found;
}
function compile(source:string,scope:Record<string,unknown>,name:string):any {
 const code=ts.transpileModule(source.replace(/export\s+default\s+/g,'').replace(/export\s+/g,''),{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2022}}).outputText;
 return new Function('scope',`with(scope){${code};return ${name};}`)(scope);
}
const paletteTree=tree('components/design/DesignPalette.tsx');
const canvasTree=tree('components/design/DesignCanvas.tsx');
const sectorTree=tree('components/design/SectorSummary.tsx');
const noteTree=tree('components/LanguageDraftNote.tsx');
const appLangTree=tree('lib/i18n.tsx');
const appLangDeclaration=appLangTree.statements.filter(ts.isVariableStatement).flatMap(s=>s.declarationList.declarations).find(d=>ts.isIdentifier(d.name)&&d.name.text==='APP_LANGS');
assert.ok(appLangDeclaration?.initializer);
const appLanguages=compile('function readLanguages(){return '+appLangDeclaration.initializer.getText(appLangTree)+';}',{},'readLanguages')();
const baseScope=()=>({React,...Icons,PAPER:'#FFFEFA',DARK:'#0B120B',GREEN:'#1F4D2B',GOLD:'#F7C97E'});
const paletteHelpers=['toolLabel','selectionRing','toolButtonStyle'].map(name=>findFunction(paletteTree,name).getText(paletteTree)).join('\n');
export function actualPaletteTools(lang:ControlLanguage,options:Record<string,unknown>={}) {
 const calls:Array<{action:string;value?:unknown}>=[];const called=(action:string)=>(value?:unknown)=>{calls.push({action,...(value===undefined?{}:{value})});};
 const scope:Record<string,unknown>={...baseScope(),t:controlT(lang),tool:'select',simple:false,canUndo:true,canRedo:true,canShowSpecies:false,angleControl:null,sizeControl:null,swaleControl:null,windControl:null,hiddenLayerCount:0,layersOpen:false,layersAnchor:null,layersButtonRef:{current:null},desktopAside:false,isPhone:true,
  setTool:called('setTool'),setHintDefId:called('setHintDefId'),onUndo:called('undo'),onRedo:called('redo'),onDuplicateSelected:called('duplicate'),onTidySelected:called('tidy'),onSnapSelected:called('snap'),onCleanupSelected:called('cleanup'),onDeleteSelected:called('delete'),setLayersOpen:called('layers'),...options};
 const render=compile(paletteHelpers+'\n'+findFunction(paletteTree,'renderToolRow').getText(paletteTree),scope,'renderToolRow');
 return{element:render()as React.ReactNode,calls};
}
export type DrawMode='line'|'zone'|'tidy'|'tidy-empty'|'snap'|'snap-empty'|'cleanup'|'cleanup-empty';
const drawExpressions:Record<string,string>={};
function collectDraw(n:ts.Node){if(ts.isJsxExpression(n)&&n.expression){const text=n.expression.getText(canvasTree);if(text.startsWith("(tool === 'zone' || tool === 'line') && draftPoints.length > 0"))drawExpressions.draw=text;else for(const name of['tidy','snap','cleanup'])if(text.startsWith(name+'Preview &&'))drawExpressions[name]=text;}ts.forEachChild(n,collectDraw);}
collectDraw(canvasTree);
export function actualDrawControls(lang:ControlLanguage,mode:DrawMode,points:unknown[]=[[0,0],[1,0],[1,1]]){
 const calls:Array<{action:string;value?:unknown}>=[];const called=(action:string)=>(value?:unknown)=>{calls.push({action,...(value===undefined?{}:{value})});};
 const kind=mode.startsWith('tidy')?'tidy':mode.startsWith('snap')?'snap':mode.startsWith('cleanup')?'cleanup':'draw';assert.ok(drawExpressions[kind],`actual ${kind} JSX`);
 const preview={canConfirm:!mode.endsWith('empty'),summary:'Recorded preview summary'};
 const scope={...baseScope(),t:controlT(lang),formatDesignTranslation,tool:mode,draftPoints:points,areaFeature:undefined,zoneDraw:1,GROUND_FEATURES:{},tidyPreview:preview,snapPreview:preview,cleanupPreview:preview,
  setDraftPoints:called('draft'),commitZone:called('zone'),commitLine:called('line'),onCancelTidy:called('cancel-tidy'),onConfirmTidy:called('confirm-tidy'),onCancelSnap:called('cancel-snap'),onConfirmSnap:called('confirm-snap'),onCancelCleanup:called('cancel-cleanup'),onConfirmCleanup:called('confirm-cleanup')};
 return{element:compile('function draw(){return ('+drawExpressions[kind]+');}',scope,'draw')()as React.ReactNode,calls};
}
export function actualDrawingHint(lang:ControlLanguage){
 const scope={...baseScope(),armedHintLabel:controlT(lang)('designPaletteTapCorners'),armedHintSource:lang==='en'?null:controlT('en')('designPaletteTapCorners'),lang,armedLessonId:null,hintDef:null,hintKey:'line',dismissedHintKey:null,setHintHeld:()=>{},setDismissedHintKey:()=>{},t:controlT(lang)};
 return compile(findFunction(paletteTree,'renderHint').getText(paletteTree),scope,'renderHint')()as React.ReactNode;
}
export function actualSectorSummary(lang:ControlLanguage,props:Record<string,unknown>={}){
 const scope:Record<string,unknown>={...baseScope(),...React,formatDesignTranslation,sectorCompassWord,deriveSectorModel,isValidEarthLatitude,useLanguage:()=>({lang,t:controlT(lang),setLang:()=>{}}),translate:(language:ControlLanguage,key:string)=>controlT(language)(key),APP_LANGS:appLanguages,resolveSectorContext:()=>null};
 const note=compile(findFunction(noteTree,'LanguageDraftNote').getText(noteTree),scope,'LanguageDraftNote');scope.LanguageDraftNote=note;
 const constants=sectorTree.statements.filter(n=>ts.isVariableStatement(n)&&n.declarationList.declarations.every(d=>ts.isIdentifier(d.name)&&['PAPER','DARK','GREEN','OCHRE','GOLD_DIM','DOT_SUN','DOT_WIND','DOT_FIRE','DOT_WATER','englishSectorText'].includes(d.name.text))).map(n=>n.getText(sectorTree)).join('\n');
 const component=compile(constants+'\n'+findFunction(sectorTree,'buildRows').getText(sectorTree)+'\n'+findFunction(sectorTree,'SectorSummary').getText(sectorTree),scope,'SectorSummary');
 return React.createElement(component,props);
}
export function hostElements(node:React.ReactNode,type:string):React.ReactElement<any>[] {
 const found:React.ReactElement<any>[]=[];React.Children.forEach(node,child=>{if(!React.isValidElement<any>(child))return;if(child.type===type)found.push(child);found.push(...hostElements(child.props.children,type));});return found;
}
export const hostButtons=(node:React.ReactNode)=>hostElements(node,'button');
export function nodeText(node:React.ReactNode):string {let s='';React.Children.forEach(node,c=>{if(typeof c==='string'||typeof c==='number')s+=c;else if(React.isValidElement<any>(c))s+=nodeText(c.props.children);});return s;}
