'use client';
import { useRouter } from 'next/navigation';
import { startRolePreview } from '@/lib/use-role-navigation';
import { useState } from 'react';
import MelDashboard from './MelDashboard';
import ProgrammeEvidence from './ProgrammeEvidence';
import FieldTeams from './FieldTeams';
import styles from './MelDashboard.module.css';

export default function OrganisationControlCentre() {
  const router = useRouter();
  const [tab, setTab] = useState<'people' | 'teams' | 'preview' | 'branding'>('people');
  const [error, setError] = useState('');
  return <section className={styles.root}><div className={styles.wrap}>
    <div className={styles.hero}><h1>Organisation control centre</h1><p>Manage your team, decide what is shared and explore each role.</p></div>
    <div className={styles.row}>{([['people', 'People & permissions'], ['teams', 'Mentor teams'], ['preview', 'View as a role'], ['branding', 'Names & logos']] as const).map(([key, label]) => <button key={key} aria-pressed={tab === key} onClick={() => setTab(key)}>{label}</button>)}</div>
    {tab === 'people' && <MelDashboard accessOnly />}
    {tab === 'branding' && <ProgrammeEvidence initialTab="branding" />}
    {tab === 'teams' && <FieldTeams organisation />}
    {tab === 'preview' && <><p className={styles.notice}>These previews use fictional sample data. They show each role’s workspace without signing in as another person or changing anyone’s permissions. They do not impersonate a particular user’s live data or custom access.</p><div className={styles.grid}>{([['farmer', 'Farmer'], ['mentor', 'Mentor / extension officer'], ['student', 'Student'], ['ngo', 'Organisation'], ['funder', 'Funder']] as const).map(([role, label]) => <button key={role} className={styles.card} onClick={() => { if (startRolePreview(role)) router.push(`/${role}`); else setError('The sample could not open. Please try again.'); }}><h2>{label}</h2><p>Open sample workspace →</p></button>)}</div>{error && <p role="alert">{error}</p>}</>}
  </div></section>;
}
