'use client';
import Link from 'next/link';
import { MEL_STAGES } from '@/lib/mel';
import { MEL_TEMPLATES, MEL_TIMING_ZU } from '@/lib/mel-templates';
import styles from './MelDashboard.module.css';
import SurveyZuluDraftPair from './SurveyZuluDraftPair';
import { inlineText } from '@/lib/xh-inline';

/** Template coverage is public information; unpublished responses stay private. */
const ZU_DRAFT = {
  title: 'Indlela ukuhlola okusebenza ngayo · izigaba, izikhathi nezenzo zokufunda',
  cycle: 'Umjikelezo ophelele wokuhlola',
  intro: 'La mathuluzi okuhlola ayatholakala. Imiphumela ivela ngezansi lapho inhlangano isiyibuyekezile futhi yabelana ngayo; ithuluzi elisohlwini lapha alisho ukuthi ukuhlola sekuqediwe.',
  app: 'Umuzwa wokusebenzisa uhlelo lokusebenza',
  project: 'Iphrojekthi nokuqeqeshwa',
  improvement: 'Guqula impendulo ibe ukuthuthukiswa okulandelayo',
  actions: 'Bhala phansi okudinga ukushintsha, ubani ozothatha isinyathelo nokuthi kuzobuyekezwa nini. Izinhlangano zinganamathisela isenzo sokufunda ekuhloleni. Izicelo eziphathelene nohlelo lokusebenza ziya kumthuthukisi ngefomu lempendulo.',
  report: 'Bika inkinga yohlelo noma cela isici esisha →',
  featurePlan: 'Izicelo zesici zilandelelwa ngokwehlukana nemiphumela yokuhlola. Kuhlosiwe ukuxhumanisa isicelo nokukhishwa kohlelo kanye nokuhlola kwakamuva.',
  draftNotice: 'Umbhalo wesiZulu olapha uwuhlaka olungakabuyekezwa.',
} as const;

export default function MelCoverage({ zu = false, lang: langProp }: { zu?: boolean; lang?: string }) {
  const lang = langProp ?? (zu ? 'zu' : 'en');
  const copy = (en: string, draft: string) => zu ? <SurveyZuluDraftPair english={en}>{draft}</SurveyZuluDraftPair> : inlineText(lang, en);
  return <details className={`${styles.card} ${styles.guide}`}>
    <summary>{copy('How assessments work · stages, timing & learning actions', ZU_DRAFT.title)}</summary>
    {zu && <p className={styles.notice} lang="zu">{ZU_DRAFT.draftNotice}</p>}
    {lang === 'xh' && <p className={styles.notice} lang="xh">{inlineText(lang, 'The isiXhosa text here is an unreviewed draft.')}</p>}
    <h2>{copy('The full assessment cycle', ZU_DRAFT.cycle)}</h2>
    <p>{copy('These assessment tools are available. Results appear below when the organisation has reviewed and shared them; a tool listed here does not mean an assessment is complete.', ZU_DRAFT.intro)}</p>
    <div className={styles.grid}>{MEL_STAGES.map(stage=><article key={stage}><span className={styles.tag}>{stage.startsWith('app_') ? copy('App experience', ZU_DRAFT.app) : copy('Project & training', ZU_DRAFT.project)}</span><h3 style={{marginTop:10}}>{zu ? <SurveyZuluDraftPair english={MEL_TEMPLATES[stage].en}>{MEL_TEMPLATES[stage].zu}</SurveyZuluDraftPair> : inlineText(lang, MEL_TEMPLATES[stage].en)}</h3><p>{zu ? <SurveyZuluDraftPair english={MEL_TEMPLATES[stage].timing}>{MEL_TIMING_ZU[stage]}</SurveyZuluDraftPair> : inlineText(lang, MEL_TEMPLATES[stage].timing)}</p></article>)}</div>
    <h3>{copy('Turn feedback into the next improvement', ZU_DRAFT.improvement)}</h3>
    <p>{copy('Record what needs to change, who will act and when to review it. Organisations can attach a learning action to an assessment. App requests go to the developer through the feedback form.', ZU_DRAFT.actions)}</p>
    <Link href="/feedback">{copy('Report a bug or request a feature →', ZU_DRAFT.report)}</Link>
    <p className={styles.muted}>{copy('Feature requests are tracked separately from assessment results. Linking a request to a release and a later assessment is planned.', ZU_DRAFT.featurePlan)}</p>
  </details>;
}
