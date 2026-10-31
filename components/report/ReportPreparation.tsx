'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Camera, FlaskConical, Droplets, ClipboardList, Map, Sprout, PenTool } from 'lucide-react';
import { EVIDENCE_CATALOGUE, type EvidenceCatalogueGroup, type EvidenceCatalogueItem } from '@/lib/evidence-catalogue';
import { getSiteEvidence, evidenceSiteId } from '@/lib/site-evidence';
import { useSiteProgress } from '@/lib/site-progress';
import { reportPreparation, reportPreparationText, type ReportDesignRecords } from '@/lib/report-readiness';
import { collectReportSiteFacts } from '@/lib/report-site-facts-collect';
import { loadCanvasState } from '@/lib/design-canvas';
import { savePlace, type SavedPlace } from '@/lib/saved-places';
import { designSiteIdFromLocation } from '@/lib/design-studio';
import type { SiteSurvey } from '@/lib/site-survey';
import type { LocationData } from '@/lib/types';
import { useLanguage } from '@/lib/i18n';
import { fillInline, inlineText, isInlineDraftLang } from '@/lib/xh-inline';
import styles from './ReportPreparation.module.css';

const EvidenceSheet=dynamic(()=>import('../EvidenceSheet'),{ssr:false});
const SiteSurveySheet=dynamic(()=>import('../SiteSurveySheet'),{ssr:false});
const icons={photos:Camera,soil:FlaskConical,water:Droplets,survey:ClipboardList,boundary:Map,design:PenTool,crops:Sprout};
export default function ReportPreparation({location,place,onSavedPlace,onChanged,snapshot,maps,onViewMaps,onSurveySaved}:{location:LocationData;place?:SavedPlace;onSavedPlace:(place:SavedPlace)=>void;onChanged:()=>void;snapshot:boolean;maps:ReportDesignRecords['maps'];onViewMaps:()=>void;onSurveySaved?:(survey:SiteSurvey)=>void}) {
  const { lang: language } = useLanguage();
  // isiXhosa: the draft keyed by the exact English template (lib/locales/xh-inline); the
  // checklist's statuses and evidence details stay English for xh (see the note below).
  const copy = (source: string, values?: Record<string, string | number>) => isInlineDraftLang(language) ? fillInline(inlineText(language, source), values ?? {}) : reportPreparationText(source, language, values);
  const xh = (text: string) => isInlineDraftLang(language) ? inlineText(language, text) : text;
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
      setDesignRecords({siteId,facts:collectReportSiteFacts({location,siteId,lat:location.lat,lon:location.lon,canvas:loadCanvasState(siteId)})});
    };
    read();
    window.addEventListener('focus',read);
    return ()=>window.removeEventListener('focus',read);
  },[siteId,location,progress]);
  useEffect(()=>{setEvidence(place?getSiteEvidence(evidenceSiteId(place.id)):{});setSheet(null);setSurvey(false);setChanged(false);},[place?.id,location.lat,location.lon]); // eslint-disable-line react-hooks/exhaustive-deps
  function refresh(){setEvidence(place?getSiteEvidence(evidenceSiteId(place.id)):{});setChanged(true);onChanged();}
  const items=progress?reportPreparation(progress.inputs,evidence,{facts:currentFacts,maps},language):[];
  const design=`/design?lat=${location.lat.toFixed(5)}&lon=${location.lon.toFixed(5)}`;
  function addEvidence(id:string){
    if(id==='photos')setSheet({group:{key:'site_photos',label:'Site photographs',color:'#285c3e',bg:'#eef5ed',iconBg:'#e3efdf',items:[]}});
    else {const group=EVIDENCE_CATALOGUE.find(g=>g.key===id)!;setSheet({group,item:group.items.find(i=>i.key==='lab_result')});}
  }
  return <section lang={language} className={`${styles.preparation} no-print`} aria-label={copy('Improve this report')}>
    <details><summary><strong>{copy('Improve this report')}</strong><span>{copy('{count} of 7 areas have records · see what to add or review', { count: items.filter(i=>i.hasRecord).length })}</span></summary>
      {language==='xh'&&<p role="note">{inlineText(language,'The isiXhosa text here is an unreviewed draft. Record statuses, evidence details and the notes below stay in English so their meaning remains accurate.')}</p>}
      {language==='af'&&<p role="note">{inlineText(language,'The Afrikaans text here is an unreviewed draft. Record statuses, evidence details and the notes below stay in English so their meaning remains accurate.')}</p>}
      <p>{copy('Generate with the information you have, or add more evidence first. Records present do not mean the information has been checked or the design is finished.')}</p>
      {snapshot&&<p>{copy('This checklist describes your current site. The saved report remains an earlier snapshot; generate a new report to use updated evidence.')}</p>}
      {!place&&<form className={styles.save} onSubmit={e=>{e.preventDefault();try{
        const saved:SavedPlace={id:crypto.randomUUID(),name:name.trim(),lat:location.lat,lon:location.lon,biome:location.biome.name,rainfall:location.rainfall.annual,elevation:location.elevation.elevation,savedAt:new Date().toISOString(),label:'field'};
        savePlace(saved);onSavedPlace(saved);setError('');
      }catch{setError('The site could not be saved. Keep this page open and try again.');}}}><label>{copy('Name and save this site to attach its evidence')}<input required maxLength={120} value={name} onChange={e=>setName(e.target.value)} placeholder={copy('Your garden or site name')}/></label><button>{copy('Save site')}</button></form>}
      {error&&<p role="alert">{copy(error)}</p>}
      <div className={styles.grid}>{items.map(item=>{const Icon=icons[item.id];return <article key={item.id}><div className={styles.title}><Icon size={22}/><h3>{xh(item.title)}</h3></div><strong className={styles.status}>{item.status}</strong><p>{item.detail}</p>
        {item.id==='design'&&(maps?.count??0)>0?<button onClick={onViewMaps}>{xh(item.action)} →</button>:item.id==='survey'?<button disabled={!place} onClick={()=>setSurvey(true)}>{xh(item.action)}</button>:['photos','soil','water'].includes(item.id)?<button disabled={!place} onClick={()=>addEvidence(item.id)}>{xh(item.action)}</button>:<Link href={item.id==='crops'?`/facilitator/crops?canvasSite=${encodeURIComponent(designSiteIdFromLocation(location))}`:design}>{xh(item.action)} →</Link>}
      </article>;})}</div>
      <p>{copy('Climate and regional soil layers provide context. They do not replace your site observations or laboratory measurements.')}</p>
    </details>
    {changed&&<p role="status">{copy('Site evidence updated. Choose Generate new report to include it in the advice.')}</p>}
    {sheet&&place&&<EvidenceSheet key={`${place.id}:${sheet.group.key}`} siteId={evidenceSiteId(place.id)} group={sheet.group} item={sheet.item} onClose={()=>setSheet(null)} onChanged={refresh}/>}
    {survey&&place&&<SiteSurveySheet placeId={place.id} coords={location} annualRainfallMm={location.rainfall.annual} locationData={location} onClose={()=>setSurvey(false)} onSaved={saved=>{setSurvey(false);onSurveySaved?.(saved);refresh();}}/>}
  </section>;
}
