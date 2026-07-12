import { notFound } from 'next/navigation';
import LessonView from '@/components/guitar/LessonView';
import { getLesson, LESSONS } from '@/lib/guitar/curriculum';

export function generateStaticParams() {
  return LESSONS.map((l) => ({ id: l.id }));
}

export function generateMetadata({ params }: { params: { id: string } }) {
  const lesson = getLesson(params.id);
  return lesson
    ? { title: `Lesson ${lesson.num}: ${lesson.title} — Guitar Studio`, description: lesson.subtitle }
    : {};
}

export default function LessonPage({ params }: { params: { id: string } }) {
  const lesson = getLesson(params.id);
  if (!lesson) notFound();
  return <LessonView lesson={lesson} />;
}
