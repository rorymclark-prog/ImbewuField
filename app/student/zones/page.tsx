'use client';

import StudyHeader from '@/components/studies/StudyHeader';
import ZoneExplorer from '@/components/studies/ZoneExplorer';
import TabBar from '@/components/TabBar';
import { useLanguage } from '@/lib/i18n';
import styles from '@/components/studies/ZoneExplorer.module.css';

export default function StudyZonesPage() {
  const { lang } = useLanguage();
  return <>
    <StudyHeader title="Explore farm zones" backFallback="/student" />
    <main className={styles.studyPage}>
      <h1 className={styles.pageTitle} lang="en">Farm zone tour</h1>
      <ZoneExplorer lang={lang} initiallyOpen />
    </main>
    <TabBar />
  </>;
}
