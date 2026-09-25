import MenuButton from '@/components/MenuButton';
import BackButton from '@/components/BackButton';
import DesignPortfolio from '@/components/studies/DesignPortfolio';
import OfflinePageLink from '@/components/studies/OfflinePageLink';
import DesignDraftCopy, { DesignDraftNotice } from '@/components/studies/DesignDraftCopy';
import styles from '@/components/studies/FinanceCourse.module.css';

export const metadata = { title: 'Your design learning folder — ImbewuField', robots: { index: false, follow: false } };

export default function DesignFolderPage() {
  return <div className={styles.page}>
    <header className={styles.header}><MenuButton /><BackButton fallback="/student/design" /><OfflinePageLink href="/student/design"><DesignDraftCopy en="Design a homestead" zu="Dizayina ikhaya" /></OfflinePageLink><span><DesignDraftCopy en="Your learning folder" zu="Ifolda yakho yokufunda" /></span></header>
    <main className={styles.main}>
      <DesignDraftNotice />
      <section className={styles.hero}><div className={styles.heroText}><p className={styles.eyebrow}><DesignDraftCopy en="From your first question to a checked revision" zu="Kusukela embuzweni wakho wokuqala kuya ekubuyekezeni okuhloliwe" /></p><h1><DesignDraftCopy en="Keep the reasons with the drawing." zu="Gcina izizathu zihambisana nomdwebo." /></h1><p>Build a record of the people, evidence and choices behind your plan. Add to it as you work through the six design stages.</p></div></section>
      <DesignPortfolio />
    </main>
  </div>;
}
