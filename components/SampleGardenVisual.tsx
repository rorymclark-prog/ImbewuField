'use client';
import { useState } from 'react';
import { sampleSitePhoto } from '@/lib/sample-gardens';
import { sampleGardenImage } from '@/lib/sample-garden-layout';
import { useLanguage } from '@/lib/i18n';
import { inlineText, inlineTemplate, isInlineDraftLang } from '@/lib/xh-inline';

/** Illustrative canvas only: never georeferenced or written into a farmer's design. */
export default function SampleGardenVisual({ name = 'Demonstration garden', initial = 'design', kind = 'Community garden', variant = name }: { name?: string; initial?: 'design' | 'aerial'; kind?: string; variant?: string }) {
  const { lang } = useLanguage();
  const photo = sampleSitePhoto(variant);
  const kindLabel = isInlineDraftLang(lang) ? inlineText(lang, kind) : kind;
  const [view, setView] = useState(initial);
  return <section style={{ background:'#eef2e7', padding:12, height:'100%', overflow:'auto' }} aria-label={inlineTemplate(lang, 'Garden visual: {name}', null, { name })}>
    <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginBottom:10 }}><strong style={{ flex:1, color:'#234d35' }}>{name}</strong>{(['design','aerial'] as const).map(v=><button key={v} type="button" aria-pressed={view===v} onClick={()=>setView(v)} style={{ minHeight:44, padding:'10px 14px', borderRadius:20, border:'1px solid #9bad9b', background:view===v?'#214d35':'#fff', color:view===v?'#fff':'#214d35', fontSize:14 }}>{v==='design'?inlineText(lang, 'Garden layout'):inlineText(lang, 'Site photo')}</button>)}</div>
    <img data-photo-preview src={view==='design'?sampleGardenImage(kind,variant):(photo ?? '/demo/aerial.webp')} alt={view==='design'?inlineTemplate(lang, 'Schematic {kind} layout for {name}. Not a measured site plan.', null, { kind: kindLabel.toLowerCase(), name }):inlineTemplate(lang, 'AI-generated site reference for {name}. Not field evidence.', null, { name })} style={{ display:'block', width:'100%', maxWidth:780, margin:'auto', borderRadius:16 }} />
    <p style={{ fontSize:14, color:'#3f533e', marginTop:10 }}>{view==='design'?inlineTemplate(lang, '{kind} · {name}. Tap the layout to enlarge. Schematic layout; not to scale.', null, { kind: kindLabel, name }):inlineTemplate(lang, 'AI-generated reference for {name}. Tap to enlarge. Illustrative setting, not satellite imagery or a measured site plan.', null, { name })}</p>
  </section>;
}
