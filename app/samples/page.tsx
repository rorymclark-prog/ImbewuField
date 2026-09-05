'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { startRolePreview } from '@/lib/use-role-navigation';
import styles from '@/components/MelDashboard.module.css';
const examples = [
  ['ngo', 'NGO', 'Run a programme', 'Explore the cohort, gardens, assessments and People & access controls.'],
  ['funder', 'Funder', 'Review what is shared', 'See the same sample programme through its published summaries.'],
  ['farmer', 'Farmer', 'Explore Ubhejane Crèche', 'Open the farm map, crop plan, harvests and example sales.'],
  ['mentor', 'Mentor', 'Support a grower', 'Explore the existing sample mentoring workspace.'],
  ['student', 'Student', 'Try the learning workspace', 'Explore the existing sample course and progress.'],
] as const;
export default function SamplesPage() {
  const router = useRouter(); const [error, setError] = useState('');
  return <main className={styles.root} style={{ minHeight: '100dvh', paddingBottom: 180 }}><div className={styles.wrap}>
    <Link href="/account">← Account</Link>
    <div className={styles.hero} style={{ marginTop: 20 }}><span>IMBEWUFIELD · SAMPLE WORKSPACE</span><h1>Choose a sample view</h1><p>Demo the app without changing a real project. Switch views from the sample banner; reset when you want to start again.</p></div>
    <p className={styles.notice}>All sample programme results and people are fictional. The farmer example uses the saved Ubhejane design. These are demonstrations, not verified project deliverables.</p>
    {error && <p role="alert">{error}</p>}
    <div className={styles.grid}>{examples.map(([role, label, title, description]) => <article key={role} className={styles.card}><span className={styles.tag}>{label}</span><h2 style={{ marginTop: 16 }}>{title}</h2><p>{description}</p><button className={styles.primary} onClick={() => { if (startRolePreview(role)) router.push('/' + role); else setError('Sample mode could not start. Please allow session storage and try again.'); }}>Open {label} sample</button></article>)}</div>
    <p>Changes stay in this sample session. Resetting or reloading starts fresh. Signing in is not required and switching sample views never changes your real account permissions.</p>
  </div></main>;
}
