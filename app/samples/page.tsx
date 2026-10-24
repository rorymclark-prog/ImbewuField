'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppHeader from '@/components/layout/AppHeader';
import TabBar from '@/components/TabBar';
import { Users, HandCoins, Sprout, GraduationCap, BookOpen, ArrowRight } from 'lucide-react';
import { enterSampleMode } from '@/lib/sample-mode';
import { startRolePreview } from '@/lib/use-role-navigation';
import { useAuth } from '@/lib/auth';
import type { UserRole } from '@/lib/db/types';
import { readSampleChooserAccountRole } from '@/lib/sample-choice-access';
import { sampleChoicesForAccount } from '@/lib/sample-tour';
import { SESOTHO_SAMPLE_CHOOSER_DRAFT } from '@/lib/sample-chooser-translation-draft-st';
import { TSHIVENDA_SAMPLE_CHOOSER_DRAFT } from '@/lib/sample-chooser-translation-draft-ve';
import { useLanguage } from '@/lib/i18n';
import { inlineText, inlineTemplate } from '@/lib/xh-inline';
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
type ChooserPair = {
  sourceEnglish: string;
  reviewStatus: 'machine-draft' | 'hold';
  sesothoDraft?: string;
  tshivendaDraft?: string;
};
function resolveChooserPair(pair: ChooserPair, lang: string) {
  if (pair.reviewStatus === 'hold') return pair.sourceEnglish;
  if (lang === 'st') return pair.sesothoDraft ?? pair.sourceEnglish;
  if (lang === 've') return pair.tshivendaDraft ?? pair.sourceEnglish;
  return pair.sourceEnglish;
}
function PairedDraft({ pair, lang, inline = false }: { pair: ChooserPair; lang: string; inline?: boolean }) {
  if (pair.reviewStatus === 'hold') return <>{pair.sourceEnglish}</>;
  return <>{resolveChooserPair(pair, lang)}<span style={{ display: inline ? 'inline' : 'block', fontSize: inline ? '0.72em' : '0.82em', fontWeight: 400, opacity: 0.78 }}> English: {pair.sourceEnglish}</span></>;
}
export default function SamplesPage() {
  const router = useRouter(); const [error, setError] = useState('');
  const { lang } = useLanguage();
  const ui = (english: string, zulu: string) => inlineText(lang, english, zulu);
  const draftText = (pair: ChooserPair) => resolveChooserPair(pair, lang);
  const regionalRoles = lang === 'st' ? SESOTHO_SAMPLE_CHOOSER_DRAFT.roles : TSHIVENDA_SAMPLE_CHOOSER_DRAFT.roles;
  const examplesXh = examplesEn.map(([id, label, title, description]) => [id, inlineText(lang, label), inlineText(lang, title), inlineText(lang, description)] as const);
  const examples = lang === 'zu' ? examplesZu : lang === 'xh' ? examplesXh : (lang === 'st' || lang === 've')
    ? Object.entries(regionalRoles)
      .map(([id, copy]) => [id as keyof typeof icons, draftText(copy.label), draftText(copy.title), draftText(copy.subtitle)] as const)
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
  return <main className={styles.shell}><AppHeader backFallback="/account" title={ui('Choose a view', 'Khetha indawo yokusebenza')} /><div className={`${styles.root} ${styles.scroller}`} style={{ paddingBottom: 'calc(24px + max(24px, var(--lima-fab-clearance, 0px)) + env(safe-area-inset-bottom, 0px))' }}><div className={styles.wrap}>
    <div className={styles.hero} style={{ marginTop: 16 }}><span style={lang === 'st' || lang === 've' ? { display: 'block' } : undefined}>{lang === 'st' ? <>IMBEWUFIELD · <PairedDraft lang={lang} pair={SESOTHO_SAMPLE_CHOOSER_DRAFT.eyebrow} inline /></> : lang === 've' ? <>IMBEWUFIELD · <PairedDraft lang={lang} pair={TSHIVENDA_SAMPLE_CHOOSER_DRAFT.eyebrow} inline /></> : `IMBEWUFIELD · ${ui('EXPLORE', 'HLOLA')}`}</span><h1>{lang === 'st' ? <PairedDraft lang={lang} pair={SESOTHO_SAMPLE_CHOOSER_DRAFT.heading} /> : lang === 've' ? <PairedDraft lang={lang} pair={TSHIVENDA_SAMPLE_CHOOSER_DRAFT.heading} /> : ui('Choose a view', 'Khetha indawo yokusebenza')}</h1><p style={lang === 'st' || lang === 've' ? { display: 'block' } : undefined}>{lang === 'st' ? <PairedDraft lang={lang} pair={SESOTHO_SAMPLE_CHOOSER_DRAFT.intro} /> : lang === 've' ? <PairedDraft lang={lang} pair={TSHIVENDA_SAMPLE_CHOOSER_DRAFT.intro} /> : ui('Explore each workspace. Use Tour in the menu to return here.', 'Hlola indawo ngayinye yokusebenza. Sebenzisa uHambo kumenyu ukuze ubuyele lapha.')}</p>{lang === 'st' && <p role="note" style={{ display: 'block', marginBottom: 0, fontWeight: 700 }}>Sesotho machine draft · awaiting fluent review</p>}{lang === 've' && <p role="note" style={{ display: 'block', marginBottom: 0, fontWeight: 700 }}>Tshivenda machine draft · awaiting fluent review</p>}</div>
    {error && <p role="alert">{error}</p>}
    <section aria-label={lang === 'st' ? `${draftText(SESOTHO_SAMPLE_CHOOSER_DRAFT.sectionLabel)} (${SESOTHO_SAMPLE_CHOOSER_DRAFT.sectionLabel.sourceEnglish})` : lang === 've' ? `${draftText(TSHIVENDA_SAMPLE_CHOOSER_DRAFT.sectionLabel)} (${TSHIVENDA_SAMPLE_CHOOSER_DRAFT.sectionLabel.sourceEnglish})` : ui('All views', 'Zonke izindawo')} style={{marginBottom:24}}>{/* nav-08: demoted from <h2> to <span> — the hero's h1 above is already this page's one true heading, but the regional-language draft wiring (tests/sample-chooser-translation-draft-*.test.ts) still needs this field rendered and paired. */}<span style={{display:'block',fontSize:13,fontWeight:700,color:'var(--text-secondary)',marginBottom:8}}>{lang === 'st' ? <PairedDraft lang={lang} pair={SESOTHO_SAMPLE_CHOOSER_DRAFT.sectionHeading} /> : lang === 've' ? <PairedDraft lang={lang} pair={TSHIVENDA_SAMPLE_CHOOSER_DRAFT.sectionHeading} /> : ui('Choose your workspace', 'Khetha indawo yakho yokusebenza')}</span><p>{!choicesReady ? ui('Checking available views…', 'Kubhekwa izindawo ezitholakalayo…') : user && !accountRole ? ui('Your account role could not be confirmed. Refresh your access in Account, then return here.', 'Indima ye-akhawunti yakho ayiqinisekisiwe. Vuselela ukufinyelela kwakho ku-I-akhawunti, bese ubuya lapha.') : accountRole && !['ngo','admin'].includes(accountRole) ? inlineTemplate(lang, 'Your {role} account opens its matching example view. Other roles are shown below so the full set is visible.', 'I-akhawunti yakho ye-{role} ivula indawo yesibonelo ehambisana nayo. Ezinye izindima ziboniswe ngezansi ukuze ubone zonke.', { role: lang === 'xh' ? (examplesXh.find(([id]) => id === accountRole)?.[1] ?? accountRole) : accountRole }) : ui('Choose any of the five workspaces.', 'Khetha noma iyiphi yezindawo ezinhlanu zokusebenza.')}</p>
    {/* nav-08: dropped the quick-jump chip row — it only jumped to the same five role cards
        immediately below, repeating the icon/label grid rather than adding anything. */}
    <div className={styles.sampleGrid}>{examples.map(([sampleRole, label, title, description]) => { const Icon = icons[sampleRole]; const allowed = availableRoles.includes(sampleRole); const englishLabel = examplesEn.find(([id]) => id === sampleRole)?.[1] ?? label; const roleCopy = lang === 'st' ? SESOTHO_SAMPLE_CHOOSER_DRAFT.roles[sampleRole] : TSHIVENDA_SAMPLE_CHOOSER_DRAFT.roles[sampleRole]; return <article id={`sample-${sampleRole}`} key={sampleRole} className={`${styles.card} ${styles.sampleCard}`}><Icon size={24} aria-hidden="true"/><span className={styles.tag}>{lang === 'st' ? <PairedDraft lang={lang} pair={roleCopy.label} inline /> : lang === 've' ? <PairedDraft lang={lang} pair={roleCopy.label} inline /> : label}</span><h3 style={{margin:'8px 0'}}>{lang === 'st' ? <PairedDraft lang={lang} pair={roleCopy.title} /> : lang === 've' ? <PairedDraft lang={lang} pair={roleCopy.title} /> : title}</h3><p>{lang === 'st' ? <PairedDraft lang={lang} pair={roleCopy.subtitle} /> : lang === 've' ? <PairedDraft lang={lang} pair={roleCopy.subtitle} /> : description}</p><button type="button" disabled={!allowed} className={styles.primary} onClick={() => { if (!allowed) return; if (startRolePreview(sampleRole)) router.push('/' + sampleRole); else setError(ui('The example workspace could not start. Please allow session storage and try again.', 'Indawo yesibonelo ayikwazanga ukuqala. Vumela ukugcinwa kolwazi lweseshini bese uzama futhi.')); }}>{allowed ? inlineTemplate(lang, 'Open {label}', 'Vula: {label}', { label: lang === 'st' || lang === 've' ? englishLabel : label }) : !choicesReady ? ui('Checking access…', 'Kubhekwa ukufinyelela…') : ui('Not available for this account', 'Akutholakali kule akhawunti')}</button></article>; })}</div></section>
    <div className={styles.stack}>
    <div className={styles.card}><h2>{ui('Browse 18 different gardens', 'Hlola izingadi ezingu-18 ezahlukene')}</h2><p style={{margin:'0 0 16px'}}>{ui('Homesteads, commercial plots, crèches, schools and community gardens. Choose one to see its layout, participants and report.', 'Amakhaya, amapulazi okuhweba, izinkulisa, izikole nezingadi zomphakathi. Khetha eyodwa ukuze ubone isakhiwo sayo, ababambiqhaza nombiko.')}</p><Link className={styles.primary} href="/samples/gardens">{ui('Browse 18 gardens', 'Hlola izingadi ezingu-18')}<ArrowRight size={16} aria-hidden="true" style={{marginLeft:8}} /></Link></div>
    <div className={styles.card}><h2>{ui('Editable farm workspace · Ubhejane', 'Indawo yepulazi ehlelekayo · Ubhejane')}</h2><p>{ui('Ubhejane is currently the connected editable farm. The 18 garden profiles above are overview examples. Try the map and editable design, review a completed assessment, review the household interview and soil record, then download an evidence report.', 'I-Ubhejane iyipulazi elixhunyiwe nelihlelekayo njengamanje. Amaphrofayela ezingadi angu-18 angenhla ayizibonelo zokubuka konke. Zama imephu nomklamo ohlelekayo, buyekeza ukuhlola okuqediwe, ingxoxo yasekhaya nerekhodi lomhlabathi, bese ulanda umbiko wobufakazi.')}</p><div className={styles.row}><Link className={styles.primary} href="/tour">{ui('Start the 15-minute tour', 'Qala uhambo lwemizuzu engu-15')}</Link><Link className={styles.secondary} href="/samples/farm">{ui('Open the farm evidence pack', 'Vula iphakethe lobufakazi bepulazi')}</Link></div></div>
    <div className={styles.card}><h2>{ui('Complete production example', 'Isibonelo sohlelo oluphelele lokukhiqiza')}</h2><p style={{margin:'0 0 16px'}}>{ui('A fictional warm KZN farm with vegetables, staples, fruit, nuts, berries, eggs, milk, honey and fish. View its monthly calendar, young trees and printable plan. Shown in English.', 'Ipulazi lesibonelo endaweni efudumele e-KZN elinemifino, izitshalo eziyisisekelo, izithelo, amantongomane, amajikijolo, amaqanda, ubisi, uju nezinhlanzi. Buka ikhalenda lanyanga zonke, izihlahla ezisencane nohlelo oluphrintekayo. Kuboniswa ngesiNgisi.')}</p><Link className={styles.primary} href="/samples/production">{ui('Open the complete example', 'Vula isibonelo esiphelele')}<ArrowRight size={16} aria-hidden="true" style={{marginLeft:8}} /></Link></div>
    </div>
    <button type="button" className={styles.secondary} onClick={() => { if (enterSampleMode()) window.location.reload(); }}>{ui('Reset tour records', 'Setha kabusha amarekhodi ohambo')}</button>
    <p>{ui('Changes stay in this tour session. Resetting or reloading starts fresh. Signing in is not required and switching views never changes your real account permissions.', 'Izinguquko zihlala kulesi seshini sohambo. Ukusetha kabusha noma ukulayisha kabusha kuqala kabusha. Akudingeki ungene ngemvume futhi ukushintsha izindawo akuguquli izimvume ze-akhawunti yakho yangempela.')}</p>
  </div></div>
  {/* nav-03: without this, /samples was one of the secondary pages that lost the farmer's way home. */}
  <div className="no-print"><TabBar hideAtDesktop/></div>
  </main>;
}
