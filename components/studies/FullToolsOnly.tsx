'use client';

import type { ReactNode } from 'react';
import { useAppLevel } from '@/lib/app-level';

/**
 * Renders children only in All tools. Simple leaves this out entirely — still reachable by
 * switching to All tools in Settings (lib/app-level.ts) — rather than a shrunk/collapsed version.
 */
export default function FullToolsOnly({ children }: { children: ReactNode }) {
  return useAppLevel() === 'full' ? <>{children}</> : null;
}
