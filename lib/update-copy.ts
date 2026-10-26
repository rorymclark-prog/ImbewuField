export type UpdateCopy = Readonly<Record<string, string>>;
export type UpdateCopyLanguage = 'zu' | 'st' | 'ts' | 've';
const EMPTY: UpdateCopy = Object.freeze({});
const loaders = {
  zu: () => import('./update-copy-locales/zu').then(m => m.default),
  st: () => import('./update-copy-locales/st').then(m => m.default),
  ts: () => import('./update-copy-locales/ts').then(m => m.default),
  ve: () => import('./update-copy-locales/ve').then(m => m.default),
};
const cache = new Map<string, Promise<UpdateCopy>>();
export function isUpdateCopyLanguage(lang:string):lang is UpdateCopyLanguage {
  return Object.hasOwn(loaders,lang);
}
// The history is large. Its language chunk belongs to the visible notice/history, not every route.
export function loadUpdateCopy(lang:string):Promise<UpdateCopy> {
  if(!isUpdateCopyLanguage(lang))return Promise.resolve(EMPTY);
  let pending=cache.get(lang);
  if(!pending){pending=loaders[lang]().catch(error=>{cache.delete(lang);throw error;});cache.set(lang,pending);}
  return pending;
}
const tokens=(text:string)=>(text.match(/\{[^{}]+\}|\d+(?:[.,]\d+)?/g)??[]).sort().join('\u0000');
export function validUpdateDescription(source:string,text:unknown):text is string {
  return typeof text==='string'&&!!text.trim()&&text!==source&&tokens(text)===tokens(source);
}
export function updateDescription(copy:UpdateCopy,source:string):string {
  const value=Object.hasOwn(copy,source)?copy[source]:undefined;
  return validUpdateDescription(source,value)?value:source;
}
/** Only exact source identities from this response may acquire native display text. */
export function cleanUpdateCopy(value:unknown,sources:readonly string[],language:unknown,expected:string):UpdateCopy {
  if(language!==expected||!isUpdateCopyLanguage(expected)||!value||typeof value!=='object'||Array.isArray(value))return EMPTY;
  return Object.fromEntries(sources.flatMap(source=>{
    const text=Object.hasOwn(value,source)?(value as Record<string,unknown>)[source]:undefined;
    return validUpdateDescription(source,text)?[[source,text]]:[];
  }));
}
export function updateTourSources(stops:readonly {title:string;where:string;detail:string}[]):string[] {
  return stops.flatMap(s=>[s.title,s.where,s.detail]);
}
