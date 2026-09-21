'use client';

import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

/** Prepared pages contain complete HTML, not every possible Next router prefetch response. */
export default function OfflinePageLink({ href, children, onClick, ...props }: Omit<ComponentProps<typeof Link>, 'href' | 'children'> & {
  href: string; children: ReactNode;
}) {
  return <Link href={href} {...props} onClick={event => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    if (!navigator.onLine && (!props.target || props.target === '_self') && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      window.location.assign(href);
    }
  }}>{children}</Link>;
}
