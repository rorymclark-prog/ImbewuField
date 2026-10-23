import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Permaculture manual — ImbewuField' };

export default function ManualLayout({ children }: { children: React.ReactNode }) {
  return children;
}
