'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Camera, FlaskConical, Droplets, ClipboardList, Map, Sprout, PenTool } from 'lucide-react';
import { EVIDENCE_CATALOGUE, type EvidenceCatalogueGroup, type EvidenceCatalogueItem } from '@/lib/evidence-catalogue';
import { getSiteEvidence, evidenceSiteId } from '@/lib/site-evidence';
import { useSiteProgress } from '@/lib/site-progress';
import { reportPreparation, type ReportDesignRecords } from '@/lib/report-readiness';
import { collectReportSiteFacts } from '@/lib/report-site-facts-collect';
import { loadCanvasState } from '@/lib/design-canvas';
import { savePlace, type SavedPlace } from '@/lib/saved-places';
import { designSiteIdFromLocation } from '@/lib/design-studio';
import type { LocationData } from '@/lib/types';
import styles from './ReportPreparation.module.css';

const EvidenceSheet=dynamic(()=>import('../EvidenceSheet'),{ssr:false});
const SiteSurveySheet=dynamic(()=>import('../SiteSurveySheet'),{ssr:false});
const icons={photos:Camera,soil:FlaskConical,water:Droplets,survey:ClipboardList,boundary:Map,design:PenTool,crops:Sprout};
export default function ReportPreparation({language,location,place,onSavedPlace,onChanged,snapshot,maps,onViewMaps}:{language:string;location:LocationData;place?:SavedPlace;onSavedPlace:(place:SavedPlace)=>void;onChanged:()=>void;snapshot:boolean;maps:ReportDesignRecords['maps'];onViewMaps:()=>void}) {
  const progress=useSiteProgress(location);
  const [evidence,setEvidence]=useState<ReturnType<typeof getSiteEvidence>>({});
  const [sheet,setSheet]=useState<{group:EvidenceCatalogueGroup;item?:EvidenceCatalogueItem}|null>(null);
  const [survey,setSurvey]=useState(false);
  const [name,setName]=useState('');
  const [error,setError]=useState('');
  const [changed,setChanged]=useState(false);
  const siteId=designSiteIdFromLocation(location);
  const [designRecords,setDesignRecords]=useState<{siteId:string;facts:ReportDesignRecords['facts']}|null>(null);
  const currentFacts=designRecords?.siteId===siteId?designRecords.facts:null;
  useEffect(()=>{
    const read=()=>{
      setDesignRecords({siteId,facts:collectReportSiteFacts({siteId,lat:location.lat,lon:location.lon,canvas:loadCanvasState(siteId)})});
    };
    read();
    window.addEventListener('focus',read);
    return ()=>window.removeEventListener('focus',read);
  },[siteId,location,progress]);
  useEffect(()=>{setEvidence(place?getSiteEvidence(evidenceSiteId(place.id)):{});setSheet(null);setSurvey(false);setChanged(false);},[place?.id,location.lat,location.lon]); // eslint-disable-line react-hooks/exhaustive-deps
  function refresh(){setEvidence(place?getSiteEvidence(evidenceSiteId(place.id)):{});setChanged(true);onChanged();}
  const items=progress?reportPreparation(progress.inputs,evidence,{facts:currentFacts,maps}):[];
  const zu=language==='zu';
  const sectionTitle:Record<string,string>={photos:'Izithombe zendawo',soil:'Amasampula omhlabathi nemiphumela yokuhlola',water:'Amasampula amanzi nemiphumela yokuhlola',survey:'Ukuhlola indawo nomndeni',boundary:'Imingcele nezilinganiso',design:'Uhlelo lwendawo',crops:'Uhlelo lokutshala'};
  const actionLabel=(action:string)=>{
    if(!zu)return action;
    const labels:Record<string,string>={
      'Add site photos':'Faka izithombe zendawo',
      'Add soil test results':'Faka imiphumela yokuhlola umhlabathi',
      'Add water test results':'Faka imiphumela yokuhlola amanzi',
      'Complete or review survey':'Gcwalisa noma ubuyekeze uhlu lokuhlola',
      'View boundary and measurements':'Buka umngcele nezilinganiso',
      'Add boundary':'Faka umngcele',
      'View saved design maps':'Buka amamephu omklamo agciniwe',
      'View saved design':'Buka umklamo ogciniwe',
      'Open Design Map':'Vula imephu yomklamo',
      'Complete planting plan':'Gcwalisa uhlelo lokutshala',
    };
    return labels[action]??action;
  };
  const design=`/design?lat=${location.lat.toFixed(5)}&lon=${location.lon.toFixed(5)}`;
  function addEvidence(id:string){
    if(id==='photos')setSheet({group:{key:'site_photos',label:'Site photographs',color:'#285c3e',bg:'#eef5ed',iconBg:'#e3efdf',items:[]}});
    else {const group=EVIDENCE_CATALOGUE.find(g=>g.key===id)!;setSheet({group,item:group.items.find(i=>i.key==='lab_result')});}
  }
  return <section className={`${styles.preparation} no-print`} aria-label={zu?'Yengeza ulwazi kulo mbiko':'Improve this report'}>
    <details><summary><strong>{zu?'Yengeza ulwazi kulo mbiko':'Improve this report'}</strong><span>{zu?`${items.filter(i=>i.hasRecord).length} kwezingu-7 izigaba zinamarekhodi · bheka ongakwengeza noma okubuyekezayo`:`${items.filter(i=>i.hasRecord).length} of 7 areas have records · see what to add or review`}</span></summary>
      {zu&&<p role="note">Umbhalo wesiZulu lapha uwuhlaka olulindele ukubuyekezwa. Izimo zamarekhodi, imininingwane yobufakazi nezaziso ezingezansi zisagcinwe ngesiNgisi ukuze incazelo yazo ihlale inembile.</p>}
      <p>Generate with the information you have, or add more evidence first. Records present do not mean the information has been checked or the design is finished.</p>
      {snapshot&&<p>This checklist describes your current site. The saved report remains an earlier snapshot; generate a new report to use updated evidence.</p>}
      {!place&&<form className={styles.save} onSubmit={e=>{e.preventDefault();try{
        const saved:SavedPlace={id:crypto.randomUUID(),name:name.trim(),lat:location.lat,lon:location.lon,biome:location.biome.name,rainfall:location.rainfall.annual,elevation:location.elevation.elevation,savedAt:new Date().toISOString(),label:'field'};
        savePlace(saved);onSavedPlace(saved);setError('');
      }catch{setError('The site could not be saved. Keep this page open and try again.');}}}><label>{zu?'Nike igama lale ndawo uyigcine ukuze unamathisele ubufakazi bayo':'Name and save this site to attach its evidence'}<input required maxLength={120} value={name} onChange={e=>setName(e.target.value)} placeholder={zu?'Igama lengadi noma lendawo yakho':'Your garden or site name'}/></label><button>{zu?'Gcina indawo':'Save site'}</button></form>}
      {error&&<p role="alert">{error}</p>}
      <div className={styles.grid}>{items.map(item=>{const Icon=icons[item.id];return <article key={item.id}><div className={styles.title}><Icon size={22}/><h3>{zu?sectionTitle[item.id]??item.title:item.title}</h3></div><strong className={styles.status}>{item.status}</strong><p>{item.detail}</p>
        {item.id==='design'&&(maps?.count??0)>0?<button onClick={onViewMaps}>{actionLabel(item.action)} →</button>:item.id==='survey'?<button disabled={!place} onClick={()=>setSurvey(true)}>{actionLabel(item.action)}</button>:['photos','soil','water'].includes(item.id)?<button disabled={!place} onClick={()=>addEvidence(item.id)}>{actionLabel(item.action)}</button>:<Link href={item.id==='crops'?`/facilitator/crops?canvasSite=${encodeURIComponent(designSiteIdFromLocation(location))}`:design}>{actionLabel(item.action)} →</Link>}
      </article>;})}</div>
      <p>Climate and regional soil layers provide context. They do not replace your site observations or laboratory measurements.</p>
    </details>
    {changed&&<p role="status">Site evidence updated. Choose Generate new report to include it in the advice.</p>}
    {sheet&&place&&<EvidenceSheet key={`${place.id}:${sheet.group.key}`} siteId={evidenceSiteId(place.id)} group={sheet.group} item={sheet.item} onClose={()=>setSheet(null)} onChanged={refresh}/>}
    {survey&&place&&<SiteSurveySheet placeId={place.id} coords={location} annualRainfallMm={location.rainfall.annual} onClose={()=>setSurvey(false)} onSaved={()=>{setSurvey(false);refresh();}}/>}
  </section>;
}
