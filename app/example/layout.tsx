import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Example farm — ImbewuField' };

export default function ExampleLayout({ children }: { children: React.ReactNode }) {
  return children;
}
