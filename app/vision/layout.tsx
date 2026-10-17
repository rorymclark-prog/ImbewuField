import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Lima Vision — ImbewuField' };

export default function VisionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
