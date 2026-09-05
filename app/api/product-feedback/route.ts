import { NextRequest } from 'next/server';
import { getApps, getApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { guardPaidApiRequest } from '@/lib/api-auth';
import { validFeedback } from '@/lib/product-feedback';

export const runtime='nodejs';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(req:NextRequest){
  try{
    const auth=await guardPaidApiRequest(req,'product-feedback');if(auth.response)return auth.response;
    if(!auth.uid)return json({error:'Sign in to send feedback to the developer.'},401);
    const text=await req.text();if(text.length>12000)return json({error:'Please shorten the report.'},413);
    const input=JSON.parse(text);if(!validFeedback(input))return json({error:'Add a title and at least ten characters of detail.'},400);
    const db=getFirestore(getApps().length?getApp():initializeApp());
    const profile=await db.collection('profiles').doc(auth.uid).get();
    const ref=db.collection('product_feedback').doc(`${auth.uid}_${input.id}`);
    // A network retry returns the original receipt; never creates duplicate tickets.
    await db.runTransaction(async tx=>{if((await tx.get(ref)).exists)return;
      tx.create(ref,{kind:input.kind,title:input.title.trim(),details:input.details.trim(),path:input.path,sample:input.sample,
        senderId:auth.uid,role:profile.data()?.role??null,orgId:profile.data()?.org_id??null,status:'new',createdAt:new Date().toISOString()});});
    return json({saved:true,reference:input.id});
  }catch(e){return json({error:e instanceof SyntaxError?'Invalid feedback.':'Could not confirm delivery. Your form is still here; retry or download a copy.'},e instanceof SyntaxError?400:503);}
}
export async function GET(req:NextRequest){
  try{
    const auth=await guardPaidApiRequest(req,'product-feedback');if(auth.response)return auth.response;
    if(!auth.uid)return json({error:'Sign in to view feedback.'},401);
    const db=getFirestore(getApps().length?getApp():initializeApp());
    const profile=await db.collection('profiles').doc(auth.uid).get();
    if(profile.data()?.role!=='admin')return json({error:'Only platform administrators can open the developer inbox.'},403);
    const rows=await db.collection('product_feedback').orderBy('createdAt','desc').limit(100).get();
    return json({tickets:rows.docs.map(d=>({id:d.id,...d.data()}))});
  }catch{return json({error:'Feedback inbox unavailable. Please try again.'},503);}
}
