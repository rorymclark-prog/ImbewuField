import Link from 'next/link';
import MenuButton from '@/components/MenuButton';
import BackButton from '@/components/BackButton';
import { ACT_FACILITATOR_DAYS, ACT_OBSERVATION_CRITERIA } from '@/lib/act-facilitator-refresher';
import { COURSE_MODULES } from '@/lib/course-modules';
import styles from './Refresher.module.css';

export const metadata = {
  title: 'ACT Teach the Teachers | two-day facilitator refresher',
  robots: { index: false, follow: false },
};

export default function TeachTheTeachersPage() {
  return <div className={styles.page}>
    <header className={styles.header}>
      <MenuButton /><BackButton fallback="/student" />
      <Link href="/student">My Studies</Link><span>Facilitator refresher</span>
    </header>
    <main className={styles.main}>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>ACT · Agroecology and permaculture</p>
        <h1>Teach the Teachers</h1>
        <p className={styles.lead}>A two-day refresher for people who will facilitate the existing core course. Practise teaching with the app, a real object and a paper fallback.</p>
        <div className={styles.heroLinks}><a href="#day-1">Day 1</a><a href="#day-2">Day 2</a><a href="#course-map">Core modules</a><a href="#prepare">Prepare</a><a href="#observe">Observation guide</a></div>
      </section>

      <aside className={styles.notice}>
        <strong>Proposed English timetable for ACT planning.</strong> Confirm the hours, group size, trainers, venue and programme policy with ACT before delivery. This is a facilitation rehearsal, not a new farming qualification or proof of competence. The app’s isiZulu, Sesotho and Tshivenda text may include marked machine drafts. Check each lesson’s text, slides and narration separately before teaching; use the exact English source and local language support when a translation is unclear.
      </aside>

      <section id="prepare" className={styles.panel}>
        <p className={styles.eyebrow}>Before participants arrive</p>
        <h2>Prepare one practice site and two ways to teach</h2>
        <ul>
          <li>Choose a permitted field area or a supplied fictional site. Mark which facts are observed, measured, reported or still unknown.</li>
          <li>Confirm the group’s languages and access needs. Bring an existing core lesson, its printed still and transcript, plus ordinary objects for a safe practical.</li>
          <li>On a trainer device, check sign-in, lesson access, slide and audio language, download and offline reopening. Use a demo account or practice site for exercises.</li>
          <li>Confirm ACT’s register and consent wording before collecting real data. Ask separately before photographing or sharing anyone’s work. Do not use a shared device for private household records.</li>
          <li>Arrange small parallel groups for teach-backs so every participant gets a turn. Assign someone to observe and record feedback.</li>
        </ul>
      </section>

      <section id="course-map" className={styles.panel}>
        <p className={styles.eyebrow}>The course being facilitated</p>
        <h2>Use the ten core modules as your lesson bank</h2>
        <p>The two days refresh the teaching method and practise selected lessons. They do not cover or assess all ten modules in full. Choose a published, available lesson that fits the local group and check its source and media before use.</p>
        <ol className={styles.moduleList}>{COURSE_MODULES.map(module => <li key={module.id}>{module.title}</li>)}</ol>
        <Link href="/student">Open My Studies →</Link>
      </section>

      {ACT_FACILITATOR_DAYS.map(day => <section id={`day-${day.number}`} key={day.number} className={styles.day}>
        <div className={styles.dayHeading}><span>Day {day.number}</span><div><h2>{day.theme}</h2><p>{day.promise}</p></div></div>
        <div className={styles.sessions}>
          {day.sessions.map(session => <details key={session.time} className={styles.session} open={session.time === '09:00–09:30'}>
            <summary><span className={styles.time}>{session.time}</span><span>{session.title}</span></summary>
            {session.outcome && <div className={styles.sessionBody}>
              <p><strong>By the end:</strong> {session.outcome}</p>
              <ol>{session.run.map(step => <li key={step}>{step}</li>)}</ol>
              {session.app && <div className={styles.appTask}>
                <p className={styles.eyebrow}>Try in ImbewuField</p>
                <p>{session.app.task}</p>
                <Link href={session.app.href}>{session.app.label} →</Link>
              </div>}
              <p><strong>Without the app:</strong> {session.paper}</p>
              <p><strong>What to observe:</strong> {session.evidence}</p>
            </div>}
          </details>)}
        </div>
      </section>)}

      <section id="observe" className={styles.panel}>
        <p className={styles.eyebrow}>Feedback, not a score</p>
        <h2>Observe the teach-back</h2>
        <p>Record what you actually saw or heard. Mark each item “seen”, “not yet seen” or “needs another attempt”, and give the facilitator one specific next step. Attendance, a photograph, a quiz answer and a practical demonstration are different kinds of evidence.</p>
        <ol>{ACT_OBSERVATION_CRITERIA.map(item => <li key={item}>{item}</li>)}</ol>
        <p>ACT decides any attendance record or certificate wording under its own policy. Do not call this refresher an accredited qualification.</p>
      </section>

      <footer className={styles.footer}>
        <Link href="/student">Return to My Studies</Link>
        <span>Adapted from the reserve facilitator guide and the existing five-day Teach the Teachers draft; condensed for this two-day ACT rehearsal.</span>
      </footer>
    </main>
  </div>;
}
