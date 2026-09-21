import MenuButton from '@/components/MenuButton';
import BackButton from '@/components/BackButton';
import DesignPortfolio from '@/components/studies/DesignPortfolio';
import OfflinePageLink from '@/components/studies/OfflinePageLink';
import styles from '@/components/studies/FinanceCourse.module.css';

export const metadata = { title: 'Your design learning folder — ImbewuField', robots: { index: false, follow: false } };

export default function DesignFolderPage() {
  return <div className={styles.page}>
    <header className={styles.header}><MenuButton /><BackButton fallback="/student/design" /><OfflinePageLink href="/student/design">Design a homestead</OfflinePageLink><span>Your learning folder</span></header>
    <main className={styles.main}>
      <section className={styles.hero}><div className={styles.heroText}><p className={styles.eyebrow}>From your first question to a checked revision</p><h1>Keep the reasons<br />with the drawing.</h1><p>Build a record of the people, evidence and choices behind your plan. Add to it as you work through the six design stages.</p></div></section>
      <DesignPortfolio />
    </main>
  </div>;
}
