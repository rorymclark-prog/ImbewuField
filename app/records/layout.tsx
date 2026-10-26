import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'My records — ImbewuField' };

export default function RecordsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
