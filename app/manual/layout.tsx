import type { Metadata } from 'next';
import styles from './ManualLayout.module.css';

export const metadata: Metadata = { title: 'Permaculture manual — ImbewuField' };

export default function ManualLayout({ children }: { children: React.ReactNode }) {
  return <div className={styles.reader}>{children}</div>;
}
