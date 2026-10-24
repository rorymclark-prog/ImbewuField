import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import styles from './Summary.module.css';

/** A `<summary>` with the Lucide chevron in place of the browser's triangle (same pattern as the notice summary). */
export default function Summary({ children }: { children: ReactNode }) {
  return <summary className={styles.summary}><span>{children}</span><ChevronDown className={styles.chevron} size={20} aria-hidden="true" /></summary>;
}
