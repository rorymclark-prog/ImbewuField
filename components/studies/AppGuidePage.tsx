'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Check, FileText, Printer } from 'lucide-react';
import MenuButton from '@/components/MenuButton';
import SettingsButton from '@/components/SettingsButton';
import TabBar from '@/components/TabBar';
import LimaBar from '@/components/LimaBar';
import { useRegisterBackControl } from '@/components/BackControl';
import { APP_GUIDES, type AppGuide } from '@/lib/course-app-guides';
import styles from './AppGuide.module.css';
import { appGuideTrack, formatClock } from '@/lib/course-audio';
import MappingExplainer from './MappingExplainer';
import SalePaymentExplainer from './SalePaymentExplainer';
import ChartWindowExplainer from './ChartWindowExplainer';
import GuideOfflineDownload from './GuideOfflineDownload';
import OfflinePageLink from './OfflinePageLink';
import GuideScreenSlides from './GuideScreenSlides';

function GuideAudio({ guideId, section, title, onPlay }: {
  guideId: string; section: string; title: string; onPlay: (audio: HTMLAudioElement) => void;
}) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const track = appGuideTrack(guideId, section);
  if (!track) return null;
  return <div className={`${styles.narration} no-print`}>
    <p>Listen in English · {formatClock(track.seconds)} · {Math.ceil(track.bytes / 1024)} KB</p>
    <audio ref={audio} key={track.url} src={track.url} controls preload="none" aria-label={`Listen: ${title}`}
      onPlay={event => onPlay(event.currentTarget)} onError={() => setFailedUrl(track.url)}
      onLoadedData={() => setFailedUrl(null)}>
      Your browser cannot play this recording. The same instructions are written on this page.
    </audio>
    {failedUrl === track.url && <div role="status">
      <p>Audio could not load. Check your connection, or use the written steps.</p>
      <button type="button" onClick={() => { setFailedUrl(null); audio.current?.load(); }}>Retry audio</button>
    </div>}
  </div>;
}

export default function AppGuidePage({ guide }: { guide: AppGuide }) {
  // My Studies is the in-flow way back; a second floating Back covered the phone text.
  useRegisterBackControl();
  const [answer, setAnswer] = useState<number | null>(null);
  const playing = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => { playing.current?.pause(); }, []);
  const playOne = (audio: HTMLAudioElement) => {
    // Starting the next step must not leave the previous instruction talking over it.
    if (playing.current && playing.current !== audio) playing.current.pause();
    playing.current = audio;
  };
  return <div className={styles.page} lang="en">
    <header className={styles.header}>
      <MenuButton />
      <OfflinePageLink href="/student" className={styles.back}><ArrowLeft size={17} /> My Studies</OfflinePageLink>
      <SettingsButton />
    </header>
    <main className={styles.main}>
      <section className={styles.hero} aria-labelledby="guide-title">
        <div className={styles.heroText}>
          <p className={styles.eyebrow}>Using ImbewuField · English guide</p>
          <h1 id="guide-title">{guide.title}</h1>
          <p>{guide.summary} Keep these steps beside you while you work.</p>
          <div className={styles.actions}>
            <Link href="#steps" className={styles.primary}>Read the steps <ArrowUpRight size={17} /></Link>
            <Link href="/tour">Practise with the sample farm</Link>
          </div>
        </div>
        <figure><img src={guide.image} alt={guide.imageAlt} /><figcaption>{guide.caption}</figcaption></figure>
      </section>

      <GuideOfflineDownload guide={guide} />

      <section className={styles.prepare} aria-labelledby="prepare-title">
        <h2 id="prepare-title">{guide.prepareTitle}</h2>
        <GuideAudio guideId={guide.id} section="prepare" title="Before you start" onPlay={playOne} />
        {guide.prepare.map(text => <p key={text}>{text}</p>)}
      </section>

      <GuideScreenSlides guideId={guide.id} />

      {guide.id === 'mapping' && <MappingExplainer />}
      {guide.id === 'sales' && <SalePaymentExplainer />}
      {guide.id === 'charts' && <ChartWindowExplainer />}

      <div className="no-print"><LimaBar /></div>

      <nav className={styles.contents} aria-label={`${guide.cardTitle} steps`}>
        {/* Native hash links lost the router's history entry: Back from Records kept Records on screen. */}
        {guide.steps.map((step, index) => <Link key={step.id} href={`#${step.id}`}><span>{index + 1}</span>{step.title}</Link>)}
      </nav>

      <div id="steps" className={styles.steps}>
        {guide.steps.map((step, index) => <section id={step.id} key={step.id} className={styles.step} aria-labelledby={`${step.id}-title`}>
          <div className={styles.stepNumber} aria-hidden="true">{index + 1}</div>
          <div>
            <h2 id={`${step.id}-title`}>{step.title}</h2>
            <p className={styles.actionPath}>{step.action}</p>
            <GuideAudio guideId={guide.id} section={step.id} title={step.title} onPlay={playOne} />
            {step.paragraphs.map(text => <p key={text}>{text}</p>)}
            <p className={styles.check}><Check size={19} aria-hidden="true" /><span><strong>Check your work:</strong> {step.check}</span></p>
          </div>
        </section>)}
      </div>

      <section className={styles.practice} aria-labelledby="practice-title">
        <p className={styles.eyebrow}>Try a decision</p>
        <h2 id="practice-title">{guide.practice.title}</h2>
        <p>{guide.practice.question}</p>
        <GuideAudio guideId={guide.id} section="practice" title="Try a decision" onPlay={playOne} />
        <div className={styles.choices}>{guide.practice.choices.map((choice, index) => <button key={choice.label} type="button" aria-pressed={answer === index} onClick={() => { playing.current?.pause(); setAnswer(index); }}>{choice.label}</button>)}</div>
        <div className={styles.feedback} aria-live="polite" aria-atomic="true">{answer !== null && <p data-correct={guide.practice.choices[answer].correct}>{guide.practice.choices[answer].feedback}</p>}</div>
        {answer !== null && <GuideAudio guideId={guide.id} section={`feedback-${answer + 1}`} title="Feedback for your answer" onPlay={playOne} />}
        <p className={styles.small}>This practice question does not change your records.</p>
      </section>

      <aside className={styles.limits} aria-labelledby="limits-title">
        <h2 id="limits-title">{guide.limits.title}</h2>
        <GuideAudio guideId={guide.id} section="next" title="Practise and continue" onPlay={playOne} />
        {guide.limits.paragraphs.map(text => <p key={text}>{text}</p>)}
        {guide.limits.reference && <p><a href={guide.limits.reference.href}>{guide.limits.reference.label}</a></p>}
      </aside>

      <section className={styles.finish}>
        <h2>{guide.finish.title}</h2>
        <p>{guide.finish.text}</p>
        <div className={styles.actions}>
          <Link href={guide.finish.href} className={styles.primary}><FileText size={18} /> {guide.finish.label}</Link>
          <button type="button" onClick={() => window.print()}><Printer size={18} /> Print this guide</button>
          <OfflinePageLink href="/student">Back to Studies</OfflinePageLink>
        </div>
      </section>
      <nav className={styles.related} aria-label="More app guides">
        <h2>Keep learning the app</h2>
        {APP_GUIDES.filter(item => item.id !== guide.id).map(item => <OfflinePageLink key={item.id} href={item.href}>{item.cardTitle} →</OfflinePageLink>)}
      </nav>
    </main>
    <div className="no-print"><TabBar /></div>
  </div>;
}
