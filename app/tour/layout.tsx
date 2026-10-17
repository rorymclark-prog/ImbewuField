import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Take a tour — ImbewuField' };

export default function TourLayout({ children }: { children: React.ReactNode }) {
  return children;
}
