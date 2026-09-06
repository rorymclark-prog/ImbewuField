'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import BackButton from '@/components/BackButton';
import MenuButton from '@/components/MenuButton';
import { ArrowRight, Users, HandCoins, Sprout, GraduationCap, BookOpen } from 'lucide-react';
import { enterSampleMode } from '@/lib/sample-mode';
import { startRolePreview, useSampleRole } from '@/lib/use-role-navigation';
import { useAuth } from '@/lib/auth';
import type { UserRole } from '@/lib/db/types';
import { readSampleChooserAccountRole } from '@/lib/sample-choice-access';
import { sampleChoicesForAccount } from '@/lib/sample-tour';
import styles from './samples.module.css';

const examples = [
  { role: 'ngo', label: 'Organisation', Icon: Users, description: 'Manage gardens, people, assessments and programme reports.' },
  { role: 'funder', label: 'Funder', Icon: HandCoins, description: 'Review shared progress, production areas and funded gardens.' },
  { role: 'farmer', label: 'Farmer', Icon: Sprout, description: 'Try the garden map, Design Studio, crop plan and money book.' },
  { role: 'mentor', label: 'Mentor', Icon: GraduationCap, description: 'Explore assigned growers, visits, guidance and training records.' },
  { role: 'student', label: 'Student', Icon: BookOpen, description: 'Explore the course, lessons, activities and learning progress.' },
] as const;

export default function SamplesPage() {
  const router = useRouter();
  const [error, setError] = useState('');
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
  const sampleRole = useSampleRole();

  function openView(view: string) {
    if (!availableRoles.includes(view)) return;
    if (startRolePreview(view)) router.push('/' + view);
    else setError('Sample mode could not start. Please allow session storage and try again.');
  }

  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <header className={styles.header}>
          <MenuButton />
          <BackButton fallback="/account" />
          <Link href="/account">Account</Link>
        </header>

        <div className={styles.intro}>
          <p className={styles.eyebrow}>ImbewuField · Sample workspace</p>
          <h1>Choose a sample view</h1>
          <p>Explore five workspaces using fictional people and programme results.</p>
        </div>

        {error && <p className={styles.error} role="alert">{error}</p>}

        {!choicesReady && <p className={styles.accessNote} role="status">Checking your sample access…</p>}
        {choicesReady && user && !accountRole && <p className={styles.error} role="alert">Your account role could not be confirmed. Refresh your access in Account, then return here.</p>}
        {choicesReady && accountRole && !['ngo', 'admin'].includes(accountRole) && <p className={styles.accessNote}>Your {accountRole} account opens the matching sample. All five views are shown below.</p>}

        <section className={styles.views} aria-label="All sample views">
          {examples.map(({ role: view, label, Icon, description }) => (
            <button
              key={view}
              type="button"
              className={styles.viewCard}
              aria-label={`Open ${label} sample`}
              aria-pressed={sampleRole === view}
              disabled={!availableRoles.includes(view)}
              onClick={() => openView(view)}
            >
              <Icon className={styles.viewIcon} size={28} aria-hidden="true" />
              <span className={styles.viewCopy}>
                <span className={styles.viewTitle}>{label}</span>
                <span className={styles.description}>{description}</span>
              </span>
              <span className={styles.openView}>
                <span>{!choicesReady ? 'Checking access…' : !availableRoles.includes(view) ? 'Unavailable for this account' : sampleRole === view ? 'Continue this view' : 'Open sample'}</span>
                <ArrowRight size={18} aria-hidden="true" />
              </span>
            </button>
          ))}
        </section>

        <p className={styles.sessionNote}>
          Use the <strong>Sample</strong> menu badge to switch views, take the tour or exit.
          {' '}Practice records reset when you reload or reset the sample.
        </p>

        <section className={styles.explore} aria-label="Gardens and guided tour">
          <article className={styles.exploreCard}>
            <h2>Browse 18 sample gardens</h2>
            <p>Homesteads, commercial plots, crèches, schools and community gardens, each with a layout, people and a report.</p>
            <Link className={styles.linkButton} href="/samples/gardens">Browse the gardens <ArrowRight size={17} aria-hidden="true" /></Link>
          </article>
          <article className={styles.exploreCard}>
            <h2>Try the complete farm workspace</h2>
            <p>Open Ubhejane’s editable design, assessment, household and soil examples, photos and evidence report.</p>
            <div className={styles.actions}>
              <Link className={styles.linkButton} href="/samples/farm">Open Ubhejane</Link>
              <Link className={styles.tourLink} href="/tour">Start the 15-minute tour <ArrowRight size={17} aria-hidden="true" /></Link>
            </div>
          </article>
        </section>

        <footer className={styles.footer}>
          <p>Ubhejane uses a real saved garden design. Sample people, programme results, household answers and soil records are illustrative. Your account permissions stay the same.</p>
          <button type="button" className={styles.reset} onClick={() => {
            if (enterSampleMode()) window.location.reload();
            else setError('The sample could not reset. Please allow session storage and try again.');
          }}>Reset sample</button>
        </footer>
      </div>
    </main>
  );
}
