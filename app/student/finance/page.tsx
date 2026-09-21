import Link from 'next/link';
import MenuButton from '@/components/MenuButton';
import BackButton from '@/components/BackButton';
import { FINANCE_UNITS, FINANCE_LESSONS } from '@/lib/course-finance';
import FinanceReadingChecklist from '@/components/studies/FinanceReadingChecklist';
import styles from '@/components/studies/FinanceCourse.module.css';

export const metadata = { title: 'Farm Finance — ImbewuField teaching preview', robots: { index: false, follow: false } };

export default function FarmFinancePage() {
  return <div className={styles.page}>
    <header className={styles.header}><MenuButton /><BackButton fallback="/student" /><Link href="/student">My Studies</Link><span>Farm Finance</span></header>
    <main className={styles.main}>
      <section className={styles.hero}>
        <div className={styles.heroText}>
          <p className={styles.eyebrow}>Farm Finance · English teaching preview</p>
          <h1>Understand the money.<br />Plan the next season.</h1>
          <p>From your first farm record to a checked business plan. Read, work through examples and practise with a notebook, calculator and the app.</p>
          <p><strong>8 units · 24 lessons</strong> · Take this course on its own, or alongside permaculture.</p>
          <div className={styles.actions}><Link className={styles.primary} href="/student/finance/f1-1">Start with farm and household money →</Link><a href="#syllabus">See every lesson</a></div>
        </div>
        <img src="/studies-guides/expense-record.jpg" alt="Illustrated homestead record-keeping scene with a grower, notebook and source documents" />
      </section>
      <aside className={styles.notice}><p><strong>Teaching preview.</strong> English lesson drafts and worked practice are available. Content review, learner trials, narration, translation and final assessment remain in preparation.</p></aside>
      <FinanceReadingChecklist lessonIds={FINANCE_LESSONS.map(e => e.lesson.id)} />
      <section className={styles.section}>
        <h2>Learn by doing</h2>
        <p>Each unit has a plain-language explanation, worked examples and practice to discuss with a facilitator or learning partner. Use the supplied practice figures; keep your household and customer details private.</p>
        <p>The figures are invented classroom examples, not local prices, promised earnings or recommendations for your farm. Each unit supplies its own case and opening balances.</p>
      </section>
      <div id="syllabus" className={styles.grid}>{FINANCE_UNITS.map(unit => <section key={unit.id} className={styles.card}>
        <p className={styles.eyebrow}>Unit {unit.number}</p><h2>{unit.title}</h2><p>{unit.summary}</p>
        <ol start={(unit.number - 1) * 3 + 1}>{unit.lessons.map(lesson => <li key={lesson.id}><Link href={`/student/finance/${lesson.id}`}>{lesson.title}</Link></li>)}</ol>
      </section>)}</div>
      <section className={styles.section}>
        <h2>A proposed ten-day course</h2>
        <div className={styles.dayList}>
          <div><h3>Days 1–8</h3><p>One unit each day, mixing explanation, guided practice and an independent attempt.</p></div>
          <div><h3>Days 9–10</h3><p>A supported project, then practical assessment, feedback and another attempt where needed.</p></div>
        </div>
        <p>Plan around four to five teaching hours per day, excluding breaks. This is an estimate to test with learners; translation, device sharing and additional practice may need more time.</p>
        <p>Self-paced learners can take the lessons at their own pace. The final connected project and assessment are still being prepared. Reading this preview does not award a qualification.</p>
      </section>
    </main>
  </div>;
}
