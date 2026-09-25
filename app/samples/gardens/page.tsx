'use client';
import { numberLabel } from '@/lib/format-figures';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import MenuButton from '@/components/MenuButton';
import BackButton from '@/components/BackButton';
import SettingsButton from '@/components/SettingsButton';
import SampleGardenVisual from '@/components/SampleGardenVisual';
import ReportComposer from '@/components/ReportComposer';
import { sampleReportVisuals } from '@/lib/report-visuals';
import { SAMPLE_REPORT_DATE } from '@/lib/sample-garden-reports';
import { SAMPLE_GARDENS, SAMPLE_PARTICIPANTS, sampleSitePhoto, sampleSitePhotos } from '@/lib/sample-gardens';
import { sampleGardenReportSections, sampleGardenReportUrl } from '@/lib/sample-garden-reports';
import { samplePortrait } from '@/lib/sample-media';
import { SAMPLE_BRANDING } from '@/lib/sample-branding';
import { useLanguage } from '@/lib/i18n-context';
import styles from '@/components/SampleExperience.module.css';

export default function SampleGardensPage() {
  const { lang } = useLanguage();
  const ui = (english: string, isiZulu: string) => lang === 'zu' ? isiZulu : english;
  const kindLabel = (kind: string | undefined) => !kind ? '' : lang !== 'zu' ? kind : ({
    'Community garden': 'Ingadi yomphakathi',
    'Crèche garden': 'Ingadi yenkulisa',
    'School garden': 'Ingadi yesikole',
    'Homestead garden': 'Ingadi yasekhaya',
    'Commercial garden': 'Ingadi yezohwebo',
    'Community food forest': 'Ihlathi lokudla lomphakathi',
  }[kind] ?? kind);
  const [selected,setSelected] = useState<string|null>(null);
  const [filter,setFilter] = useState('All');
  const detail=useRef<HTMLElement>(null);
  const garden=SAMPLE_GARDENS.find(g=>g.id===selected);
  const kinds=['All',...new Set(SAMPLE_GARDENS.map(g=>g.kind??'Garden'))];
  const visible=SAMPLE_GARDENS.filter(g=>filter==='All'||g.kind===filter);
  useEffect(() => { const id = new URLSearchParams(window.location.search).get('garden'); if (id && SAMPLE_GARDENS.some(g => g.id === id)) setSelected(id); }, []);
  useEffect(()=>{if(selected)detail.current?.scrollIntoView({block:'start',behavior:'auto'});},[selected]);
  return <main className={styles.page}><div className={styles.wrap}>
    <header className={styles.header}><MenuButton/><BackButton fallback="/samples"/><SettingsButton/></header>
    <h1>{SAMPLE_GARDENS.length} {ui('gardens','izingadi')}</h1><p>{ui('Choose a garden to explore its layout, people and report.','Khetha ingadi ukuze uhlole ukuhleleka kwayo, abantu nombiko.')}</p>
    {garden&&<section ref={detail} className={styles.card} aria-label={ui('Selected garden','Ingadi ekhethiwe')}>
      <div className={styles.actions}><button onClick={()=>setSelected(null)}>← {ui('All gardens','Zonke izingadi')}</button><label>{ui('Change garden','Shintsha ingadi')}<select value={garden.id} onChange={e=>setSelected(e.target.value)}>{SAMPLE_GARDENS.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label></div>
      <h2 aria-live="polite">{garden.name}</h2><p>{garden.town} · {kindLabel(garden.kind)} · {numberLabel(Math.round(garden.areaM2??0))} m² {ui('illustrative area','indawo eyisibonelo')}</p>
      <SampleGardenVisual key={garden.id} name={garden.name} kind={garden.kind} variant={garden.id} initial="aerial"/>
      <div className={styles.grid} style={{marginTop:20}}>{[[ui('Site area','Indawo yengadi'),garden.areaM2 ?? 0],[ui('Vegetable beds','Imibhede yemifino'),garden.production.vegetableM2],[ui('Staple plots','Iziza zezitshalo eziyinhloko'),garden.production.stapleM2]].map(([label,value])=><section className={styles.card} key={label}><h3>{label}</h3><strong>{numberLabel(Number(value))} m²</strong></section>)}</div><p>{ui('Growing areas exclude buildings, paths, tree areas and unused space. Photos illustrate the setting; they do not measure the land.','Izindawo zokutshala azifaki izakhiwo, izindlela, izindawo zezihlahla noma umhlaba ongasetshenziswa. Izithombe zibonisa indawo kuphela; azilinganisi umhlaba.')}</p>
      <h2 style={{marginTop:24}}>{ui('Participants','Ababambiqhaza')}</h2><p>{ui(`${garden.language}-speaking group.`, `Iqembu elikhuluma ${garden.language}.`)}</p>
      <div className={styles.grid}>{(SAMPLE_PARTICIPANTS[garden.language??'isiZulu']??[]).map(name=><figure key={name} style={{display:'flex',alignItems:'center',gap:14}}><img data-photo-preview src={samplePortrait(name)} alt={ui(`Portrait illustration of ${name}`,`Umfanekiso ka-${name}`)} width={80} height={80} style={{borderRadius:'50%',objectFit:'cover'}}/><figcaption>{name}</figcaption></figure>)}</div>
      <div className={styles.actions}><a href={sampleGardenReportUrl(garden.id)} target="_blank" rel="noreferrer">{ui('Open completed report (PDF)','Vula umbiko ogcwalisiwe (PDF)')}</a><a href={sampleGardenReportUrl(garden.id)} download={`${garden.id}-tour-report.pdf`}>{ui('Download report','Landa umbiko')}</a></div>
      <p>{ui("The saved report includes this garden's site photograph, layout, assessment narrative, programme figures and next actions. Generate a new report below to create another copy.",'Umbiko ogciniwe uhlanganisa isithombe sendawo yale ngadi, ukuhleleka kwayo, umbhalo wokuhlola, izibalo zohlelo nezinyathelo ezilandelayo. Dala omunye umbiko ngezansi ukuze wenze enye ikhophi.')}</p>
      {lang === 'zu' && <p role="note" className={styles.notice}>Umbhalo wokuhlola nobufakazi obukulo mbiko kusagcinwe ngesiNgisi; akuzona iziyalezo zokulima eziqinisekisiwe ngesiZulu.</p>}
      <ReportComposer key={`report-${garden.id}`} sample visuals={sampleReportVisuals(garden)} reportDate={SAMPLE_REPORT_DATE} photos={[...sampleSitePhotos(garden.id), { image: `/demo/reports/${garden.id}-layout.png`, caption: `${garden.name} — schematic layout, not to scale` }]} photosByDefault photoHeading="Site reference and schematic layout" title={`${garden.name} — garden report`} branding={{...SAMPLE_BRANDING,garden:{...SAMPLE_BRANDING.garden,label:garden.name}}} sections={sampleGardenReportSections(garden)}/>
      <p><Link href="/samples/farm">{ui('Open the separate editable Ubhejane farm example','Vula isibonelo sepulazi lase-Ubhejane ongasihlela')}</Link></p>
    </section>}
    <label>{ui('Garden type','Uhlobo lwengadi')}<select value={filter} onChange={e=>setFilter(e.target.value)}>{kinds.map(k=><option key={k} value={k}>{k === 'All' ? ui('All','Zonke') : kindLabel(k)}</option>)}</select></label>
    <p>{visible.length} {ui('gardens shown','izingadi ezibonisiwe')}</p><div className={styles.grid}>{visible.map(g=><article key={g.id} className={styles.card}><button onClick={()=>setSelected(g.id)} style={{display:'block',textAlign:'left',borderRadius:18,margin:0}} aria-label={ui(`Open ${g.name}`,`Vula ${g.name}`)}>
      <img src={sampleSitePhoto(g.id)} alt="" loading="lazy" style={{width:'100%',aspectRatio:'3/2',objectFit:'cover',borderRadius:12}}/><h2 style={{marginTop:12}}>{g.name}</h2><p>{g.kind ? kindLabel(g.kind) : ''} · {g.town}</p><span>{ui('Open garden →','Vula ingadi →')}</span>
    </button><p><a href={sampleGardenReportUrl(g.id)} target="_blank" rel="noreferrer">{ui('Open completed report (PDF) →','Vula umbiko ogcwalisiwe (PDF) →')}</a></p></article>)}</div>
  </div></main>;
}
