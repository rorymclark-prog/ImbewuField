'use client';

import Link from 'next/link';
import { useSyncExternalStore, type ComponentProps } from 'react';

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  window.addEventListener('popstate', onChange);
  return () => {
    window.removeEventListener('hashchange', onChange);
    window.removeEventListener('popstate', onChange);
  };
}

function chapterHash() {
  const hash = window.location.hash;
  const target = hash && document.getElementById(hash.slice(1));
  return target && target.closest('article') ? hash : '';
}

const serverHash = () => '';

/** Section, glossary and film IDs are shared across editions of the chapter. */
export default function ChapterLanguageLink({ href, ...props }: Omit<ComponentProps<typeof Link>, 'href'> & { href: string }) {
  const hash = useSyncExternalStore(subscribe, chapterHash, serverHash);
  return <Link href={href + hash} {...props} />;
}
