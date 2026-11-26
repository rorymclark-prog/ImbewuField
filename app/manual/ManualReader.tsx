'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import styles from './ManualLayout.module.css';

export default function ManualReader({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    // A direct chapter link can load before the app has mounted its anchor.
    const id = window.location.hash.slice(1);
    if (!id) return;
    const frame = requestAnimationFrame(() => {
      if (window.scrollY === 0) document.getElementById(id)?.scrollIntoView();
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  return <div className={styles.reader}>{children}</div>;
}
