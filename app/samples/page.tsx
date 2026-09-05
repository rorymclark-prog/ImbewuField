'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import BackButton from '@/components/BackButton';
import MenuButton from '@/components/MenuButton';
import { Users, HandCoins, Sprout, GraduationCap, BookOpen } from 'lucide-react';
import { enterSampleMode } from '@/lib/sample-mode';
import { startRolePreview } from '@/lib/use-role-navigation';
import { useAuth } from '@/lib/auth';
import { sampleRolesFor } from '@/lib/sample-tour';
import styles from '@/components/MelDashboard.module.css';
const icons = { ngo: Users, funder: HandCoins, farmer: Sprout, mentor: GraduationCap, student: BookOpen };
const examples = [
  ['ngo', 'Organisation', 'Run a programme', 'Explore gardens, assessments, reports and the organisation Control centre.'],
  ['funder', 'Funder', 'Review what is shared', 'See the same sample programme through its published summaries.'],
  ['farmer', 'Farmer', 'Explore Ubhejane Crèche', 'Open the farm map, crop plan, harvests and example sales.'],
  ['mentor', 'Mentor', 'Support a grower', 'Explore assigned farmers, organisation guidance, visits and reports.'],
  ['student', 'Student', 'Try the learning workspace', 'Explore the existing sample course and progress.'],
] as const;
export default function SamplesPage() {
  const router = useRouter(); const [error, setError] = useState('');
  const { role, user, loading } = useAuth();
  const visibleExamples = loading || (user && !role) ? [] : examples.filter(([r]) => sampleRolesFor(role).includes(r));
  return <main className={styles.root} style={{ height: '100dvh', minHeight: 0, overflowY: 'auto', paddingBottom: 'calc(180px + env(safe-area-inset-bottom, 0px))', scrollPaddingBottom: 'calc(180px + env(safe-area-inset-bottom, 0px))' }}><div className={styles.wrap}>
    <header className={styles.row}><MenuButton /><BackButton fallback="/account" /><Link href="/account">Account</Link></header>
    <div className={styles.hero} style={{ marginTop: 20 }}><span>IMBEWUFIELD · SAMPLE WORKSPACE</span><h1>Choose a sample view</h1><p>Demo the app without changing a real project. Switch views from the sample banner; reset when you want to start again.</p></div>
    <p className={styles.notice}>All sample programme results and people are fictional. The farmer example uses the saved Ubhejane design. These are demonstrations, not verified project deliverables.</p>
    {error && <p role="alert">{error}</p>}
    <div className={styles.card}><h2>Explore a complete farm example</h2><p>Try the map and editable design, review a completed assessment, explore fictional household and soil records, then download an evidence report.</p><div className={styles.row}><Link href="/tour">Start the 15-minute tour</Link><Link href="/samples/farm">Open the farm evidence pack</Link></div></div>
    {loading && <p role="status">Loading your sample choices…</p>}
    <div className={styles.sampleGrid}>{visibleExamples.map(([role, label, title, description]) => { const Icon = icons[role]; return <article key={role} className={`${styles.card} ${styles.sampleCard}`}><Icon size={28} aria-hidden="true" /><span className={styles.tag}>{label}</span><h2 style={{ marginTop: 16 }}>{title}</h2><p>{description}</p><button className={styles.primary} onClick={() => { if (startRolePreview(role)) router.push('/' + role); else setError('Sample mode could not start. Please allow session storage and try again.'); }}>Open {label} sample</button></article>; })}</div>
    <button type="button" onClick={() => { if (enterSampleMode()) window.location.reload(); }}>Reset sample</button>
    <p>Changes stay in this sample session. Resetting or reloading starts fresh. Signing in is not required and switching sample views never changes your real account permissions.</p>
  </div></main>;
}
