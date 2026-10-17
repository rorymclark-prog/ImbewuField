import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Design studio — ImbewuField' };

export default function DesignLayout({ children }: { children: React.ReactNode }) {
  return children;
}
