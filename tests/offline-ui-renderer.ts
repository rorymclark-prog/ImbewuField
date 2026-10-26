import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as React from 'react';
import { act, create, type ReactTestRenderer, type ReactTestInstance } from 'react-test-renderer';
import { ChevronDown, Wifi, WifiOff } from 'lucide-react';
import { controlT, type ControlLanguage } from './control-icon-renderers.ts';
import { FIELD_PAGE_NAMES } from '../lib/field-page-downloads.ts';
import { FIELD_CHANGED, FIELD_SYNCED } from '../lib/field-request-model.ts';
import { fieldScope, type FieldIdentity } from '../lib/field-session.ts';
import { canSeeNavLink } from '../lib/role-access.ts';
import type { DeviceRow } from '../lib/field-device-store.ts';

export const offlineQaIdentity:FieldIdentity={uid:'qa-offline-user',org:'qa-offline-org',role:'mentor'};
export function offlineQaRows():DeviceRow[]{
  const scope=fieldScope(offlineQaIdentity);
  return [
    ...(['waiting','sending','review']as const).map((state,index)=>({key:'qa-write-'+index,scope,kind:'write'as const,value:{url:'/api/field-teams?org=qa-offline-org',body:{action:'visit',id:'qa-visit-'+index,notes:'Original saved text',photos:[]},operationId:'qa-operation-'+index,label:index===0?'Visit · 2026-10-21':index===1?'Training register':'My own unchanged garden name',createdAt:0,state,leaseUntil:state==='sending'?Date.now()+60000:0,...(state==='review'?{error:'The server did not confirm this save.'}:{})}})),
    {key:'qa-cache',scope,kind:'cache',value:{url:'/api/field-teams',data:{visits:[]}}},
    {key:'qa-other-owner',scope:'other-owner',kind:'write',value:{label:'PRIVATE OTHER OWNER',state:'waiting'}},
  ];
}
export function offlineNodeText(node:ReactTestInstance):string{return node.children.map(c=>typeof c==='string'?c:offlineNodeText(c)).join('');}
const compiled=new Map<string,string>();
function component(path:string,scope:Record<string,unknown>,name:string):React.ComponentType{
  let code=compiled.get(path);
  if(!code){const tree=ts.createSourceFile(path,readFileSync(new URL('../'+path,import.meta.url),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);code=ts.transpileModule(tree.statements.filter(s=>!ts.isImportDeclaration(s)).map(s=>s.getText(tree)).join('\n').replace('export default ',''),{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2022}}).outputText;compiled.set(path,code);}
  return new Function('scope',`with(scope){${code};return ${name};}`)(scope);
}
export interface OfflineQaOptions {
  rows?:DeviceRow[];simple?:boolean;sample?:boolean;guest?:boolean;online?:boolean;badge?:boolean;
  downloadPages?:(prepare:boolean,paths:string[],status:(p:any)=>void)=>Promise<void>;
  sync?:(rows:Map<string,DeviceRow>)=>Promise<void>;
  readError?:string;api?:(path:string)=>Promise<any>;
}
export async function actualOfflineUi(initialLanguage:ControlLanguage,options:OfflineQaOptions={}){
  let lang=initialLanguage,simple=options.simple??false,sample=options.sample??false,identity:FieldIdentity|null=options.guest?null:{...offlineQaIdentity};
  const values=new Map((options.rows??offlineQaRows()).map(r=>[r.key,structuredClone(r)]));
  const window=new EventTarget(),navigator={onLine:options.online??true,storage:{persist:async()=>true}};
  const changes:string[]=[],downloads:Array<{blob:Blob;name:string}>=[],apiCalls:string[]=[],pageCalls:boolean[]=[];
  let downloadBlob:Blob;
  const scope:Record<string,unknown>={React,...React,ChevronDown,Wifi,WifiOff,window,navigator,FIELD_PAGE_NAMES,FIELD_CHANGED,FIELD_SYNCED,fieldScope,canSeeNavLink,
    Link:({children,...props}:any)=>React.createElement('a',props,children),AppHeader:({title}:any)=>React.createElement('header',null,title),TabBar:()=>null,
    useLanguage:()=>({lang,t:controlT(lang)}),translate:(language:ControlLanguage,key:string)=>controlT(language)(key),useAppLevel:()=>simple?'simple':'full',
    useAuth:()=>({user:identity?{uid:identity.uid}:null,profile:identity?{org_id:identity.org,role:identity.role}:null,role:identity?.role??null}),fieldIdentity:()=>identity,isSampleMode:()=>sample,
    fieldDeviceStore:{all:async()=>{if(options.readError)throw Error(options.readError);return [...values.values()];},change:async(key:string,update:(r:DeviceRow|undefined)=>DeviceRow|undefined)=>{changes.push(key);const next=update(values.get(key));if(next)values.set(key,next);else values.delete(key);return next;}},
    currentFieldClient:()=>({writes:async()=>[...values.values()].filter(r=>r.kind==='write'&&identity&&r.scope===fieldScope(identity)),sync:async()=>{await options.sync?.(values);}}),
    fieldApi:async(path:string)=>{apiCalls.push(path);if(options.api)return options.api(path);return path==='/api/network/orgs'?{orgs:[{id:'qa-offline-org'}]}:{visits:[],sessions:[]};},
    fieldPageDownloads:async(prepare:boolean,paths:string[],status:(p:any)=>void)=>{pageCalls.push(prepare);if(options.downloadPages)return options.downloadPages(prepare,paths,status);for(const path of paths)status({path,ready:true});},
    document:{createElement:()=>{const anchor={download:'',href:'',click:()=>downloads.push({name:anchor.download,blob:downloadBlob})};return anchor;}},
    URL:{createObjectURL:(blob:Blob)=>{downloadBlob=blob;return'blob:offline-qa';},revokeObjectURL:()=>{}},
  };
  const Component=component(options.badge?'components/FieldSyncBadge.tsx':'app/offline/page.tsx',scope,options.badge?'FieldSyncBadge':'OfflinePage');
  let renderer!:ReactTestRenderer;
  await act(async()=>{renderer=create(React.createElement(Component));});
  async function update(){await act(async()=>{renderer.update(React.createElement(Component));});}
  return{renderer,values,changes,downloads,apiCalls,pageCalls,
    text:()=>renderer.toJSON()?offlineNodeText(renderer.root):'',
    button:(key:string)=>renderer.root.findByProps({'aria-label':controlT(lang)(key)}),
    async click(key:string,index=0){await act(async()=>{renderer.root.findAllByProps({'aria-label':controlT(lang)(key)})[index].props.onClick();});},
    async language(next:ControlLanguage){lang=next;await update();},
    async level(next:boolean){simple=next;await update();},
    async online(next:boolean){navigator.onLine=next;await act(async()=>{window.dispatchEvent(new Event(next?'online':'offline'));});},
    async account(next:FieldIdentity|null){identity=next;await update();},
    async event(){await act(async()=>{window.dispatchEvent(new Event(FIELD_CHANGED));});},
    async dispose(){await act(async()=>renderer.unmount());},
  };
}
