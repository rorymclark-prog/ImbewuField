'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import BackButton from '@/components/BackButton';
import MenuButton from '@/components/MenuButton';
import { Users, HandCoins, Sprout, GraduationCap, BookOpen } from 'lucide-react';
import { enterSampleMode } from '@/lib/sample-mode';
import { startRolePreview } from '@/lib/use-role-navigation';
import { useAuth } from '@/lib/auth';
import type { UserRole } from '@/lib/db/types';
import { readSampleChooserAccountRole } from '@/lib/sample-choice-access';
import { sampleChoicesForAccount } from '@/lib/sample-tour';
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
  const [accountRole, setAccountRole] = useState<UserRole | null>(null);
  const [accessReady, setAccessReady] = useState(false);
  const [verifiedUid, setVerifiedUid] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false; setAccessReady(false);
    if (loading) return;
    if (!user) { setAccountRole(null); setVerifiedUid(null); setAccessReady(true); return; }
    void readSampleChooserAccountRole(user.uid).then(value => { if (!cancelled) { setAccountRole(value); setVerifiedUid(user.uid); setAccessReady(true); } }).catch(() => { if (!cancelled) { setAccountRole(null); setVerifiedUid(user.uid); setAccessReady(true); } });
    return () => { cancelled = true; };
  }, [loading, user?.uid, role]);
  const choicesReady = !loading && accessReady && verifiedUid === (user?.uid ?? null);
  const availableRoles = sampleChoicesForAccount(accountRole, !!user, choicesReady);
  return <main className={styles.root} style={{ height: '100dvh', minHeight: 0, overflowY: 'auto', paddingBottom: 'calc(var(--bottom-nav-height, 64px) + 24px + env(safe-area-inset-bottom, 0px))' }}><div className={styles.wrap}>
    <header className={styles.row}><MenuButton /><BackButton fallback="/account" /><Link href="/account">Account</Link></header>
    <div className={styles.hero} style={{ marginTop: 16, padding:20 }}><span>IMBEWUFIELD · SAMPLE WORKSPACE</span><h1>Choose a sample view</h1><p>Demo the app without changing a real project. Use the Sample badge in the menu to return here.</p></div>
    <p className={styles.notice}>All sample programme results and people are fictional. The farmer example uses the saved Ubhejane design. These are demonstrations, not verified project deliverables.</p>
    {error && <p role="alert">{error}</p>}
    <section aria-label="All sample views" style={{marginBottom:24}}><h2>Sample views</h2><p>{!choicesReady ? 'Checking your sample access…' : user && !accountRole ? 'Your account role could not be confirmed. Refresh your access in Account, then return here.' : accountRole && !['ngo','admin'].includes(accountRole) ? `Your ${accountRole} account opens the matching sample. Other roles are shown below so the full set is visible.` : 'Choose any of the five sample workspaces.'}</p>
    <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}} aria-label="Sample view index">{examples.map(([id,label])=><a key={id} href={`#sample-${id}`} style={{padding:'10px 12px',border:'1px solid var(--border)',borderRadius:20}}>{label}</a>)}</div>
    <div className={styles.sampleGrid}>{examples.map(([sampleRole, label, title, description]) => { const Icon = icons[sampleRole]; const allowed = availableRoles.includes(sampleRole); return <article id={`sample-${sampleRole}`} key={sampleRole} className={`${styles.card} ${styles.sampleCard}`}><Icon size={24} aria-hidden="true"/><span className={styles.tag}>{label}</span><h3 style={{margin:'8px 0'}}>{title}</h3><p>{description}</p><button type="button" disabled={!allowed} className={styles.primary} onClick={() => { if (!allowed) return; if (startRolePreview(sampleRole)) router.push('/' + sampleRole); else setError('Sample mode could not start. Please allow session storage and try again.'); }}>{allowed ? `Open ${label} sample` : !choicesReady ? 'Checking access…' : 'Not available for this account'}</button></article>; })}</div></section>
    <div className={styles.card}><h2>Browse 18 different gardens</h2><p>Homesteads, commercial plots, crèches, schools and community gardens. Choose one to see its layout, participants and report.</p><Link className={styles.primary} href="/samples/gardens">Browse 18 sample gardens →</Link></div>
    <div className={styles.card}><h2>Editable farm workspace · Ubhejane</h2><p>Ubhejane is currently the connected editable farm. The 18 garden profiles above are overview examples. Try the map and editable design, review a completed assessment, explore fictional household and soil records, then download an evidence report.</p><div className={styles.row}><Link href="/tour">Start the 15-minute tour</Link><Link href="/samples/farm">Open the farm evidence pack</Link></div></div>
    <button type="button" onClick={() => { if (enterSampleMode()) window.location.reload(); }}>Reset sample</button>
    <p>Changes stay in this sample session. Resetting or reloading starts fresh. Signing in is not required and switching sample views never changes your real account permissions.</p>
  </div></main>;
}
