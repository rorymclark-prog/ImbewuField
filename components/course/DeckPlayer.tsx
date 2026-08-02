'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  animationUrls,
  deckFor,
  formatBytes,
  resolveDeckLang,
  slideAudioUrl,
  slideImageFor,
} from '@/lib/course-deck';
import { trackTitle } from '@/lib/course-audio';
import { COURSE_NARRATION } from '@/lib/course-audio';
import { COURSE_CACHE } from '@/lib/offline-cache';

// The module as it was actually written: 24 slides in a teaching order, narrated, with animations
// where a still cannot carry the idea. Built for one farmer alone with a phone and metered data.
//
// THREE RULES DRIVE EVERY DECISION HERE:
//
// 1. Nothing downloads unasked. Slides are ~75 KB each and load one at a time; audio is
//    preload="none"; animation clips are 0.6–2.6 MB and load only when the farmer presses play,
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
const langName = (code: string) => LANG_NAME[code] ?? code;

export default function DeckPlayer({ moduleId, lang: appLang, lessonId, onClose }: DeckPlayerProps) {
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
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const current = slides[index];
  const total = slides.length;
  // Resolved up here, not after the early return below, because the play-through effects need it.
  const audioForCurrent = current ? slideAudioUrl(moduleId, lang, current.slide) : null;

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
    const el = audioRef.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
    if (!running) return;
    const started = el.play();
    if (started) started.catch(() => setRunning(false));
    // `audioForCurrent` is in the deps so switching language mid-lesson restarts THIS slide in the
    // new voice, rather than leaving the element pointing at a source it is no longer playing.
  }, [index, running, audioForCurrent]);

  // A downloaded clip plays itself; one that is not downloaded still asks first.
  //
  // The rule the whole module is built on is that nothing costs data unasked — but a farmer who
  // downloaded the module in town has already paid for these clips, and making them tap each
  // one again would be asking twice for the same thing. So play-through consults the offline
  // cache: present means free, absent means the poster and its size stay, and the narration
  // carries the slide either way.
  useEffect(() => {
    if (!running || !current?.animation) return;
    if (playing.has(current.slide)) return;
    let cancelled = false;
    (async () => {
      const urls = animationUrls(moduleId, current.slide);
      if (!urls || typeof caches === 'undefined') return;
      try {
        const hit = await (await caches.open(COURSE_CACHE)).match(urls.video, { ignoreSearch: true });
        if (hit && !cancelled) setPlaying((p) => new Set(p).add(current.slide));
      } catch {
        // No cache access — leave it as tap-to-play, which is the safe default.
      }
    })();
    return () => { cancelled = true; };
  }, [running, current, moduleId, playing]);

  // When a clip ends, turn the page. On the last slide, stop rather than loop.
  const advance = useCallback(() => {
    setIndex((i) => {
      if (i >= total - 1) { setRunning(false); return i; }
      return i + 1;
    });
  }, [total]);

  const onNarrationEnded = useCallback(() => {
    if (running) advance();
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
    const t = setTimeout(advance, SILENT_SLIDE_MS);
    return () => clearTimeout(t);
  }, [running, audioForCurrent, advance]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'Escape' && onClose) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, go, onClose]);

  // Touch: a horizontal drag turns the page. Vertical is left alone so the page still scrolls.
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touchStart.current;
    if (!s) return;
    const dx = e.changedTouches[0].clientX - s.x;
    const dy = e.changedTouches[0].clientY - s.y;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.6) go(dx < 0 ? 1 : -1);
    touchStart.current = null;
  };

  if (!deck || !slideLang || !current) return null;

  const img = slideImageFor(moduleId, lang, current.slide);
  const anim = animationUrls(moduleId, current.slide);
  const audio = audioForCurrent;
  const track = narration?.tracks.find((t) => t.slide === current.slide);
  const heading = track ? trackTitle(track, lang) : current.title;
  const isPlaying = playing.has(current.slide);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: PAPER, borderRadius: 14, border: `1px solid ${LINE}`, padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', color: MUTED, textTransform: 'uppercase' }}>
          {index + 1} / {total}
        </span>
        <h3 style={{ margin: 0, fontSize: 15, lineHeight: 1.25, color: INK, flex: 1, textWrap: 'balance' }}>{heading}</h3>
        {languages.length > 1 && (
          <div role="group" aria-label="Narration language" style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {languages.map((code) => {
              const on = code === lang;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLang(code)}
                  aria-pressed={on}
                  style={{
                    padding: '3px 9px', borderRadius: 999, fontSize: 11.5, cursor: 'pointer',
                    background: on ? 'rgba(47,107,58,0.10)' : 'transparent',
                    border: `1px solid ${on ? 'rgba(47,107,58,0.30)' : LINE}`,
                    color: on ? GREEN : MUTED,
                  }}
                >
                  {langName(code)}
                </button>
              );
            })}
          </div>
        )}
        {onClose && (
          <button onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'none', color: MUTED, fontSize: 20, lineHeight: 1, cursor: 'pointer', padding: 4 }}>×</button>
        )}
      </div>

      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', background: '#1B1710', aspectRatio: '16 / 9' }}
      >
        {isPlaying && anim ? (
          <video
            src={anim.video}
            poster={anim.poster}
            autoPlay
            loop
            muted
            playsInline
            controls
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

        {anim && !isPlaying && (
          <button
            onClick={() => setPlaying((p) => new Set(p).add(current.slide))}
            style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none', background: 'rgba(20,16,10,0.42)', color: '#fff', cursor: 'pointer' }}
          >
            <span aria-hidden style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 54, height: 54, borderRadius: '50%', background: 'rgba(255,255,255,0.94)', color: INK, fontSize: 20, paddingLeft: 4 }}>▶</span>
            {/* The size is on the button, not buried in a setting. Someone paying by the megabyte
                is entitled to decide before the download starts, not after. */}
            <span style={{ fontSize: 12.5, fontWeight: 700 }}>Watch · {anim.seconds}s · {formatBytes(anim.bytes)}</span>
          </button>
        )}
      </div>

      {audio && (
        <audio
          ref={audioRef}
          src={audio}
          controls
          onEnded={onNarrationEnded}
          // Under play-through the next clip is fetched the moment this slide appears, so the gap
          // between slides is not a silence while the phone thinks. Off otherwise: idle preloading
          // is the whole thing this module refuses to do.
          preload={running ? 'auto' : 'none'}
          style={{ width: '100%', height: 34 }}
        />
      )}

      {img && !img.exact && (
        // Only on the slide it is actually true of. A localized deck can have one missing asset,
        // so saying "these slides are in English" across the whole module would be false for the
        // rest of the lesson and would make a finished lesson look unfinished.
        <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.4, color: MUTED }}>
          This one slide is only in English. The spoken lesson is in your language.
        </p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* THE PRIMARY ACTION. Everything else on this control strip is for someone who wants to
            steer; this is for someone who wants to be taught. It stays available on every slide,
            so stopping to re-read one and then carrying on is one tap, not a restart. */}
        <button
          onClick={() => setRunning((on) => !on)}
          aria-label={running ? 'Stop the lesson' : 'Play the lesson'}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '9px 15px', borderRadius: 10,
            border: 'none', background: running ? '#8A4B2A' : GREEN, color: '#fff',
            fontWeight: 700, fontSize: 13, cursor: 'pointer', flexShrink: 0,
          }}
        >
          <span aria-hidden style={{ fontSize: 12 }}>{running ? '■' : '▶'}</span>
          {running ? 'Stop' : 'Play lesson'}
        </button>
        <button
          onClick={() => go(-1)}
          disabled={index === 0}
          style={{ padding: '9px 14px', borderRadius: 10, border: `1px solid ${LINE}`, background: PAPER, color: index === 0 ? '#B9AC94' : INK, fontWeight: 700, fontSize: 13, cursor: index === 0 ? 'default' : 'pointer' }}
        >
          ‹ Back
        </button>
        <div style={{ flex: 1, height: 4, borderRadius: 2, background: LINE, overflow: 'hidden' }}>
          <div style={{ width: `${((index + 1) / total) * 100}%`, height: '100%', background: GREEN }} />
        </div>
        <button
          onClick={() => go(1)}
          disabled={index === total - 1}
          style={{ padding: '9px 14px', borderRadius: 10, border: 'none', background: index === total - 1 ? '#D9D0BC' : GREEN, color: '#fff', fontWeight: 700, fontSize: 13, cursor: index === total - 1 ? 'default' : 'pointer' }}
        >
          Next ›
        </button>
      </div>
    </div>
  );
}
