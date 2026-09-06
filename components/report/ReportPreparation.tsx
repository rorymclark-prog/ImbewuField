'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Camera, FlaskConical, Droplets, ClipboardList, Map, Sprout, PenTool } from 'lucide-react';
import { EVIDENCE_CATALOGUE, type EvidenceCatalogueGroup, type EvidenceCatalogueItem } from '@/lib/evidence-catalogue';
import { getSiteEvidence, evidenceSiteId } from '@/lib/site-evidence';
import { useSiteProgress } from '@/lib/site-progress';
import { reportPreparation } from '@/lib/report-readiness';
import { savePlace, type SavedPlace } from '@/lib/saved-places';
import { designSiteIdFromLocation } from '@/lib/design-studio';
import type { LocationData } from '@/lib/types';
import styles from './ReportPreparation.module.css';

const EvidenceSheet=dynamic(()=>import('../EvidenceSheet'),{ssr:false});
const SiteSurveySheet=dynamic(()=>import('../SiteSurveySheet'),{ssr:false});
const icons={photos:Camera,soil:FlaskConical,water:Droplets,survey:ClipboardList,boundary:Map,design:PenTool,crops:Sprout};
export default function ReportPreparation({location,place,onSavedPlace,onChanged,snapshot}:{location:LocationData;place?:SavedPlace;onSavedPlace:(place:SavedPlace)=>void;onChanged:()=>void;snapshot:boolean}) {
  const progress=useSiteProgress(location);
  const [evidence,setEvidence]=useState<ReturnType<typeof getSiteEvidence>>({});
  const [sheet,setSheet]=useState<{group:EvidenceCatalogueGroup;item?:EvidenceCatalogueItem}|null>(null);
  const [survey,setSurvey]=useState(false);
  const [name,setName]=useState('');
  const [error,setError]=useState('');
  const [changed,setChanged]=useState(false);
  useEffect(()=>{setEvidence(place?getSiteEvidence(evidenceSiteId(place.id)):{});setSheet(null);setSurvey(false);setChanged(false);},[place?.id,location.lat,location.lon]); // eslint-disable-line react-hooks/exhaustive-deps
  function refresh(){setEvidence(place?getSiteEvidence(evidenceSiteId(place.id)):{});setChanged(true);onChanged();}
  const items=progress?reportPreparation(progress.inputs,evidence):[];
  const design=`/design?lat=${location.lat.toFixed(5)}&lon=${location.lon.toFixed(5)}`;
  function addEvidence(id:string){
    if(id==='photos')setSheet({group:{key:'site_photos',label:'Site photographs',color:'#285c3e',bg:'#eef5ed',iconBg:'#e3efdf',items:[]}});
    else {const group=EVIDENCE_CATALOGUE.find(g=>g.key===id)!;setSheet({group,item:group.items.find(i=>i.key==='lab_result')});}
  }
  return <section className={`${styles.preparation} no-print`} aria-label="Improve this report">
    <details><summary><strong>Improve this report</strong><span>{items.filter(i=>i.hasRecord).length} of 7 areas have records · see what to add or review</span></summary>
      <p>Generate with the information you have, or add more evidence first. Records present do not mean the information has been checked or the design is finished.</p>
      {snapshot&&<p>This checklist describes your current site. The saved report remains an earlier snapshot; generate a new report to use updated evidence.</p>}
      {!place&&<form className={styles.save} onSubmit={e=>{e.preventDefault();try{
        const saved:SavedPlace={id:crypto.randomUUID(),name:name.trim(),lat:location.lat,lon:location.lon,biome:location.biome.name,rainfall:location.rainfall.annual,elevation:location.elevation.elevation,savedAt:new Date().toISOString(),label:'field'};
        savePlace(saved);onSavedPlace(saved);setError('');
      }catch{setError('The site could not be saved. Keep this page open and try again.');}}}><label>Name and save this site to attach its evidence<input required maxLength={120} value={name} onChange={e=>setName(e.target.value)} placeholder="Your garden or site name"/></label><button>Save site</button></form>}
      {error&&<p role="alert">{error}</p>}
      <div className={styles.grid}>{items.map(item=>{const Icon=icons[item.id];return <article key={item.id}><div className={styles.title}><Icon size={22}/><h3>{item.title}</h3></div><strong className={styles.status}>{item.status}</strong><p>{item.detail}</p>
        {item.id==='survey'?<button disabled={!place} onClick={()=>setSurvey(true)}>{item.action}</button>:['photos','soil','water'].includes(item.id)?<button disabled={!place} onClick={()=>addEvidence(item.id)}>{item.action}</button>:<Link href={item.id==='crops'?`/facilitator/crops?canvasSite=${encodeURIComponent(designSiteIdFromLocation(location))}`:design}>{item.action} →</Link>}
      </article>;})}</div>
      <p>Climate and regional soil layers provide context. They do not replace your site observations or laboratory measurements.</p>
    </details>
    {changed&&<p role="status">Site evidence updated. Choose Generate new report to include it in the advice.</p>}
    {sheet&&place&&<EvidenceSheet key={`${place.id}:${sheet.group.key}`} siteId={evidenceSiteId(place.id)} group={sheet.group} item={sheet.item} onClose={()=>setSheet(null)} onChanged={refresh}/>}
    {survey&&place&&<SiteSurveySheet placeId={place.id} coords={location} onClose={()=>setSurvey(false)} onSaved={()=>{setSurvey(false);refresh();}}/>}
  </section>;
}
