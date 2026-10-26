import fs from 'node:fs';
import ts from 'typescript';
import * as React from 'react';
import * as Icons from 'lucide-react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { controlT, type ControlLanguage } from './control-icon-renderers.ts';
import { accountText } from '../lib/account-copy.ts';
import { sampleWorkspaceText } from '../lib/sample-tour-localization.ts';
import { sampleChoicesForAccount } from '../lib/sample-tour.ts';
import { accessibleSourceLabel } from '../lib/accessible-label.ts';
import { canSeeNavLink } from '../lib/role-access.ts';
import { visibleRoleTabs } from '../lib/role-navigation.ts';
import { canSeeWorkspaceLink } from '../lib/role-navigation.ts';
const cache = new Map<string, string>();
function component(path:string,name:string,scope:Record<string,unknown>):React.ComponentType<any> {
 let code=cache.get(path);
 if(!code){const tree=ts.createSourceFile(path,fs.readFileSync(new URL('../'+path,import.meta.url),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);code=ts.transpileModule(tree.statements.filter(n=>!ts.isImportDeclaration(n)).map(n=>n.getText(tree)).join('\n').replace(/^export\s+default\s+/gm,'').replace(/^export\s+/gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None,jsx:ts.JsxEmit.React}}).outputText;cache.set(path,code);}
 return new Function('scope',`with(scope){${code};return ${name};}`)(scope);
}
export const practiceNodeText=(n:ReactTestInstance):string=>n.children.map(c=>typeof c==='string'?c:practiceNodeText(c)).join('');
export interface PracticeUiOptions {
 kind?:'chooser'|'menu'|'banner'|'account'|'nav';role?:string|null;user?:{uid:string;displayName?:string|null;email?:string|null}|null;
 loading?:boolean;backend?:boolean;sample?:boolean;navigationRole?:string;readFails?:boolean;deferRole?:boolean;previewFails?:boolean;storageFails?:boolean;path?:string;simple?:boolean;hasMenu?:boolean;
}
/** Real component/effects, with isolated auth/storage/navigation boundaries; no backend writes. */
export async function actualPracticeUi(initial:ControlLanguage,options:PracticeUiOptions={}) {
 let lang=initial,loading=options.loading??false,user=options.user??null,authRole=options.role??null;
 let hasMenu=options.hasMenu??false,observer:(()=>void)|undefined;
 const calls={routes:[]as string[],previews:[]as string[],reads:[]as string[],exits:0,resets:0,reloads:0,signOut:0,bodyModes:[]as any[]};
 const pending:Array<{uid:string;resolve:(role:any)=>void;reject:(error:any)=>void}>=[];
 const storage=new Map<string,string>();
 const sessionStorage={getItem:(key:string)=>{if(options.storageFails)throw Error('storage unavailable');return storage.get(key)??null;},setItem:(key:string,value:string)=>{if(options.storageFails)throw Error('storage unavailable');storage.set(key,value);}};
 const window=Object.assign(new EventTarget(),{location:{href:'',reload:()=>calls.reloads++}});
 const document={body:{style:{overflow:''},classList:{toggle:(...args:any[])=>calls.bodyModes.push(args),remove:(...args:any[])=>calls.bodyModes.push(args)}},querySelector:()=>hasMenu?{}:null};
 const scope:Record<string,unknown>={React,...React,...Icons,window,document,sessionStorage,
  MutationObserver:class{constructor(callback:()=>void){observer=callback;}observe(){}disconnect(){observer=undefined;}},
  accountText,sampleWorkspaceText,sampleChoicesForAccount,visibleRoleTabs,accessibleSourceLabel,canSeeNavLink,canSeeWorkspaceLink,SAMPLE_MODE_EVENT:'qa-sample',
  APP_LANGS:[{code:'zu',label:'isiZulu'},{code:'st',label:'Sesotho'},{code:'ts',label:'itsonga'},{code:'ve',label:'Tshivenda'}],
  translate:(language:ControlLanguage,key:string)=>controlT(language)(key),
  useLanguage:()=>({lang,t:controlT(lang),setLang:(next:ControlLanguage)=>{lang=next;renderer.update(React.createElement(Component));}}),
  useAuth:()=>({user,role:authRole,loading,signOutUser:()=>calls.signOut++}),isBackendConfigured:()=>options.backend??true,
  useRouter:()=>({push:(route:string)=>calls.routes.push(route)}),usePathname:()=>options.path??'/samples',
  useSampleRole:()=>options.sample?'farmer':null,isSampleMode:()=>!!options.sample,
  useRoleNavigation:()=>({accountRole:authRole,sample:!!options.sample,navigationRole:options.navigationRole??authRole??'farmer'}),useAppLevel:()=>options.simple?'simple':'full',communityEnabled:()=>true,
  readSampleChooserAccountRole:(uid:string)=>{calls.reads.push(uid);if(options.deferRole)return new Promise((resolve,reject)=>pending.push({uid,resolve,reject}));return options.readFails?Promise.reject(Error('role read unavailable')):Promise.resolve(authRole);},
  startRolePreview:(role:string)=>{calls.previews.push(role);return!options.previewFails;},enterSampleMode:()=>{calls.resets++;return!options.storageFails;},exitSampleMode:()=>calls.exits++,
  Link:({children,...props}:any)=>React.createElement('a',props,children),AppHeader:({title,backFallback}:any)=>React.createElement('header',{'data-back-fallback':backFallback},title),TabBar:()=>null,
  FieldSyncBadge:()=>null,ProductTourButton:()=>null,SettingsButton:()=>null,LessonLink:()=>null,RoleSwitcher:()=>null,styles:{},chooser:{},
 };
 scope.LanguageDraftNote=component('components/LanguageDraftNote.tsx','LanguageDraftNote',scope);
 scope.RoleSwitcher=component('components/RoleSwitcher.tsx','RoleSwitcher',scope);
 scope.NavDrawer=component('components/NavDrawer.tsx','NavDrawer',scope);
 const [path,name]=({chooser:['app/samples/page.tsx','SamplesPage'],menu:['components/MenuButton.tsx','MenuButton'],banner:['components/SampleModeBanner.tsx','SampleModeBanner'],account:['components/AccountButton.tsx','AccountButton'],nav:['components/NavDrawer.tsx','NavDrawer']}as const)[options.kind??'chooser'];
 const Actual=component(path,name,scope),Component=()=>React.createElement(Actual,options.kind==='nav'?{open:true,onClose:()=>{calls.exits++;}}:{});
 let renderer!:ReactTestRenderer;
 await act(async()=>{renderer=create(React.createElement(Component),{createNodeMock:()=>({inert:false})});});
 return {renderer,calls,document,window,pending,text:()=>renderer.toJSON()?practiceNodeText(renderer.root):'',
  async language(next:ControlLanguage){lang=next;await act(async()=>renderer.update(React.createElement(Component)));},
  async auth(next:{user?:PracticeUiOptions['user'];role?:string|null;loading?:boolean}){if('user'in next)user=next.user??null;if('role'in next)authRole=next.role??null;if('loading'in next)loading=next.loading!;await act(async()=>renderer.update(React.createElement(Component)));},
  async resolveRole(index:number,value:string|null,fail=false){await act(async()=>{if(fail)pending[index].reject(Error('read failed'));else pending[index].resolve(value);});},
  async choose(role:string){await act(async()=>renderer.root.findByProps({id:'sample-'+role}).findByType('button').props.onClick());},
  async click(text:string){await act(async()=>{const node=renderer.root.findAll(n=>n.type==='button'&&(practiceNodeText(n)===text||n.props['aria-label']===text))[0];if(!node)throw Error('Missing practice action '+text);await node.props.onClick();});},
  async menuPresent(value:boolean){hasMenu=value;await act(async()=>observer?.());},
  async dispose(){await act(async()=>renderer.unmount());},
 };
}
