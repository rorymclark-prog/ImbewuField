import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Atlas — ImbewuField' };

export default function AtlasLayout({ children }: { children: React.ReactNode }) {
  return children;
}
