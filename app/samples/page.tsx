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
import { sampleWorkspaceText } from '@/lib/sample-tour-localization';
import LanguageDraftNote from '@/components/LanguageDraftNote';
import { useLanguage } from '@/lib/i18n';
import { inlineTemplate } from '@/lib/xh-inline';
import styles from '@/components/MelDashboard.module.css';
import chooser from './Samples.module.css';
const icons = { ngo: Users, funder: HandCoins, farmer: Sprout, mentor: GraduationCap, student: BookOpen };
const examplesEn = [
    ['ngo', 'Organisation', 'Run a programme', 'Explore gardens, assessments, reports and the organisation Control centre.'],
    ['funder', 'Funder', 'Review what is shared', 'See the same programme through its published summaries.'],
    ['farmer', 'Farmer', 'Explore Ubhejane Crèche', 'Open the farm map, crop plan, harvests and example sales.'],
    ['mentor', 'Mentor', 'Support a grower', 'Explore assigned farmers, organisation guidance, visits and reports.'],
    ['student', 'Student', 'Try the learning workspace', 'Explore the existing course and progress.'],
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
    nativeDraft: string;
};
function PairedDraft({ pair, lang, inline = false }: {
    pair: ChooserPair;
    lang: string;
    inline?: boolean;
}) {
    const { t } = useLanguage();
    if (pair.nativeDraft === pair.sourceEnglish)
        return <span lang="en">{pair.sourceEnglish}</span>;
    return <span className={chooser.pair}><span lang={lang}>{pair.nativeDraft}</span><span lang="en" className={chooser.source} style={{ display: inline ? 'inline' : 'block' }}><span lang={lang}> {t('offlineSourceLabel')}: </span>{pair.sourceEnglish}</span></span>;
}
export default function SamplesPage() {
    const router = useRouter();
    const [error, setError] = useState('');
    const { lang } = useLanguage();
    // isiXhosa: the unreviewed draft keyed by the exact English template (lib/locales/xh-inline).
    const ui = (english: string, zulu: string, values: Record<string, string | number> = {}) => (lang === 'xh' || lang === 'af') ? inlineTemplate(lang, english, null, values) : sampleWorkspaceText(lang, english, zulu, values);
    const pair = (english: string, zulu: string, values: Record<string, string | number> = {}, sourceValues = values): ChooserPair => ({ sourceEnglish: sampleWorkspaceText('en', english, zulu, sourceValues), nativeDraft: ui(english, zulu, values) });
    const paired = (english: string, zulu: string, values: Record<string, string | number> = {}, sourceValues = values) => <PairedDraft lang={lang} pair={pair(english, zulu, values, sourceValues)}/>;
    const examples = examplesEn.map(([id, label, title, description], i) => [id, ui(label, examplesZu[i][1]), ui(title, examplesZu[i][2]), ui(description, examplesZu[i][3])] as const);
    const { role, user, loading } = useAuth();
    const [accountRole, setAccountRole] = useState<UserRole | null>(null), [accessReady, setAccessReady] = useState(false), [verifiedUid, setVerifiedUid] = useState<string | null | undefined>(undefined);
    useEffect(() => {
        let cancelled = false;
        setAccessReady(false);
        if (loading)
            return;
        if (!user) {
            setAccountRole(null);
            setVerifiedUid(null);
            setAccessReady(true);
            return;
        }
        void readSampleChooserAccountRole(user.uid).then(value => { if (!cancelled) {
            setAccountRole(value);
            setVerifiedUid(user.uid);
            setAccessReady(true);
        } }).catch(() => { if (!cancelled) {
            setAccountRole(null);
            setVerifiedUid(user.uid);
            setAccessReady(true);
        } });
        return () => { cancelled = true; };
    }, [loading, user?.uid, role]);
    const choicesReady = !loading && accessReady && verifiedUid === (user?.uid ?? null);
    const availableRoles = sampleChoicesForAccount(accountRole, !!user, choicesReady);
    const shownRole = examples.find(([id]) => id === accountRole)?.[1] ?? accountRole ?? '';
    return <main lang={lang} className={styles.shell}><AppHeader backFallback="/account" title={ui('Choose a view', 'Khetha indawo yokusebenza')}/><div className={`${styles.root} ${styles.scroller}`} style={{ paddingBottom: 'calc(24px + max(24px, var(--lima-fab-clearance, 0px)) + env(safe-area-inset-bottom, 0px))' }}><div className={styles.wrap}>
  <div className={chooser.hero}><span>IMBEWUFIELD · <PairedDraft lang={lang} pair={pair('EXPLORE', 'HLOLA')} inline/></span><h1>{paired('Choose a view', 'Khetha indawo yokusebenza')}</h1><p>{paired('Explore each workspace. Use Tour in the menu to return here.', 'Hlola indawo ngayinye yokusebenza. Sebenzisa uHambo kumenyu ukuze ubuyele lapha.')}</p><LanguageDraftNote lang={lang} scope="sample-chooser"/></div>
  {error && <p role="alert">{paired(error, error === 'The example workspace could not start. Please allow session storage and try again.' ? 'Indawo yesibonelo ayikwazanga ukuqala. Vumela ukugcinwa kolwazi lweseshini bese uzama futhi.' : error)}</p>}
  <section aria-label={ui('All views', 'Zonke izindawo')} style={{ marginBottom: 24 }}><span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>{paired('Choose your workspace', 'Khetha indawo yakho yokusebenza')}</span>
   <p>{!choicesReady ? paired('Checking available views…', 'Kubhekwa izindawo ezitholakalayo…') : user && !accountRole ? paired('Your account role could not be confirmed. Refresh your access in Account, then return here.', 'Indima ye-akhawunti yakho ayiqinisekisiwe. Vuselela ukufinyelela kwakho ku-I-akhawunti, bese ubuya lapha.') : accountRole && !['ngo', 'admin'].includes(accountRole) ? paired('Your {role} account opens its matching example view. Other roles are shown below so the full set is visible.', 'I-akhawunti yakho ye-{role} ivula indawo yesibonelo ehambisana nayo. Ezinye izindima ziboniswe ngezansi ukuze ubone zonke.', { role: lang === 'en' || lang === 'zu' ? accountRole : shownRole }, { role: accountRole }) : paired('Choose any of the five workspaces.', 'Khetha noma iyiphi yezindawo ezinhlanu zokusebenza.')}</p>
   <div className={styles.sampleGrid}>{examples.map(([sampleRole, label, title, description], i) => { const Icon = icons[sampleRole], allowed = availableRoles.includes(sampleRole), english = examplesEn[i], zulu = examplesZu[i]; return <article id={`sample-${sampleRole}`} key={sampleRole} className={`${styles.card} ${styles.sampleCard}`}><Icon size={24} aria-hidden="true"/><span className={styles.tag}><PairedDraft lang={lang} pair={pair(english[1], zulu[1])} inline/></span><h3 style={{ margin: '8px 0' }}>{paired(english[2], zulu[2])}</h3><p>{paired(english[3], zulu[3])}</p><button type="button" disabled={!allowed} className={styles.primary} onClick={() => { if (!allowed)
        return; if (startRolePreview(sampleRole))
        router.push('/' + sampleRole);
    else
        setError('The example workspace could not start. Please allow session storage and try again.'); }}>{allowed ? paired('Open {label}', 'Vula: {label}', { label }, { label: english[1] }) : !choicesReady ? paired('Checking access…', 'Kubhekwa ukufinyelela…') : paired('Not available for this account', 'Akutholakali kule akhawunti')}</button></article>; })}</div>
  </section>
  <div className={styles.stack}>
  <div className={styles.card}><h2>{ui('Browse 18 different gardens', 'Hlola izingadi ezingu-18 ezahlukene')}</h2><p style={{margin:'0 0 16px'}}>{ui('Homesteads, commercial plots, crèches, schools and community gardens. Choose one to see its layout, participants and report.', 'Amakhaya, amapulazi okuhweba, izinkulisa, izikole nezingadi zomphakathi. Khetha eyodwa ukuze ubone isakhiwo sayo, ababambiqhaza nombiko.')}</p><Link className={styles.primary} href="/samples/gardens">{ui('Browse 18 gardens', 'Hlola izingadi ezingu-18')}<ArrowRight size={16} aria-hidden="true" style={{marginLeft:8}} /></Link></div>
  <div className={styles.card}><h2>{ui('Editable farm workspace · Ubhejane', 'Indawo yepulazi ehlelekayo · Ubhejane')}</h2><p>{ui('Ubhejane is currently the connected editable farm. The 18 garden profiles above are overview examples. Try the map and editable design, review a completed assessment, review the household interview and soil record, then download an evidence report.', 'I-Ubhejane iyipulazi elixhunyiwe nelihlelekayo njengamanje. Amaphrofayela ezingadi angu-18 angenhla ayizibonelo zokubuka konke. Zama imephu nomklamo ohlelekayo, buyekeza ukuhlola okuqediwe, ingxoxo yasekhaya nerekhodi lomhlabathi, bese ulanda umbiko wobufakazi.')}</p><div className={styles.row}><Link className={styles.primary} href="/tour">{ui('Start the 15-minute tour', 'Qala uhambo lwemizuzu engu-15')}</Link><Link className={styles.secondary} href="/samples/farm">{ui('Open the farm evidence pack', 'Vula iphakethe lobufakazi bepulazi')}</Link></div></div>
  <div className={styles.card}><h2>{ui('Complete production example', 'Isibonelo sohlelo oluphelele lokukhiqiza')}</h2><p style={{margin:'0 0 16px'}}>{ui('A fictional warm KZN farm with vegetables, staples, fruit, nuts, berries, eggs, milk, honey and fish. View its monthly calendar, young trees and printable plan. Shown in English.', 'Ipulazi lesibonelo endaweni efudumele e-KZN elinemifino, izitshalo eziyisisekelo, izithelo, amantongomane, amajikijolo, amaqanda, ubisi, uju nezinhlanzi. Buka ikhalenda lanyanga zonke, izihlahla ezisencane nohlelo oluphrintekayo. Kuboniswa ngesiNgisi.')}</p><Link className={styles.primary} href="/samples/production">{ui('Open the complete example', 'Vula isibonelo esiphelele')}<ArrowRight size={16} aria-hidden="true" style={{marginLeft:8}} /></Link></div>
  </div>
  <button type="button" className={styles.secondary} onClick={() => { if (enterSampleMode())
        window.location.reload(); }}>{ui('Reset tour records', 'Setha kabusha amarekhodi ohambo')}</button><p>{paired('Changes stay in this tour session. Resetting or reloading starts fresh. Signing in is not required and switching views never changes your real account permissions.', 'Izinguquko zihlala kulesi seshini sohambo. Ukusetha kabusha noma ukulayisha kabusha kuqala kabusha. Akudingeki ungene ngemvume futhi ukushintsha izindawo akuguquli izimvume ze-akhawunti yakho yangempela.')}</p>
 </div></div><div className="no-print"><TabBar hideAtDesktop/></div></main>;
}
