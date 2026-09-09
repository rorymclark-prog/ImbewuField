import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fieldDeviceStore as store } from '../lib/field-device-store';
import { createFieldClient } from '../lib/field-api-core';

test('IndexedDB commits photographs and nested signature points before reporting success',async()=>{
  const row={key:'idb-a|write|1',scope:'idb-a',kind:'write' as const,value:{photo:'data:image/png;base64,AAA',signature:[[[10,20],[30,40]]]}};
  await store.change(row.key,()=>row);
  assert.deepEqual(await store.get(row.key),row);
  assert.equal((await store.all('idb-b')).length,0);
});
test('a rejected transaction leaves the original record intact',async()=>{
  const row={key:'idb-a|write|2',scope:'idb-a',kind:'write' as const,value:{notes:'Keep this evidence'}};
  await store.change(row.key,()=>row);
  await assert.rejects(store.change(row.key,()=>{throw Error('No storage');}),/No storage/);
  assert.deepEqual(await store.get(row.key),row);
});
test('actual IndexedDB transactions let only one simultaneous client claim a queued upload',async()=>{
  let online=false,calls=0,release!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;});
  const client=()=>createFieldClient({store,scope:'idb-concurrent',assertCurrent:()=>{},online:()=>online,send:async()=>{calls++;await gate;return {saved:true,updatedAt:'v2'};}});
  await client().request('/api/field-teams?org=g',{action:'visit',id:'v',notes:'Test',photos:[]});online=true;
  const first=client().sync(),second=client().sync();
  // Wait until the first transport has reached its gate; no browser/time assumption.
  while(calls===0)await new Promise(resolve=>setTimeout(resolve,1));
  release();await Promise.all([first,second]);assert.equal(calls,1);assert.equal((await client().writes()).length,0);
});
test('a fresh client can restore a queued training register from IndexedDB and later send it',async()=>{
  let online=false;
  const client=()=>createFieldClient({store,scope:'idb-restart',assertCurrent:()=>{},online:()=>online,send:async(_url,body)=>body?{saved:true,updatedAt:'v2'}:{sessions:[]}});
  online=true;await client().request('/api/programme-evidence?org=g');online=false;
  const session={id:'s',title:'Offline training',attendance:[{present:true,signature:{strokes:[[[1,1],[2,2]]]}}],photos:[{image:'proof',caption:'Group'}]};
  await client().request('/api/programme-evidence?org=g',{action:'session',session});
  assert.deepEqual((await client().request('/api/programme-evidence?org=g')).sessions[0].attendance,session.attendance);
  online=true;await client().sync();online=false;
  const photos=await client().request('/api/programme-evidence?org=g&mode=photos&id=s');assert.deepEqual(photos.photos,session.photos);
});
