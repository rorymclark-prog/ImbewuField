import * as React from'react';import * as Icons from'lucide-react';
import{act,create,type ReactTestRenderer}from'react-test-renderer';
import{compileActualComponent,actualAppLanguages}from'./account-ui-renderer.ts';
import{controlT,type ControlLanguage}from'./control-icon-renderers.ts';
import{communityNodeText,QA_COMMUNITY_PHOTO}from'./community-profile-renderer.ts';
export interface CommunityMemberOptions {profile?:any;simple?:boolean;enabled?:boolean;signedOut?:boolean;authLoading?:boolean;loadFailures?:number;deferLoad?:boolean;threadFails?:boolean;threadNull?:boolean;deferThread?:boolean;reportFails?:boolean;deferReport?:boolean;ownProfile?:boolean;}
export async function actualCommunityMember(initial:ControlLanguage,options:CommunityMemberOptions={}){
 let lang=initial,simple=options.simple??false,targetUid='qa-public-farmer',user:any=options.signedOut?null:{uid:options.ownProfile?targetUid:'qa-community-viewer'},failures=options.loadFailures??0;
 const profile=options.profile===undefined?{uid:targetUid,display_name:'QA Public {number} $&',area_text:'QA District',bio:'QA owned biography',crops:['maize','beans'],photos:[QA_COMMUNITY_PHOTO,QA_COMMUNITY_PHOTO]}:options.profile;
 const calls={reads:[]as string[],threads:[]as any[],reports:[]as any[],routes:[]as string[],replacements:[]as string[],diagnostics:[]as string[]};
 const router={push:(url:string)=>calls.routes.push(url),replace:(url:string)=>calls.replacements.push(url)};
 const pendingLoads:Array<(value:any)=>void>=[];let threadDone:(()=>void)|undefined,reportDone:(()=>void)|undefined;
 const timers=new Map<number,{fn:()=>void;ms:number}>();let nextTimer=0;const storage=new Map<string,string>();
 const window={setTimeout:(fn:()=>void,ms:number)=>{const id=++nextTimer;timers.set(id,{fn,ms});return id;},clearTimeout:(id:number)=>timers.delete(id)};
 const scope:Record<string,unknown>={React,...React,...Icons,APP_LANGS:actualAppLanguages,window,setTimeout:window.setTimeout,clearTimeout:window.clearTimeout,sessionStorage:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v)},
  console:{error:(label:string)=>calls.diagnostics.push(label)},translate:(language:ControlLanguage,key:string)=>controlT(language)(key),useLanguage:()=>({lang,t:controlT(lang)}),useAuth:()=>({user,loading:options.authLoading??false}),useRouter:()=>router,useParams:()=>({uid:targetUid}),useAppLevel:()=>simple?'simple':'full',communityEnabled:()=>options.enabled??true,
  getCommunityProfile:async(uid:string)=>{calls.reads.push(uid);if(options.deferLoad)return new Promise(resolve=>pendingLoads.push(resolve));if(failures-->0)throw Error('isolated profile read failure');return structuredClone(profile);},
  getOrCreateThread:async(uid:string,name:string)=>{calls.threads.push({uid,name});if(options.deferThread)await new Promise<void>(resolve=>{threadDone=resolve;});if(options.threadFails)throw Error('isolated conversation failure');return options.threadNull?null:'qa-thread';},
  reportContent:async(kind:string,id:string,owner:string,reason:string)=>{calls.reports.push({kind,id,owner,reason});if(options.deferReport)await new Promise<void>(resolve=>{reportDone=resolve;});if(options.reportFails)throw Error('isolated report failure');},
  AppHeader:({title}:any)=>React.createElement('header',null,title),TabBar:()=>React.createElement('nav',null,'QA navigation'),LessonLink:({label}:any)=>React.createElement('span',null,label),workspace:{workspace:'workspace',readingWidth:'readingWidth'},
 };
 scope.LanguageDraftNote=compileActualComponent('components/LanguageDraftNote.tsx','LanguageDraftNote',scope);
 const Component=compileActualComponent('app/community/u/[uid]/page.tsx','PublicCommunityProfilePage',scope);let renderer!:ReactTestRenderer;
 await act(async()=>{renderer=create(React.createElement(Component));});
 const update=async()=>{await act(async()=>renderer.update(React.createElement(Component)));};
 return{renderer,calls,timers,profile,text:()=>renderer.toJSON()?communityNodeText(renderer.root):'',
  async language(next:ControlLanguage){lang=next;await update();},async level(next:boolean){simple=next;await update();},async target(next:string){targetUid=next;await update();},
  async resolveLoad(index:number,value:any){await act(async()=>pendingLoads[index](value));},async finishThread(){await act(async()=>threadDone?.());},async finishReport(){await act(async()=>reportDone?.());},
  async button(label:string){await act(async()=>{const b=renderer.root.findAll(n=>n.type==='button'&&(n.props['aria-label']===label||communityNodeText(n).replace(/\s+/g,' ').trim()===label.replace(/\s+/g,' ').trim()))[0];if(!b)throw Error('Missing action '+label);const promise=b.props.onClick();if(!options.deferThread&&!options.deferReport)await promise;});},
  async reason(value:string){await act(async()=>renderer.root.findByProps({id:'community-member-report-reason'}).props.onChange({target:{value}}));},
  async timer(ms:number){await act(async()=>{for(const[id,t]of[...timers])if(t.ms===ms){timers.delete(id);t.fn();}});},async dispose(){await act(async()=>renderer.unmount());},
 };
}
