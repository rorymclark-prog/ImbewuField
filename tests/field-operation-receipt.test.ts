import test from 'node:test';
import assert from 'node:assert/strict';
import { fieldOperationReceipt,readFieldReceipt,writeFieldReceipt } from '../lib/field-operation-receipt';
import type { Firestore,Transaction } from 'firebase-admin/firestore';
const db={collection:(name:string)=>({doc:(id:string)=>({path:`${name}/${id}`})})} as unknown as Firestore;
const body={clientOperationId:'operation-id-123456789',action:'visit',id:'v',notes:'original'};

test('acknowledgement receipts separate actors, organisations, actions and payloads',async()=>{
  const first=fieldOperationReceipt(db,'a','org','visit',body)!;
  for(const [actor,org,lane] of [['b','org','visit'],['a','other','visit'],['a','org','training']])assert.notEqual(fieldOperationReceipt(db,actor,org,lane,body)!.ref.path,first.ref.path);
  assert.equal(fieldOperationReceipt(db,'a','org','visit',{action:'visit'}),null);
  assert.throws(()=>fieldOperationReceipt(db,'a','org','visit',{clientOperationId:'../bad'}));
  const writes=new Map<string,any>();
  const tx={get:async(ref:any)=>({exists:writes.has(ref.path),data:()=>writes.get(ref.path)}),create:(ref:any,data:any)=>{if(writes.has(ref.path))throw Error('Duplicate');writes.set(ref.path,data);}} as unknown as Transaction;
  assert.equal(await readFieldReceipt(tx,first),null);writeFieldReceipt(tx,first,'v1');
  assert.deepEqual(await readFieldReceipt(tx,first),{updatedAt:'v1'});
  await assert.rejects(readFieldReceipt(tx,fieldOperationReceipt(db,'a','org','visit',{...body,notes:'different'})!),/different content/);
  assert.equal(writes.size,1);
});
