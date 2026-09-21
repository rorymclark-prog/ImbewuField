import Link from 'next/link';
import { notFound } from 'next/navigation';
import MenuButton from '@/components/MenuButton';
import BackButton from '@/components/BackButton';
import FinanceText from '@/components/studies/FinanceText';
import { DESIGN_COURSE, DESIGN_LESSONS, DESIGN_GUIDE_NAMES, designLesson } from '@/lib/course-design';
import styles from '@/components/studies/FinanceCourse.module.css';

export const metadata = { title: 'Permaculture design lesson — teaching preview', robots: { index: false, follow: false } };
export function generateStaticParams() { return DESIGN_LESSONS.map(({ lesson }) => ({ lesson: lesson.id })); }

export default async function DesignLessonPage({ params }: { params: Promise<{ lesson: string }> }) {
  const { lesson: id } = await params;
  const entry = designLesson(id);
  if (!entry) notFound();
  const { unit, lesson } = entry;
  const index = DESIGN_LESSONS.findIndex(item => item.lesson.id === id);
  const previous = DESIGN_LESSONS[index - 1]?.lesson;
  const next = DESIGN_LESSONS[index + 1]?.lesson;
  const section = (title: string) => lesson.sections.find(item => item.title === title)!.text;
  const [question, feedback] = section('Check').split('**Answer:**');
  const companion = lesson.sections.filter(item => item.title.startsWith('App companion'));
  return <div className={styles.page}>
    <header className={styles.header}><MenuButton /><BackButton fallback="/student/design" /><Link href="/student/design">Design a homestead</Link><span>{lesson.code} · {index + 1} / {DESIGN_LESSONS.length}</span></header>
    <main className={styles.main}>
      <section className={styles.hero}><div className={styles.heroText}><p className={styles.eyebrow}>Stage {unit.number} · {unit.title}</p><h1>{lesson.title}</h1><p>{section('Question to show')}</p><div className={styles.actions}><a href="#read">Read the idea</a><a href="#practice">Try the task</a><a href="#check">Check your understanding</a></div></div></section>
      <aside className={`${styles.notice} ${styles.projectNotice}`}><p><strong>English teaching preview.</strong> Use a notebook, drawings or supported spoken answers. The measured worked example and plan set remain incomplete. These pages do not certify a design or award assessed progress. Audio and offline downloads are not yet available for this pathway.</p></aside>
      <section className={`${styles.section} ${styles.reading}`} id="read"><h2>The idea</h2><FinanceText text={section('Teaching text')} /></section>
      <section className={styles.section}><p className={styles.eyebrow}>The busy yard · invented classroom example</p><h2>Follow the decision</h2><FinanceText text={section('Worked example')} /><div className={styles.actions}><Link href="/student/design/case">See the full case and source notes →</Link></div></section>
      <section className={styles.section} id="practice"><h2>Make the next part of your folder</h2><FinanceText text={section('Learner task')} /><h3>What your partner or facilitator should look for</h3><FinanceText text={section('Evidence for feedback')} /><div className={styles.actions}><Link href={`/student/design/folder#folder-${unit.id}`}>Record this stage in your design folder →</Link></div></section>
      <section className={styles.section} id="check"><h2>Pause and explain</h2><FinanceText text={question} /><p>Try your own explanation before opening the discussion answer.</p><details><summary>Compare your reasoning</summary><FinanceText text={feedback} /></details></section>
      <section className={styles.section}><h2>Use the app alongside this lesson</h2><p>Practise in the sample farm first. Keep the source map and its measurements when trying a proposal. A paper design folder is also valid.</p>{companion.map(item => <FinanceText key={item.title} text={item.text} />)}<div className={styles.actions}>{unit.guides.map(id => <Link key={id} href={`/student/guides/${id}`}>{DESIGN_GUIDE_NAMES[id]} →</Link>)}{unit.id === 'd5' && <Link href="/student/finance">Farm Finance course →</Link>}</div></section>
      <section className={styles.section}><details><summary>Sources and further reading</summary><p>Drawn from Rory’s course outlines, handbook and RVCC planning material, with the design framework checked against these primary references.</p><ul>{DESIGN_COURSE.sources.map(source => <li key={source.url}><a href={source.url}>{source.label}</a></li>)}</ul></details><nav aria-label="Design lesson navigation" className={styles.actions}>{previous && <Link href={`/student/design/${previous.id}`}>← {previous.title}</Link>}{next ? <Link className={styles.primary} href={`/student/design/${next.id}`}>Next: {next.title} →</Link> : <Link className={styles.primary} href="/student/design">Return to the pathway</Link>}</nav></section>
    </main>
  </div>;
}
