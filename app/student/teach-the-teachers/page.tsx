import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { ACT_FACILITATOR_DAYS, ACT_OBSERVATION_CRITERIA } from '@/lib/act-facilitator-refresher';
import { COURSE_MODULES } from '@/lib/course-modules';
import styles from './Refresher.module.css';
import ArrowLabel from '@/components/studies/ArrowLabel';
import StudyHeader from '@/components/studies/StudyHeader';
import T from '@/components/InlineText';

export const metadata = {
  title: 'ACT Teach the Teachers | two-day facilitator refresher',
  robots: { index: false, follow: false },
};

export default function TeachTheTeachersPage() {
  return <div className={styles.page}>
    <StudyHeader title="Facilitator refresher" />
    <main className={styles.main}>
      <section className={styles.hero}>
        <p className={styles.eyebrow}><T en="ACT · Agroecology and permaculture" /></p>
        <h1><T en="Teach the Teachers" /></h1>
        <p className={styles.lead}><T en="A two-day refresher for people who will facilitate the existing core course. Practise teaching with the app, a real object and a paper fallback." /></p>
        <div className={styles.heroLinks}><a href="#day-1"><T en="Day {n}" vars={{ n: 1 }} /></a><a href="#day-2"><T en="Day {n}" vars={{ n: 2 }} /></a><a href="#course-map"><T en="Core modules" /></a><a href="#prepare"><T en="Prepare" /></a><a href="#observe"><T en="Observation guide" /></a></div>
      </section>

      <aside className={styles.notice}>
        <p><strong><T en="Proposed English timetable for ACT planning." /></strong> <T en="This is a facilitation rehearsal, not a qualification or proof of competence." /></p>
        <details><summary><T en="More" /><ChevronDown className={styles.chevron} size={20} aria-hidden="true" /></summary><p><T en="Confirm the hours, group size, trainers, venue and programme policy with ACT before delivery. The app’s isiZulu, Sesotho and Tshivenda text may include marked machine drafts. Check each lesson’s text, slides and narration separately before teaching; use the exact English source and local language support when a translation is unclear." /></p></details>
      </aside>

      <section id="prepare" className={styles.panel}>
        <p className={styles.eyebrow}><T en="Before participants arrive" /></p>
        <h2><T en="Prepare one practice site and two ways to teach" /></h2>
        <ul>
          <li><T en="Choose a permitted field area or a supplied fictional site. Mark which facts are observed, measured, reported or still unknown." /></li>
          <li><T en="Confirm the group’s languages and access needs. Bring an existing core lesson, its printed still and transcript, plus ordinary objects for a safe practical." /></li>
          <li><T en="On a trainer device, check sign-in, lesson access, slide and audio language, download and offline reopening. Use a demo account or practice site for exercises." /></li>
          <li><T en="Confirm ACT’s register and consent wording before collecting real data. Ask separately before photographing or sharing anyone’s work. Do not use a shared device for private household records." /></li>
          <li><T en="Arrange small parallel groups for teach-backs so every participant gets a turn. Assign someone to observe and record feedback." /></li>
        </ul>
      </section>

      <section id="course-map" className={styles.panel}>
        <p className={styles.eyebrow}><T en="The course being facilitated" /></p>
        <h2><T en="Use the ten core modules as your lesson bank" /></h2>
        <p><T en="The two days refresh the teaching method and practise selected lessons. They do not cover or assess all ten modules in full. Choose a published, available lesson that fits the local group and check its source and media before use." /></p>
        <ol className={styles.moduleList}>{COURSE_MODULES.map(module => <li key={module.id}><T en={module.title} /></li>)}</ol>
        <Link href="/student"><ArrowLabel><T en="Open My Studies" /></ArrowLabel></Link>
      </section>

      {ACT_FACILITATOR_DAYS.map(day => <section id={`day-${day.number}`} key={day.number} className={styles.day}>
        <div className={styles.dayHeading}><span><T en="Day {n}" vars={{ n: day.number }} /></span><div><h2><T en={day.theme} /></h2><p><T en={day.promise} /></p></div></div>
        <div className={styles.sessions}>
          {day.sessions.map(session => <details key={session.time} className={styles.session} open={session.time === '09:00–09:30'}>
            <summary><span className={styles.time}>{session.time}</span><span><T en={session.title} /></span><ChevronDown className={styles.chevron} size={20} aria-hidden="true" /></summary>
            {session.outcome && <div className={styles.sessionBody}>
              <p><strong><T en="By the end:" /></strong> <T en={session.outcome} /></p>
              <ol>{session.run.map(step => <li key={step}><T en={step} /></li>)}</ol>
              {session.app && <div className={styles.appTask}>
                <p className={styles.eyebrow}><T en="Try in ImbewuField" /></p>
                <p><T en={session.app.task} /></p>
                <Link href={session.app.href}><ArrowLabel><T en={session.app.label} /></ArrowLabel></Link>
              </div>}
              <p><strong><T en="Without the app:" /></strong> <T en={session.paper} /></p>
              <p><strong><T en="What to observe:" /></strong> <T en={session.evidence} /></p>
            </div>}
          </details>)}
        </div>
      </section>)}

      <section id="observe" className={styles.panel}>
        <p className={styles.eyebrow}><T en="Feedback, not a score" /></p>
        <h2><T en="Observe the teach-back" /></h2>
        <p><T en="Record what you actually saw or heard. Mark each item “seen”, “not yet seen” or “needs another attempt”, and give the facilitator one specific next step. Attendance, a photograph, a quiz answer and a practical demonstration are different kinds of evidence." /></p>
        <ol>{ACT_OBSERVATION_CRITERIA.map(item => <li key={item}><T en={item} /></li>)}</ol>
        <p><T en="ACT decides any attendance record or certificate wording under its own policy. Do not call this refresher an accredited qualification." /></p>
      </section>

      <footer className={styles.footer}>
        <Link href="/student"><T en="Return to My Studies" /></Link>
        <span><T en="Adapted from the reserve facilitator guide and the existing five-day Teach the Teachers draft; condensed for this two-day ACT rehearsal." /></span>
      </footer>
    </main>
  </div>;
}
