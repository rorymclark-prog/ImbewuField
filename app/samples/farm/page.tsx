'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import MenuButton from '@/components/MenuButton';
import BackButton from '@/components/BackButton';
import SettingsButton from '@/components/SettingsButton';
import { useSampleRole } from '@/lib/use-role-navigation';
import { isSampleMode, enterSampleMode } from '@/lib/sample-mode';
import { sampleRead, sampleWrite } from '@/lib/sample-operations';
import { freshSampleFarmPack, SAMPLE_PHOTOS, sampleFarmSections, type SampleFarmPack } from '@/lib/sample-farm-pack';
import { prepareSampleFarm } from '@/lib/sample-farm-session';
import { buildProgrammePdf } from '@/lib/programme-report-pdf';
import { SAMPLE_BRANDING } from '@/lib/sample-branding';
import { resizeLogoForStorage } from '@/lib/invoice-logo';
import { deliverFile } from '@/lib/file-delivery';
import styles from '@/components/SampleExperience.module.css';

export default function SampleFarmPage() {
  const sample=useSampleRole(); const [pack,setPack]=useState<SampleFarmPack|null>(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{setPack(null);if(sample){try{prepareSampleFarm();setPack(sampleRead('farm-pack',freshSampleFarmPack));}catch(e){setMessage((e as Error).message);}}},[sample]);
  // Tour anchors arrive before this client-only evidence pack has mounted.
  // Wait for its first render, without moving the visitor again as they edit fields.
  const packReady = !!pack;
  useEffect(() => {
    if (!packReady) return;
    const id = window.location.hash.slice(1);
    if (id !== 'report' && id !== 'evidence') return;
    const frame = requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }));
    return () => cancelAnimationFrame(frame);
  }, [packReady]);
  function save(){if(!pack)return;try{sampleWrite('farm-pack',pack);setMessage('Saved in this sample only. Reload or reset discards these edits.');}catch(e){setMessage((e as Error).message);}}
  async function report(){if(!pack||busy)return;setBusy(true);setMessage('');try{
    if(!isSampleMode())throw Error('Reopen the sample before exporting.');
    const assessment=prepareSampleFarm(); sampleWrite('farm-pack',pack);
    const photos=[...await Promise.all(SAMPLE_PHOTOS.map(async p=>{const response=await fetch(p.src);if(!response.ok)throw Error('An example photo could not load. Try again when connected.');return {image:await resizeLogoForStorage(new File([await response.blob()],'sample.webp',{type:'image/webp'}),640),caption:p.caption};})),...(pack.photos??[])];
    if(!isSampleMode())return;
    const pdf=await buildProgrammePdf('Sample farm evidence pack',true,sampleFarmSections(pack,assessment),'full',SAMPLE_BRANDING,photos,'Illustrative garden and harvest images');
    if(!isSampleMode())return;
    await deliverFile(pdf.output('blob'),'ImbewuField-SAMPLE-Farm-Evidence.pdf','Fictional sample farm evidence');setMessage('Sample report prepared. Use your device’s save or share controls.');
  }catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
  return <main className={styles.page}><div className={styles.wrap}><header className={styles.header}><MenuButton/><BackButton fallback="/samples"/><SettingsButton/><Link href="/tour">15-minute tour</Link></header>
    <h1>One farm, from plan to evidence</h1><p className={styles.notice}>SAMPLE ONLY. Ubhejane’s real map location is used to demonstrate the tools. The design, people, household answers, soil values and finances are fictional. The generated pictures are not photographs of that site.</p>
    {!sample?<button className={styles.primary} onClick={()=>{if(!enterSampleMode())setMessage('Please allow session storage to open this sample.');}}>Open the editable sample farm</button>:pack&&<>
      <div className={styles.actions}><Link className={styles.button} href="/farmer">Saved place &amp; map</Link><Link className={`${styles.button} ${styles.primary}`} href="/design?lat=-27.72623&lon=31.96304">Edit design</Link><Link className={styles.button} href="/farmer?openSurvey=1">Edit site assessment</Link><Link className={styles.button} href="/facilitator/crops">Crop plan</Link><Link className={styles.button} href="/records">Harvest &amp; money</Link></div>
      <section id="evidence" className={styles.card}><h2>Illustrative site pictures</h2><div className={styles.grid}>{SAMPLE_PHOTOS.map(p=><figure key={p.src}><img data-photo-preview className={styles.photo} src={p.src} alt={p.caption}/><figcaption>{p.caption}</figcaption></figure>)}{pack.photos?.map((p,i)=><figure key={i}><img data-photo-preview className={styles.photo} src={p.image} alt={p.caption}/><figcaption>{p.caption}</figcaption><button disabled={busy} onClick={()=>setPack({...pack,photos:pack.photos?.filter((_,index)=>index!==i)})}>Remove added photo {i+1}</button></figure>)}</div><p>These example images are included in the report. No real site observation is inferred from them.</p><label>Add up to two of your own practice photos (sample only)<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy||(pack.photos?.length??0)>=2} onChange={e=>{const files=Array.from(e.target.files??[]).slice(0,2-(pack.photos?.length??0));e.target.value='';if(!files.length||!isSampleMode())return;setBusy(true);void Promise.all(files.map(async file=>({image:await resizeLogoForStorage(file,640),caption:'User-added practice photo — sample workspace, not verified site evidence.'}))).then(photos=>{if(isSampleMode())setPack(p=>p?{...p,photos:[...(p.photos??[]),...photos].slice(0,2)}:p);}).catch(e=>setMessage((e as Error).message)).finally(()=>setBusy(false));}}/></label><p>Use pictures you have permission to use. Press Save sample edits to keep them while you explore; reset or reload removes them.</p></section>
      <form onSubmit={e=>{e.preventDefault();save();}}><fieldset disabled={busy} style={{minWidth:0}}>
        <section className={styles.card}><h2>Site visit</h2><label>Example coordinator<input required maxLength={150} value={pack.coordinator} onChange={e=>setPack({...pack,coordinator:e.target.value})}/></label><label>Visit date<input required type="date" value={pack.visitDate} onChange={e=>setPack({...pack,visitDate:e.target.value})}/></label><label>Mentor notes and follow-up<textarea required maxLength={2000} value={pack.mentorNotes} onChange={e=>setPack({...pack,mentorNotes:e.target.value})}/></label></section>
        <section className={styles.card}><h2>Completed household interview · fictional</h2><p>This example household is linked to the community-garden demonstration. It does not represent a real family or all garden participants.</p><div className={styles.grid}>{(['adults','children'] as const).map(key=><label key={key}>{key==='adults'?'Adults':'Children'}<input required type="number" min="0" max="100" value={pack.household[key]} onChange={e=>setPack({...pack,household:{...pack.household,[key]:Number(e.target.value)}})}/></label>)}</div>{([['water','Water access'],['food','Food access'],['priority','Household priority'],['followUp','Agreed follow-up']] as const).map(([key,label])=><label key={key}>{label}<textarea required maxLength={1000} value={pack.household[key]} onChange={e=>setPack({...pack,household:{...pack.household,[key]:e.target.value}})}/></label>)}</section>
        <section className={styles.card}><h2>Soil test example · not a lab certificate</h2><p>{pack.soil.reference}</p><p>{pack.soil.note}</p><div className={styles.grid}><label>Example sampling date<input required type="date" value={pack.soil.sampledOn} onChange={e=>setPack({...pack,soil:{...pack.soil,sampledOn:e.target.value}})}/></label><label>Example pH<input required type="number" min="0" max="14" step="0.1" value={pack.soil.ph} onChange={e=>setPack({...pack,soil:{...pack.soil,ph:Number(e.target.value)}})}/></label></div><label>Texture description<input required maxLength={150} value={pack.soil.texture} onChange={e=>setPack({...pack,soil:{...pack.soil,texture:e.target.value}})}/></label></section>
        <div className={styles.actions}><button className={styles.primary} type="submit">Save sample edits</button></div>
      </fieldset></form>
      <section id="report" className={styles.card}><h2>Take the evidence away</h2><p>A branded PDF with the current site assessment, your sample interview and visit edits, the illustrative soil result and pictures. It is separate from the full agronomic site report and crop-plan export.</p><div className={styles.actions}><button disabled={busy} className={styles.primary} onClick={()=>void report()}>{busy?'Preparing report…':'Download sample evidence report'}</button><Link href="/reports">Open site reports</Link></div></section>
    </>}{message&&<p role="status" className={styles.notice}>{message}</p>}
  </div></main>;
}
