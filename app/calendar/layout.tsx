import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Planting calendar — ImbewuField' };

export default function CalendarLayout({ children }: { children: React.ReactNode }) {
  return children;
}
