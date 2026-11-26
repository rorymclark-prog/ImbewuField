import type { Metadata } from 'next';
import ManualReader from './ManualReader';

export const metadata: Metadata = { title: 'Permaculture manual — ImbewuField' };

export default function ManualLayout({ children }: { children: React.ReactNode }) {
  return <ManualReader>{children}</ManualReader>;
}
