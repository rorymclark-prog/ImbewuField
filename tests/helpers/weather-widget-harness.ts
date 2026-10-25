import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import * as weather from '../../lib/weather.ts';
import * as copy from '../../lib/weather-copy.ts';
import * as pending from '../../lib/i18n-pending.ts';
import * as art from '../../lib/element-art-2.ts';
import * as records from '../../lib/records-regional-drafts.ts';
const require = createRequire(import.meta.url);
const source=(file:string)=>readFileSync(new URL('../../'+file,import.meta.url),'utf8');
export const weatherFixture:weather.WeatherForecast={current:{tempC:23.4,weatherCode:1,windKph:11.6},daily:Array.from({length:7},(_,i)=>({date:`2026-10-${25+i}`,tMaxC:i===1?38:23.4,tMinC:i===0?-1:12.2,precipMm:i===2?30:0,precipProbability:i===2?80:null,windMaxKph:14,weatherCode:[1,0,95,45,71,80,3][i],et0Mm:3.2,frostWarning:i===0,heatWarning:i===1,heavyRainWarning:i===2}))};
// Both versions paint the same controlled states. Effects do not run here;
// browser evidence separately exercises the real fetch/effect/language path.
export function renderWeatherWidget({lang='en',status='ok',forecast=weatherFixture,compact=false,context='report',widgetSource=source('components/WeatherWidget.tsx'),copySource}:{lang?:string;status?:'ok'|'error'|'loading';forecast?:weather.WeatherForecast;compact?:boolean;context?:'home'|'report';widgetSource?:string;copySource?:string}={}){
 const load=(text:string):Record<string,any>=>{const module={exports:{}};const compiled=ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}});const localRequire=(id:string):any=>{
  if(id==='react')return{...React,useState:(initial:unknown)=>initial===null?[status==='ok'?forecast:null,()=>{}]:initial==='loading'?[status,()=>{}]:(()=>{throw Error('unmodelled weather state');})(),useEffect:()=>{}};
  if(id==='@/lib/i18n')return{useLanguage:()=>({lang})};
  if(id==='@/lib/weather')return weather;
  if(id==='@/lib/weather-copy')return copySource?load(copySource):copy;
  if(id==='@/lib/i18n-pending')return pending;
  if(id==='@/lib/element-art-2')return art;
  if(id==='@/lib/records-regional-drafts')return records;
  if(id==='./IsiZuluDraftSource')return load(source('components/IsiZuluDraftSource.tsx'));
  return require(id);
 };new Function('require','module','exports',compiled.outputText)(localRequire,module,module.exports);return module.exports;};
 const Component=load(widgetSource).default;return renderToStaticMarkup(React.createElement(Component,{lat:-29,lon:30,compact,context}));
}
export function weatherVisibleText(html:string){return html.replace(/<[^>]*>/g,'').replace(/&(?:amp|lt|gt|quot|#x27|#39);/g,s=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#x27;':"'",'&#39;':"'"}[s]!)).replace(/\s+/g,' ').trim();}
