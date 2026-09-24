'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

import styles from './DeckPlayer.module.css';
import {
  animationUrls,
  deckFor,
  formatBytes,
  resolveDeckLang,
  slideAudioUrl,
  slideImageFor,
  timedAnimationSync,
} from '@/lib/course-deck';
import { resolveNarrationLang, trackTitle } from '@/lib/course-audio';
import { COURSE_NARRATION } from '@/lib/course-audio';
import { COURSE_TRANSCRIPTS } from '@/lib/course-transcripts';
import { COURSE_CACHE } from '@/lib/offline-cache';
import COURSE_DECK_ART from '@/docs/course-deck-art.json' with { type: 'json' };
import { useLanguage } from '@/lib/i18n-context';
import { narrationReviewPending } from '@/lib/narration-blockers';

// The module as it was actually written: slides in a teaching order, narrated, with animations
// where a still cannot carry the idea. Built for one farmer alone with a phone and metered data.
//
// THREE RULES DRIVE EVERY DECISION HERE:
//
// 1. Nothing downloads unasked. Slides load one at a time; audio is
//    preload="none"; animation clips load only when the farmer presses play,
//    with the size printed on the button. lib/course-modules.ts already says video is never given
//    an inline player for this audience because KZN connectivity cannot stream it per visit.
//
// 2. It says what it does not have, on the slide where it is true. If a localized asset is
//    absent, that slide falls back to English and says so; the other slides say nothing because
//    there is nothing to apologise for. A whole-module warning would make a finished lesson look
//    unfinished to the person it was made for.
//
// 3. It works with the sound off. Every slide carries its title and the narration is optional, so
//    a learner in a noisy room or without earphones still gets the sequence.

export interface DeckPlayerProps {
  moduleId: string;
  /** The learner's language, e.g. 'zu'. Slides and audio resolve independently. */
  lang: string;
  /** Show only this lesson's slides. Omit for the whole module. */
  lessonId?: string;
  onClose?: () => void;
}

const INK = '#20190F';
const MUTED = '#5C5040';
const PAPER = '#FFFEFA';
const LINE = '#ECE3C9';
const GREEN = '#2F6B3A';

/** Human names for the languages a module can be recorded in; an unlisted code shows as-is. */
const LANG_NAME: Record<string, string> = {
  en: 'English', zu: 'isiZulu', af: 'Afrikaans', xh: 'isiXhosa', st: 'Sesotho',
  nso: 'Sepedi', tn: 'Setswana', ts: 'Xitsonga', ve: 'Tshivenda', ss: 'siSwati', nr: 'isiNdebele',
};
const langName = (code: string, uiLang: string) => uiLang === 'zu' && code === 'en'
  ? 'isiNgisi'
  : LANG_NAME[code] ?? code;

// Match the short points on the published slide images. The full narration remains available
// below the inline player; a full-screen slide shows the slide, not a second reading mode.
function slidePoints(paragraphs: string[]): string[] {
  const numbered = paragraphs.filter((p) => /^(?:One|Two|Three|Four|Five|Six|\d+)[.)]\s/i.test(p));
  if (numbered.length > 1) {
    return numbered.map((p) => p.replace(/^(?:One|Two|Three|Four|Five|Six|\d+)[.)]\s+/i, ''));
  }
  return paragraphs
    .map((p) => (p.split(/(?<=[.!?])\s/)[0] || p).trim())
    .filter((p) => p.length >= 12)
    .slice(0, 4);
}

