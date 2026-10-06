'use client';

// Pre-recorded module narration, played as a short playlist of per-slide clips.
//
// This is the better half of the pair with <SpeakButton />. SpeakButton uses the device's
// SpeechSynthesis voices, which for isiZulu, Sesotho, Setswana and the rest usually do not
// exist on a real phone (see the header of lib/tts.ts). These clips are recorded narration,
// so they sound like a person and work on any device. Where a module has a recording this is
// what a learner should get; SpeakButton stays for everything not yet recorded.
//
// Deliberate behaviours:
//   • Nothing autoplays and nothing preloads. On a metered rural connection, audio downloads
//     only when the learner presses play — `preload="none"` and a src set on demand.
//   • Clips advance automatically to the end of the list, then stop. No looping.
//   • If the app language was never recorded, the player says which language it is actually
//     playing rather than quietly substituting English.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause, Volume2, AlertCircle } from 'lucide-react';
import {
  availableNarrationLanguages, formatClock, narrationFor, requiresExplicitNarrationChoice, resolveNarrationLang, trackTitle, trackUrl,
  type NarrationTrack,
} from '@/lib/course-audio';
import { useLanguage } from '@/lib/i18n-context';
import { narrationReviewPending, regionalNarrationDraft } from '@/lib/narration-blockers';
import { isiZuluDeckReviewHold } from '@/lib/course-deck-review-holds';

const GREEN = '#1F4D2B';
const OCHRE = '#C07A1E';
const MUTED = '#755942';
const HAIRLINE = '#E2D8C4';

/** Human names for the languages we can record in. Shown only in the mismatch notice and the
 *  language switch, so an unlisted code degrades to the raw code rather than breaking. */
const LANG_NAME: Record<string, string> = {
  en: 'English', zu: 'isiZulu', af: 'Afrikaans', xh: 'isiXhosa', st: 'Sesotho',
  nso: 'Sepedi', tn: 'Setswana', ts: 'Xitsonga', ve: 'Tshivenda', ss: 'siSwati', nr: 'isiNdebele',
};
const langName = (code: string, uiLang: string) => uiLang === 'zu' && code === 'en'
  ? 'isiNgisi'
  : LANG_NAME[code] ?? code;

interface CourseAudioPlayerProps {
  moduleId: string;
  /** The app's current language code. */
  appLang: string;
  /** Which tracks to offer. Pass a lesson's tracks for a lesson-level player, or all of them
   *  for the module. An empty list renders nothing. */
  tracks: NarrationTrack[];
  /** Small heading above the list. */
  label?: string;
}

