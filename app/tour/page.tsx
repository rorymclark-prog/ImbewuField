'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import MenuButton from '@/components/MenuButton';
import BackButton from '@/components/BackButton';
import SettingsButton from '@/components/SettingsButton';
import { FARM_TOUR, cleanTourProgress } from '@/lib/sample-tour';
import { enterSampleMode } from '@/lib/sample-mode';
import { useSampleRole } from '@/lib/use-role-navigation';
import { sampleRead, sampleWrite } from '@/lib/sample-operations';
import { prepareSampleFarm } from '@/lib/sample-farm-session';
import styles from '@/components/SampleExperience.module.css';

export default function TourPage() {
  const sample = useSampleRole();
  const [done,setDone] = useState<string[]>([]), [error,setError] = useState('');
  useEffect(() => { if (sample) { try { prepareSampleFarm(); setDone(cleanTourProgress(sampleRead('farm-tour',()=>[]))); } catch(e) { setError((e as Error).message); } } else setDone([]); },[sample]);
  function start() { if (!enterSampleMode()) setError('Could not open the sample. Please allow session storage.'); }
  function mark(id:string, checked:boolean) { try { const next=cleanTourProgress(checked?[...done,id]:done.filter(x=>x!==id)); sampleWrite('farm-tour',next); setDone(next); } catch(e) { setError((e as Error).message); } }
  return <main className={styles.page}><div className={styles.wrap}>
    <header className={styles.header}><MenuButton/><BackButton fallback="/home"/><SettingsButton/></header>
    <h1>Your first 15 minutes</h1>
    <p>Walk through one example garden: map, design, assessment, evidence, crop plan, money and report. You can change the sample and start again.</p>
    <p className={styles.notice}>The sandbox uses the Ubhejane map location with an illustrative design and fictional records. Nothing here grants access to another person’s live farm. Reloading or resetting the sample discards demo edits.</p>
    {error&&<p role="alert">{error}</p>}
    {!sample ? <section className={styles.card}><h2>Try it without changing your project</h2><p>Your account permissions stay the same. Funder and organisation users can experiment with farm tools inside the sample.</p><button className={styles.primary} onClick={start}>Start the sample tour</button><p><Link href="/home">Skip for now</Link> · Replay from Settings → Tour &amp; samples.</p></section> : <>
      <p aria-live="polite">{done.length} of {FARM_TOUR.length} stops tried</p><progress value={done.length} max={FARM_TOUR.length} aria-label="Tour progress"/>
      <div className={styles.actions}><Link href="/samples/farm">Open the sample farm pack</Link><Link href="/samples">Choose a role sample</Link><button onClick={()=>{try{sampleWrite('farm-tour',[]);setDone([]);}catch(e){setError((e as Error).message);}}}>Restart checklist</button></div>
      {FARM_TOUR.map((s,index)=><section className={styles.card} key={s.id}><span className={styles.meta}>{index+1} / {FARM_TOUR.length} · about {s.minutes} minutes</span><h2>{s.title}</h2><p>{s.task}</p><Link className={`${styles.button} ${styles.primary}`} href={s.href}>Try this step</Link><label className={styles.check}><input type="checkbox" checked={done.includes(s.id)} onChange={e=>mark(s.id,e.target.checked)}/>I have tried this</label></section>)}
      <p>Come back through the Tour link in the sample banner. The checklist records what you mark—not training attendance or project achievements.</p>
    </>}
  </div></main>;
}
