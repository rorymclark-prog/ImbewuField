import * as React from'react';
import * as Icons from'lucide-react';
import{act,create,type ReactTestRenderer}from'react-test-renderer';
import{compileActualComponent,actualAppLanguages}from'./account-ui-renderer.ts';
import{controlT,type ControlLanguage}from'./control-icon-renderers.ts';
import{accountNodeText}from'./account-ui-renderer.ts';
export async function actualPhotoViewer(initial:ControlLanguage='en'){
 let lang=initial,t=controlT(lang),renderer!:ReactTestRenderer;
 const calls={show:0,close:0,focus:0,observers:[]as any[],listeners:[]as any[]};
 class Photo {
  alt='';src='https://qa.invalid/photo.svg';currentSrc='';isConnected=true;tabIndex=-1;style:Record<string,string>={};attrs=new Map<string,string>([['data-photo-preview','']]);
  constructor(alt='',src?:string){this.alt=alt;if(src)this.src=src;}
  setAttribute(k:string,v:string){this.attrs.set(k,v);}hasAttribute(k:string){return this.attrs.has(k);}focus(){calls.focus++;}
 }
 class KeyEvent extends Event {key:string;constructor(key:string){super('keydown',{cancelable:true});this.key=key;}}
 const photos=[new Photo('QA {caption} $& farmer')],listeners=new Map<string,Set<(e:Event)=>void>>();
 const document={body:{},querySelectorAll:()=>photos.filter(p=>p.hasAttribute('data-photo-preview')),addEventListener:(name:string,fn:any,capture:boolean)=>{calls.listeners.push({name,capture});if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name)!.add(fn);},removeEventListener:(name:string,fn:any)=>listeners.get(name)?.delete(fn)};
 class Observer {active=true;fn:()=>void;constructor(fn:()=>void){this.fn=fn;calls.observers.push(this);}observe(){}disconnect(){this.active=false;}}
 const dialog={open:false,showModal(){this.open=true;calls.show++;},close(){this.open=false;calls.close++;renderer.root.findByType('dialog').props.onClose();}};
 const scope:any={React,...React,...Icons,document,MutationObserver:Observer,HTMLImageElement:Photo,KeyboardEvent:KeyEvent,URL,window:{location:{href:'https://qa.invalid/account'}},APP_LANGS:actualAppLanguages,useLanguage:()=>({lang,t,setLang:(next:ControlLanguage)=>{lang=next;t=controlT(lang);renderer.update(React.createElement(Component));}}),translate:(l:ControlLanguage,key:string)=>controlT(l)(key),styles:{viewer:'viewer',panel:'panel',imageArea:'imageArea',zoomed:'zoomed'}};
 scope.LanguageDraftNote=compileActualComponent('components/LanguageDraftNote.tsx','LanguageDraftNote',scope);
 const Component=compileActualComponent('components/PhotoViewer.tsx','PhotoViewer',scope);
 await act(async()=>{renderer=create(React.createElement(Component),{createNodeMock:element=>element.type==='dialog'?dialog:null});});
 return{renderer,calls,dialog,photos,Photo,listeners,text:()=>accountNodeText(renderer.root),
  async language(next:ControlLanguage){lang=next;t=controlT(lang);await act(async()=>renderer.update(React.createElement(Component)));},
  async fire(photo=photos[0],key?:string){const event=key===undefined?new Event('click',{cancelable:true}):new KeyEvent(key);Object.defineProperty(event,'target',{value:photo});await act(async()=>{for(const fn of listeners.get(event.type)??[])fn(event);});return event;},
  async mutate(){await act(async()=>{for(const o of calls.observers)if(o.active)o.fn();});},
  async button(label:string){await act(async()=>{const b=renderer.root.findAll(n=>n.type==='button'&&accountNodeText(n)===label)[0];if(!b)throw Error('No button '+label);b.props.onClick();});},
  async error(){await act(async()=>renderer.root.findByType('img').props.onError());},
  async backdrop(){await act(async()=>renderer.root.findByType('dialog').props.onClick({target:dialog}));},
  async closed(){await act(async()=>{dialog.open=false;renderer.root.findByType('dialog').props.onClose();});},
  async dispose(){await act(async()=>renderer.unmount());},
 };
}
