'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

/** Prepared pages contain complete HTML, not every possible Next router prefetch response. */
export default function OfflinePageLink({ href, children, className }: {
  href: string; children: ReactNode; className?: string;
}) {
  return <Link href={href} className={className} onClick={event => {
    if (!navigator.onLine && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      window.location.assign(href);
    }
  }}>{children}</Link>;
}