export default function CourseAudioPlayer({ moduleId, appLang, tracks, label }: CourseAudioPlayerProps) {
  const { t } = useLanguage();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const narration = narrationFor(moduleId);
  const availableLanguages = availableNarrationLanguages(moduleId);
  const resolved = resolveNarrationLang(moduleId, appLang);

  // Chosen language is state so the learner can override the resolved default. Re-resolves if
  // the app language changes underneath us.
  const needsExplicitChoice = requiresExplicitNarrationChoice(moduleId, appLang);
  const defaultLang = needsExplicitChoice ? null : resolved?.lang ?? null;
  const [lang, setLang] = useState<string | null>(defaultLang);
  const selectionRef = useRef({ moduleId, lang: defaultLang });
  const playbackGeneration = useRef(0);
  const currentSlideRef = useRef<number | null>(null);

  const [currentSlide, setCurrentSlide] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [failedSlide, setFailedSlide] = useState<number | null>(null);

  // A previous play promise or ended handler may arrive after a language change.
  // Invalidate that work and remove its URL before offering another voice.
  const resetPlayback = useCallback((next: string | null) => {
    playbackGeneration.current += 1;
    selectionRef.current = { moduleId, lang: next };
    currentSlideRef.current = null;
    const el = audioRef.current;
    if (el) { el.pause(); el.removeAttribute('src'); el.load(); }
    setLang(next);
    setPlaying(false);
    setCurrentSlide(null);
    setElapsed(0);
    setDuration(0);
    setFailedSlide(null);
  }, [moduleId]);
  useEffect(() => { resetPlayback(defaultLang); }, [moduleId, appLang, defaultLang, resetPlayback]);
  const renderedGeneration = playbackGeneration.current;

  const reviewUnavailable = useCallback((slide: number): string | null => {
    if (lang !== 'zu') return null;
    const reason = isiZuluDeckReviewHold(moduleId, slide);
    if (reason) return reason;
    if (trackUrl(moduleId, lang, slide) === null) {
      return 'Source comparison changed; recording unavailable until checked.';
    }
    return null;
  }, [lang, moduleId]);

  // App-language changes or source edits can make a previously selected row unavailable. Stop
  // and clear its old src immediately so a stale button or ended event cannot resume it.
  useEffect(() => {
    if (currentSlide === null || !reviewUnavailable(currentSlide)) return;
    resetPlayback(selectionRef.current.lang);
  }, [currentSlide, reviewUnavailable, resetPlayback]);

  const stop = useCallback(() => {
    playbackGeneration.current += 1;
    const el = audioRef.current;
    if (el) { el.pause(); }
    setPlaying(false);
  }, []);

  // Never leave audio running after the panel closes or the page changes.
  useEffect(() => {
    const el = audioRef.current;
    return () => { playbackGeneration.current += 1; el?.pause(); };
  }, []);

  // The deck's silent Watch clip is still a lesson scene. Stop this playlist when
  // it starts, or its next narrated slide can speak over the picture.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const pauseForOtherMedia = (event: Event) => {
      const audio = audioRef.current;
      if (audio && event.target !== audio &&
        (event.target instanceof HTMLAudioElement || event.target instanceof HTMLVideoElement) &&
        !audio.paused) {
        playbackGeneration.current += 1;
        audio.pause();
        setPlaying(false);
      }
    };
    document.addEventListener('play', pauseForOtherMedia, true);
    return () => document.removeEventListener('play', pauseForOtherMedia, true);
  }, []);

  const playSlide = useCallback((slide: number) => {
    if (!lang || selectionRef.current.moduleId !== moduleId || selectionRef.current.lang !== lang) return;
    if (reviewUnavailable(slide)) {
      stop();
      currentSlideRef.current = null;
      setCurrentSlide(null);
      return;
    }
    const url = trackUrl(moduleId, lang, slide);
    const el = audioRef.current;
    if (!url || !el) { setFailedSlide(slide); return; }

    setFailedSlide(null);
    currentSlideRef.current = slide;
    setCurrentSlide(slide);
    setElapsed(0);
    setDuration(0);
    // Assigning src is what triggers the download — nothing is fetched before this point.
    const generation = ++playbackGeneration.current;
    el.src = url;
    void el.play().then(() => {
      if (generation === playbackGeneration.current) setPlaying(true);
    }).catch(() => {
      if (generation !== playbackGeneration.current) return;
      // Autoplay policy or a missing file. Both are "it did not play"; say so rather than
      // leaving a Pause button showing over silence.
      setPlaying(false);
      setFailedSlide(slide);
    });
  }, [lang, moduleId, reviewUnavailable, stop]);

  function toggle(slide: number) {
    if (!lang || selectionRef.current.moduleId !== moduleId || selectionRef.current.lang !== lang || reviewUnavailable(slide)) return;
    const el = audioRef.current;
    if (!el) return;
    if (currentSlide === slide && playing) { stop(); return; }
    if (currentSlide === slide && !playing && el.src) {
      const generation = ++playbackGeneration.current;
      void el.play().then(() => {
        if (generation === playbackGeneration.current) setPlaying(true);
      }).catch(() => { if (generation === playbackGeneration.current) setFailedSlide(slide); });
      return;
    }
    playSlide(slide);
  }

  function playbackIsCurrent() {
    return lang !== null && renderedGeneration === playbackGeneration.current &&
      selectionRef.current.moduleId === moduleId && selectionRef.current.lang === lang &&
      currentSlide !== null && currentSlideRef.current === currentSlide;
  }

  function handleEnded() {
    if (!playbackIsCurrent()) return;
    setPlaying(false);
    if (currentSlide !== null && reviewUnavailable(currentSlide)) {
      setCurrentSlide(null);
      return;
    }
    const i = tracks.findIndex((t) => t.slide === currentSlide);
    const next = i >= 0 ? tracks[i + 1] : undefined;
    if (next && !reviewUnavailable(next.slide)) playSlide(next.slide); // stop before a review-held or stale-source row
    else setCurrentSlide(null);           // end of the list — stop, never loop
  }

  function switchLang(next: string | null) {
    resetPlayback(next);
  }

  if (!narration || tracks.length === 0) return null;

  const mismatch = lang !== null && lang !== appLang;

  const progressPct = duration > 0 ? Math.min(100, (elapsed / duration) * 100) : 0;

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${HAIRLINE}`, background: '#FFFEFA' }}>
      <div className="flex flex-wrap items-center gap-2 px-3.5 py-2.5" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
        <Volume2 size={14} style={{ color: GREEN, flexShrink: 0 }} />
        <span className="font-display text-xs font-semibold uppercase tracking-wide" style={{ color: '#5C5040' }}>
          {label ?? t('courseAudioListen')}
        </span>
        <div className="flex-1 min-w-0" />
        {(availableLanguages.length > 1 || needsExplicitChoice) && (
          <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-1 sm:w-auto" role="group" aria-label={t('courseNarrationLanguage')}>
            {availableLanguages.map((code) => {
              const on = code === lang;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => switchLang(code)}
                  aria-pressed={on}
                  className="font-sans text-xs px-2 py-1 rounded-full shrink-0"
                  style={{
                    background: on ? 'rgba(31,77,43,0.10)' : 'transparent',
                    border: `1px solid ${on ? 'rgba(31,77,43,0.30)' : HAIRLINE}`,
                    color: on ? GREEN : MUTED,
                    cursor: 'pointer',
                    minHeight: 28,
                  }}
                >
                  {needsExplicitChoice && code === 'en'
                    ? 'English source narration'
                    : regionalNarrationDraft(moduleId, code)
                    ? `${langName(code, appLang)} AI draft + English`
                    : langName(code, appLang)}
                </button>
              );
            })}
            {needsExplicitChoice && <button type="button" onClick={() => switchLang(null)}
              aria-pressed={lang === null} className="font-sans text-xs px-2 py-1 rounded-full shrink-0"
              style={{ border: `1px solid ${HAIRLINE}`, color: lang === null ? GREEN : MUTED, minHeight: 28 }}>
              {t('courseDeckNoNarration')}
            </button>}
          </div>
        )}
      </div>

      {needsExplicitChoice && lang === null && <p className="font-sans text-xs px-3.5 pt-2.5 leading-relaxed" style={{ color: MUTED }}>
        No {langName(appLang, appLang)} narration is available. Choose English source narration explicitly to listen.
      </p>}

      {mismatch && lang && (
        <p className="font-sans text-xs px-3.5 pt-2.5 leading-relaxed" style={{ color: MUTED }}>
          {playing ? t('courseAudioLanguageMissing')
            .replace('{appLanguage}', langName(appLang, appLang))
            .replace('{playingLanguage}', langName(lang, appLang))
            : `${needsExplicitChoice && lang === 'en' ? 'English source narration' : langName(lang, appLang) + ' narration'} selected. Press Play to listen.`}
        </p>
      )}

      {lang === 'zu' && narrationReviewPending(moduleId, lang) && (
        <p className="font-sans text-xs px-3.5 pt-2.5 leading-relaxed" style={{ color: MUTED }}>
          {appLang === 'zu'
            ? 'Lo msindo wesiZulu usalindele ukubuyekezwa ngumuntu olwazi kahle ulimi.'
            : 'This isiZulu narration is awaiting review by a fluent speaker.'}
        </p>
      )}

      {lang && regionalNarrationDraft(moduleId, lang) && (
        <p className="font-sans text-xs px-3.5 pt-2.5 leading-relaxed" style={{ color: MUTED }}>
          Unreviewed machine {langName(lang, appLang)} narration with exact English passages.
          Fluent-speaker, local-farming and listening review are pending.
        </p>
      )}

      <ul className="px-2 py-2 space-y-0.5" style={{ listStyle: 'none', margin: 0 }}>
        {tracks.map((track) => {
          const isCurrent = currentSlide === track.slide;
          const isPlaying = isCurrent && playing;
          const failed = failedSlide === track.slide;
          const reviewHold = reviewUnavailable(track.slide);
          const documentedHold = lang === 'zu' ? isiZuluDeckReviewHold(moduleId, track.slide) : null;
          const title = trackTitle(track, lang ?? 'en');
          return (
            <li key={track.slide}>
              <button
                type="button"
                onClick={() => toggle(track.slide)}
                aria-label={t(isPlaying ? 'courseAudioPauseTrack' : 'courseAudioPlayTrack').replace('{title}', title)}
                aria-describedby={reviewHold ? `${moduleId}-slide-${track.slide}-review-hold` : undefined}
                disabled={!lang || Boolean(reviewHold)}
                className="w-full flex items-center gap-2.5 px-1.5 py-2 rounded-lg text-left"
                style={{
                  background: isCurrent ? 'rgba(31,77,43,0.06)' : 'transparent',
                  border: 'none',
                  cursor: !lang || reviewHold ? 'not-allowed' : 'pointer',
                  opacity: !lang || reviewHold ? 0.72 : 1,
                  minHeight: 40,
                }}
              >
                <span
                  className="flex-shrink-0 flex items-center justify-center rounded-full"
                  style={{
                    width: 26, height: 26,
                    background: isPlaying ? GREEN : 'rgba(31,77,43,0.08)',
                    border: `1px solid ${isPlaying ? GREEN : 'rgba(31,77,43,0.20)'}`,
                  }}
                >
                  {isPlaying
                    ? <Pause size={12} style={{ color: '#EAF3E2' }} />
                    : <Play size={12} style={{ color: GREEN, marginLeft: 1 }} />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-sans text-sm leading-snug truncate" style={{ color: '#3A3020' }}>
                    {title}
                  </span>
                  {reviewHold && (
                    <span id={`${moduleId}-slide-${track.slide}-review-hold`} className="block font-sans text-xs leading-relaxed" style={{ color: MUTED }}>
                      {documentedHold
                        ? 'isiZulu recording needs revision; choose English narration explicitly.'
                        : reviewHold}
                    </span>
                  )}
                  {isCurrent && duration > 0 && (
                    <span className="flex items-center gap-2 mt-1">
                      <span className="flex-1 rounded-full overflow-hidden" style={{ height: 3, background: 'rgba(32,25,15,0.10)' }}>
                        <span className="block" style={{ width: `${progressPct}%`, height: '100%', background: OCHRE, borderRadius: 999 }} />
                      </span>
                      <span className="font-mono text-xs flex-shrink-0" style={{ color: MUTED }}>
                        {formatClock(elapsed)} / {formatClock(duration)}
                      </span>
                    </span>
                  )}
                  {failed && (
                    <span className="flex items-center gap-1 mt-1">
                      <AlertCircle size={11} style={{ color: '#B03A2E' }} />
                      <span className="font-sans text-xs" style={{ color: '#B03A2E' }}>
                        {t('courseAudioPlayFailed')}
                      </span>
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* One element for the whole list: only ever one clip plays at a time. */}
      <audio
        ref={audioRef}
        preload="none"
        onTimeUpdate={(e) => { if (playbackIsCurrent()) setElapsed(e.currentTarget.currentTime); }}
        onLoadedMetadata={(e) => { if (playbackIsCurrent()) setDuration(e.currentTarget.duration); }}
        onPlay={() => {
          if (playbackIsCurrent()) setPlaying(true);
          else if (selectionRef.current.lang === null || currentSlideRef.current === null) audioRef.current?.pause();
        }}
        onPause={() => { if (playbackIsCurrent()) setPlaying(false); }}
        onEnded={handleEnded}
        onError={() => { if (playbackIsCurrent()) { setPlaying(false); setFailedSlide(currentSlide); } }}
      />
    </div>
  );
}
