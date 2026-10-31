'use client';
import { useState } from 'react';
import Link from 'next/link';
import { sampleLimaFor } from '@/lib/sample-lima';
import { useLanguage } from '@/lib/i18n';
import { inlineText } from '@/lib/xh-inline';
import styles from './MelDashboard.module.css';
export default function SampleLimaConversation({role}:{role:string}) {
  const { lang } = useLanguage();
  const example=sampleLimaFor(role);
  const [followed,setFollowed]=useState(false);
  return <section className={styles.root} style={{padding:16,borderRadius:16}} aria-label={inlineText(lang,'Lima example conversation')}>
    <span className={styles.tag} style={{color:'var(--text-primary)'}}>{inlineText(lang,'Lima · guided conversation')}</span><h2 style={{marginTop:12}}>{example.title}</h2>
    <p>{inlineText(lang,'Explore this prepared conversation. Live questions are available from your own workspace.')}</p>
    {lang==='xh'&&<p role="note">{inlineText(lang,'The example questions and answers below stay in English so the advice is not changed in translation.')}</p>}
    <article className={styles.card}><strong>{inlineText(lang,'You')}</strong><p>{example.question}</p>{'image' in example && <img data-photo-preview src={example.image} alt={inlineText(lang,'AI-generated example of aphids on a leaf')} style={{width:'100%',maxWidth:300,borderRadius:12}}/>}</article>
    <article className={styles.card} style={{marginTop:12}}><strong>Lima</strong><p>{example.answer}</p>{'source' in example && <a href={example.source} target="_blank" rel="noreferrer">{inlineText(lang,'Read the aphid management reference')}</a>}</article>
    {followed ? <><article className={styles.card} style={{marginTop:12}}><strong>{inlineText(lang,'You')}</strong><p>{example.followup}</p></article><article className={styles.card} style={{marginTop:12}}><strong>Lima</strong><p>{example.next}</p></article><button type="button" onClick={()=>setFollowed(false)}>{inlineText(lang,'Replay example')}</button></> : <button type="button" style={{marginTop:12}} onClick={()=>setFollowed(true)}>{example.followup}</button>}
    <p><Link href="/samples">{inlineText(lang,'Switch practice role')}</Link> · <Link href="/feedback">{inlineText(lang,'Request an improvement')}</Link></p>
  </section>;
}
