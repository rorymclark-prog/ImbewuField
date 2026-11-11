'use client';

import { usePathname } from 'next/navigation';
import LimaBar from '@/components/LimaBar';
import { usesInternationalReviewHelp } from '@/lib/international/review-help';
import styles from './InternationalReviewHelp.module.css';

export default function InternationalReviewHelp({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  // Do not add a second help strip or scroll owner to the locale worksheets.
  if (!usesInternationalReviewHelp(pathname)) return <>{children}</>;

  return <div data-international-reference-review role="region" aria-label="Country and project review"
    lang="en" tabIndex={0} className={styles.frame}>
    <style>{`@media print {
      body:has([data-international-reference-review]) { height: auto !important; overflow: visible !important; }
    }`}</style>
    {children}
    <div className={styles.help}><LimaBar inPlace /></div>
  </div>;
}
