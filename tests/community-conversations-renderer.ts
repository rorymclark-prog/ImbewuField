import * as React from'react';import * as Icons from'lucide-react';
import{act,create,type ReactTestRenderer}from'react-test-renderer';
import{compileActualComponent,actualAppLanguages}from'./account-ui-renderer.ts';
import{controlT,type ControlLanguage}from'./control-icon-renderers.ts';
import{communityNodeText,QA_COMMUNITY_PHOTO}from'./community-profile-renderer.ts';
import{communityTimeAgo}from'../lib/community-time.ts';
export interface ConversationUiOptions {
 mapLoading?:boolean;simple?:boolean;enabled?:boolean;signedOut?:boolean;authLoading?:boolean;now?:number;
 thread?:any;messages?:any[];loadFailures?:number;deferThreadLoad?:boolean;listenFails?:boolean;
 sendFails?:boolean;deferSend?:boolean;reportFails?:boolean;deferReport?:boolean;
 profile?:any;nearby?:any[];posts?:any[];threads?:any[];readFailures?:string[];deferHubLoad?:boolean;
 postFails?:boolean;deferPost?:boolean;uploadFails?:boolean;uploadNull?:boolean;deferUpload?:boolean;closeFails?:boolean;deleteFails?:boolean;deferPostAction?:boolean;
}
export async function actualCommunityConversation(initial:ControlLanguage,kind:'thread'|'hub'|'map'='thread',options:ConversationUiOptions={}){
 let lang=initial,simple=options.simple??false,user:any=options.signedOut?null:{uid:'qa-user'},threadId='qa-thread',failures=options.loadFailures??0;
 const now=options.now??Date.UTC(2026,9,22,12),stamp=(ago:number)=>({seconds:(now-ago)/1000});
 const thread=options.thread===undefined?{id:threadId,participants:['qa-user','qa-farmer'],participant_names:{'qa-user':'QA Me','qa-farmer':'QA Farmer'}}:options.thread;
 const messages=options.messages??[{id:'qa-1',sender_id:'qa-farmer',body:'QA received message',created_at:stamp(5*60_000)},{id:'qa-2',sender_id:'qa-user',body:'QA sent message',created_at:stamp(2*3_600_000)},{id:'qa-3',sender_id:'qa-farmer',body:'QA earlier message',created_at:stamp(2*86_400_000)}];
 const profile=options.profile===undefined?{uid:'qa-user',display_name:'QA Me',area_text:'QA Own district'}:options.profile;
 const nearby=options.nearby??[{uid:'qa-farmer',display_name:'QA Farmer',area_text:'QA District',photos:[QA_COMMUNITY_PHOTO],show_on_map:true,coarse_lat:-29.12,coarse_lon:30.65},{uid:'qa-unpinned',display_name:'QA List only',area_text:'QA district',photos:[],show_on_map:false,coarse_lat:null,coarse_lon:null}];
 const posts=options.posts??[{id:'qa-own-post',owner_id:'qa-user',owner_name:'QA Me',description:'QA own listing',area_text:'QA Own district',category:'seed',kind:'have',photo_url:QA_COMMUNITY_PHOTO,created_at:stamp(60_000)},{id:'qa-other-post',owner_id:'qa-farmer',owner_name:'QA Farmer',description:'QA other listing',area_text:'QA District',category:'tools',kind:'free',photo_url:QA_COMMUNITY_PHOTO,created_at:stamp(3_600_000)}];
 const threads=options.threads??[{...thread,last_message:'QA received message',last_message_at:stamp(5*60_000)}];
 const calls={reads:[]as any[],subscriptions:[]as any[],sends:[]as any[],reports:[]as any[],posts:[]as any[],uploads:[]as any[],resizes:[]as any[],closed:[]as string[],deleted:[]as string[],opened:[]as any[],routes:[]as string[],replacements:[]as string[],maps:[]as any[],markers:[]as any[],popups:[]as any[],scrolls:0,focus:0,diagnostics:[]as string[]};
 const timers=new Map<number,{fn:()=>void;ms:number}>(),storage=new Map<string,string>();let nextTimer=0;
 const window={setTimeout:(fn:()=>void,ms:number)=>{const id=++nextTimer;timers.set(id,{fn,ms});return id;},clearTimeout:(id:number)=>timers.delete(id)};
 const router={push:(url:string)=>calls.routes.push(url),replace:(url:string)=>calls.replacements.push(url)},loadReplies:Array<(v:any)=>void>=[],hubReplies:Array<{owner:string;name:string;resolve:(v:any)=>void;reject:()=>void}>=[],readFailures=new Set(options.readFailures??[]);
 let finishSend:(()=>void)|undefined,finishReport:(()=>void)|undefined,finishPost:(()=>void)|undefined,finishUpload:(()=>void)|undefined,finishAction:(()=>void)|undefined;
 const read=async(name:string,value:any)=>{calls.reads.push({name,owner:user.uid});if(options.deferHubLoad)return new Promise((resolve,reject)=>hubReplies.push({owner:user.uid,name,resolve,reject:()=>reject(Error('isolated read failure'))}));if(readFailures.has(name))throw Error('isolated read failure');return structuredClone(value);};
 const nodes:any[]=[];
 const scope:Record<string,unknown>={React,...React,...Icons,APP_LANGS:actualAppLanguages,window,setTimeout:window.setTimeout,clearTimeout:window.clearTimeout,sessionStorage:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v)},process:{env:{NEXT_PUBLIC_MAPBOX_TOKEN:'qa-no-live-map'}},console:{error:(label:string)=>calls.diagnostics.push(label)},
  translate:(language:ControlLanguage,key:string)=>controlT(language)(key),useLanguage:()=>({lang,t:controlT(lang)}),useAuth:()=>({user,loading:options.authLoading??false}),useRouter:()=>router,useParams:()=>({threadId}),useAppLevel:()=>simple?'simple':'full',communityEnabled:()=>options.enabled??true,
  communityTimeAgo:(value:unknown,language:string,t:(k:string)=>string,compact=false)=>communityTimeAgo(value,language,t,compact,now),
  getThread:async(id:string)=>{calls.reads.push({name:'thread',id,owner:user.uid});if(options.deferThreadLoad)return new Promise(resolve=>loadReplies.push(resolve));if(failures-->0)throw Error('isolated thread read failure');return structuredClone(thread);},
  subscribeMessages:(id:string,receive:(v:any)=>void,error:()=>void)=>{const sub={id,receive,error,closed:false};calls.subscriptions.push(sub);receive(structuredClone(messages));if(options.listenFails)error();return()=>{sub.closed=true;};},
  sendMessage:async(id:string,text:string)=>{calls.sends.push({id,text});if(options.deferSend)await new Promise<void>(resolve=>{finishSend=resolve;});if(options.sendFails)throw Error('isolated send failure');},
  reportContent:async(kind:string,id:string,owner:string,reason:string)=>{calls.reports.push({kind,id,owner,reason});if(options.deferReport)await new Promise<void>(resolve=>{finishReport=resolve;});if(options.reportFails)throw Error('isolated report failure');},
  getMyCommunityProfile:()=>read('profile',profile),listNearbyCommunityProfiles:()=>read('nearby',nearby),listBoardPosts:()=>read('posts',posts),listMyThreads:()=>read('threads',threads),
  createBoardPost:async(value:any)=>{calls.posts.push(value);if(options.deferPost)await new Promise<void>(resolve=>{finishPost=resolve;});if(options.postFails)throw Error('isolated posting failure');},
  closeBoardPost:async(id:string)=>{calls.closed.push(id);if(options.deferPostAction)await new Promise<void>(resolve=>{finishAction=resolve;});if(options.closeFails)throw Error('isolated close failure');},
  deleteBoardPost:async(id:string)=>{calls.deleted.push(id);if(options.deferPostAction)await new Promise<void>(resolve=>{finishAction=resolve;});if(options.deleteFails)throw Error('isolated delete failure');},
  getOrCreateThread:async(uid:string,name:string)=>{calls.opened.push({uid,name});return'qa-new-thread';},
  uploadPhoto:async(file:any,folder:string)=>{calls.uploads.push({file,folder});if(options.deferUpload)await new Promise<void>(resolve=>{finishUpload=resolve;});if(options.uploadFails)throw Error('isolated photo failure');return options.uploadNull?null:QA_COMMUNITY_PHOTO;},resizeFileForUpload:async(file:any)=>{calls.resizes.push(file);return'qa-resized-photo';},
  AppHeader:({title,right}:any)=>React.createElement('header',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 16px',gap:8}},React.createElement('span',null,title),React.createElement('div',{style:{display:'flex',gap:8,alignItems:'center'}},right)),TabBar:()=>React.createElement('nav',null,'QA navigation'),LessonLink:({label}:any)=>React.createElement('span',null,label),Link:({href,children,...props}:any)=>React.createElement('a',{href,...props},children),workspace:{workspace:'workspace',readingWidth:'readingWidth',cards:'cards'},
  ReactMapGL:({children,...props}:any)=>{calls.maps.push(props);return React.createElement('div',{'data-qa-map':true,style:{height:'100%',background:'var(--bg-2)',padding:12,position:'relative',display:'flex',gap:8,alignItems:'flex-start'}},children);},
  Marker:({children,...props}:any)=>{calls.markers.push(props);return React.createElement('div',{'data-qa-marker':true},children);},
  Popup:({children,...props}:any)=>{calls.popups.push(props);return React.createElement('section',{'data-qa-popup':true,style:{background:'#FFFFFF',borderRadius:12,padding:10,boxShadow:'0 4px 12px #0003'}},children);},
 };
 scope.LanguageDraftNote=compileActualComponent('components/LanguageDraftNote.tsx','LanguageDraftNote',scope);
 const NearbyMapComponent=compileActualComponent('components/community/NearbyMap.tsx','NearbyMap',scope);scope.dynamic=(_loader:any,settings:any)=>options.mapLoading?settings.loading:NearbyMapComponent;
 const Component=kind==='map'?NearbyMapComponent:compileActualComponent(kind==='hub'?'app/community/page.tsx':'app/community/messages/[threadId]/page.tsx',kind==='hub'?'CommunityHubPage':'MessageThreadPage',scope);
 const props:any=kind==='map'?{people:nearby,onOpenProfile:(uid:string)=>{calls.routes.push('/community/u/'+uid);}}:{};
 let renderer!:ReactTestRenderer;await act(async()=>{renderer=create(React.createElement(Component,props),{createNodeMock:()=>{const node={value:'qa-file',scrollIntoView:()=>{calls.scrolls++;},focus:()=>{calls.focus++;},click:()=>{}};nodes.push(node);return node;}});});
 const update=async()=>{await act(async()=>renderer.update(React.createElement(Component,props)));};
 return{renderer,calls,timers,nodes,thread,messages,profile,nearby,posts,threads,now,text:()=>renderer.toJSON()?communityNodeText(renderer.root):'',
  async language(next:ControlLanguage){lang=next;await update();},async level(next:boolean){simple=next;await update();},async user(next:any){user=next;await update();},async target(next:string){threadId=next;await update();},
  async resolveThread(index:number,value:any){await act(async()=>loadReplies[index](value));},async finishSend(){await act(async()=>finishSend?.());},async finishReport(){await act(async()=>finishReport?.());},async finishPost(){await act(async()=>finishPost?.());},async finishUpload(){await act(async()=>finishUpload?.());},async finishAction(){await act(async()=>finishAction?.());},
  async resolveHubRound(round:number,values:{profile:any;nearby:any[];posts:any[];threads:any[]}){await act(async()=>{for(const r of hubReplies.slice(round*4,round*4+4))r.resolve(values[r.name as keyof typeof values]);});},allowReads(){readFailures.clear();},
  async listener(index:number,values:any[]){await act(async()=>calls.subscriptions[index].receive(values));},async listenerError(index:number){await act(async()=>calls.subscriptions[index].error());},
  async button(label:string){await act(async()=>{const b=renderer.root.findAll(n=>n.type==='button'&&(n.props['aria-label']===label||communityNodeText(n).replace(/\s+/g,' ').trim()===label.replace(/\s+/g,' ').trim()))[0];if(!b)throw Error('Missing action '+label);const promise=b.props.onClick?.({stopPropagation:()=>{},currentTarget:{focus:()=>{calls.focus++;}}});if(!options.deferSend&&!options.deferReport&&!options.deferPost&&!options.deferPostAction&&!options.deferUpload&&!options.deferHubLoad)await promise;});},
  async tab(value:string){await act(async()=>renderer.root.findByProps({id:'community-tab-'+value}).props.onClick());},
  async body(value:string){await act(async()=>renderer.root.findAllByType('input').find(n=>n.props.type==='text')!.props.onChange({target:{value}}));},async enter(){await act(async()=>renderer.root.findAllByType('input').find(n=>n.props.type==='text')!.props.onKeyDown({key:'Enter'}));},
  async change(id:string,value:string){await act(async()=>renderer.root.findByProps({id}).props.onChange({target:{value}}));},async kind(value:string){await act(async()=>{const label=controlT(lang)('communityBoardKind'+value[0].toUpperCase()+value.slice(1));const b=renderer.root.findAll(n=>n.type==='button'&&n.props['aria-pressed']!==undefined&&communityNodeText(n)===label)[0];b.props.onClick();});},
  async upload(file:any){await act(async()=>{const promise=renderer.root.findByProps({type:'file'}).props.onChange({target:{files:[file]}});if(!options.deferUpload)await promise;});},
  async timer(ms:number){await act(async()=>{for(const[id,t]of[...timers])if(t.ms===ms){timers.delete(id);t.fn();}});},async dispose(){await act(async()=>renderer.unmount());},
 };
}
