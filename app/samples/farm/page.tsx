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
import { useLanguage } from '@/lib/i18n-context';

export default function SampleFarmPage() {
  const { lang } = useLanguage();
  const ui = (english: string, isiZulu: string) => lang === 'zu' ? isiZulu : english;
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
  function save(){if(!pack)return;try{sampleWrite('farm-pack',pack);setMessage(ui('Edits saved.','Izinguquko zilondoloziwe.'));}catch(e){setMessage((e as Error).message);}}
  async function report(){if(!pack||busy)return;setBusy(true);setMessage('');try{
    if(!isSampleMode())throw Error(ui('Reopen the tour before exporting.','Vula uhambo futhi ngaphambi kokukhipha umbiko.'));
    const assessment=prepareSampleFarm(); sampleWrite('farm-pack',pack);
    const photos=[...await Promise.all(SAMPLE_PHOTOS.map(async p=>{const response=await fetch(p.src);if(!response.ok)throw Error(ui('An example photo could not load. Try again when connected.','Isithombe sesibonelo asikwazanga ukulayishwa. Zama futhi uma uxhumekile.'));return {image:await resizeLogoForStorage(new File([await response.blob()],'sample.webp',{type:'image/webp'}),640),caption:p.caption};})),...(pack.photos??[])];
    if(!isSampleMode())return;
    const pdf=await buildProgrammePdf("Ubhejane farm evidence pack",true,sampleFarmSections(pack,assessment),'full',SAMPLE_BRANDING,photos,'Illustrative garden and harvest images');
    if(!isSampleMode())return;
    await deliverFile(pdf.output('blob'),'ImbewuField-Tour-Farm-Evidence.pdf',"Ubhejane farm evidence · Tour edition");setMessage(ui('Report ready. Use your device’s save or share controls.','Umbiko usulungile. Sebenzisa izinkinobho zokulondoloza noma zokwabelana zedivayisi yakho.'));
  }catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
  return <main className={styles.page}><div className={styles.wrap}><header className={styles.header}><MenuButton/><BackButton fallback="/samples"/><SettingsButton/><Link href="/tour">{ui('15-minute tour','Uhambo lwemizuzu engu-15')}</Link></header>
    <h1>{ui('One farm, from plan to evidence','Ipulazi elilodwa, kusukela ohlelweni kuye ebufakazini')}</h1><p>{ui('Explore the design, visit records and evidence. Your edits stay available until you reload or reset this workspace.','Hlola umklamo, amarekhodi okuvakasha nobufakazi. Izinguquko zakho zizohlala zikhona uze ulayishe kabusha noma usethe kabusha le ndawo yokuzilolonga.')}</p>
    {!sample?<button className={styles.primary} onClick={()=>{if(!enterSampleMode())setMessage(ui('Please allow session storage to open this tour.','Vumela ukugcinwa kolwazi lweseshini ukuze uvule lolu hambo.'));}}>{ui('Open farm workspace','Vula indawo yokusebenza yepulazi')}</button>:pack&&<>
      {lang === 'zu' && <p role="note" className={styles.notice}>Amarekhodi esampula, imibhalo yobufakazi, imiphumela yokuhlolwa komhlabathi namazwibela ezithombe kugcinwe ngesiNgisi ukuze kugcinwe imithombo namaqiniso. Cela usizo lokuzihumusha ngaphambi kokusebenzisa imininingwane yokulima.</p>}
      <div className={styles.actions}><Link className={styles.button} href="/farmer">{ui('Saved place & map','Indawo elondoloziwe nemephu')}</Link><Link className={`${styles.button} ${styles.primary}`} href="/design?lat=-27.72623&lon=31.96304">{ui('Edit design','Hlela umklamo')}</Link><Link className={styles.button} href="/farmer?openSurvey=1">{ui('Edit site assessment','Hlela ukuhlolwa kwendawo')}</Link><Link className={styles.button} href="/facilitator/crops">{ui('Crop plan','Uhlelo lwezitshalo')}</Link><Link className={styles.button} href="/records">{ui('Harvest & money','Isivuno nemali')}</Link></div>
      <section id="evidence" className={styles.card}><h2>{ui('Site pictures','Izithombe zendawo')}</h2><div className={styles.grid}>{SAMPLE_PHOTOS.map(p=><figure key={p.src}><img data-photo-preview className={styles.photo} src={p.src} alt={p.caption}/><figcaption>{p.caption}</figcaption></figure>)}{pack.photos?.map((p,i)=><figure key={i}><img data-photo-preview className={styles.photo} src={p.image} alt={p.caption}/><figcaption>{p.caption}</figcaption><button disabled={busy} onClick={()=>setPack({...pack,photos:pack.photos?.filter((_,index)=>index!==i)})}>{ui('Remove added photo','Susa isithombe esingeziwe')} {i+1}</button></figure>)}</div><p>{ui('These pictures are included in the evidence report.','Lezi zithombe zifakwa embikweni wobufakazi.')}</p><label>{ui('Add up to two photos','Engeza izithombe ezingafika kwezimbili')}<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy||(pack.photos?.length??0)>=2} aria-label={ui('Choose up to two photos','Khetha izithombe ezingafika kwezimbili')} onChange={e=>{const files=Array.from(e.target.files??[]).slice(0,2-(pack.photos?.length??0));e.target.value='';if(!files.length||!isSampleMode())return;setBusy(true);void Promise.all(files.map(async file=>({image:await resizeLogoForStorage(file,640),caption:"User-added practice photo — workspace, not verified site evidence."}))).then(photos=>{if(isSampleMode())setPack(p=>p?{...p,photos:[...(p.photos??[]),...photos].slice(0,2)}:p);}).catch(e=>setMessage((e as Error).message)).finally(()=>setBusy(false));}}/></label><p>{ui('Choose pictures you have permission to use, then press Save edits.','Khetha izithombe ovunyelwe ukuzisebenzisa, bese ucindezela okuthi Londoloza izinguquko.')}</p></section>
      <form onSubmit={e=>{e.preventDefault();save();}}><fieldset disabled={busy} style={{minWidth:0}}>
        <section className={styles.card}><h2>{ui('Site visit','Ukuvakasha endaweni')}</h2><label>{ui('Coordinator','Umxhumanisi')}<input required maxLength={150} aria-label={ui('Coordinator','Umxhumanisi')} value={pack.coordinator} onChange={e=>setPack({...pack,coordinator:e.target.value})}/></label><label>{ui('Visit date','Usuku lokuvakasha')}<input required type="date" aria-label={ui('Visit date','Usuku lokuvakasha')} value={pack.visitDate} onChange={e=>setPack({...pack,visitDate:e.target.value})}/></label><label>{ui('Mentor notes and follow-up','Amanothi omeluleki nokulandelela')}<textarea required maxLength={2000} aria-label={ui('Mentor notes and follow-up','Amanothi omeluleki nokulandelela')} value={pack.mentorNotes} onChange={e=>setPack({...pack,mentorNotes:e.target.value})}/></label></section>
        <section className={styles.card}><h2>{ui('Household interview','Ingxoxo nomndeni')}</h2><div className={styles.grid}>{(['adults','children'] as const).map(key=><label key={key}>{key==='adults'?ui('Adults','Abantu abadala'):ui('Children','Izingane')}<input required type="number" min="0" max="100" aria-label={key==='adults'?ui('Adults','Abantu abadala'):ui('Children','Izingane')} value={pack.household[key]} onChange={e=>setPack({...pack,household:{...pack.household,[key]:Number(e.target.value)}})}/></label>)}</div>{([['water',ui('Water access','Ukuthola amanzi')],['food',ui('Food access','Ukuthola ukudla')],['priority',ui('Household priority','Okubalulekile emndenini')],['followUp',ui('Agreed follow-up','Ukulandelela okuvunyelwene ngakho')]] as const).map(([key,label])=><label key={key}>{label}<textarea required maxLength={1000} aria-label={label} value={pack.household[key]} onChange={e=>setPack({...pack,household:{...pack.household,[key]:e.target.value}})}/></label>)}</section>
        <section className={styles.card}><h2>{ui('Soil test results','Imiphumela yokuhlolwa komhlabathi')}</h2><details><summary>{ui('Source details','Imininingwane yomthombo')}</summary><p>{pack.soil.reference}</p><p>{pack.soil.note}</p></details><div className={styles.grid}><label>{ui('Sampling date','Usuku lokuthatha isampula')}<input required type="date" aria-label={ui('Sampling date','Usuku lokuthatha isampula')} value={pack.soil.sampledOn} onChange={e=>setPack({...pack,soil:{...pack.soil,sampledOn:e.target.value}})}/></label><label>pH<input required type="number" min="0" max="14" step="0.1" aria-label="pH" value={pack.soil.ph} onChange={e=>setPack({...pack,soil:{...pack.soil,ph:Number(e.target.value)}})}/></label></div><label>{ui('Texture description','Incazelo yokuthamba komhlabathi')}<input required maxLength={150} aria-label={ui('Texture description','Incazelo yokuthamba komhlabathi')} value={pack.soil.texture} onChange={e=>setPack({...pack,soil:{...pack.soil,texture:e.target.value}})}/></label></section>
        <div className={styles.actions}><button className={styles.primary} type="submit">{ui('Save edits','Londoloza izinguquko')}</button></div>
      </fieldset></form>
      <section id="report" className={styles.card}><h2>{ui('Take the evidence away','Landa ubufakazi')}</h2><p>{ui('Download a branded PDF with the site assessment, household interview, visit notes, soil results and pictures. Open site reports for the full site analysis and crop plan.','Landa i-PDF enophawu ehlanganisa ukuhlolwa kwendawo, ingxoxo nomndeni, amanothi okuvakasha, imiphumela yomhlabathi nezithombe. Vula imibiko yendawo ukuze ubone ukuhlaziywa kwendawo nohlelo lwezitshalo olugcwele.')}</p><div className={styles.actions}><button disabled={busy} className={styles.primary} onClick={()=>void report()}>{busy?ui('Preparing report…','Ilungiselela umbiko…'):ui('Download evidence report','Landa umbiko wobufakazi')}</button><Link href="/reports">{ui('Open site reports','Vula imibiko yendawo')}</Link></div></section>
    </>}{message&&<p role="status" className={styles.notice}>{message}</p>}
  </div></main>;
}
