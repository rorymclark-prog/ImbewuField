import { notFound } from 'next/navigation';
import MenuButton from '@/components/MenuButton';
import BackButton from '@/components/BackButton';
import { FINANCE_LESSONS, FINANCE_APP_GUIDES, financeLesson } from '@/lib/course-finance';
import FinanceText from '@/components/studies/FinanceText';
import FinanceReadingChecklist from '@/components/studies/FinanceReadingChecklist';
import FinanceF1Timeline from '@/components/studies/FinanceF1Timeline';
import f1Practice from '@/docs/studies-review-2026-09-20/reserve/finance/f1-practice.json';
import OfflinePageLink from '@/components/studies/OfflinePageLink';
import styles from '@/components/studies/FinanceCourse.module.css';

export const metadata = { title: 'Farm Finance lesson — ImbewuField teaching preview', robots: { index: false, follow: false } };
export function generateStaticParams() { return FINANCE_LESSONS.map(({ lesson }) => ({ lesson: lesson.id })); }

export default async function FinanceLessonPage({ params }: { params: Promise<{ lesson: string }> }) {
  const { lesson: id } = await params;
  const entry = financeLesson(id);
  if (!entry) notFound();
  const { lesson, unit } = entry;
  const index = FINANCE_LESSONS.findIndex(e => e.lesson.id === id);
  const previous = FINANCE_LESSONS[index - 1]?.lesson;
  const next = FINANCE_LESSONS[index + 1]?.lesson;
  const practice = lesson.practice.filter(s => !/^(Feedback|Corrective feedback)/.test(s.title));
  const feedback = lesson.practice.filter(s => /^(Feedback|Corrective feedback)/.test(s.title));
  return <div className={styles.page}>
    <header className={styles.header}><MenuButton /><BackButton fallback="/student/finance" /><OfflinePageLink href="/student/finance">Farm Finance</OfflinePageLink><span>{lesson.code} · {index + 1} / 24</span></header>
    <main className={styles.main}>
      <section className={styles.hero}>
        <div className={styles.heroText}><p className={styles.eyebrow}>Unit {unit.number} · {unit.title}</p><h1>{lesson.title}</h1>{lesson.outcome && <p>{lesson.outcome}</p>}
          <div className={styles.actions}><a href="#read">Read the lesson</a><a href="#practice">Work through examples</a><a href="#unit-material">Practice materials</a></div>
        </div>
        <img src={unit.image} alt="Illustrated homestead setting for practical farm record keeping" />
      </section>
      <aside className={`${styles.notice} ${styles.projectNotice}`}><p><strong>English teaching preview.</strong> Work through these examples with a facilitator or learning partner. The amounts and dates are invented practice inputs, not advice for your own accounts.</p></aside>
      <section id="read" className={`${styles.section} ${styles.reading}`}><h2>The idea</h2><FinanceText text={lesson.reading} /></section>
      {lesson.id === 'f1-2' && <FinanceF1Timeline practice={f1Practice} />}
      <section id="unit-material" className={styles.section}>
        <h2>Practice materials for Unit {unit.number}</h2>
        <p>Use this unit’s own opening balances and source cards. Do not carry a previous unit’s totals into this exercise.</p>
        {unit.workbook ? <div className={styles.actions}><a href={unit.workbook}>Open the printable workbook (PDF)</a></div> : <p>Use the event cards and worked examples below with a notebook and calculator.</p>}
        <details><summary>Open the unit’s setting, source cards and worked answers</summary>{unit.shared.map(section => <section key={section.title} className={styles.practice}><h3>{section.title}</h3><FinanceText text={section.text} /></section>)}</details>
      </section>
      <section id="practice" className={styles.section}>
        <h2>Worked examples and practice</h2>
        <p>Some examples include their worked answers. Pause before reading them and try the calculation or decision yourself. These are practice activities, not a graded test.</p>
        {practice.map((section, i) => <section key={`${section.title}-${i}`} className={styles.practice}><h3>{section.title.replace(/^Independent (attempt|check|task|decision)$/i, 'Try another example')}</h3><FinanceText text={section.text} /></section>)}
        {feedback.length > 0 && <details className={styles.practice}><summary>Discuss mistakes and try again</summary>{feedback.map((section, i) => <FinanceText key={i} text={section.text} />)}</details>}
      </section>
      <section className={styles.section}><h2>Use the app alongside this lesson</h2><p>Read the relevant guide, then practise in the sample farm. Keep workbook figures out of your real farm records.</p><div className={styles.actions}>{FINANCE_APP_GUIDES[unit.id].map(guide => <OfflinePageLink key={guide.href} href={guide.href}>{guide.title} →</OfflinePageLink>)}</div></section>
      {unit.sources.length > 0 && <section className={`${styles.section} ${styles.sourceLinks}`}><details><summary>Sources and further reading</summary><ul>{unit.sources.map(source => <li key={source.url}><a href={source.url}>{source.label}</a></li>)}</ul></details></section>}
      {lesson.id === 'f8-3' && <section className={styles.section}><h2>Bring the course together</h2><p>Try the connected practice case, then work through an independent case with fresh figures.</p><div className={styles.actions}><OfflinePageLink href="/student/finance/project/guided">Open the practical project →</OfflinePageLink></div></section>}
      <section className={styles.section}><h2>Keep your place</h2><FinanceReadingChecklist lessonId={lesson.id} lessonIds={FINANCE_LESSONS.map(e => e.lesson.id)} />
        <nav aria-label="Finance lesson navigation" className={styles.actions}>{previous && <OfflinePageLink href={`/student/finance/${previous.id}`}>← {previous.title}</OfflinePageLink>}{next ? <OfflinePageLink className={styles.primary} href={`/student/finance/${next.id}`}>Next: {next.title} →</OfflinePageLink> : <OfflinePageLink className={styles.primary} href="/student/finance">Return to the course outline</OfflinePageLink>}</nav>
      </section>
    </main>
  </div>;
}
