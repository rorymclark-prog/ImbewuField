import Link from 'next/link';
import MenuButton from '@/components/MenuButton';
import BackButton from '@/components/BackButton';
import DesignWorkedExample from '@/components/studies/DesignWorkedExample';
import styles from '@/components/studies/FinanceCourse.module.css';

export const metadata = { title: 'Worked design demonstration — teaching preview', robots: { index: false, follow: false } };

export default function WorkedDesignPage() {
  return <div className={styles.page}>
    <header className={styles.header}><MenuButton /><BackButton fallback="/student/design" /><Link href="/student/design">Design a homestead</Link><span>Worked demonstration</span></header>
    <main className={styles.main}>
      <section className={styles.hero}><div className={styles.heroText}><p className={styles.eyebrow}>A supplied fictional model</p><h1>Follow a plan.<br />Then revise it honestly.</h1><p>Compare two provisional concepts against the same household brief. Keep unknowns visible, then update connected records when later care evidence arrives.</p><div className={styles.actions}><a href="#read">Read the source pack</a><a href="#compare">Compare concepts</a><a href="#practice">Explain the evidence</a></div></div><img src="/studies-guides/sketch-the-site.jpg" alt="Illustrated growers discussing a paper plan; it is contextual only and not the fictional classroom site" /></section>
      <DesignWorkedExample />
    </main>
  </div>;
}
