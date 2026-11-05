import assert from 'node:assert/strict';
import test, { beforeEach, afterEach, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { act, create, type ReactTestRenderer, type ReactTestInstance } from 'react-test-renderer';
import ts from 'typescript';
import type { InvoiceBookSource } from '../components/invoice/useInvoiceBookSource.ts';
import type { InvoiceBookRead, SavedInvoice } from '../lib/invoices.ts';
import type { SalesLog } from '../lib/db/types.ts';

class MemoryStorage {
 rows=new Map<string,string>();writes:string[]=[];afterSet:((key:string)=>void)|null=null;
 getItem(key:string){return this.rows.get(key)??null;}
 setItem(key:string,value:string){this.rows.set(key,value);this.writes.push(key);this.afterSet?.(key);}
 removeItem(key:string){this.rows.delete(key);}
}
class Locks {
 held=new Set<string>(); pause=false; waiting:Array<()=>void>=[];
 async request<T>(name:string,_options:unknown,callback:(lock:unknown|null)=>T|PromiseLike<T>):Promise<T>{
  if(this.pause){this.pause=false;await new Promise<void>(resolve=>this.waiting.push(resolve));}
  if(this.held.has(name))return callback(null);
  this.held.add(name);try{return await callback({name});}finally{this.held.delete(name);}
 }
 resume(){this.waiting.shift()?.();}
}
const prior=new Map(['window','localStorage','sessionStorage','navigator','document','__invoiceQuickProbe','IS_REACT_ACT_ENVIRONMENT'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
const probe={owner:'actor-a' as string|null,auth:{user:{uid:'actor-a'} as {uid:string}|null,loading:false},listeners:new Set<(user:{uid:string}|null)=>void>(),sources:[] as InvoiceBookSource[],reads:0,calls:[] as Array<{row:Partial<SalesLog>;source:InvoiceBookRead|undefined}>,syncs:0,gate:null as Promise<void>|null,pushes:[] as string[],saved:0,costs:0,edits:0};
Object.assign(globalThis,{__invoiceQuickProbe:probe,IS_REACT_ACT_ENVIRONMENT:true});
const url=(path:string)=>new URL('../'+path,import.meta.url).href;
const hookUrl=url('components/invoice/useInvoiceBookSource.ts'),providerUrl=url('components/InvoiceStorageStatus.tsx'),invoiceUrl=url('lib/invoices.ts');
const data=(source:string)=>({shortCircuit:true,url:'data:text/javascript,'+encodeURIComponent(source)});
const auth=data('export const useAuth=()=>globalThis.__invoiceQuickProbe.auth;');
const firebase=data('const p=globalThis.__invoiceQuickProbe;export const isBackendConfigured=()=>true;export const getFirebase=()=>({auth:{get currentUser(){return p.owner?{uid:p.owner}:null;}}});');
const observer=data('export const onAuthStateChanged=(auth,callback)=>{const p=globalThis.__invoiceQuickProbe;p.listeners.add(callback);callback(auth.currentUser);return()=>p.listeners.delete(callback);};');
const invoices=data(`import * as real from ${JSON.stringify(invoiceUrl)};export * from ${JSON.stringify(invoiceUrl)};export const readInvoiceBook=()=>{globalThis.__invoiceQuickProbe.reads++;return real.readInvoiceBook();};`);
const hooks=registerHooks({resolve(specifier,context,next){
 if([hookUrl,providerUrl].includes(context.parentURL??'')&&specifier==='@/lib/auth')return auth;
 if(context.parentURL===hookUrl&&specifier==='@/lib/invoices')return invoices;
 if(context.parentURL===hookUrl&&specifier==='@/components/InvoiceStorageStatus')return {shortCircuit:true,url:providerUrl};
 if(context.parentURL?.endsWith('/lib/length-unit-preference.ts')&&specifier==='firebase/auth')return observer;
 if((context.parentURL?.endsWith('/lib/account-local-storage.ts')||context.parentURL?.endsWith('/lib/length-unit-preference.ts'))&&specifier==='./firebase/init')return firebase;
 return next(specifier,context);
},load(target,context,next){
 if(target===hookUrl||target===providerUrl)return {shortCircuit:true,format:'module',source:ts.transpileModule(readFileSync(new URL(target),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText};
 return next(target,context);
}});
const model=await import('../lib/invoices.ts');
const storage=await import('../lib/invoice-storage.ts');
const account=await import('../lib/account-local-storage.ts');
const {useInvoiceBookSource}=await import('../components/invoice/useInvoiceBookSource.ts');
const {default:Provider,InvoiceStorageNotice}=await import('../components/InvoiceStorageStatus.tsx');
const {saveSaleInvoice}=await import('../lib/sale-invoice.ts');
const records=await import('../lib/farm-records.ts');
const {parseDecimalInput}=await import('../lib/decimal-input.ts');
const {UserFacingError,userFacingMessage}=await import('../lib/user-facing-error.ts');
const sampling=await import('../lib/sample-mode.ts');
let local:MemoryStorage,session:MemoryStorage,events:EventTarget,locks:Locks;
const mounted=new Set<ReactTestRenderer>();
const text=(node:ReactTestInstance|string):string=>typeof node==='string'?node:node.children.map(child=>text(child as ReactTestInstance|string)).join('');
function tracked(options?:{enabled?:boolean}){const value=useInvoiceBookSource(options);probe.sources.push(value);return value;}
function latest(){const value=probe.sources.at(-1);assert.ok(value);return value;}
function changeOwner(owner:string){
 probe.owner=owner;probe.auth.user={uid:owner};account.bindMountedAccountLocalStorageUid(owner);
 for(const callback of [...probe.listeners])callback({uid:owner});
}
const icon=()=>React.createElement('i');
const boundary=({children}:{children:React.ReactNode})=>React.createElement('div',null,children);
const quantity=({quantity,onQuantityChange}:{quantity:string;onQuantityChange:(value:string)=>void})=>React.createElement('input',{'data-quantity':true,value:quantity,onChange:(event:{target:{value:string}})=>onQuantityChange(event.target.value)});
const scope:Record<string,unknown>={React,...React,...records,parseDecimalInput,userFacingMessage,UserFacingError,
 useInvoiceBookSource:tracked,InvoiceStorageNotice,invoiceBookIsCurrent:model.invoiceBookIsCurrent,
 useRouter:()=>({push:(path:string)=>probe.pushes.push(path)}),useLanguage:()=>({lang:'en'}),useRecordsT:()=>({lang:'en',t:(key:string)=>key}),translate:(_lang:string,key:string)=>key,
 recordsUi:(_lang:string,en:string)=>en,recordsFill:(_lang:string,en:string)=>en,recordsPaired:(_lang:string,en:string)=>en,
 recordsText:(_lang:string,en:string)=>en,recordsInstruction:(_lang:string,en:string)=>en,recordsMessage:(_lang:string,en:string)=>en,
 activeAccountUid:account.activeAccountUid,isSampleMode:sampling.isSampleMode,
 expenseReceiptScope:()=>({}),receiptScopeIsCurrent:()=>true,EXPENSE_RECEIPT_ACCEPT:'.jpg,.png',
 saveExpenseWithReceipt:async({saveExpense}:{saveExpense:()=>Promise<void>})=>saveExpense(),addExpense:async()=>{probe.costs++;},updateExpense:async()=>{probe.edits++;},updateSale:async()=>{probe.edits++;},
 addSandboxExpense:()=>{probe.costs++;},updateSandboxExpense:()=>{probe.edits++;},updateSandboxSale:()=>{probe.edits++;},
 WriteTimeoutError:class extends Error{},loadCropPriceOverrides:()=>({}),priceFor:()=>null,
 CropSelect:({value,onChange}:{value:string;onChange:(value:string,key:null)=>void})=>React.createElement('input',{'data-crop':true,value,onChange:(event:{target:{value:string}})=>onChange(event.target.value,null)}),
 RecordQuantityFields:quantity,Card:boundary,SectionLabel:boundary,FieldLabel:boundary,Input:(props:Record<string,unknown>)=>React.createElement('input',props),
 SubmitBtn:({loading,children}:{loading:boolean;children:React.ReactNode})=>React.createElement('button',{type:'submit',disabled:loading},children),
 Link:({children,href}:{children:React.ReactNode;href:string})=>React.createElement('a',{href},children),
 addSale:async(row:Partial<SalesLog>,source?:InvoiceBookRead)=>{
  probe.calls.push({row,source});
  return saveSaleInvoice(row,async()=>{probe.syncs++;if(probe.gate)await probe.gate;},source);
 },
};
for(const name of ['Star','Camera','X','Plus','Receipt','Eye','FileText','Download','Sprout','Loader2','Sparkles','Upload'])scope[name]=icon;
// Only local form declarations are compiled. Auth, real invoice storage/model,
// actual source hook and saveSaleInvoice all execute. Crop/photo controls and
// cloud transport remain bounded framework boundaries, not replacement writers.
function form(path:string,extra:string[]=[]){
 const source=readFileSync(new URL('../'+path,import.meta.url),'utf8'),tree=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const code=tree.statements.filter(node=>ts.isFunctionDeclaration(node)?(node.name?.text==='LogSaleForm'||extra.includes(node.name?.text??'')):ts.isVariableStatement(node)&&node.declarationList.declarations.some(d=>ts.isIdentifier(d.name)&&extra.includes(d.name.text))).map(node=>node.getText(tree)).join('\n');
 return new Function('scope',`with(scope){${ts.transpileModule(code+'\nreturn LogSaleForm;',{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2022}}).outputText}}`)(scope);
}
const RecordsForm=form('app/records/page.tsx',['emptyForm','categoryLabel','EXPENSE_CATEGORIES']);
const MyForm=form('components/MyRecords.tsx');
function mount(kind:'hook'|'records'|'mine'='hook',provider=true,extra:Record<string,unknown>={}){
 let renderer!:ReactTestRenderer;
 function Probe(){tracked();return null;}
 const child=()=>kind==='hook'?React.createElement(Probe):React.createElement(kind==='records'?RecordsForm:MyForm,{onSaved:()=>{probe.saved++;},editing:null,onCancelEdit:()=>{},alwaysOpen:true,online:true,lockKind:'in',...extra});
 const tree=()=>provider?React.createElement(Provider,{children:child()}):child();
 act(()=>{renderer=create(tree());});mounted.add(renderer);
 return {renderer,update(){act(()=>renderer.update(tree()));},
  async flush(){await act(async()=>{await Promise.resolve();await new Promise<void>(resolve=>setImmediate(resolve));});},
  event(name:string){act(()=>{events.dispatchEvent(new Event(name));});},
  dispose(){if(mounted.delete(renderer))act(()=>renderer.unmount());},
  text:()=>text(renderer.root),submit:()=>renderer.root.findByType('form').props.onSubmit,
  async fill(){await act(async()=>{
   const inputs=renderer.root.findAllByType('input');
   const crop=inputs.find(input=>input.props['data-crop']||input.props.id?.endsWith('-crop'));assert.ok(crop);crop.props.onChange({target:{value:'Line A'}});
   const qty=inputs.find(input=>input.props['data-quantity']);assert.ok(qty);qty.props.onChange({target:{value:'2'}});
   const amount=inputs.find(input=>input.props.id?.endsWith('-price')||input.props.placeholder==='0.00');assert.ok(amount);amount.props.onChange({target:{value:'20'}});
  });},
  async invoke(handler?: (event:{preventDefault:()=>void})=>unknown){await act(async()=>{await (handler??renderer.root.findByType('form').props.onSubmit)({preventDefault(){}});});},
 };
}
beforeEach(()=>{
 storage.releaseAllDocumentInvoiceLeases();probe.owner='actor-a';probe.auth={user:{uid:'actor-a'},loading:false};probe.sources=[];probe.reads=0;probe.calls=[];probe.syncs=0;probe.gate=null;probe.pushes=[];probe.saved=0;probe.costs=0;probe.edits=0;
 local=new MemoryStorage();session=new MemoryStorage();events=new EventTarget();locks=new Locks();
 const window=Object.assign(events,{localStorage:local,sessionStorage:session});
 for(const [key,value] of Object.entries({window,localStorage:local,sessionStorage:session,navigator:{locks},document:{createElement:()=>({click(){}})}}))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 account.bindMountedAccountLocalStorageUid(probe.owner);
});
afterEach(async()=>{
 for(const renderer of mounted)act(()=>renderer.unmount());mounted.clear();storage.releaseAllDocumentInvoiceLeases();
 while(locks.waiting.length)locks.resume();await new Promise<void>(resolve=>setImmediate(resolve));
 assert.equal(probe.listeners.size,0,'all native actor observers must be released after genuine model/helper/hook cleanup');
});
after(()=>{hooks.deregister();account.bindMountedAccountLocalStorageUid(null);for(const [key,descriptor]of prior){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}});
const entry=(id:string):SavedInvoice=>({id,no:44,billTo:'Buyer',currencyCode:'ZAR',items:[{desc:'Line A',qty:2,unit:'kg',price:10}],total:20,dateISO:'2026-11-04T12:00:00Z',status:'paid',paidAt:'2026-11-04T12:00:00Z'});

test('first provider readiness captures one genuine source; passive own writes hold it without silently adopting another raw book',async()=>{
 locks.pause=true;const ui=mount();await ui.flush();assert.equal(probe.reads,0);assert.equal(latest().ready,false);
 locks.resume();await ui.flush();const original=latest();assert.equal(original.ready,true);assert.ok(original.book);assert.equal(probe.reads,1);
 let result!:ReturnType<typeof model.saveInvoice>;act(()=>{result=model.saveInvoice(entry('written'),original.book!);});assert.equal(result.status,'written');await ui.flush();
 assert.equal(model.invoiceBookIsCurrent(original.book),false);assert.equal(original.isActorCurrent(),true);
 assert.equal(latest().ready,false);assert.equal(latest().book,original.book);assert.equal(probe.reads,1);
 assert.equal(original.adopt({...original.book}),false,'a copied display is not a private book admission');
 assert.ok(result.status==='written');const writtenBook=result.book;
 act(()=>{assert.equal(original.adopt(writtenBook),true);});await ui.flush();assert.equal(latest().ready,true);assert.equal(probe.reads,1);
});

for(const transition of ['account-ABA','sample-ABA']as const)test(`${transition} invalidates retained actor/reload/adopt closures and fresh reading requires an explicit live action`,async()=>{
 const ui=mount();await ui.flush();const original=latest();assert.ok(original.book);
 if(transition==='account-ABA')for(const uid of ['actor-b','actor-a']){act(()=>changeOwner(uid));ui.update();await ui.flush();}
 else{session.setItem('imbewu_sample_mode','1');ui.event('imbewu-sample-mode-changed');await ui.flush();session.removeItem('imbewu_sample_mode');ui.event('imbewu-sample-mode-changed');await ui.flush();}
 assert.equal(original.isActorCurrent(),false);assert.equal(original.reload(),null);assert.equal(original.adopt(original.book),false);
 assert.equal(latest().ready,false);assert.equal(probe.reads,1,'no passive adoption after the workspace changes');
 act(()=>{assert.ok(latest().reload());});await ui.flush();assert.equal(latest().ready,true);
 assert.equal(original.isActorCurrent(),false);assert.equal(original.reload(),null,'a later reload never resurrects old actor authority');
});

test('without provider readiness and when explicitly disabled no book is read or writable source invented',async()=>{
 const ui=mount('mine',false);await ui.flush();await ui.fill();await ui.invoke();
 assert.equal(probe.reads,0);assert.equal(probe.calls.length,0);assert.equal(latest().ready,false);
 const other=mount('records',true,{lockKind:'out'});await other.flush();assert.equal(probe.reads,0);
 assert.equal(other.renderer.root.findAllByProps({'aria-label':'Invoice storage'}).length,0);
 assert.equal(other.renderer.root.findByType('fieldset').props.disabled,false,'cost controls are not blocked by the invoice source');
});

for(const kind of ['records','mine']as const){
 test(`${kind} quick form passes the original rendered admission, then completes an actual own save without demanding its obsolete pre-write raw token`,async()=>{
  const ui=mount(kind);await ui.flush();const original=latest();assert.ok(original.book);await ui.fill();await ui.invoke();await ui.flush();
  assert.equal(probe.calls.length,1);assert.equal(probe.calls[0].source,original.book);assert.equal(probe.saved,1);assert.equal(probe.pushes.length,1);
  assert.equal(model.invoiceBookIsCurrent(original.book),false);assert.equal(original.isActorCurrent(),true);assert.equal(latest().ready,true);
  assert.equal(latest().book?.invoices[0].currencyCode,'ZAR');
 });
 test(`${kind} a cloud-sync rejection completes from one real pending local receipt, clears the form and cannot duplicate the sale`,async()=>{
  let rejectCloud!:(error:Error)=>void;
  probe.gate=new Promise<void>((_resolve,reject)=>{rejectCloud=reject;});
  const ui=mount(kind);await ui.flush();await ui.fill();
  const retained=ui.submit();let first!:Promise<unknown>,duplicate!:Promise<unknown>;
  act(()=>{first=retained({preventDefault(){}});duplicate=retained({preventDefault(){}});});await ui.flush();
  assert.equal(probe.calls.length,1);assert.equal(probe.syncs,1);
  const beforeRejection=model.loadInvoices();
  assert.equal(beforeRejection.length,1,'the cloud failure must occur after the real protected local write');
  const invoice=beforeRejection[0];
  assert.equal(invoice.salesSyncPending,true);assert.equal(invoice.status,'paid');assert.equal(invoice.currencyCode,'ZAR');
  assert.equal(invoice.total,20);assert.equal(invoice.items[0].qty,2);
  assert.equal(probe.saved,0);assert.deepEqual(probe.pushes,[],'the form still awaits completion, not an invented early receipt');
  rejectCloud(new Error('synthetic cloud acknowledgement rejected'));
  await act(async()=>{await Promise.all([first,duplicate]);});await ui.flush();
  assert.equal(probe.saved,1);assert.deepEqual(probe.pushes,[`/invoice?view=${encodeURIComponent(invoice.id)}`]);
  assert.equal(latest().ready,true,'the current actor can inspect the actual written invoice after its ordinary reload');
  const afterRejection=model.loadInvoices();
  assert.equal(afterRejection.length,1);assert.deepEqual(afterRejection[0],invoice,'a failed cloud acknowledgement cannot roll back or falsely clear pending payment evidence');
  const fields=ui.renderer.root.findAllByType('input');
  const crop=fields.find(input=>input.props['data-crop']||input.props.id?.endsWith('-crop'));
  const quantity=fields.find(input=>input.props['data-quantity']);
  const amount=fields.find(input=>input.props.id?.endsWith('-price')||input.props.placeholder==='0.00');
  assert.ok(crop&&quantity&&amount);
  for(const input of [crop,quantity,amount])assert.equal(input.props.value,'','receipt completion clears every entered sale value');
  assert.doesNotMatch(ui.text(),/sale could not be confirmed|Failed to save|could not be confirmed/);
  const writes=[...local.writes];
  await ui.invoke(retained);await ui.invoke();await ui.flush();
  assert.equal(probe.calls.length,1);assert.equal(probe.syncs,1);assert.equal(probe.saved,1);assert.equal(probe.pushes.length,1);
  assert.deepEqual(local.writes,writes);assert.deepEqual(model.loadInvoices(),afterRejection);
 });
 for(const transition of ['account-ABA','sample-ABA']as const)test(`${kind} retained submit after ${transition} cannot adopt the refreshed form's source`,async()=>{
  const ui=mount(kind);await ui.flush();await ui.fill();const retained=ui.submit();
  if(transition==='account-ABA'){act(()=>changeOwner('actor-b'));ui.update();await ui.flush();act(()=>changeOwner('actor-a'));ui.update();await ui.flush();}
  else{session.setItem('imbewu_sample_mode','1');ui.event('imbewu-sample-mode-changed');await ui.flush();session.removeItem('imbewu_sample_mode');ui.event('imbewu-sample-mode-changed');await ui.flush();}
  act(()=>{assert.ok(latest().reload());});await ui.flush();await ui.invoke(retained);await ui.flush();
  assert.equal(probe.calls.length,0);assert.equal(probe.saved,0);assert.deepEqual(probe.pushes,[]);
 });
 test(`${kind} changed actor during actual cloud await suppresses callbacks/navigation without clearing into another workspace`,async()=>{
  let resume!:()=>void;probe.gate=new Promise<void>(resolve=>{resume=resolve;});const ui=mount(kind);await ui.flush();await ui.fill();
  let pending!:Promise<unknown>;act(()=>{pending=ui.submit()({preventDefault(){}});});await ui.flush();assert.equal(probe.syncs,1);
  act(()=>changeOwner('actor-b'));ui.update();await ui.flush();act(()=>changeOwner('actor-a'));ui.update();await ui.flush();
  resume();await act(async()=>{await pending;});await ui.flush();assert.equal(probe.saved,0);assert.deepEqual(probe.pushes,[]);assert.equal(latest().ready,false);
 });
 test(`${kind} an actual uncertain storage effect retains its error and never auto reloads or creates a duplicate invoice`,async()=>{
  const ui=mount(kind);await ui.flush();await ui.fill();const reads=probe.reads;
  local.afterSet=()=>{throw Error('synthetic performed-but-unconfirmed effect');};await ui.invoke();local.afterSet=null;await ui.flush();
  assert.equal(probe.calls.length,1);assert.equal(probe.saved,0);assert.deepEqual(probe.pushes,[]);assert.equal(probe.reads,reads);
  assert.match(ui.text(),/may already be saved|could not be confirmed/);
  assert.equal(latest().ready,false);const writes=[...local.writes];await ui.invoke();await ui.flush();
  assert.equal(probe.calls.length,1);assert.deepEqual(local.writes,writes);
 });
}


test('explicit reload returns its genuine fresh read synchronously without changing the preceding render snapshot',async()=>{
 const ui=mount();await ui.flush();const original=latest(),old=original.book;assert.ok(old);
 let returned:InvoiceBookRead|null=null;
 act(()=>{returned=original.reload();assert.ok(returned);assert.equal(model.invoiceBookIsCurrent(returned),true);assert.equal(original.book,old);});
 await ui.flush();assert.equal(latest().book,returned);assert.notEqual(returned,old);assert.equal(model.invoiceBookIsCurrent(old),false);
});

for(const kind of ['records','mine']as const)test(`${kind} uses an immediate pending guard before React can publish the loading state`,async()=>{
 let resume!:()=>void;probe.gate=new Promise<void>(resolve=>{resume=resolve;});const ui=mount(kind);await ui.flush();await ui.fill();
 const retained=ui.submit();let first!:Promise<unknown>,second!:Promise<unknown>;
 act(()=>{first=retained({preventDefault(){}});second=retained({preventDefault(){}});});await ui.flush();
 assert.equal(probe.calls.length,1);assert.equal(probe.syncs,1);
 resume();await act(async()=>{await Promise.all([first,second]);});await ui.flush();
 assert.equal(probe.calls.length,1);assert.equal(probe.saved,1);assert.equal(probe.pushes.length,1);
});
