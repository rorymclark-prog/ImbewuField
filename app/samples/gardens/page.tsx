'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import MenuButton from '@/components/MenuButton';
import BackButton from '@/components/BackButton';
import SettingsButton from '@/components/SettingsButton';
import SampleGardenVisual from '@/components/SampleGardenVisual';
import ReportComposer from '@/components/ReportComposer';
import { SAMPLE_GARDENS, SAMPLE_PARTICIPANTS, sampleSitePhoto, sampleSitePhotos } from '@/lib/sample-gardens';
import { samplePortrait } from '@/lib/sample-media';
import { SAMPLE_BRANDING } from '@/lib/sample-branding';
import styles from '@/components/SampleExperience.module.css';

export default function SampleGardensPage() {
  const [selected,setSelected] = useState<string|null>(null);
  const [filter,setFilter] = useState('All');
  const detail=useRef<HTMLElement>(null);
  const garden=SAMPLE_GARDENS.find(g=>g.id===selected);
  const kinds=['All',...new Set(SAMPLE_GARDENS.map(g=>g.kind??'Garden'))];
  const visible=SAMPLE_GARDENS.filter(g=>filter==='All'||g.kind===filter);
  useEffect(()=>{if(selected)detail.current?.scrollIntoView({block:'start',behavior:'auto'});},[selected]);
  return <main className={styles.page}><div className={styles.wrap}>
    <header className={styles.header}><MenuButton/><BackButton fallback="/samples"/><SettingsButton/></header>
    <h1>{SAMPLE_GARDENS.length} sample gardens</h1><p>Choose a garden to see its layout, people and example report. These are fictional examples; opening them does not change your live project.</p>
    {garden&&<section ref={detail} className={styles.card} aria-label="Selected sample garden">
      <div className={styles.actions}><button onClick={()=>setSelected(null)}>← All gardens</button><label>Change garden<select value={garden.id} onChange={e=>setSelected(e.target.value)}>{SAMPLE_GARDENS.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label></div>
      <h2 aria-live="polite">{garden.name}</h2><p>{garden.town} · {garden.kind} · {Math.round(garden.areaM2??0).toLocaleString()} m² illustrative area</p>
      <SampleGardenVisual key={garden.id} name={garden.name} kind={garden.kind} variant={garden.id} initial="aerial"/>
      <div className={styles.grid} style={{marginTop:20}}>{[['Site area',garden.areaM2 ?? 0],['Vegetable beds',garden.production.vegetableM2],['Staple plots',garden.production.stapleM2]].map(([label,value])=><section className={styles.card} key={label}><h3>{label}</h3><strong>{Number(value).toLocaleString()} m²</strong></section>)}</div><p>Fictional planted areas exclude buildings, paths, tree areas and unused space. Photos illustrate the setting; they do not measure the land.</p>
      <h2 style={{marginTop:24}}>Example participants</h2><p>Fictional adults · {garden.language}-speaking sample group. Portraits may repeat across examples.</p>
      <div className={styles.grid}>{(SAMPLE_PARTICIPANTS[garden.language??'isiZulu']??[]).map(name=><figure key={name} style={{display:'flex',alignItems:'center',gap:14}}><img data-photo-preview src={samplePortrait(name)} alt={`Fictional participant ${name}`} width={80} height={80} style={{borderRadius:'50%',objectFit:'cover'}}/><figcaption>{name}</figcaption></figure>)}</div>
      <ReportComposer key={`report-${garden.id}`} sample photos={sampleSitePhotos(garden.id)} photosByDefault photoHeading="Fictional garden site reference" title={`${garden.name} — example report`} branding={{...SAMPLE_BRANDING,garden:{...SAMPLE_BRANDING.garden,label:garden.name}}} sections={[
        {title:'Garden',lines:[garden.name,`${garden.kind} · ${garden.town}`,`Illustrative site area: ${Math.round(garden.areaM2??0)} m²`, `Planted vegetable beds: ${garden.production.vegetableM2} m²; staple plots: ${garden.production.stapleM2} m²`, `Example group language: ${garden.language}`]},
        {title:'Fictional programme figures',lines:[`${garden.farmers} participants in the example register`,`${garden.produceKg} kg example produce`,`${garden.training}% example training progress`, `Example supervisor: ${garden.facilitator}`]},
        {title:'About this sample',lines:['All figures and people are fictional. The diagram is not a measured planting design. The site photo is AI-generated for this fictional garden type and setting; it is not field evidence. This overview is not a site assessment, soil test or bill of quantities.']},
      ]}/>
      <p><Link href="/samples/farm">Open the separate editable Ubhejane farm example</Link></p>
    </section>}
    <label>Garden type<select value={filter} onChange={e=>setFilter(e.target.value)}>{kinds.map(k=><option key={k}>{k}</option>)}</select></label>
    <p>{visible.length} gardens shown</p><div className={styles.grid}>{visible.map(g=><button key={g.id} className={styles.card} onClick={()=>setSelected(g.id)} style={{display:'block',textAlign:'left',borderRadius:18,margin:0}} aria-label={`Open ${g.name}`}>
      <img src={sampleSitePhoto(g.id)} alt="" loading="lazy" style={{width:'100%',aspectRatio:'3/2',objectFit:'cover',borderRadius:12}}/><h2 style={{marginTop:12}}>{g.name}</h2><p>{g.kind} · {g.town}</p><span>Open garden →</span>
    </button>)}</div>
  </div></main>;
}
