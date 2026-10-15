import Link from 'next/link';
import MenuButton from '@/components/MenuButton';
import BackButton from '@/components/BackButton';
import AnimationReview from './AnimationReview';
import clips from './clips.json';
import styles from './review.module.css';

export const metadata = {
  title: 'Animation review — ImbewuField',
  robots: { index: false, follow: false },
};

export default function AnimationReviewPage() {
  return <div className={styles.page}>
    <header className={styles.header}>
      <div className={styles.brand}><MenuButton /><BackButton fallback="/student" /><Link href="/student">ImbewuField / My Studies</Link></div>
      <span>Animation drafts · 15 October 2026</span>
    </header>
    <main className={styles.main}>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>Observe · compare · understand</p>
        <h1>Read the land.<br />Watch what changes.</h1>
        <p>Six wordless scene studies for the course. Each keeps one landscape in view and follows one process, with time to see the result.</p>
        <p className={styles.note}>Review drafts. The current lesson decks stay as they are. These clips have no voice, music or written labels; the existing lesson text supplies the language and site context.</p>
      </section>
      <AnimationReview clips={clips} />
      <footer className={styles.footer}>
        <p>Original animation: Blender / Codex for Rory Clark. The water and air cues illustrate principles; they are not measurements or construction designs.</p>
        <Link href="/student">Return to My Studies</Link>
      </footer>
    </main>
  </div>;
}
