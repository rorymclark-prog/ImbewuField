'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  animationUrls,
  deckFor,
  formatBytes,
  resolveDeckLang,
  slideAudioUrl,
  slideImageUrl,
} from '@/lib/course-deck';
import { trackTitle } from '@/lib/course-audio';
import { COURSE_NARRATION } from '@/lib/course-audio';

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
// 2. It says what it does not have. isiZulu narration exists; isiZulu slides do not yet. Rather
//    than quietly showing English, it says so — the same contract resolveNarrationLang uses for
//    audio. A farmer who cannot read the slide should know that is our gap, not theirs.
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

export default function DeckPlayer({ moduleId, lang, lessonId, onClose }: DeckPlayerProps) {
  const deck = deckFor(moduleId);
  const slideLang = resolveDeckLang(moduleId, lang);
  const narration = COURSE_NARRATION[moduleId];

  const slides = useMemo(
    () => (deck?.slides ?? []).filter((s) => !lessonId || s.lesson === lessonId),
    [deck, lessonId],
  );

  const [index, setIndex] = useState(0);
  // Which slides the farmer has chosen to spend data on. Never persisted and never pre-filled —
  // reopening the module should not silently re-download 11 MB of clips.
  const [playing, setPlaying] = useState<Set<number>>(() => new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const current = slides[index];
  const total = slides.length;

  const go = useCallback((next: number) => {
    setIndex((i) => Math.min(total - 1, Math.max(0, next ?? i)));
  }, [total]);

  // Moving on stops the previous slide's narration. Two voices at once is worse than silence, and
  // on a slow connection the old clip can otherwise still be arriving when the new one starts.
  useEffect(() => {
    const el = audioRef.current;
    if (el) { el.pause(); el.currentTime = 0; }
  }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(index + 1);
      if (e.key === 'ArrowLeft') go(index - 1);
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
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.6) go(index + (dx < 0 ? 1 : -1));
    touchStart.current = null;
  };

  if (!deck || !slideLang || !current) return null;

  const img = slideImageUrl(moduleId, slideLang.lang, current.slide);
  const anim = animationUrls(moduleId, current.slide);
  const audio = slideAudioUrl(moduleId, lang, current.slide);
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
            src={anim ? anim.poster : (img ?? '')}
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
          preload="none"
          style={{ width: '100%', height: 34 }}
        />
      )}

      {!slideLang.exact && (
        // Say it plainly. The narration IS in their language; only the slide text is not.
        <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.4, color: MUTED }}>
          The spoken lesson is in your language. These slides are only in English so far.
        </p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={() => go(index - 1)}
          disabled={index === 0}
          style={{ padding: '9px 14px', borderRadius: 10, border: `1px solid ${LINE}`, background: PAPER, color: index === 0 ? '#B9AC94' : INK, fontWeight: 700, fontSize: 13, cursor: index === 0 ? 'default' : 'pointer' }}
        >
          ‹ Back
        </button>
        <div style={{ flex: 1, height: 4, borderRadius: 2, background: LINE, overflow: 'hidden' }}>
          <div style={{ width: `${((index + 1) / total) * 100}%`, height: '100%', background: GREEN }} />
        </div>
        <button
          onClick={() => go(index + 1)}
          disabled={index === total - 1}
          style={{ padding: '9px 14px', borderRadius: 10, border: 'none', background: index === total - 1 ? '#D9D0BC' : GREEN, color: '#fff', fontWeight: 700, fontSize: 13, cursor: index === total - 1 ? 'default' : 'pointer' }}
        >
          Next ›
        </button>
      </div>
    </div>
  );
}
