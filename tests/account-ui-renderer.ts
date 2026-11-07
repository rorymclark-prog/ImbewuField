import fs from'node:fs';
import ts from'typescript';
import * as React from'react';
import * as Icons from'lucide-react';
import{act,create,type ReactTestRenderer,type ReactTestInstance}from'react-test-renderer';
import{CONSENT_PANEL_HEADING,CONSENT_SCOPES,emptyConsent,hasConsent,grantedScopes,setScope,revokeAll}from'../lib/consent.ts';
import{controlT,type ControlLanguage}from'./control-icon-renderers.ts';
import{accountText,accountRoleName,accountErrorText,allowanceResetLabel,fillAccountText,isAccountDraftLanguage}from'../lib/account-copy.ts';
import{inlineText,inlineTemplate,xhInlineDraft}from'../lib/xh-inline.ts';
const read=(p:string)=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const cache=new Map<string,string>();
function compile(path:string,result:string,scope:Record<string,unknown>):any {
 let code=cache.get(path);if(!code){const tree=ts.createSourceFile(path,read(path),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);code=ts.transpileModule(tree.statements.filter(n=>!ts.isImportDeclaration(n)).map(n=>n.getText(tree)).join('\n').replace(/^export\s+default\s+/gm,'').replace(/^export\s+/gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None,jsx:ts.JsxEmit.React}}).outputText;cache.set(path,code);}return new Function('scope',`with(scope){${code};return ${result};}`)(scope);
}
const languageTree=ts.createSourceFile('i18n',read('lib/i18n.tsx'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const declaration=languageTree.statements.filter(ts.isVariableStatement).flatMap(n=>n.declarationList.declarations).find(n=>ts.isIdentifier(n.name)&&n.name.text==='APP_LANGS');
const APP_LANGS=new Function(ts.transpileModule('return ('+declaration!.initializer!.getText(languageTree)+');',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText)();
export function accountNodeText(n:ReactTestInstance):string{return n.children.map(c=>typeof c==='string'?c:accountNodeText(c)).join('');}
export interface AccountUiOptions {
 kind?:'page'|'access'|'allowance'|'confirm'|'consent';role?:string;sample?:boolean;simple?:boolean;loading?:boolean;backend?:boolean;signedOut?:boolean;
 allowance?:any;profile?:any;consent?:any;organisation?:string;consentLoadFailures?:number;consentLoading?:boolean;consentWriteError?:boolean;consentRevokeError?:boolean;consentWriteDelay?:boolean;saveError?:unknown;photoError?:unknown;passwordError?:string;refreshError?:boolean;previewFails?:boolean;
}
export async function actualAccountUi(initial:ControlLanguage,options:AccountUiOptions={}) {
 let currentConsent=options.consent??emptyConsent('qa-account-owner','qa-org','2026-01-01T00:00:00Z'),loadFailures=options.consentLoadFailures??0;
 let finishConsentWrite:undefined|(()=>void);
 let lang=initial,simple=options.simple??false,loading=options.loading??false;
 const user=options.signedOut?null:{uid:'qa-account-owner',displayName:'QA Name',email:'qa@example.invalid'};
 const profile={role:options.role??'farmer',full_name:'QA Name',phone:'QA phone',farm_name:'QA Farm',language:'en',...options.profile};
 const calls={updates:[]as any[],routes:[]as string[],replace:[]as string[],refresh:0,passwords:[]as string[][],signOut:0,uploads:[]as any[],resize:[]as any[],previews:[]as string[],exit:0,focus:0,consentReads:0,consentWrites:[]as Array<{scope:string;next:boolean}>,revocations:0};
 const storage=new Map<string,string>(),timers=new Map<number,{fn:()=>void;ms:number}>();let id=0;
 const window=Object.assign(new EventTarget(),{setTimeout:(fn:()=>void,ms:number)=>{const n=++id;timers.set(n,{fn,ms});return n;},clearTimeout:(n:number)=>timers.delete(n)});
 const sessionStorage={getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v)};
 const router={push:(url:string)=>calls.routes.push(url),replace:(url:string)=>calls.replace.push(url)};
 let renderer!:ReactTestRenderer,Component:React.ComponentType<any>,ask:((opts:any)=>Promise<boolean>)|undefined;
 const scope:Record<string,unknown>={React,...React,...Icons,window,sessionStorage,setTimeout:window.setTimeout,clearTimeout:window.clearTimeout,APP_LANGS,
  inlineText,inlineTemplate,xhInlineDraft,
  accountText,accountRoleName,accountErrorText,allowanceResetLabel,fillAccountText,isAccountDraftLanguage,CONSENT_PANEL_HEADING,CONSENT_SCOPES,hasConsent,grantedScopes,
  useLanguage:()=>({lang,t:controlT(lang),setLang:(next:ControlLanguage)=>{lang=next;renderer.update(React.createElement(Component));}}),translate:(l:ControlLanguage,k:string)=>controlT(l)(k),
  useRouter:()=>router,useAppLevel:()=>simple?'simple':'full',useSampleRole:()=>options.sample?'ngo':'',isBackendConfigured:()=>options.backend??false,
  useAuth:()=>({user,profile,loading,signOutUser:async()=>{calls.signOut++;},changePassword:async(...values:string[])=>{calls.passwords.push(values);return options.passwordError??null;},refreshProfile:async()=>{calls.refresh++;if(options.refreshError)throw Error('refresh failure');}}),
  updateMyProfile:async(payload:any)=>{calls.updates.push(payload);if(options.saveError)throw options.saveError;},uploadPhoto:async(file:any,kind:string)=>{calls.uploads.push({file,kind});if(options.photoError)throw options.photoError;return'qa-photo-url';},
  resizeFileForUpload:async(file:any)=>{calls.resize.push({kind:'photo',file});return'qa-resized-photo';},resizeLogoForStorage:async(file:any)=>{calls.resize.push({kind:'logo',file});return'qa-logo-data';},getOrganizationName:async()=>'QA organisation',
  getMyConsent:async()=>{calls.consentReads++;if(options.consentLoading)return new Promise(()=>{});if(loadFailures-->0)throw Error('consent read failed');return structuredClone(currentConsent);},
  setMyConsentScope:async(scope:any,next:boolean)=>{calls.consentWrites.push({scope,next});if(options.consentWriteDelay)await new Promise<void>(resolve=>{finishConsentWrite=resolve;});if(options.consentWriteError)throw Error('consent write failed');currentConsent=setScope(currentConsent,scope,next,'2026-01-02T00:00:00Z');return structuredClone(currentConsent);},
  revokeAllMyConsent:async()=>{calls.revocations++;if(options.consentRevokeError)throw Error('revoke failed');currentConsent=revokeAll(currentConsent,'2026-01-03T00:00:00Z');return structuredClone(currentConsent);},
  getSandboxProfile:()=>({...profile,full_name:'QA practice profile'}),exitSampleMode:()=>{calls.exit++;},startRolePreview:(role:string)=>{calls.previews.push(role);return!options.previewFails;},
  paidApiHeaders:async()=>({'X-QA':'isolated'}),fetch:async()=>({ok:true,json:async()=>options.allowance??{kind:'user',capZar:120,spentZar:33,remainingZar:87,capped:false,resetsOn:'2026-11-01'}}),
  workspace:{workspace:'workspace',formWidth:'formWidth',twoColumns:'twoColumns'},styles:{root:'root',card:'card',muted:'muted',row:'row'},
  AppHeader:({title}:any)=>React.createElement('header',null,title),TabBar:()=>React.createElement('nav',null,'QA navigation'),LessonLink:({label}:any)=>React.createElement('span',null,label),ThemePanel:()=>null,
 };
 scope.LanguageDraftNote=compile('components/LanguageDraftNote.tsx','LanguageDraftNote',scope);
  scope.useDialogFocus=(open:boolean)=>{if(open)calls.focus++;};
  scope.useEscapeClose=()=>{};
 scope.AccountErrorText=compile('components/AccountErrorText.tsx','AccountErrorText',scope);
 scope.ConsentPanel=compile('components/ConsentPanel.tsx','ConsentPanel',scope);
 scope.AccountAccess=compile('components/AccountAccess.tsx','AccountAccess',scope);
 scope.AiAllowance=compile('components/AiAllowance.tsx','AiAllowance',scope);
 const kind=options.kind??'page';
 if(kind==='confirm'){
  const module=compile('components/AppConfirm.tsx','({AppConfirmProvider,useAppConfirm})',scope);
  function Probe(){ask=module.useAppConfirm();return null;}
  Component=()=>React.createElement(module.AppConfirmProvider,null,React.createElement(Probe));
 }else if(kind==='consent')Component=()=>React.createElement(scope.ConsentPanel as React.ComponentType<any>,{orgName:options.organisation??null});
 else if(kind==='access')Component=scope.AccountAccess as React.ComponentType;
 else if(kind==='allowance'){const Allowance=scope.AiAllowance as React.ComponentType<any>;Component=()=>React.createElement(Allowance,{copy:(en:string,zu:string,values:any)=>accountText(lang,en,zu,controlT(lang),values)});}
 else Component=compile('app/account/page.tsx','AccountPage',scope);
 await act(async()=>{renderer=create(React.createElement(Component),{createNodeMock:()=>({value:'',focus:()=>{calls.focus++;},click:()=>{}})});});
 return{renderer,calls,timers,profile,
  async finishConsent(){await act(async()=>{finishConsentWrite?.();});},
  async consentToggle(index:number,next:boolean){await act(async()=>{const change=renderer.root.findAll(n=>n.type==='input'&&n.props.type==='checkbox')[index].props.onChange({target:{checked:next}});if(!options.consentWriteDelay)await change;});},text:()=>renderer.toJSON()?accountNodeText(renderer.root):'',
  async language(next:ControlLanguage){lang=next;await act(async()=>renderer.update(React.createElement(Component)));},
  async level(next:boolean){simple=next;await act(async()=>renderer.update(React.createElement(Component)));},
  async loading(next:boolean){loading=next;await act(async()=>renderer.update(React.createElement(Component)));},
  async button(label:string){await act(async()=>{const b=renderer.root.findAll(n=>n.type==='button'&&(accountNodeText(n)===label||n.props['aria-label']===label||n.props.title===label))[0];if(!b)throw Error('Missing action '+label);await b.props.onClick();});},
  async change(node:ReactTestInstance,value:string){await act(async()=>node.props.onChange({target:{value}}));},
  async upload(index:number,file:any){await act(async()=>renderer.root.findAll(n=>n.type==='input'&&n.props.type==='file')[index].props.onChange({target:{files:[file]}}));},
  async timer(ms:number){await act(async()=>{for(const[n,t]of[...timers])if(t.ms===ms){timers.delete(n);t.fn();}});},
  async question(opts:any){let answer:boolean|undefined;await act(async()=>{void ask!(opts).then(value=>{answer=value;});});return()=>answer;},
  async escape(){await act(async()=>{window.dispatchEvent(Object.assign(new Event('keydown'),{key:'Escape'}));});},
  async dispose(){await act(async()=>renderer.unmount());},
 };
}

export {compile as compileActualComponent,APP_LANGS as actualAppLanguages};
