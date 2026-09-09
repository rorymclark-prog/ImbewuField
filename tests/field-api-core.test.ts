import test from 'node:test';
import assert from 'node:assert/strict';
import { createFieldClient } from '../lib/field-api-core';
import type { DeviceStore, DeviceRow } from '../lib/field-device-store';
import { fieldUrl,writeIdentity,overlayFieldWrites,type FieldWrite } from '../lib/field-request-model';

class MemoryStore implements DeviceStore {
  rows = new Map<string,DeviceRow>();
  fail = false;
  async get(key:string){return structuredClone(this.rows.get(key));}
  async all(scope:string){return structuredClone([...this.rows.values()].filter(r=>r.scope===scope));}
  async change(key:string,update:(r:DeviceRow|undefined)=>DeviceRow|undefined){if(this.fail)throw Error('Quota exceeded');const next=update(structuredClone(this.rows.get(key)));if(next)this.rows.set(key,structuredClone(next));else this.rows.delete(key);return structuredClone(next);}
}
function setup(store=new MemoryStore()) {
  let online=true,owner='a',sent:any[]=[],handler:(url:string,body?:any)=>Promise<any>=async(_url,body)=>body?{saved:true,updatedAt:'server-time'}:{visits:[],teams:[],sessions:[],assessments:[]};
  const client=(scope='a')=>createFieldClient({store,scope,assertCurrent:()=>{if(owner!==scope)throw Error('Account changed');},online:()=>online,send:async(url,body)=>{sent.push({url,body:structuredClone(body)});return handler(url,body);}});
  return {store,client,setOnline:(v:boolean)=>{online=v;},setOwner:(v:string)=>{owner=v;},setHandler:(fn:typeof handler)=>{handler=fn;},sent};
}
const url='/api/field-teams?org=farm';
const visit=(notes='Saved observations')=>({action:'visit',id:'a_visit1',mentorId:'a',farmerId:'farmer',date:'2026-09-09',notes,photos:[{image:'data:image/png;base64,AAA',caption:'Seedlings'}],expectedUpdatedAt:''});

test('a closed app can reopen the saved workspace, visit and photo before reconnecting',async()=>{
  const h=setup();await h.client().request(url);h.setOnline(false);
  const saved=await h.client().request(url,visit());assert.equal(saved.queued,true);assert.equal(saved.saved,false);
  const reopened=await h.client().request(url);assert.equal(reopened.visits.length,1);assert.equal(reopened.visits[0].notes,'Saved observations');assert.equal(reopened._device.pending,true);
  const photo=await h.client().request(url+'&mode=photos&id=a_visit1');assert.equal(photo.photos[0].caption,'Seedlings');
  assert.equal(h.sent.length,1,'offline saving never asks for an auth token or connection');
});

test('resaving a waiting record retains its original revision and creates one queue item',async()=>{
  const h=setup();h.setOnline(false);await h.client().request(url,{...visit(),expectedUpdatedAt:'v1'});await h.client().request(url,{...visit('Revised observations'),expectedUpdatedAt:'local-time'});
  const rows=await h.client().writes();assert.equal(rows.length,1);assert.equal(rows[0].value.body.notes,'Revised observations');assert.equal(rows[0].value.body.expectedUpdatedAt,'v1');
});

test('successful reconnection removes the queue only after storing the acknowledged record',async()=>{
  const h=setup();await h.client().request(url);h.setOnline(false);await h.client().request(url,visit());h.setOnline(true);await h.client().sync();
  assert.equal((await h.client().writes()).length,0);h.setOnline(false);
  const reopened=await h.client().request(url);assert.equal(reopened.visits[0].updatedAt,'server-time');assert.equal(reopened._device.pending,false);
});

test('a lost response retries exactly the same operation ID instead of a new submission',async()=>{
  const h=setup();h.setOnline(false);await h.client().request(url,visit());h.setOnline(true);
  h.setHandler(async()=>{throw Error('Connection lost after server save');});await h.client().sync();
  const first=h.sent[0].body.clientOperationId;assert.equal((await h.client().writes()).length,1);
  h.setHandler(async()=>({saved:true,updatedAt:'v2'}));await h.client().sync();
  assert.equal(h.sent[1].body.clientOperationId,first);assert.equal((await h.client().writes()).length,0);
});

test('conflicts and denied permissions retain evidence for review and do not repeatedly retry',async()=>{
  for(const status of [400,403,409]){
    const h=setup();h.setOnline(false);await h.client().request(url,visit());h.setOnline(true);h.setHandler(async()=>{throw Object.assign(Error('Needs review'),{status});});
    await h.client().sync();await h.client().sync();const row=(await h.client().writes())[0];assert.equal(row.value.state,'review');assert.equal(row.value.body.photos.length,1);assert.equal(h.sent.length,1);
    await assert.rejects(h.client().request(url,visit('Overwrite attempt')),/needs review/);
  }
});

