import MenuButton from '@/components/MenuButton';
import BackButton from '@/components/BackButton';
import DesignWorkedExample from '@/components/studies/DesignWorkedExample';
import OfflinePageLink from '@/components/studies/OfflinePageLink';
import DesignDraftCopy, { DesignDraftNotice } from '@/components/studies/DesignDraftCopy';
import styles from '@/components/studies/FinanceCourse.module.css';

export const metadata = { title: 'Worked design demonstration — teaching preview', robots: { index: false, follow: false } };

export default function WorkedDesignPage() {
  return <div className={styles.page}>
    <header className={styles.header}><MenuButton /><BackButton fallback="/student/design" /><OfflinePageLink href="/student/design"><DesignDraftCopy en="Design a homestead" zu="Dizayina ikhaya" /></OfflinePageLink><span><DesignDraftCopy en="Worked demonstration" zu="Ukuboniswa komsebenzi oqediwe" /></span></header>
    <main className={styles.main}>
      <DesignDraftNotice />
      <section className={styles.hero}><div className={styles.heroText}><p className={styles.eyebrow}><DesignDraftCopy en="A supplied fictional model" zu="Imodeli eqanjiwe enikeziwe" /></p><h1><DesignDraftCopy en="Follow a plan. Then revise it honestly." zu="Landela uhlelo. Bese ulubuyekeza ngobuqotho." /></h1><p>Compare two provisional concepts against the same household brief. Keep unknowns visible, then update connected records when later care evidence arrives.</p><div className={styles.actions}><a href="#read"><DesignDraftCopy en="Read the source pack" zu="Funda iphakethe lemithombo" /></a><a href="#compare"><DesignDraftCopy en="Compare concepts" zu="Qhathanisa imiqondo" /></a><a href="#practice"><DesignDraftCopy en="Explain the evidence" zu="Chaza ubufakazi" /></a></div></div><img src="/studies-guides/sketch-the-site.jpg" alt="Illustrated growers discussing a paper plan; it is contextual only and not the fictional classroom site" /></section>
      <DesignWorkedExample />
    </main>
  </div>;
}
