import MenuButton from '@/components/MenuButton';
import BackButton from '@/components/BackButton';
import DesignScalePractice from '@/components/studies/DesignScalePractice';
import { buildDemoFacilitatorState } from '@/lib/demo-farm';
import { sampleScalePair } from '@/lib/design-scale';
import OfflinePageLink from '@/components/studies/OfflinePageLink';
import styles from '@/components/studies/FinanceCourse.module.css';

export const metadata = { title: 'Read the scale, check the space — design practice', robots: { index: false, follow: false } };

export default function DesignScalePage() {
  const pair = sampleScalePair(buildDemoFacilitatorState().items);
  return <div className={styles.page}>
    <header className={styles.header}><MenuButton /><BackButton fallback="/student/design/d4-1" /><OfflinePageLink href="/student/design">Design a homestead</OfflinePageLink><span>Scale practice</span></header>
    <main className={styles.main}>
      <section className={styles.hero}><div className={styles.heroText}><p className={styles.eyebrow}>A model you can inspect</p><h1>Read the scale.<br />Check the space.</h1><p>Follow the dimensions from the source to the drawing. Compare a gap, touching edges and an overlap before trusting an area total.</p><div className={styles.actions}><a className={styles.primary} href="#explore">Explore the arrangements →</a><a href="#source">Read the supplied dimensions</a></div></div></section>
      <DesignScalePractice pair={pair} />
    </main>
  </div>;
}
