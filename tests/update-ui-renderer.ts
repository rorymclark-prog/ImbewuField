import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as React from 'react';
import { act,create,type ReactTestRenderer,type ReactTestInstance } from 'react-test-renderer';
import { ChevronUp,X,Menu,ArrowRight } from 'lucide-react';
import { controlT,type ControlLanguage } from './control-icon-renderers.ts';
import { isDifferentBuild } from '../lib/pwa-update.ts';
import { cleanUpdateTour,readUpdateGuide,UPDATE_GUIDE_KEY,OPEN_UPDATE_GUIDE_EVENT } from '../lib/update-tour.ts';
import { RELEASE_NOTES,visibleNotes,visibleUpdateTour } from '../lib/release-notes.ts';
import { cleanUpdateCopy,isUpdateCopyLanguage,loadUpdateCopy,updateDescription,updateTourSources,type UpdateCopy } from '../lib/update-copy.ts';
import { useUpdateCopy } from '../lib/use-update-copy.ts';
import { updateDateLabel } from '../lib/update-copy-date.ts';
import { RateLimiter,clientIp } from '../lib/api-rate-limit.ts';
import { recordTourOpening,dismissTourMenuTip,TOUR_INVITATION_LIMIT } from '../lib/tour-discovery.ts';
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const cache=new Map<string,string>();
const languageTree=ts.createSourceFile('i18n',read('lib/i18n.tsx'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const languageDeclaration=languageTree.statements.filter(ts.isVariableStatement).flatMap(s=>s.declarationList.declarations).find(d=>ts.isIdentifier(d.name)&&d.name.text==='APP_LANGS');
const appLanguages=new Function(ts.transpileModule('return ('+languageDeclaration!.initializer!.getText(languageTree)+');',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText)();
function compiled(path:string,name:string,scope:Record<string,unknown>):any {
 let code=cache.get(path);
 if(!code){const tree=ts.createSourceFile(path,read(path),ts.ScriptTarget.Latest,true,path.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);const source=tree.statements.filter(s=>!ts.isImportDeclaration(s)).map(s=>s.getText(tree)).join('\n').replace(/^export\s+default\s+/gm,'').replace(/^export\s+/gm,'').replace(/import\('@\/lib\/release-notes'\)/g,'loadReleaseNotes()');code=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2022}}).outputText;cache.set(path,code);}
 return new Function('scope',`with(scope){${code};return ${name};}`)(scope);
}
export function updateNodeText(node:ReactTestInstance):string{return node.children.map(n=>typeof n==='string'?n:updateNodeText(n)).join('');}
const styleNames=Object.fromEntries([...read('components/UpdateGuide.module.css').matchAll(/\.([A-Za-z][\w-]*)/g)].map(m=>[m[1],m[1]]));
export interface UpdateUiOptions {
 kind?:'banner'|'guide'|'history'|'discovery'|'onboarding';path?:string;simple?:boolean;sample?:boolean;waiting?:boolean;guide?:unknown;
 server?:(lang:string,url:string,index:number)=>Promise<any>;loader?:(lang:string)=>Promise<UpdateCopy>;
}
let fixtureId=0;
export async function actualUpdateUi(initial:ControlLanguage,options:UpdateUiOptions={}){
 // Preload real data unless a test explicitly controls chunk arrival/failure.
 if(!options.loader)await loadUpdateCopy(initial);
 let lang=initial,path=options.path??'/home',simple=options.simple??false;
 const actor='qa-update-'+(++fixtureId);
 const session=new Map<string,string>(),storage=new Map<string,string>(),calls={fetch:[]as string[],reload:0,lazy:0,worker:0,posts:[]as unknown[],menu:0,completed:[]as string[],routes:[]as string[]};
 if(options.kind==='discovery')storage.set('imbewu-tour-discovery:'+actor,JSON.stringify({openings:TOUR_INVITATION_LIMIT,menuTipDismissed:false}));
 if(options.guide)session.set(UPDATE_GUIDE_KEY,JSON.stringify(options.guide));
 const timers=new Map<number,{fn:()=>void;ms:number;interval:boolean}>();let nextTimer=0;
 const window=Object.assign(new EventTarget(),{
  location:{search:'',reload:()=>calls.reload++},sessionStorage:{getItem:(k:string)=>session.get(k)??null,setItem:(k:string,v:string)=>session.set(k,v),removeItem:(k:string)=>session.delete(k)},
  setTimeout:(fn:()=>void,ms:number)=>{const id=++nextTimer;timers.set(id,{fn,ms,interval:false});return id;},clearTimeout:(id:number)=>timers.delete(id),
  setInterval:(fn:()=>void,ms:number)=>{const id=++nextTimer;timers.set(id,{fn,ms,interval:true});return id;},clearInterval:(id:number)=>timers.delete(id),
 });
 const registration=Object.assign(new EventTarget(),{waiting:options.waiting?{postMessage:(v:unknown)=>calls.posts.push(v)}:null,installing:null,update:async()=>{}});
 const worker=Object.assign(new EventTarget(),{controller:{},register:async()=>{calls.worker++;return registration;},getRegistration:async()=>registration});
 const document=Object.assign(new EventTarget(),{visibilityState:'visible',querySelector:()=>({getBoundingClientRect:()=>({top:8,left:8,width:44,height:44}),click:()=>calls.menu++})});
 const scope:Record<string,unknown>={React,...React,ChevronUp,X,Menu,ArrowRight,window,document,navigator:{serviceWorker:worker},process:{env:{NODE_ENV:'test'}},URLSearchParams,cleanUpdateTour,readUpdateGuide,UPDATE_GUIDE_KEY,OPEN_UPDATE_GUIDE_EVENT,isDifferentBuild,
  isUpdateCopyLanguage,updateDescription,updateTourSources,cleanUpdateCopy,updateDateLabel,RELEASE_NOTES,styles:styleNames,
  translate:(language:ControlLanguage,key:string)=>controlT(language)(key),APP_LANGS:appLanguages,loadLocale:async()=>{},useRouter:()=>({push:(url:string)=>calls.routes.push(url)}),useLanguage:()=>({lang,t:controlT(lang),onboarded:false,completeOnboarding:(language:string)=>calls.completed.push(language)}),useAppLevel:()=>simple?'simple':'full',usePathname:()=>path,useAuth:()=>({user:options.kind==='discovery'?{uid:actor}:null,loading:false}),useSampleRole:()=>options.sample??false,
  recordTourOpening,dismissTourMenuTip,TOUR_INVITATION_LIMIT,announceOverlay:()=>{},localStorage:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v)},
  AppHeader:({title}:any)=>React.createElement('header',null,title),
  useUpdateCopy:(language:string,enabled:boolean)=>useUpdateCopy(language,enabled,options.loader??loadUpdateCopy),
  loadReleaseNotes:async()=>{calls.lazy++;return{visibleNotes,visibleUpdateTour};},
  fetch:async(url:string)=>{calls.fetch.push(url);const language=new URL(url,'http://fixture').searchParams.get('language')??'';let data;if(options.server)data=await options.server(language,url,calls.fetch.length);else{const notes=visibleNotes(),tour=visibleUpdateTour();data={sha:'qa-new-build',notes,tour,...(isUpdateCopyLanguage(language)?{copyLanguage:language,copy:cleanUpdateCopy(await loadUpdateCopy(language),[...notes,...updateTourSources(tour)],language,language)}:{})};}return{ok:true,json:async()=>data};},
 };
 scope.UpdateCopyText=compiled('components/UpdateCopyText.tsx','UpdateCopyText',scope);
 const kind=options.kind??'banner',file=kind==='banner'?'components/PWAUpdateNotifier.tsx':kind==='guide'?'components/UpdateGuide.tsx':kind==='history'?'app/updates/page.tsx':kind==='discovery'?'components/TourDiscovery.tsx':'components/Onboarding.tsx';
 const name=kind==='banner'?'PWAUpdateNotifier':kind==='guide'?'UpdateGuide':kind==='history'?'UpdatesPage':kind==='discovery'?'TourDiscoveryProvider':'Onboarding';const Component=compiled(file,name,scope);
 const props:any=kind==='banner'?{initialBuildSha:'qa-old-build'}:kind==='guide'?{loadedBuildSha:'qa-current-build'}:{};
 const panels:Array<{scrollTop:number}>=[];
 let renderer!:ReactTestRenderer;
 await act(async()=>{renderer=create(React.createElement(Component,props),{createNodeMock:element=>{const node={scrollTop:0,showModal:()=>{},close:()=>{}};if(element.type==='section')panels.push(node);return node;}});});
 return{renderer,session,storage,calls,timers,panels,
  text:()=>renderer.toJSON()?updateNodeText(renderer.root):'',
  async language(next:ControlLanguage){if(!options.loader)await loadUpdateCopy(next);lang=next;await act(async()=>renderer.update(React.createElement(Component,props)));},
  async path(next:string){path=next;await act(async()=>renderer.update(React.createElement(Component,props)));},
  async level(next:boolean){simple=next;await act(async()=>renderer.update(React.createElement(Component,props)));},
  async click(key:string){const name=controlT(lang)(key);await act(async()=>{const button=renderer.root.findAll(n=>(n.type==='button'||n.type==='a')&&(n.props['aria-label']===name||updateNodeText(n)===name))[0];if(!button)throw Error('Missing action '+key);await button.props.onClick();});},
  async actionLabel(label:string){await act(async()=>{const button=renderer.root.findAll(n=>(n.type==='button'||n.type==='a')&&n.props['aria-label']===label)[0];if(!button)throw Error('Missing labelled action '+label);await button.props.onClick();});},
  async buttonText(text:string){await act(async()=>{const button=renderer.root.findAll(n=>n.type==='button'&&updateNodeText(n)===text)[0];if(!button)throw Error('Missing action '+text);await button.props.onClick();});},
  async timer(ms:number){await act(async()=>{for(const[id,t]of [...timers])if(t.ms===ms){if(!t.interval)timers.delete(id);t.fn();}});},
  async event(event:string){await act(async()=>{window.dispatchEvent(new Event(event));});},
  async dispose(){await act(async()=>renderer.unmount());},
 };
}
export async function actualBuildInfo(language?:string){
 const scope={URL,visibleNotes,visibleUpdateTour,loadUpdateCopy,isUpdateCopyLanguage,cleanUpdateCopy,updateTourSources,RateLimiter,clientIp,
  process:{env:{VERCEL_GIT_COMMIT_REF:'qa-branch',VERCEL_GIT_COMMIT_SHA:'123456789abcdef'}},execSync:()=>{throw Error('Environment metadata should not fork git');},
  NextResponse:{json:(data:unknown,options:any)=>Response.json(data,options)},
 };
 const GET=compiled('app/api/build-info/route.ts','GET',scope);
 return GET(new Request('http://fixture/api/build-info'+(language?'?language='+encodeURIComponent(language):'')));
}
