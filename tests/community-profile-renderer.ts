import fs from'node:fs';
import ts from'typescript';
import * as React from'react';
import * as Icons from'lucide-react';
import{act,create,type ReactTestRenderer,type ReactTestInstance}from'react-test-renderer';
import{compileActualComponent,actualAppLanguages}from'./account-ui-renderer.ts';
import{controlT,type ControlLanguage}from'./control-icon-renderers.ts';
const read=(p:string)=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
// Extract the actual rounding function without initializing any Firebase service.
const queryTree=ts.createSourceFile('community',read('lib/db/community-queries.ts'),ts.ScriptTarget.Latest,true),jitter=queryTree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='jitterToNeighbourhood');
if(!jitter)throw Error('Missing original location authority');
export const actualCommunityRounding=new Function(ts.transpileModule(jitter.getText(queryTree).replace('export ',''),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+';return jitterToNeighbourhood;')()as(lat:number,lon:number)=>{lat:number;lon:number};
export const QA_COMMUNITY_PHOTO='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72"><rect width="72" height="72" fill="#ddd5c1"/><text x="12" y="42" fill="#213924">QA</text></svg>');
export const communityNodeText=(n:ReactTestInstance):string=>n.children.map(c=>typeof c==='string'?c:communityNodeText(c)).join('');
export interface CommunityUiOptions {
 profile?:any;simple?:boolean;enabled?:boolean;signedOut?:boolean;authLoading?:boolean;loadFailures?:number;deferLoad?:boolean;
 saveFails?:boolean;deleteFails?:boolean;deferDelete?:boolean;uploadFails?:boolean;uploadNull?:boolean;deferUpload?:boolean;unsupportedLocation?:boolean;
}
export async function actualCommunityProfile(initial:ControlLanguage,options:CommunityUiOptions={}) {
 let lang=initial,simple=options.simple??false,user:any=options.signedOut?null:{uid:'qa-community-owner',displayName:'QA Owner'},failures=options.loadFailures??0;
 const profile=options.profile===undefined?{display_name:'QA public name',area_text:'QA district',bio:'QA bio',crops:['maize'],photos:[],show_on_map:false,coarse_lat:null,coarse_lon:null}:options.profile;
 const pendingLoads:Array<(value:any)=>void>=[];
 let geolocationSuccess:((pos:any)=>void)|undefined,geolocationFailure:(()=>void)|undefined,finishDelete:(()=>void)|undefined,finishUpload:(()=>void)|undefined;
 const calls={reads:[]as string[],saves:[]as any[],deletes:0,routes:[]as string[],replacements:[]as string[],uploads:[]as any[],resizes:[]as any[],geo:[]as any[],questions:[]as any[],focus:0};
 const storage=new Map<string,string>(),timers=new Map<number,{fn:()=>void;ms:number}>();let nextTimer=0;
 const window=Object.assign(new EventTarget(),{setTimeout:(fn:()=>void,ms:number)=>{const id=++nextTimer;timers.set(id,{fn,ms});return id;},clearTimeout:(id:number)=>timers.delete(id)});
 const sessionStorage={getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value)};
 const router={push:(url:string)=>calls.routes.push(url),replace:(url:string)=>calls.replacements.push(url)};
 const navigator={geolocation:options.unsupportedLocation?undefined:{getCurrentPosition:(success:any,failure:any,settings:any)=>{geolocationSuccess=success;geolocationFailure=failure;calls.geo.push(settings);}}};
 let renderer!:ReactTestRenderer;
 const scope:Record<string,unknown>={APP_LANGS:actualAppLanguages,React,...React,...Icons,window,sessionStorage,navigator,setTimeout:window.setTimeout,clearTimeout:window.clearTimeout,
  translate:(language:ControlLanguage,key:string)=>controlT(language)(key),useLanguage:()=>({lang,t:controlT(lang),setLang:()=>{}}),useDialogFocus:(open:boolean)=>{if(open)calls.focus++;},
  useAuth:()=>({user,loading:options.authLoading??false}),useRouter:()=>router,useAppLevel:()=>simple?'simple':'full',communityEnabled:()=>options.enabled??true,
  getMyCommunityProfile:async()=>{calls.reads.push(user.uid);if(options.deferLoad)return new Promise(resolve=>pendingLoads.push(resolve));if(failures-->0)throw Error('isolated read failure');return structuredClone(profile);},
  upsertCommunityProfile:async(value:any)=>{calls.saves.push(value);if(options.saveFails)throw Error('isolated save failure');},
  deleteCommunityProfile:async()=>{calls.deletes++;if(options.deferDelete)await new Promise<void>(resolve=>{finishDelete=resolve;});if(options.deleteFails)throw Error('isolated deletion failure');},
  uploadPhoto:async(file:any,folder:string)=>{calls.uploads.push({file,folder});if(options.deferUpload)await new Promise<void>(resolve=>{finishUpload=resolve;});if(options.uploadFails)throw Error('isolated photo failure');return options.uploadNull?null:QA_COMMUNITY_PHOTO;},
  resizeFileForUpload:async(file:any)=>{calls.resizes.push(file);return'qa-resized-photo';},jitterToNeighbourhood:actualCommunityRounding,
  AppHeader:({title}:any)=>React.createElement('header',null,title),TabBar:()=>React.createElement('nav',null,'QA navigation'),LessonLink:({label}:any)=>React.createElement('span',null,label),
  workspace:{workspace:'workspace',formWidth:'formWidth',twoColumns:'twoColumns',fullRow:'fullRow'},
 };
 scope.LanguageDraftNote=compileActualComponent('components/LanguageDraftNote.tsx','LanguageDraftNote',scope);
 const confirm=compileActualComponent('components/AppConfirm.tsx','({AppConfirmProvider,useAppConfirm})',scope);
 scope.useAppConfirm=()=>{const ask=confirm.useAppConfirm();return(opts:any)=>{calls.questions.push(opts);return ask(opts);};};
 const Page=compileActualComponent('app/community/profile/page.tsx','CommunityProfilePage',scope);
 const Component=()=>React.createElement(confirm.AppConfirmProvider,null,React.createElement(Page));
 await act(async()=>{renderer=create(React.createElement(Component),{createNodeMock:()=>({value:'',focus:()=>{calls.focus++;},click:()=>{}})});});
 return{renderer,calls,timers,profile,text:()=>renderer.toJSON()?communityNodeText(renderer.root):'',
  async language(next:ControlLanguage){lang=next;await act(async()=>renderer.update(React.createElement(Component)));},
  async level(next:boolean){simple=next;await act(async()=>renderer.update(React.createElement(Component)));},
  async user(next:any){user=next;await act(async()=>renderer.update(React.createElement(Component)));},
  async resolveLoad(index:number,value:any){await act(async()=>pendingLoads[index](value));},
  async finishDelete(){await act(async()=>{finishDelete?.();});},async finishUpload(){await act(async()=>{finishUpload?.();});},
  async button(label:string){await act(async()=>{const root=renderer.root.findAllByProps({role:'alertdialog'}).at(-1)??renderer.root;const b=root.findAll(n=>n.type==='button'&&(n.props['aria-label']===label||communityNodeText(n).replace(/\s+/g,' ').trim()===label.replace(/\s+/g,' ').trim()))[0];if(!b)throw Error('Missing action '+label);const before=calls.questions.length,result=b.props.onClick();if(!options.deferDelete&&calls.questions.length===before)await result;});},
  async change(id:string,value:string){await act(async()=>renderer.root.findByProps({id}).props.onChange({target:{value}}));},
  async toggle(){await act(async()=>renderer.root.findByProps({role:'switch'}).props.onClick());},
  async geolocation(lat:number,lon:number){await act(async()=>{geolocationSuccess!({coords:{latitude:lat,longitude:lon}});});},async denyLocation(){await act(async()=>{geolocationFailure!();});},
  async upload(file:any){await act(async()=>{const promise=renderer.root.findByProps({type:'file'}).props.onChange({target:{files:[file]}});if(!options.deferUpload)await promise;});},
  async escape(){await act(async()=>{window.dispatchEvent(Object.assign(new Event('keydown'),{key:'Escape'}));});},
  async timer(ms:number){await act(async()=>{for(const[id,t]of[...timers])if(t.ms===ms){timers.delete(id);t.fn();}});},
  async dispose(){await act(async()=>renderer.unmount());},
 };
}
