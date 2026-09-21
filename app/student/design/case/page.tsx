import Link from 'next/link';
import MenuButton from '@/components/MenuButton';
import BackButton from '@/components/BackButton';
import FinanceText from '@/components/studies/FinanceText';
import DesignCasePractice from '@/components/studies/DesignCasePractice';
import { DESIGN_COURSE } from '@/lib/course-design';
import styles from '@/components/studies/FinanceCourse.module.css';

export const metadata = { title: 'The busy yard — design practice case', robots: { index: false, follow: false } };

export default function DesignCasePage() {
  const [, ...sections] = DESIGN_COURSE.case.text.split(/^## /m);
  const introduction = DESIGN_COURSE.case.text.split(/^## /m)[0].replace(/^# .+\n/, '').trim();
  return <div className={styles.page}>
    <header className={styles.header}><MenuButton /><BackButton fallback="/student/design" /><Link href="/student/design">Design a homestead</Link><span>The busy yard</span></header>
    <main className={styles.main}>
      <section className={styles.hero}><div className={styles.heroText}><p className={styles.eyebrow}>An invented classroom case</p><h1>A busy yard.<br />A design worth discussing.</h1><p>The household wants food, usable access and manageable care. Follow the evidence before adding features to the plan.</p><div className={styles.actions}><a href="#sources">Read the source cards</a><a href="#practice">Try the evidence checks</a></div></div><img src="/studies-guides/sketch-the-site.jpg" alt="Illustrative homestead planning scene; this image is not a measured picture of the practice case" /></section>
      <aside className={`${styles.notice} ${styles.projectNotice}`}><FinanceText text={introduction} /></aside>
      {sections.map((section, i) => { const end = section.indexOf('\n'); return <section className={styles.section} key={i} id={i === 0 ? 'sources' : undefined}><h2>{section.slice(0, end)}</h2><FinanceText text={section.slice(end + 1)} headingLevel={3} /></section>; })}
      <DesignCasePractice />
      <section className={styles.section}><h2>Apply the same questions to your own folder</h2><p>Keep observed, reported, measured and proposed information distinct. Ask your learning partner to trace a decision from the brief to its source. This early case deliberately remains unmeasured; use the separate fictional worked demonstration to practise a supplied model and a later revision.</p><div className={styles.actions}><Link className={styles.primary} href="/student/design/worked">Open the worked demonstration →</Link><Link href="/student/design/d1-1">Begin with the household brief →</Link><Link href="/student/design">Return to all eighteen lessons</Link></div></section>
    </main>
  </div>;
}
