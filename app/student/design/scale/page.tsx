import MenuButton from '@/components/MenuButton';
import BackButton from '@/components/BackButton';
import DesignScalePractice from '@/components/studies/DesignScalePractice';
import { buildDemoFacilitatorState } from '@/lib/demo-farm';
import { sampleScalePair } from '@/lib/design-scale';
import OfflinePageLink from '@/components/studies/OfflinePageLink';
import DesignDraftCopy, { DesignDraftNotice } from '@/components/studies/DesignDraftCopy';
import styles from '@/components/studies/FinanceCourse.module.css';

export const metadata = { title: 'Read the scale, check the space — design practice', robots: { index: false, follow: false } };

export default function DesignScalePage() {
  const pair = sampleScalePair(buildDemoFacilitatorState().items);
  return <div className={styles.page}>
    <header className={styles.header}><MenuButton /><BackButton fallback="/student/design/d4-1" /><OfflinePageLink href="/student/design"><DesignDraftCopy en="Design a homestead" zu="Dizayina ikhaya" /></OfflinePageLink><span><DesignDraftCopy en="Scale practice" zu="Ukuzilolonga ngesikali" /></span></header>
    <main className={styles.main}>
      <DesignDraftNotice />
      <section className={styles.hero}><div className={styles.heroText}><p className={styles.eyebrow}><DesignDraftCopy en="A model you can inspect" zu="Imodeli ongayihlola" /></p><h1><DesignDraftCopy en="Read the scale. Check the space." zu="Funda isikali. Hlola isikhala." /></h1><p>Follow the dimensions from the source to the drawing. Compare a gap, touching edges and an overlap before trusting an area total.</p><div className={styles.actions}><a className={styles.primary} href="#explore"><DesignDraftCopy en="Explore the arrangements →" zu="Hlola ukuhleleka kwezinto →" /></a><a href="#source"><DesignDraftCopy en="Read the supplied dimensions" zu="Funda izilinganiso ezinikeziwe" /></a></div></div></section>
      <DesignScalePractice pair={pair} />
    </main>
  </div>;
}