test('storage refusal never claims the entry was saved and never sends it behind the error',async()=>{
  const h=setup();h.store.fail=true;await assert.rejects(h.client().request(url,visit()),/Could not save on this device/);assert.equal(h.sent.length,0);assert.equal(h.store.rows.size,0);
});

test('other accounts cannot read, replay or see this account’s queue',async()=>{
  const h=setup();await h.client().request(url);h.setOnline(false);await h.client().request(url,visit());h.setOwner('b');
  await assert.rejects(h.client().request(url),/Account changed/);await assert.rejects(h.client('b').request(url),/not saved on this device/);assert.equal((await h.client('b').writes()).length,0);
});

test('account switching during a save preserves the original queue without reporting success to the new account',async()=>{
  const h=setup();h.setHandler(async()=>{h.setOwner('b');return {saved:true};});await assert.rejects(h.client().request(url,visit()),/Account changed/);
  assert.equal(h.store.rows.size,1);assert.equal([...h.store.rows.values()][0].scope,'a');assert.equal((await h.client('b').writes()).length,0);
});

test('an explicit access refusal removes old cached reads instead of displaying them as offline fallback',async()=>{
  const h=setup();await h.client().request(url);h.setHandler(async()=>{throw Object.assign(Error('Access removed'),{status:403});});await assert.rejects(h.client().request(url),/Access removed/);h.setOnline(false);await assert.rejects(h.client().request(url),/not saved/);
});

test('fresh sign-in, sharing and team administration are not silently queued',async()=>{
  const h=setup();h.setOnline(false);await assert.rejects(h.client().request(url,{action:'team',team:{}}),/needs a connection/);await assert.rejects(h.client().request('/api/assessments',{action:'sharing',funderAccess:true}),/needs a connection/);
  assert.equal(writeIdentity('/api/programme-evidence',{action:'branding'}),null);assert.throws(()=>fieldUrl('https://other.test/api/field-teams'));
});

test('training signatures, feedback and pictures round-trip without changing their evidence',async()=>{
  const h=setup();const training='/api/programme-evidence?org=farm';await h.client().request(training);h.setOnline(false);
  const session={id:'training1',title:'Water harvesting',attendance:[{id:'farmer',present:true,signature:{signedAt:'2026-09-09',strokes:[[[1,2],[3,4]]]}}],feedback:[{answers:{useful:'5'},consent:true}],photos:[{image:'data:image/png;base64,AAA',caption:'Training group',shared:false}],published:false};
  await h.client().request(training,{action:'session',session,expectedUpdatedAt:''});const data=await h.client().request(training);
  assert.deepEqual(data.sessions[0].attendance,session.attendance);assert.deepEqual(data.sessions[0].feedback,session.feedback);assert.deepEqual(data.sessions[0].photos,session.photos);assert.equal(data.sessions[0].presentCount,1);
});

test('a sending lease prevents a second tab from sending the same queued entry',async()=>{
  const h=setup();h.setOnline(false);await h.client().request(url,visit());h.setOnline(true);
  let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});h.setHandler(async()=>{await gate;return {saved:true};});
  const first=h.client().sync();await new Promise(resolve=>setTimeout(resolve,0));await h.client().sync();assert.equal(h.sent.length,1);
  await assert.rejects(h.client().request(url,visit('During upload')),/is sending/);release();await first;
});

test('local overlays never mix organisations or expose a private session through another API',()=>{
  const w={url:'/api/programme-evidence?org=a',body:{action:'session',session:{id:'s',attendance:[],photos:[],title:'Private'}},createdAt:Date.now(),operationId:'test-operation',label:'Private',state:'waiting',leaseUntil:0} as FieldWrite;
  assert.deepEqual(overlayFieldWrites('/api/programme-evidence?org=b',{sessions:[]},[w]),{sessions:[]});
  assert.deepEqual(overlayFieldWrites('/api/network/farmers?org=a',{sessions:[]},[w]),{sessions:[]});
});

import { fieldDataReportNote } from '../lib/field-request-model';
import { OFFLINE_MAP_STYLE } from '../lib/map-offline-style';
test('exports distinguish downloaded information and pending observations from confirmed records',()=>{
  assert.equal(fieldDataReportNote({_device:{cached:false,pending:false}}),null);
  assert.match(fieldDataReportNote({_device:{cached:true,savedAt:1}})!,/saved on this device/);
  assert.match(fieldDataReportNote({visits:[{_pending:true}]})!,/not yet confirmed/);
});
test('the offline drawing canvas has no network style, tile, sprite or font dependency',()=>{
  assert.deepEqual(OFFLINE_MAP_STYLE.sources,{});
  assert.equal(OFFLINE_MAP_STYLE.sprite,undefined);assert.equal(OFFLINE_MAP_STYLE.glyphs,undefined);
  assert.equal(OFFLINE_MAP_STYLE.layers[0].type,'background');
});