export default function DeckPlayer({ moduleId, lang: appLang, lessonId, onClose }: DeckPlayerProps) {
  const { lang: uiLang, t } = useLanguage();
  const deck = deckFor(moduleId);
  const narration = COURSE_NARRATION[moduleId];

  // WHICH LANGUAGE THIS DECK IS IN, separately from the app's.
  //
  // Replacing the old track list with this player took the isiZulu/English switch away with it,
  // and that switch was doing real work: a learner reading isiZulu may still want to hear the
  // English, a facilitator checks both, and the app-wide language is a heavier thing to change and
  // change back. It defaults to the app's language and is only offered when the module actually
  // has more than one recording.
  const [lang, setLang] = useState(appLang);
  useEffect(() => { setLang(appLang); }, [appLang]);
  const slideLang = resolveDeckLang(moduleId, lang);
  const spokenLang = resolveNarrationLang(moduleId, lang);
  const languages = narration?.languages ?? [];

  const slides = useMemo(
    () => (deck?.slides ?? []).filter((s) => !lessonId || s.lesson === lessonId),
    [deck, lessonId],
  );

  const [index, setIndex] = useState(0);
  // Which slides the farmer has chosen to spend data on. Never persisted and never pre-filled —
  // reopening the module should not silently re-download 11 MB of clips.
  const [playing, setPlaying] = useState<Set<number>>(() => new Set());
  // Play-through: narration plays and the deck turns its own pages until it is stopped.
  // Rory, watching the finished module: "i wanted the full slidedeck at the beginning of the
  // lesson, in a window so you can immediately see it — press play, the audio starts auto and
  // moves through unless you stop the deck." A list of 24 play buttons is a filing cabinet; this
  // is a lesson.
  const [running, setRunning] = useState(false);
  const [timedVoiceActive, setTimedVoiceActive] = useState(false);
  const [audioFailed, setAudioFailed] = useState(false);
  const [animationFailed, setAnimationFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [landscape, setLandscape] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [textScale, setTextScale] = useState(1);
  const [imageZoom, setImageZoom] = useState(1);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const playerRef = useRef<HTMLDialogElement | null>(null);
  const imageViewerRef = useRef<HTMLDialogElement | null>(null);
  const imageButtonRef = useRef<HTMLButtonElement | null>(null);
  const imageCloseRef = useRef<HTMLButtonElement | null>(null);
  const slideViewportRef = useRef<HTMLDivElement | null>(null);
  const expandButtonRef = useRef<HTMLButtonElement | null>(null);
  const exitButtonRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { setAudioFailed(false); setAnimationFailed(false); }, [index, lang]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const narrationEnded = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const updateOrientation = () => setLandscape(window.innerWidth > window.innerHeight);
    updateOrientation();
    window.addEventListener('resize', updateOrientation);
    return () => window.removeEventListener('resize', updateOrientation);
  }, []);


  // The separate audio-only playlist can be opened beside this deck. If the
  // learner starts another spoken clip, stop this tour instead of talking over it.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const pauseForOtherAudio = (event: Event) => {
      const audio = audioRef.current;
      if (audio && event.target instanceof HTMLAudioElement && event.target !== audio &&
        (!audio.paused || (videoRef.current && !videoRef.current.paused))) {
        if (!audio.paused) audio.pause();
        videoRef.current?.pause();
        setRunning(false);
        setTimedVoiceActive(false);
      }
    };
    document.addEventListener('play', pauseForOtherAudio, true);
    return () => document.removeEventListener('play', pauseForOtherAudio, true);
  }, []);


  const current = slides[index];
  const total = slides.length;
  const transcript = current && spokenLang ? COURSE_TRANSCRIPTS[moduleId]?.[spokenLang.lang]?.[current.slide] : null;

  useEffect(() => {
    setZoom(1);
    setTextScale(1);
    if (slideViewportRef.current) {
      slideViewportRef.current.scrollTop = 0;
      slideViewportRef.current.scrollLeft = 0;
    }
  }, [index]);

  useEffect(() => {
    // Rory's landscape view lost the picture behind the lesson controls. Start each landscape
    // slide clean, including after rotation, while portrait keeps its visible exit affordance.
    setChromeVisible(!expanded || !landscape);
  }, [expanded, landscape, index]);

  useEffect(() => {
    if (!expanded || !slideViewportRef.current) return;
    const viewport = slideViewportRef.current;
    const measure = () => {
      const { width, height } = viewport.getBoundingClientRect();
      setViewportSize((previous) => previous.width === width && previous.height === height
        ? previous : { width, height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [expanded]);

  useEffect(() => {
    if (!expanded || !chromeVisible) return;
    const timeout = window.setTimeout(() => setChromeVisible(false), landscape ? 3500 : 10000);
    return () => window.clearTimeout(timeout);
  }, [expanded, chromeVisible, landscape, index]);

  const exitExpanded = useCallback(() => {
    const dialog = playerRef.current;
    if (!dialog) return;
    dialog.close();
    dialog.show();
    setExpanded(false);
    setChromeVisible(true);
  }, []);

  const toggleExpanded = () => {
    const dialog = playerRef.current;
    if (!dialog) return;
    if (expanded) exitExpanded();
    else {
      dialog.close();
      dialog.showModal();
      setChromeVisible(!landscape);
      setZoom(1);
      setTextScale(1);
      setExpanded(true);
    }
  };

  // Keep the same audio and video elements when the learner expands the deck. Re-mounting them
  // would restart the lesson, especially on phones where full-screen media APIs vary by browser.
  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    (landscape ? playerRef.current : exitButtonRef.current)?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      expandButtonRef.current?.focus();
    };
  }, [expanded, landscape]);

  // Resolved up here, not after the early return below, because the play-through effects need it.
  const audioForCurrent = current && spokenLang ? slideAudioUrl(moduleId, spokenLang.lang, current.slide) : null;
  const timedTour = !!current && !!animationUrls(moduleId, current.slide, lang)?.narrationTimed;
  const followNarration = useCallback(() => {
    const audio = audioRef.current;
    const video = videoRef.current;
    if (!timedTour || !audio || !video || (!running && !timedVoiceActive && audio.paused)) return;
    const sync = timedAnimationSync(audio, video);
    if (!sync) return;
    if (sync.seekTo !== null) video.currentTime = sync.seekTo;
    if (!sync.playing) video.pause();
    else if (video.paused) video.play().catch(() => {});
  }, [running, timedTour, timedVoiceActive]);

  // STEP BY A DELTA, never to a computed absolute.
  //
  // This took an absolute target and was called as go(index + 1), which reads `index` out of the
  // render closure. Tapping Next four times in quick succession advanced ONE slide: every press
  // computed the same target from the same stale index, and React collapsed them into one update.
  // Caught by pressing it four times in a browser —
  // it looks perfectly correct in the source, and a farmer paging through 24 slides taps far
  // faster than a re-render. The functional updater sees the real current value each time.
  const go = useCallback((delta: number) => {
    // TURNING THE PAGE ALSO STARTS THAT PAGE'S NARRATION.
    //
    // Rory, testing it: "ok so it does autoplay just not if you press next." Play-through was a
    // mode you had to be inside; stepping forward yourself dropped you out of it and left the new
    // slide silent, so a learner who paused to re-read one slide lost the voice for every slide
    // after it. Moving through the deck IS the lesson, however you move.
    //
    // It doubles as the browser's autoplay unlock: a tap on Next is a user gesture, so the same
    // <audio> element is permitted to play from here on.
    setRunning(true);
    setChromeVisible(true);
    setIndex((i) => Math.min(total - 1, Math.max(0, i + delta)));
  }, [total]);

  // Moving on stops the previous slide's narration. Two voices at once is worse than silence, and
  // on a slow connection the old clip can otherwise still be arriving when the new one starts.
  //
  // Under play-through the same effect starts the NEW slide's clip. The browser only allows that
  // because the farmer's tap on Play unlocked this same <audio> element; changing its `src` keeps
  // the permission, which is why there is one element for the whole deck rather than one per
  // slide. If a browser refuses anyway, play-through switches itself off rather than leaving a
  // Stop button that stops nothing.
  useEffect(() => {
    narrationEnded.current = false;
    setTimedVoiceActive(false);
    let cancelled = false;
    if (!running) videoRef.current?.pause();
    if (running && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
    const el = audioRef.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
    if (!running) return;
    setAudioFailed(false);
    if (el.error) el.load();
    const started = el.play();
    if (started) started.catch((error: DOMException) => {
      // Rapid page turns cancel the old play promise; that is not a failed new recording.
      if (cancelled || error?.name === 'AbortError') return;
      setAudioFailed(true);
      setRunning(false);
    });
    // `audioForCurrent` is in the deps so switching language mid-lesson restarts THIS slide in the
    // new voice, rather than leaving the element pointing at a source it is no longer playing.
    return () => { cancelled = true; };
  }, [index, running, audioForCurrent]);

  // A downloaded clip plays itself; one that is not downloaded still asks first.
  //
  // The rule the whole module is built on is that nothing costs data unasked — but a farmer who
  // downloaded the module in town has already paid for these clips, and making them tap each
  // one again would be asking twice for the same thing. So play-through consults the offline
  // cache: present means free, absent means the poster and its size stay, and the narration
  // carries the slide either way.
  useEffect(() => {
    if (!running || !current?.animation || animationFailed) return;
    if (playing.has(current.slide)) return;
    let cancelled = false;
    (async () => {
      const urls = animationUrls(moduleId, current.slide, lang);
      if (!urls || typeof caches === 'undefined') return;
      try {
        const hit = await (await caches.open(COURSE_CACHE)).match(urls.video, { ignoreSearch: true });
        if (hit && !cancelled) setPlaying((p) => new Set(p).add(current.slide));
      } catch {
        // No cache access — leave it as tap-to-play, which is the safe default.
      }
    })();
    return () => { cancelled = true; };
  }, [running, current, moduleId, playing, lang, animationFailed]);

  // When a clip ends, turn the page. On the last slide, stop rather than loop.
  const advance = useCallback(() => {
    setIndex((i) => {
      if (i >= total - 1) { setRunning(false); return i; }
      return i + 1;
    });
  }, [total]);

  const onNarrationEnded = useCallback(() => {
    narrationEnded.current = true;
    // Water's voice finishes before infiltration does. Wait for the chosen clip's real ended
    // event, so buffering cannot make a wall-clock timer cut away from the teaching action.
    if (running && (!videoRef.current || videoRef.current.ended || animationFailed)) advance();
  }, [running, advance, animationFailed]);

  const onAnimationEnded = useCallback(() => {
    if (running && narrationEnded.current) advance();
  }, [running, advance]);

  // A SLIDE WITH NO NARRATION MUST NOT END THE LESSON.
  //
  // Page turns are driven by the audio's `ended` event, so a slide with no clip fires nothing and
  // play-through stops dead on it — the farmer sees a picture and waits, with a Stop button that
  // implies something is still happening. Every Seeds slide has narration, so this cannot happen
  // today; the next module recorded is where it would, and it would look like the app freezing
  // rather than like a missing file.
  //
  // Long enough to actually read the slide, since that is all there is to do on it.
  const SILENT_SLIDE_MS = 7000;
  useEffect(() => {
    if (!running || audioForCurrent) return;
    const t = setTimeout(onNarrationEnded, SILENT_SLIDE_MS);
    return () => clearTimeout(t);
  }, [running, audioForCurrent, onNarrationEnded]);

  const onDeckKeyDown = useCallback((e: React.KeyboardEvent<HTMLDialogElement>) => {
    if (expanded && e.key === 'Escape') { e.preventDefault(); exitExpanded(); return; }
    if (expanded && e.currentTarget === e.target && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      setChromeVisible((visible) => !visible);
      return;
    }
    if (expanded) setChromeVisible(true);
    // The player used to listen on window, which meant seeking an audio clip or using any other
    // page control also turned the lesson page. Only the deck surface owns these shortcuts.
    if (e.currentTarget !== e.target || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    else if (e.key === 'Escape' && onClose) onClose();
  }, [go, onClose, expanded, exitExpanded]);

  // Touch: a horizontal drag turns the page. Vertical is left alone so the page still scrolls.
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touchStart.current;
    if (!s) return;
    if (expanded && zoom > 1) { touchStart.current = null; return; }
    const dx = e.changedTouches[0].clientX - s.x;
    const dy = e.changedTouches[0].clientY - s.y;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.6) go(dx < 0 ? 1 : -1);
    touchStart.current = null;
  };

  if (!deck || !slideLang || !current) return null;

  const img = slideImageFor(moduleId, lang, current.slide);
  const anim = animationUrls(moduleId, current.slide, lang);
  const audio = audioForCurrent;
  const track = narration?.tracks.find((t) => t.slide === current.slide);
  const heading = track ? trackTitle(track, lang) : current.title;
  const isPlaying = playing.has(current.slide);

  const slideRatio = anim?.aspectRatio ?? 16 / 9;
  const artModule = (COURSE_DECK_ART as Record<string, Record<string, { layout: string }>>)[moduleId];
  const art = artModule?.[current.slide];
  const presentationPoints = transcript ? slidePoints(transcript) : [];
  const showReflowedSlide = expanded && !!artModule && !art && !anim && current.slide !== 1 && presentationPoints.length > 0;
  const fittedWidth = expanded && viewportSize.width && viewportSize.height
    ? Math.min(viewportSize.width, viewportSize.height * slideRatio) : 0;
  const fullSizeImageUrl = anim?.poster ?? img?.url;


  return (
    <>
    <dialog
      ref={playerRef}
      open
      tabIndex={0}

      role={expanded ? 'dialog' : 'region'}
      aria-modal={expanded ? true : undefined}
      aria-label={t('courseDeckRegion')}

      onKeyDown={onDeckKeyDown}
      onCancel={(event) => { event.preventDefault(); exitExpanded(); }}
      className={`${styles.player} ${expanded ? styles.expanded : ''} ${showReflowedSlide ? styles.textSlide : ''} ${expanded && !chromeVisible ? styles.chromeHidden : ''}`}
    >
      <div className={styles.playerHeader}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', color: MUTED, textTransform: 'uppercase' }}>
          {index + 1} / {total}
        </span>
        <h3 className={styles.slideHeading} style={{ color: INK }}>{heading}</h3>
        {languages.length > 1 && (
          <div role="group" aria-label={t('courseNarrationLanguage')} style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {languages.map((code) => {
              const on = code === lang;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => { setPlaying(new Set()); setLang(code); }}
                  aria-pressed={on}
                  style={{
                    padding: '3px 9px', borderRadius: 999, fontSize: 11.5, cursor: 'pointer',
                    background: on ? 'rgba(47,107,58,0.10)' : 'transparent',
                    border: `1px solid ${on ? 'rgba(47,107,58,0.30)' : LINE}`,
                    color: on ? GREEN : MUTED,
                  }}
                >
                  {langName(code, uiLang)}
                </button>
              );
            })}
          </div>
        )}
        <button
          ref={expanded ? exitButtonRef : expandButtonRef}
          type="button"
          className={styles.expandButton}
          onClick={toggleExpanded}
          aria-label={t(expanded ? 'courseDeckFullscreenExitAria' : 'courseDeckFullscreenEnterAria')}
        >
          {expanded ? <Minimize2 size={17} aria-hidden="true" /> : <Maximize2 size={17} aria-hidden="true" />}
          <span>{t(expanded ? 'courseDeckFullscreenExit' : 'courseDeckFullscreenEnter')}</span>
        </button>
        {onClose && (
          <button onClick={onClose} aria-label={t('courseDeckClose')} style={{ border: 'none', background: 'none', color: MUTED, fontSize: 20, lineHeight: 1, cursor: 'pointer', padding: 4 }}>×</button>
        )}
      </div>
      {expanded && (
        <div className={styles.zoomBar} role="group" aria-label={t('courseDeckSlideImageSize')}>
          <button type="button" aria-label={t('courseDeckZoomOut')} disabled={showReflowedSlide ? textScale <= .75 : zoom === 1} onClick={() => { setChromeVisible(true); if (showReflowedSlide) setTextScale((value) => Math.max(.75, value - .125)); else setZoom((value) => Math.max(1, value - 1)); }}>−</button>
          <span aria-live="polite">{showReflowedSlide ? `${Math.round(textScale * 100)}%` : `${zoom}×`}</span>
          <button type="button" aria-label={t('courseDeckZoomIn')} disabled={showReflowedSlide ? textScale >= 1.5 : zoom === 3} onClick={() => { setChromeVisible(true); if (showReflowedSlide) setTextScale((value) => Math.min(1.5, value + .125)); else setZoom((value) => Math.min(3, value + 1)); }}>+</button>
        </div>
      )}

      {anim && <p className={styles.rotationTip}>{t('courseDeckTurnPhoneHint')}</p>}
      <div
        ref={slideViewportRef}
        className={styles.slideStage}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onClick={() => { if (expanded) setChromeVisible((visible) => !visible); }}
        style={{ position: 'relative', borderRadius: 10, overflow: expanded ? 'auto' : 'hidden', background: '#1B1710', aspectRatio: expanded ? undefined : slideRatio }}
      >
        {expanded && anim && <p className={styles.turnPhoneHint}>{t('courseDeckTurnPhoneHint')}</p>}
        {showReflowedSlide && (
          <section className={styles.presentationSlide} aria-label={`${heading} slide`} lang={spokenLang?.lang} style={{ '--presentation-scale': textScale } as CSSProperties}>
            <div className={styles.presentationIntro}>
              <div className={styles.presentationEyebrow}>ImbewuField</div>
              <h2>{heading}</h2>
            </div>
            <ul>{presentationPoints.map((point, i) => <li key={i}>{point}</li>)}</ul>
            <footer><span>ImbewuField · Imbewu Yoshintso</span><span>{index + 1} / {total}</span></footer>
          </section>
        )}
        <div className={`${styles.slideCanvas} ${showReflowedSlide ? styles.canvasHidden : ''}`} style={{ position: 'relative', width: expanded && fittedWidth ? `${Math.round(fittedWidth * zoom)}px` : '100%', aspectRatio: slideRatio }}>
        {isPlaying && anim && !animationFailed ? (
          <video
            ref={videoRef}
            src={anim.video}
            poster={anim.poster}
            autoPlay
            loop={!(anim.playOnce || running || (timedTour && timedVoiceActive))}
            muted
            playsInline
            controls={!(timedTour && (running || timedVoiceActive)) && (!expanded || chromeVisible)}
            onCanPlay={followNarration}
            onEnded={onAnimationEnded}
            onError={() => {
              setAnimationFailed(true);
              if (running && narrationEnded.current) advance();
            }}
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={anim ? anim.poster : (img?.url ?? '')}
            alt={heading}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          />
        )}

        {anim && (!isPlaying || animationFailed) && (
          <button
            onClick={() => {
              // Watch during speech starts this timed scene together from the beginning.
              // Loading may still take time; onCanPlay catches the picture up to the voice.
              if (timedTour && (running || timedVoiceActive) && audioRef.current) {
                narrationEnded.current = false;
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch(() => { setAudioFailed(true); setRunning(false); });
              }
              setAnimationFailed(false);
              setPlaying((p) => new Set(p).add(current.slide));
            }}
            style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none', background: 'rgba(20,16,10,0.42)', color: '#fff', cursor: 'pointer' }}
          >
            <span aria-hidden style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 54, height: 54, borderRadius: '50%', background: 'rgba(255,255,255,0.94)', color: INK, fontSize: 20, paddingLeft: 4 }}>▶</span>
            {/* The size is on the button, not buried in a setting. Someone paying by the megabyte
                is entitled to decide before the download starts, not after. */}
            <span style={{ fontSize: 12.5, fontWeight: 700 }}>{t('courseDeckWatch').replace('{seconds}', String(Number(anim.seconds.toFixed(1)))).replace('{size}', formatBytes(anim.bytes))}</span>
          </button>
        )}
        </div>
      </div>

      {fullSizeImageUrl && (!expanded || !showReflowedSlide) && (
        <button
          ref={imageButtonRef}
          type="button"
          aria-label={t('courseDeckOpenImageAria').replace('{title}', heading)}
          className={styles.zoomLink}
          onClick={() => {
            // A raw image opens without browser controls in the installed phone app. Keep the
            // learner in this lesson and make the way back visible while the picture is enlarged.
            audioRef.current?.pause();
            videoRef.current?.pause();
            setRunning(false);
            setTimedVoiceActive(false);
            setImageZoom(1);
            imageViewerRef.current?.showModal();
            requestAnimationFrame(() => imageCloseRef.current?.focus());
          }}
        >
          {t('courseDeckOpenImage')}
        </button>
      )}

      {audio && (
        <audio
          className={styles.audioControl}
          ref={audioRef}
          src={audio}
          aria-label={t('courseDeckNarrationAria').replace('{title}', heading)}
          controls
          onEnded={onNarrationEnded}
          onPlaying={() => { setAudioFailed(false); if (timedTour) setTimedVoiceActive(true); followNarration(); }}
          onTimeUpdate={followNarration}
          onSeeked={followNarration}
          onPause={followNarration}
          onWaiting={() => { if (timedTour && (running || timedVoiceActive)) videoRef.current?.pause(); }}
          onError={() => { setAudioFailed(true); setRunning(false); }}
          // Under play-through the next clip is fetched the moment this slide appears, so the gap
          // between slides is not a silence while the phone thinks. Off otherwise: idle preloading
          // is the whole thing this module refuses to do.
          preload={running ? 'auto' : 'none'}
          style={{ width: '100%', height: 34 }}
        />
      )}

      {audioFailed && (
        <p role="alert" style={{ margin: 0, color: '#8B2020', fontSize: 14, lineHeight: 1.5 }}>
          {t('courseDeckNarrationFailed')}
        </p>
      )}
      {animationFailed && (
        <p role="status" style={{ margin: 0, color: MUTED, fontSize: 14, lineHeight: 1.5 }}>
          {t('courseDeckAnimationFailed')}
        </p>
      )}

      {img && !img.exact && (
        // Only on the slide it is actually true of. A localized deck can have one missing asset,
        // so saying "these slides are in English" across the whole module would be false for the
        // rest of the lesson and would make a finished lesson look unfinished.
        <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.4, color: MUTED }}>
          {t('courseDeckSlideLanguage').replace('{language}', langName(img.lang, uiLang))}
        </p>
      )}

      {spokenLang && !spokenLang.exact && (
        <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.4, color: MUTED }}>
          {t('courseDeckNarrationFallback')
            .replace('{spokenLanguage}', langName(spokenLang.lang, uiLang))
            .replace('{appLanguage}', langName(lang, uiLang))}
        </p>
      )}

      {spokenLang?.lang === 'zu' && narrationReviewPending(moduleId, 'zu') && (
        <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.4, color: MUTED }}>
          {uiLang === 'zu'
            ? 'Lo msindo wesiZulu usalindele ukubuyekezwa ngumuntu olwazi kahle ulimi.'
            : 'This isiZulu narration is awaiting review by a fluent speaker.'}
        </p>
      )}

      <div className={styles.controlStrip}>
        {/* THE PRIMARY ACTION. Everything else on this control strip is for someone who wants to
            steer; this is for someone who wants to be taught. It stays available on every slide,
            so stopping to re-read one and then carrying on is one tap, not a restart. */}
        <button
          className={styles.playControl}
          onClick={() => setRunning((on) => !on)}
          aria-label={t(running ? 'courseDeckStopAria' : 'courseDeckPlayAria')}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '9px 15px', borderRadius: 10,
            border: 'none', background: running ? '#8A4B2A' : GREEN, color: '#fff',
            fontWeight: 700, fontSize: 13, cursor: 'pointer', flexShrink: 0,
          }}
        >
          <span aria-hidden style={{ fontSize: 12 }}>{running ? '■' : '▶'}</span>
          {t(running ? 'courseDeckStop' : 'courseDeckPlay')}
        </button>
        <button
          className={styles.backControl}
          onClick={() => go(-1)}
          disabled={index === 0}
          style={{ padding: '9px 14px', borderRadius: 10, border: `1px solid ${LINE}`, background: PAPER, color: index === 0 ? '#B9AC94' : INK, fontWeight: 700, fontSize: 13, cursor: index === 0 ? 'default' : 'pointer' }}
        >
          {t('courseDeckBack')}
        </button>
        <div className={styles.progress} style={{ height: 4, borderRadius: 2, background: LINE, overflow: 'hidden' }}>
          <div style={{ width: `${((index + 1) / total) * 100}%`, height: '100%', background: GREEN }} />
        </div>
        <button
          className={styles.nextControl}
          onClick={() => go(1)}
          disabled={index === total - 1}
          style={{ padding: '9px 14px', borderRadius: 10, border: 'none', background: index === total - 1 ? '#D9D0BC' : GREEN, color: '#fff', fontWeight: 700, fontSize: 13, cursor: index === total - 1 ? 'default' : 'pointer' }}
        >
          {t('courseDeckNext')}
        </button>
      </div>

      {transcript && (
        <details className={styles.transcript} style={{ borderTop: `1px solid ${LINE}`, paddingTop: 10 }}>
          <summary style={{ color: GREEN, fontSize: 14, fontWeight: 700, cursor: 'pointer', padding: '6px 0' }}>
            {t('courseDeckReadSlide').replace('{language}', langName(spokenLang!.lang, uiLang))}
          </summary>
          <div lang={spokenLang!.lang} style={{ color: INK, fontSize: 16, lineHeight: 1.65, maxWidth: '70ch' }}>
            {transcript.map((paragraph, i) => <p key={i} style={{ margin: '10px 0' }}>{paragraph}</p>)}
          </div>
        </details>
      )}
    </dialog>
      {fullSizeImageUrl && (
        <dialog
          ref={imageViewerRef}
          className={styles.imageViewer}
          aria-label={t('courseDeckOpenImageAria').replace('{title}', heading)}
          onKeyDown={(event) => event.stopPropagation()}
          onClose={() => { setChromeVisible(true); imageButtonRef.current?.focus(); }}
        >
          <div className={styles.imageViewerHeader}>
            <span className={styles.imageViewerTitle}>{heading}</span>
            <button
              ref={imageCloseRef}
              type="button"
              className={styles.imageViewerClose}
              onClick={() => imageViewerRef.current?.close()}
            >
              × {t('courseDeckClose')}
            </button>
            <div className={styles.imageViewerZoom} role="group" aria-label={t('courseDeckSlideImageSize')}>
              <button type="button" aria-label={t('courseDeckZoomOut')} disabled={imageZoom === 1} onClick={() => setImageZoom((value) => Math.max(1, value - 1))}>−</button>
              <span aria-live="polite">{imageZoom}×</span>
              <button type="button" aria-label={t('courseDeckZoomIn')} disabled={imageZoom === 3} onClick={() => setImageZoom((value) => Math.min(3, value + 1))}>+</button>
            </div>
          </div>
          <div className={styles.imageViewerStage}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fullSizeImageUrl} alt={heading} style={{ width: `${imageZoom * 100}%`, maxHeight: imageZoom === 1 ? '100%' : undefined }} />
          </div>
        </dialog>
      )}
    </>
  );
}
