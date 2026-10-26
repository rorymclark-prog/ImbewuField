import * as React from'react';import{act,create,type ReactTestRenderer}from'react-test-renderer';
import{compileActualComponent}from'./account-ui-renderer.ts';import{controlT,type ControlLanguage}from'./control-icon-renderers.ts';
import{keepsDocumentTitleOwner,resolvePageTitle}from'../lib/page-titles.ts';
export async function actualPageTitle(initial:ControlLanguage='zu',title='Home — ImbewuField',path='/home'){
 let lang=initial,pathname=path,current=title,t=controlT(lang),renderer!:ReactTestRenderer;
 const observers:any[]=[],pending=new Set<any>(),calls={writes:[]as string[],callbacks:0};
 const document={head:{},get title(){return current;},set title(value:string){current=value;calls.writes.push(value);notify('childList');}};
 function notify(kind:'childList'|'characterData'){for(const o of observers)if(o.active&&o.options[kind])pending.add(o);}
 class Observer{active=true;fn:()=>void;options:any={};constructor(fn:()=>void){this.fn=fn;observers.push(this);}observe(_target:any,options:any){this.options=options;}disconnect(){this.active=false;pending.delete(this);}}
 const scope={React,...React,document,MutationObserver:Observer,keepsDocumentTitleOwner,resolvePageTitle,useLanguage:()=>({lang,t}),usePathname:()=>pathname};
 const Component=compileActualComponent('components/LocalizedPageTitle.tsx','LocalizedPageTitle',scope);
 async function flush(){await act(async()=>{let loops=0;while(pending.size){if(++loops>20)throw Error('Title observer recursively writes its own output');for(const o of [...pending]){pending.delete(o);if(o.active){calls.callbacks++;o.fn();}}}});}
 await act(async()=>{renderer=create(React.createElement(Component));});await flush();
 return{calls,observers,title:()=>current,
  async language(next:ControlLanguage,ready=true){lang=next;t=controlT(ready?lang:'en');await act(async()=>renderer.update(React.createElement(Component)));await flush();},
  async route(next:string){pathname=next;await act(async()=>renderer.update(React.createElement(Component)));await flush();},
  async metadata(value:string,kind:'childList'|'characterData'='childList'){current=value;notify(kind);await flush();},
  async dispose(){await act(async()=>renderer.unmount());},
 };
}
