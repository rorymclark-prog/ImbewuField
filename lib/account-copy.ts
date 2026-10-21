import { ACCOUNT_DRAFTS, ACCOUNT_KEYS } from './account-copy-data';
import { AUTH_ERROR_KEYS } from './auth-error-copy';
import { recordsMonthLong } from './records-months';
export type AccountValues=Readonly<Record<string,string>>;
export type AccountCopy=(english:string,zulu:string,values?:AccountValues)=>string;
export const isAccountDraftLanguage=(lang:string)=>['zu','st','ts','ve'].includes(lang);
export function fillAccountText(source:string,values:AccountValues={}):string {
  // A value is data, even when it contains '$&' or another brace pair; never interpret it again.
  return source.replace(/\{([^{}]+)\}/g,(match,key)=>Object.hasOwn(values,key)?values[key]:match);
}
export function accountText(lang:string,source:string,zulu:string,t:(key:string)=>string,values:AccountValues={}):string {
  const key=Object.hasOwn(ACCOUNT_KEYS,source)?ACCOUNT_KEYS[source]:undefined;
  const row=Object.hasOwn(ACCOUNT_DRAFTS,source)?ACCOUNT_DRAFTS[source]:undefined;
  const template=lang==='zu'?zulu:isAccountDraftLanguage(lang)?(key?t(key):row?.[lang]??source):source;
  return fillAccountText(template,values);
}
/** Known messages can repaint after a language switch; external text is never guessed at. */
export function accountErrorText(lang:string,source:string,t:(key:string)=>string):{text:string;known:boolean} {
  if(Object.hasOwn(AUTH_ERROR_KEYS,source))return{text:isAccountDraftLanguage(lang)?t(AUTH_ERROR_KEYS[source]):source,known:true};
  if(Object.hasOwn(ACCOUNT_DRAFTS,source))return{text:accountText(lang,source,ACCOUNT_DRAFTS[source].zu??source,t),known:true};
  const diagnostic=/^Something went wrong \(([^()\n]+)\)\.$/.exec(source);
  if(diagnostic){const template='Something went wrong ({code}).';return{text:accountText(lang,template,ACCOUNT_DRAFTS[template].zu,t,{code:diagnostic[1]}),known:true};}
  return{text:source,known:false};
}
const ROLE_ENGLISH:Readonly<Record<string,string>>={farmer:'Farmer',student:'Student',mentor:'Mentor',ngo:'NGO coordinator',funder:'Funder',admin:'Admin'};
const ROLE_ZULU:Readonly<Record<string,string>>={farmer:'Umlimi',student:'Umfundi',mentor:'Umeluleki',ngo:'Umxhumanisi we-NGO',funder:'Umxhasi',admin:'Umphathi'};
export function accountRoleName(role:string,copy:AccountCopy):string {
  return Object.hasOwn(ROLE_ENGLISH,role)?copy(ROLE_ENGLISH[role],ROLE_ZULU[role]):role;
}
/** Preserve the original local calendar day; only the month word follows the app language. */
export function allowanceResetLabel(lang:string,resetsOn:string):string {
  const date=new Date(`${resetsOn}T00:00:00Z`);
  return isAccountDraftLanguage(lang)&&!Number.isNaN(date.getTime())
    ?`${date.getDate()} ${recordsMonthLong(lang,date.getMonth()+1)}`
    :date.toLocaleDateString(undefined,{day:'numeric',month:'long'});
}
