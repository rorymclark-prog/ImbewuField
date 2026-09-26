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
import { resolveSampleChooserDraft, SESOTHO_SAMPLE_CHOOSER_DRAFT } from '@/lib/sample-chooser-translation-draft-st';
import { useLanguage } from '@/lib/i18n';
import styles from '@/components/MelDashboard.module.css';
const icons = { ngo: Users, funder: HandCoins, farmer: Sprout, mentor: GraduationCap, student: BookOpen };
const examplesEn = [
  ['ngo', 'Organisation', 'Run a programme', 'Explore gardens, assessments, reports and the organisation Control centre.'],
  ['funder', 'Funder', 'Review what is shared', "See the same programme through its published summaries."],
  ['farmer', 'Farmer', 'Explore Ubhejane Crèche', 'Open the farm map, crop plan, harvests and example sales.'],
  ['mentor', 'Mentor', 'Support a grower', 'Explore assigned farmers, organisation guidance, visits and reports.'],
  ['student', 'Student', 'Try the learning workspace', "Explore the existing course and progress."],
] as const;
const examplesZu = [
  ['ngo', 'Inhlangano', 'Qalisa uhlelo', 'Hlola izingadi, ukuhlola, imibiko kanye nesikhungo sokulawula inhlangano.'],
  ['funder', 'Umxhasi', 'Buyekeza okwabiwe', 'Bona uhlelo olufanayo ngezifinyezo zalo ezishicilelwe.'],
  ['farmer', 'Umlimi', 'Hlola i-Ubhejane Crèche', 'Vula imephu yepulazi, uhlelo lwezitshalo, izivuno nezibonelo zokuthengisa.'],
  ['mentor', 'Umeluleki', 'Sekela umlimi', 'Hlola abalimi ababelwe wena, isiqondiso senhlangano, ukuvakashela nemibiko.'],
  ['student', 'Umfundi', 'Zama indawo yokufunda', 'Hlola izifundo nenqubekela-phambili ekhona.'],
] as const;
function PairedDraft({ pair, inline = false }: { pair: typeof SESOTHO_SAMPLE_CHOOSER_DRAFT.heading; inline?: boolean }) {
  if (pair.reviewStatus === 'hold') return <>{pair.sourceEnglish}</>;
  return <>{resolveSampleChooserDraft(pair, 'st')}<span style={{ display: inline ? 'inline' : 'block', fontSize: inline ? '0.72em' : '0.82em', fontWeight: 400, opacity: 0.78 }}> English: {pair.sourceEnglish}</span></>;
}
export default function SamplesPage() {
  const router = useRouter(); const [error, setError] = useState('');
  const { lang } = useLanguage();
  const ui = (english: string, zulu: string) => lang === 'zu' ? zulu : english;
  const draftText = (pair: typeof SESOTHO_SAMPLE_CHOOSER_DRAFT.heading) => resolveSampleChooserDraft(pair, lang);
  const examples = lang === 'zu' ? examplesZu : lang === 'st'
    ? (Object.entries(SESOTHO_SAMPLE_CHOOSER_DRAFT.roles) as [keyof typeof SESOTHO_SAMPLE_CHOOSER_DRAFT.roles, (typeof SESOTHO_SAMPLE_CHOOSER_DRAFT.roles)[keyof typeof SESOTHO_SAMPLE_CHOOSER_DRAFT.roles]][])
      .map(([id, copy]) => [id, draftText(copy.label), draftText(copy.title), draftText(copy.subtitle)] as const)
    : examplesEn;
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
    <header className={styles.row}><MenuButton /><BackButton fallback="/account" /><Link href="/account">{ui('Account', 'I-akhawunti')}</Link></header>
    <div className={styles.hero} style={{ marginTop: 16, padding:20 }}><span style={lang === 'st' ? { display: 'block' } : undefined}>{lang === 'st' ? <>IMBEWUFIELD · <PairedDraft pair={SESOTHO_SAMPLE_CHOOSER_DRAFT.eyebrow} inline /></> : `IMBEWUFIELD · ${ui('EXPLORE', 'HLOLA')}`}</span><h1>{lang === 'st' ? <PairedDraft pair={SESOTHO_SAMPLE_CHOOSER_DRAFT.heading} /> : ui('Choose a view', 'Khetha indawo yokusebenza')}</h1><p style={lang === 'st' ? { display: 'block' } : undefined}>{lang === 'st' ? <PairedDraft pair={SESOTHO_SAMPLE_CHOOSER_DRAFT.intro} /> : ui('Explore each workspace. Use Tour in the menu to return here.', 'Hlola indawo ngayinye yokusebenza. Sebenzisa uHambo kumenyu ukuze ubuyele lapha.')}</p>{lang === 'st' && <p role="note" style={{ display: 'block', marginBottom: 0, fontWeight: 700 }}>Sesotho machine draft · awaiting fluent review</p>}</div>
    {error && <p role="alert">{error}</p>}
    <section aria-label={lang === 'st' ? `${draftText(SESOTHO_SAMPLE_CHOOSER_DRAFT.sectionLabel)} (${SESOTHO_SAMPLE_CHOOSER_DRAFT.sectionLabel.sourceEnglish})` : ui('All views', 'Zonke izindawo')} style={{marginBottom:24}}><h2>{lang === 'st' ? <PairedDraft pair={SESOTHO_SAMPLE_CHOOSER_DRAFT.sectionHeading} /> : ui('Choose your workspace', 'Khetha indawo yakho yokusebenza')}</h2><p>{!choicesReady ? ui('Checking available views…', 'Kubhekwa izindawo ezitholakalayo…') : user && !accountRole ? ui('Your account role could not be confirmed. Refresh your access in Account, then return here.', 'Indima ye-akhawunti yakho ayiqinisekisiwe. Vuselela ukufinyelela kwakho ku-I-akhawunti, bese ubuya lapha.') : accountRole && !['ngo','admin'].includes(accountRole) ? ui(`Your ${accountRole} account opens its matching practice view. Other roles are shown below so the full set is visible.`, `I-akhawunti yakho ye-${accountRole} ivula indawo ehambisana nayo yokuzilolonga. Ezinye izindima ziboniswe ngezansi ukuze ubone zonke.`) : ui('Choose any of the five workspaces.', 'Khetha noma iyiphi yezindawo ezinhlanu zokusebenza.')}</p>
    <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}} aria-label={lang === 'st' ? `${draftText(SESOTHO_SAMPLE_CHOOSER_DRAFT.indexLabel)} (${SESOTHO_SAMPLE_CHOOSER_DRAFT.indexLabel.sourceEnglish})` : ui('View index', 'Uhlu lwezindawo')}>{examples.map(([id,label])=><a key={id} href={`#sample-${id}`} style={{padding:'10px 12px',border:'1px solid var(--border)',borderRadius:20}}>{lang === 'st' ? <PairedDraft pair={SESOTHO_SAMPLE_CHOOSER_DRAFT.roles[id].label} inline /> : label}</a>)}</div>
    <div className={styles.sampleGrid}>{examples.map(([sampleRole, label, title, description]) => { const Icon = icons[sampleRole]; const allowed = availableRoles.includes(sampleRole); const englishLabel = examplesEn.find(([id]) => id === sampleRole)?.[1] ?? label; const roleCopy = SESOTHO_SAMPLE_CHOOSER_DRAFT.roles[sampleRole]; return <article id={`sample-${sampleRole}`} key={sampleRole} className={`${styles.card} ${styles.sampleCard}`}><Icon size={24} aria-hidden="true"/><span className={styles.tag}>{lang === 'st' ? <PairedDraft pair={roleCopy.label} inline /> : label}</span><h3 style={{margin:'8px 0'}}>{lang === 'st' ? <PairedDraft pair={roleCopy.title} /> : title}</h3><p>{lang === 'st' ? <PairedDraft pair={roleCopy.subtitle} /> : description}</p><button type="button" disabled={!allowed} className={styles.primary} onClick={() => { if (!allowed) return; if (startRolePreview(sampleRole)) router.push('/' + sampleRole); else setError(ui('Tour mode could not start. Please allow session storage and try again.', 'Uhambo alukwazanga ukuqala. Vumela ukugcinwa kolwazi lweseshini bese uzama futhi.')); }}>{allowed ? ui(`Open ${lang === 'st' ? englishLabel : label}`, `Vula: ${label}`) : !choicesReady ? ui('Checking access…', 'Kubhekwa ukufinyelela…') : ui('Not available for this account', 'Akutholakali kule akhawunti')}</button></article>; })}</div></section>
    <div className={styles.card}><h2>{ui('Browse 18 different gardens', 'Hlola izingadi ezingu-18 ezahlukene')}</h2><p>{ui('Homesteads, commercial plots, crèches, schools and community gardens. Choose one to see its layout, participants and report.', 'Amakhaya, amapulazi okuhweba, izinkulisa, izikole nezingadi zomphakathi. Khetha eyodwa ukuze ubone isakhiwo sayo, ababambiqhaza nombiko.')}</p><Link className={styles.primary} href="/samples/gardens">{ui('Browse 18 gardens →', 'Hlola izingadi ezingu-18 →')}</Link></div>
    <div className={styles.card}><h2>{ui('Editable farm workspace · Ubhejane', 'Indawo yepulazi ehlelekayo · Ubhejane')}</h2><p>{ui('Ubhejane is currently the connected editable farm. The 18 garden profiles above are overview examples. Try the map and editable design, review a completed assessment, review the household interview and soil record, then download an evidence report.', 'I-Ubhejane iyipulazi elixhunyiwe nelihlelekayo njengamanje. Amaphrofayela ezingadi angu-18 angenhla ayizibonelo zokubuka konke. Zama imephu nomklamo ohlelekayo, buyekeza ukuhlola okuqediwe, ingxoxo yasekhaya nerekhodi lomhlabathi, bese ulanda umbiko wobufakazi.')}</p><div className={styles.row}><Link href="/tour">{ui('Start the 15-minute tour', 'Qala uhambo lwemizuzu engu-15')}</Link><Link href="/samples/farm">{ui('Open the farm evidence pack', 'Vula iphakethe lobufakazi bepulazi')}</Link></div></div>
    <button type="button" onClick={() => { if (enterSampleMode()) window.location.reload(); }}>{ui('Reset tour records', 'Setha kabusha amarekhodi ohambo')}</button>
    <p>{ui('Changes stay in this tour session. Resetting or reloading starts fresh. Signing in is not required and switching views never changes your real account permissions.', 'Izinguquko zihlala kulesi seshini sohambo. Ukusetha kabusha noma ukulayisha kabusha kuqala kabusha. Akudingeki ungene ngemvume futhi ukushintsha izindawo akuguquli izimvume ze-akhawunti yakho yangempela.')}</p>
  </div></main>;
}
