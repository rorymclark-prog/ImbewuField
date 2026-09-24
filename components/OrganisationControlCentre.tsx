'use client';
import { useRouter } from 'next/navigation';
import { startRolePreview } from '@/lib/use-role-navigation';
import { useState } from 'react';
import MelDashboard from './MelDashboard';
import ProgrammeEvidence from './ProgrammeEvidence';
import FieldTeams from './FieldTeams';
import MemberAccessPreview from './MemberAccessPreview';
import styles from './MelDashboard.module.css';
import { useLanguage } from '@/lib/i18n';

export default function OrganisationControlCentre() {
  const { lang } = useLanguage();
  const ui = (en: string, zu: string) => lang === 'zu' ? zu : en;
  const router = useRouter();
  const [tab, setTab] = useState<'people' | 'teams' | 'preview' | 'branding'>('people');
  const [error, setError] = useState('');
  return <section className={styles.root}><div className={styles.wrap}>
    <div className={styles.hero}><h1>{ui('Organisation control centre','Isikhungo sokuphatha inhlangano')}</h1><p>{ui('Manage your team, decide what is shared and explore each role.','Phatha ithimba lakho, khetha okuzokwabelwana ngakho, futhi uhlole izindima ezahlukene.')}</p></div>
    <div className={styles.row}>{([['people', ui('People & permissions','Abantu nezimvume')], ['teams', ui('Mentor teams','Amaqembu abeluleki')], ['preview', ui('View as a role','Buka njengomuntu onendima ethile')], ['branding', ui('Names & logos','Amagama namalogo')]] as const).map(([key, label]) => <button key={key} aria-pressed={tab === key} onClick={() => setTab(key)}>{label}</button>)}</div>
    {tab === 'people' && <MelDashboard accessOnly />}
    {tab === 'branding' && <ProgrammeEvidence initialTab="branding" />}
    {tab === 'teams' && <FieldTeams organisation />}
    {tab === 'preview' && <MemberAccessPreview />}
    {tab === 'preview' && <><p className={styles.notice}>{ui('Explore each role’s workspace. Your account permissions stay unchanged.','Hlola indawo yokusebenza yendima ngayinye. Izimvume ze-akhawunti yakho azishintshi.')}</p><div className={styles.grid}>{([['farmer', ui('Farmer','Umlimi')], ['mentor', ui('Mentor / extension officer','Umeluleki / isikhulu sezolimo')], ['student', ui('Student','Umfundi')], ['ngo', ui('Organisation','Inhlangano')], ['funder', ui('Funder','Umxhasi')]] as const).map(([role, label]) => <button key={role} className={styles.card} onClick={() => { if (startRolePreview(role)) router.push(`/${role}`); else setError(ui('The practice workspace could not open. Please try again.','Indawo yokuzijwayeza ayivulekanga. Zama futhi.')); }}><h2>{label}</h2><p>{ui('Open workspace →','Vula indawo yokusebenza →')}</p></button>)}</div>{error && <p role="alert">{error}</p>}</>}
  </div></section>;
}
