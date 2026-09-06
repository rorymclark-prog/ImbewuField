'use client';
import { useState } from 'react';
import { sampleGardenImage } from '@/lib/sample-garden-layout';

/** Illustrative canvas only: never georeferenced or written into a farmer's design. */
export default function SampleGardenVisual({ name = 'Demonstration garden', initial = 'design', kind = 'Community garden', variant = name }: { name?: string; initial?: 'design' | 'aerial'; kind?: string; variant?: string }) {
  const [view, setView] = useState(initial);
  return <section style={{ background:'#eef2e7', padding:12, height:'100%', overflow:'auto' }} aria-label={`Fictional garden visual: ${name}`}>
    <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginBottom:10 }}><strong style={{ flex:1, color:'#234d35' }}>{name}</strong>{(['design','aerial'] as const).map(v=><button key={v} type="button" aria-pressed={view===v} onClick={()=>setView(v)} style={{ minHeight:44, padding:'10px 14px', borderRadius:20, border:'1px solid #9bad9b', background:view===v?'#214d35':'#fff', color:view===v?'#fff':'#214d35', fontSize:14 }}>{v==='design'?'Garden layout':'Shared reference photo'}</button>)}</div>
    <img data-photo-preview src={view==='design'?sampleGardenImage(kind,variant):'/demo/aerial.webp'} alt={view==='design'?`Fictional ${kind.toLowerCase()} layout for ${name}. Not a measured site plan.`:'Shared AI-generated reference photo. This does not depict the selected garden.'} style={{ display:'block', width:'100%', maxWidth:780, margin:'auto', borderRadius:16 }} />
    <p style={{ fontSize:14, color:'#3f533e', marginTop:10 }}>{view==='design'?`${kind} · ${name}. Tap the layout to enlarge. Fictional diagram; not an agronomic recommendation.`:'This reference photo is reused across examples. It is not satellite imagery of this garden.'}</p>
  </section>;
}
