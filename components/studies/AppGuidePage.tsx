'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Check, FileText, Printer } from 'lucide-react';
import MenuButton from '@/components/MenuButton';
import SettingsButton from '@/components/SettingsButton';
import TabBar from '@/components/TabBar';
import { APP_GUIDES, type AppGuide } from '@/lib/course-app-guides';
import styles from './AppGuide.module.css';

export default function AppGuidePage({ guide }: { guide: AppGuide }) {
  const [answer, setAnswer] = useState<number | null>(null);
  return <div className={styles.page} lang="en">
    <header className={styles.header}>
      <MenuButton />
      <Link href="/student" className={styles.back}><ArrowLeft size={17} /> My Studies</Link>
      <SettingsButton />
    </header>
    <main className={styles.main}>
      <section className={styles.hero} aria-labelledby="guide-title">
        <div className={styles.heroText}>
          <p className={styles.eyebrow}>Using ImbewuField · English guide</p>
          <h1 id="guide-title">{guide.title}</h1>
          <p>{guide.summary} Keep these steps beside you while you work.</p>
          <div className={styles.actions}>
            <a href="#steps" className={styles.primary}>Read the steps <ArrowUpRight size={17} /></a>
            <Link href="/tour">Practise with the sample farm</Link>
          </div>
        </div>
        <figure><img src={guide.image} alt={guide.imageAlt} /><figcaption>{guide.caption}</figcaption></figure>
      </section>

      <section className={styles.prepare} aria-labelledby="prepare-title">
        <h2 id="prepare-title">{guide.prepareTitle}</h2>
        {guide.prepare.map(text => <p key={text}>{text}</p>)}
      </section>

      <nav className={styles.contents} aria-label={`${guide.cardTitle} steps`}>
        {guide.steps.map((step, index) => <a key={step.id} href={`#${step.id}`}><span>{index + 1}</span>{step.title}</a>)}
      </nav>

      <div id="steps" className={styles.steps}>
        {guide.steps.map((step, index) => <section id={step.id} key={step.id} className={styles.step} aria-labelledby={`${step.id}-title`}>
          <div className={styles.stepNumber} aria-hidden="true">{index + 1}</div>
          <div>
            <h2 id={`${step.id}-title`}>{step.title}</h2>
            <p className={styles.actionPath}>{step.action}</p>
            {step.paragraphs.map(text => <p key={text}>{text}</p>)}
            <p className={styles.check}><Check size={19} aria-hidden="true" /><span><strong>Check your work:</strong> {step.check}</span></p>
          </div>
        </section>)}
      </div>

      <section className={styles.practice} aria-labelledby="practice-title">
        <p className={styles.eyebrow}>Try a decision</p>
        <h2 id="practice-title">{guide.practice.title}</h2>
        <p>{guide.practice.question}</p>
        <div className={styles.choices}>{guide.practice.choices.map((choice, index) => <button key={choice.label} type="button" aria-pressed={answer === index} onClick={() => setAnswer(index)}>{choice.label}</button>)}</div>
        <div className={styles.feedback} aria-live="polite" aria-atomic="true">{answer !== null && <p data-correct={guide.practice.choices[answer].correct}>{guide.practice.choices[answer].feedback}</p>}</div>
        <p className={styles.small}>This practice question does not change your records.</p>
      </section>

      <aside className={styles.limits} aria-labelledby="limits-title">
        <h2 id="limits-title">{guide.limits.title}</h2>
        {guide.limits.paragraphs.map(text => <p key={text}>{text}</p>)}
        {guide.limits.reference && <p><a href={guide.limits.reference.href}>{guide.limits.reference.label}</a></p>}
      </aside>

      <section className={styles.finish}>
        <h2>{guide.finish.title}</h2>
        <p>{guide.finish.text}</p>
        <div className={styles.actions}>
          <Link href={guide.finish.href} className={styles.primary}><FileText size={18} /> {guide.finish.label}</Link>
          <button type="button" onClick={() => window.print()}><Printer size={18} /> Print this guide</button>
          <Link href="/student">Back to Studies</Link>
        </div>
      </section>
      <nav className={styles.related} aria-label="More app guides">
        <h2>Keep learning the app</h2>
        {APP_GUIDES.filter(item => item.id !== guide.id).map(item => <Link key={item.id} href={item.href}>{item.cardTitle} →</Link>)}
      </nav>
    </main>
    <div className="no-print"><TabBar /></div>
  </div>;
}
