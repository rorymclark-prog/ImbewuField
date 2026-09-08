'use client';
import { useRef, useState } from 'react';
import type { AttendanceSignature } from '@/lib/programme-evidence';

export function SignatureImage({ value, name }: { value: AttendanceSignature; name: string }) {
  return <svg viewBox="0 0 1000 320" role="img" aria-label={`Attendance signature of ${name}`} style={{width:'100%',maxWidth:320,height:90,background:'white'}}>
    {value.strokes.map((stroke,i)=><polyline key={i} points={stroke.map(([x,y])=>`${x},${y*.32}`).join(' ')} fill="none" stroke="#183427" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>)}
  </svg>;
}
export default function TrainingSignature({name,value,onChange}:{name:string;value?:AttendanceSignature;onChange:(signature?:AttendanceSignature)=>void}) {
  const [editing,setEditing]=useState(false),[strokes,setStrokes]=useState<[number,number][][]>([]),[notice,setNotice]=useState('');
  const drawing=useRef(false),points=useRef<[number,number][]>([]);
  const point=(e:React.PointerEvent<SVGSVGElement>):[number,number]=>{const r=e.currentTarget.getBoundingClientRect();return [Math.round(Math.max(0,Math.min(1000,(e.clientX-r.left)/r.width*1000))),Math.round(Math.max(0,Math.min(1000,(e.clientY-r.top)/r.height*1000)))];};
  function finish(){if(!drawing.current)return;drawing.current=false;points.current=[];}
  return <div>
    {value&&<><SignatureImage value={value} name={name}/><p style={{margin:0,fontSize:13}}>Signed {value.signedAt.slice(0,10)}</p></>}
    {!editing?<button type="button" onClick={()=>{setStrokes([]);setNotice('');setEditing(true);}}>{value?'Sign again':'Add signature'}</button>:<div style={{padding:12,border:'1px solid #789582',borderRadius:12,background:'#f5f8f5'}}>
      <p><strong>{name}</strong> — sign below with a finger or pen.</p>
      <svg viewBox="0 0 1000 320" preserveAspectRatio="none" aria-label={`Sign attendance for ${name}`} role="img" style={{width:'100%',height:140,touchAction:'none',background:'white',border:'1px solid #789582',borderRadius:8}}
        onPointerDown={e=>{if(strokes.length>=40)return; e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);drawing.current=true;points.current=[point(e)];setStrokes(s=>[...s,points.current]);}}
        onPointerMove={e=>{if(!drawing.current)return;const p=point(e),last=points.current.at(-1)!;if(Math.hypot(p[0]-last[0],p[1]-last[1])<5)return;if(strokes.reduce((n,s)=>n+s.length,0)>=800){setNotice('Signature space is full. Keep it or clear and sign again.');return;}points.current=[...points.current,p];setStrokes(s=>[...s.slice(0,-1),points.current]);}}
        onPointerUp={finish} onPointerCancel={finish}>
        {strokes.map((s,i)=><polyline key={i} points={s.map(([x,y])=>`${x},${y*.32}`).join(' ')} fill="none" stroke="#183427" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>)}
      </svg>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:8}}><button type="button" disabled={!strokes.some(s=>s.length>1)} onClick={()=>{onChange({strokes:strokes.filter(s=>s.length>1),signedAt:new Date().toISOString()});setEditing(false);}}>Use signature</button><button type="button" onClick={()=>{setStrokes([]);setNotice('');}}>Clear drawing</button><button type="button" onClick={()=>setEditing(false)}>Cancel</button></div>
      {notice&&<p role="status">{notice}</p>}
    </div>}
    {value&&!editing&&<button type="button" onClick={()=>onChange(undefined)}>Clear signature</button>}
  </div>;
}
