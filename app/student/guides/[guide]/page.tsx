import { notFound } from 'next/navigation';
import AppGuidePage from '@/components/studies/AppGuidePage';
import { APP_GUIDES } from '@/lib/course-app-guides';

export default async function GuidePage({ params }: { params: Promise<{ guide: string }> }) {
  const { guide: id } = await params;
  const guide = APP_GUIDES.find(item => item.id === id);
  if (!guide) notFound();
  return <AppGuidePage key={guide.id} guide={guide} />;
}
