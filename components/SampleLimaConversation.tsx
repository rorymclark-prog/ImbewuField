'use client';
import { useState } from 'react';
import Link from 'next/link';
import { sampleLimaFor } from '@/lib/sample-lima';
import styles from './MelDashboard.module.css';
export default function SampleLimaConversation({role}:{role:string}) {
  const example=sampleLimaFor(role);
  const [followed,setFollowed]=useState(false);
  return <section className={styles.root} style={{padding:16,borderRadius:16}} aria-label="Lima example conversation">
    <span className={styles.tag}>Lima · scripted sample conversation</span><h2 style={{marginTop:12}}>{example.title}</h2>
    <p>This prepared example uses fictional information. It does not run a live AI analysis or change project records.</p>
    <article className={styles.card}><strong>You</strong><p>{example.question}</p>{'image' in example && <img data-photo-preview src={example.image} alt="AI-generated example of aphids on a leaf" style={{width:'100%',maxWidth:300,borderRadius:12}}/>}</article>
    <article className={styles.card} style={{marginTop:12}}><strong>Lima</strong><p>{example.answer}</p>{'source' in example && <a href={example.source} target="_blank" rel="noreferrer">Read the aphid management reference</a>}</article>
    {followed ? <><article className={styles.card} style={{marginTop:12}}><strong>You</strong><p>{example.followup}</p></article><article className={styles.card} style={{marginTop:12}}><strong>Lima</strong><p>{example.next}</p></article><button type="button" onClick={()=>setFollowed(false)}>Replay example</button></> : <button type="button" style={{marginTop:12}} onClick={()=>setFollowed(true)}>{example.followup}</button>}
    <p><Link href="/samples">Switch sample role</Link> · <Link href="/feedback">Request an improvement</Link></p>
  </section>;
}
