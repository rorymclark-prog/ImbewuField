'use client';
import { useState } from 'react';
import { useLanguage } from '@/lib/i18n-context';
import { programmeReportText } from '@/lib/programme-report-copy';
import { sampleSitePhoto } from '@/lib/sample-gardens';
import { sampleGardenImage } from '@/lib/sample-garden-layout';

/** Illustrative canvas only: never georeferenced or written into a farmer's design. */
export default function SampleGardenVisual({ name, initial = 'design', kind = 'Community garden', variant }: { name?: string; initial?: 'design' | 'aerial'; kind?: string; variant?: string }) {
  const { lang } = useLanguage();
  const ui = (source:string,values:Record<string,string|number>={}) => programmeReportText(source,lang,values);
  const sourceName=name ?? 'Demonstration garden';
  const displayName=name ?? ui('Demonstration garden');
  const identity=variant ?? sourceName;
  const kindLabel=ui(kind);
  const photo = sampleSitePhoto(identity);
  const [view, setView] = useState(initial);
  return <section style={{ background:'#eef2e7', padding:12, height:'100%', overflow:'auto' }} aria-label={ui('Garden visual: {name}',{name:displayName})}>
    <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginBottom:10 }}><strong style={{ flex:1, color:'#234d35' }}>{displayName}</strong>{(['design','aerial'] as const).map(v=><button key={v} type="button" aria-pressed={view===v} onClick={()=>setView(v)} style={{ minHeight:44, padding:'10px 14px', borderRadius:20, border:'1px solid #9bad9b', background:view===v?'#214d35':'#fff', color:view===v?'#fff':'#214d35', fontSize:14 }}>{ui(v==='design'?'Garden layout':'Site photo')}</button>)}</div>
    <img data-photo-preview src={view==='design'?sampleGardenImage(kind,identity,lang):(photo ?? '/demo/aerial.webp')} alt={view==='design'?ui('Schematic {kind} layout for {name}. Not a measured site plan.',{kind:lang==='en'?kind.toLowerCase():kindLabel,name:displayName}):ui('AI-generated site reference for {name}. Not field evidence.',{name:displayName})} style={{ display:'block', width:'100%', maxWidth:780, margin:'auto', borderRadius:16 }} />
    <p style={{ fontSize:14, color:'#3f533e', marginTop:10 }}>{view==='design'?ui('{kind} · {name}. Tap the layout to enlarge. Schematic layout; not to scale.',{kind:kindLabel,name:displayName}):ui('AI-generated reference for {name}. Tap to enlarge. Illustrative setting, not satellite imagery or a measured site plan.',{name:displayName})}</p>
  </section>;
}
