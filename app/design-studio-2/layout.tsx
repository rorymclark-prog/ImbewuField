import type { Metadata } from 'next';

// Design Studio 2.0 is an unlinked comparison scaffold (see app/design-studio-2/page.tsx) — it
// must never show up in search results while it sits beside the production studio.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function DesignStudio2Layout({ children }: { children: React.ReactNode }) {
  return children;
}
