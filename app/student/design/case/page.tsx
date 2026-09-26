import MenuButton from '@/components/MenuButton';
import BackButton from '@/components/BackButton';
import FinanceText from '@/components/studies/FinanceText';
import DesignCasePractice from '@/components/studies/DesignCasePractice';
import { DESIGN_COURSE } from '@/lib/course-design';
import OfflinePageLink from '@/components/studies/OfflinePageLink';
import DesignDraftCopy, { DesignDraftNotice } from '@/components/studies/DesignDraftCopy';
import styles from '@/components/studies/FinanceCourse.module.css';

export const metadata = { title: 'The busy yard — design practice case', robots: { index: false, follow: false } };

export default function DesignCasePage() {
  const [, ...sections] = DESIGN_COURSE.case.text.split(/^## /m);
  const introduction = DESIGN_COURSE.case.text.split(/^## /m)[0].replace(/^# .+\n/, '').trim();
  return <div className={styles.page}>
    <header className={styles.header}><MenuButton /><BackButton fallback="/student/design" /><OfflinePageLink href="/student/design"><DesignDraftCopy en="Design a homestead" zu="Dizayina ikhaya" /></OfflinePageLink><span data-header-secondary><DesignDraftCopy en="The busy yard" zu="Igceke elimatasa" /></span></header>
    <main className={styles.main}>
      <DesignDraftNotice />
      <section className={styles.hero}><div className={styles.heroText}><p className={styles.eyebrow}><DesignDraftCopy en="An invented classroom case" zu="Icala lekilasi eliqanjiwe" /></p><h1><DesignDraftCopy en="A busy yard. A design worth discussing." zu="Igceke elimatasa. Umklamo okufanele kuxoxwe ngawo." /></h1><p>The household wants food, usable access and manageable care. Follow the evidence before adding features to the plan.</p><div className={styles.actions}><a href="#sources"><DesignDraftCopy en="Read the source cards" zu="Funda amakhadi emithombo" /></a><a href="#practice"><DesignDraftCopy en="Try the evidence checks" zu="Zama ukuhlola ubufakazi" /></a></div></div><img src="/studies-guides/sketch-the-site.jpg" alt="Illustrative homestead planning scene; this image is not a measured picture of the practice case" /></section>
      <aside className={`${styles.notice} ${styles.projectNotice}`}><FinanceText text={introduction} /></aside>
      {sections.map((section, i) => { const end = section.indexOf('\n'); return <section className={styles.section} key={i} id={i === 0 ? 'sources' : undefined}><h2>{section.slice(0, end)}</h2><FinanceText text={section.slice(end + 1)} headingLevel={3} /></section>; })}
      <DesignCasePractice />
      <section className={styles.section}><h2><DesignDraftCopy en="Apply the same questions to your own folder" zu="Sebenzisa imibuzo efanayo kufolda yakho" /></h2><p>Keep observed, reported, measured and proposed information distinct. Ask your learning partner to trace a decision from the brief to its source. This early case deliberately remains unmeasured; use the separate fictional worked demonstration to practise a supplied model and a later revision.</p><div className={styles.actions}><OfflinePageLink className={styles.primary} href="/student/design/worked"><DesignDraftCopy en="Open the worked demonstration →" zu="Vula ukuboniswa kwesibonelo esenziwe ngezinyathelo →" /></OfflinePageLink><OfflinePageLink href="/student/design/d1-1"><DesignDraftCopy en="Begin with the household brief →" zu="Qala ngencazelo yezidingo zomuzi →" /></OfflinePageLink><OfflinePageLink href="/student/design"><DesignDraftCopy en="Return to all eighteen lessons" zu="Buyela kuzo zonke izifundo eziyishumi nesishiyagalombili" /></OfflinePageLink></div></section>
    </main>
  </div>;
}
