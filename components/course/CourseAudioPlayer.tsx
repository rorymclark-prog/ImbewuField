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
  formatClock, narrationFor, resolveNarrationLang, trackTitle, trackUrl,
  type NarrationTrack,
} from '@/lib/course-audio';

const GREEN = '#1F4D2B';
const OCHRE = '#C07A1E';
const MUTED = '#8C7A62';
const HAIRLINE = '#E2D8C4';

/** Human names for the languages we can record in. Shown only in the mismatch notice and the
 *  language switch, so an unlisted code degrades to the raw code rather than breaking. */
const LANG_NAME: Record<string, string> = {
  en: 'English', zu: 'isiZulu', af: 'Afrikaans', xh: 'isiXhosa', st: 'Sesotho',
  nso: 'Sepedi', tn: 'Setswana', ts: 'Xitsonga', ve: 'Tshivenda', ss: 'siSwati', nr: 'isiNdebele',
};
const langName = (code: string) => LANG_NAME[code] ?? code;

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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const narration = narrationFor(moduleId);
  const resolved = resolveNarrationLang(moduleId, appLang);

  // Chosen language is state so the learner can override the resolved default. Re-resolves if
  // the app language changes underneath us.
  const [lang, setLang] = useState<string | null>(resolved?.lang ?? null);
  useEffect(() => { setLang(resolveNarrationLang(moduleId, appLang)?.lang ?? null); }, [moduleId, appLang]);

  const [currentSlide, setCurrentSlide] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [failedSlide, setFailedSlide] = useState<number | null>(null);

  const stop = useCallback(() => {
    const el = audioRef.current;
    if (el) { el.pause(); }
    setPlaying(false);
  }, []);

  // Never leave audio running after the panel closes or the page changes.
  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const playSlide = useCallback((slide: number) => {
    if (!lang) return;
    const url = trackUrl(moduleId, lang, slide);
    const el = audioRef.current;
    if (!url || !el) { setFailedSlide(slide); return; }

    setFailedSlide(null);
    setCurrentSlide(slide);
    setElapsed(0);
    setDuration(0);
    // Assigning src is what triggers the download — nothing is fetched before this point.
    el.src = url;
    void el.play().then(() => setPlaying(true)).catch(() => {
      // Autoplay policy or a missing file. Both are "it did not play"; say so rather than
      // leaving a Pause button showing over silence.
      setPlaying(false);
      setFailedSlide(slide);
    });
  }, [lang, moduleId]);

  function toggle(slide: number) {
    const el = audioRef.current;
    if (!el) return;
    if (currentSlide === slide && playing) { el.pause(); setPlaying(false); return; }
    if (currentSlide === slide && !playing && el.src) {
      void el.play().then(() => setPlaying(true)).catch(() => setFailedSlide(slide));
      return;
    }
    playSlide(slide);
  }

  function handleEnded() {
    setPlaying(false);
    const i = tracks.findIndex((t) => t.slide === currentSlide);
    const next = i >= 0 ? tracks[i + 1] : undefined;
    if (next) playSlide(next.slide);      // roll on through the lesson
    else setCurrentSlide(null);           // end of the list — stop, never loop
  }

  function switchLang(next: string) {
    stop();
    setLang(next);
    setCurrentSlide(null);
    setElapsed(0);
    setDuration(0);
    setFailedSlide(null);
  }

  if (!narration || tracks.length === 0 || !lang) return null;

  const mismatch = resolved ? !resolved.exact : false;
  const progressPct = duration > 0 ? Math.min(100, (elapsed / duration) * 100) : 0;

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${HAIRLINE}`, background: '#FFFEFA' }}>
      <div className="flex items-center gap-2 px-3.5 py-2.5" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
        <Volume2 size={14} style={{ color: GREEN, flexShrink: 0 }} />
        <span className="font-display text-xs font-semibold uppercase tracking-wide" style={{ color: '#5C5040' }}>
          {label ?? 'Listen'}
        </span>
        <div className="flex-1" />
        {narration.languages.length > 1 && (
          <div className="flex items-center gap-1" role="group" aria-label="Narration language">
            {narration.languages.map((code) => {
              const on = code === lang;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => switchLang(code)}
                  aria-pressed={on}
                  className="font-sans text-xs px-2 py-1 rounded-full"
                  style={{
                    background: on ? 'rgba(31,77,43,0.10)' : 'transparent',
                    border: `1px solid ${on ? 'rgba(31,77,43,0.30)' : HAIRLINE}`,
                    color: on ? GREEN : MUTED,
                    cursor: 'pointer',
                    minHeight: 28,
                  }}
                >
                  {langName(code)}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {mismatch && (
        <p className="font-sans text-xs px-3.5 pt-2.5 leading-relaxed" style={{ color: MUTED }}>
          This module has not been recorded in {langName(appLang)} yet — playing {langName(lang)}.
        </p>
      )}

      <ul className="px-2 py-2 space-y-0.5" style={{ listStyle: 'none', margin: 0 }}>
        {tracks.map((track) => {
          const isCurrent = currentSlide === track.slide;
          const isPlaying = isCurrent && playing;
          const failed = failedSlide === track.slide;
          const title = trackTitle(track, lang);
          return (
            <li key={track.slide}>
              <button
                type="button"
                onClick={() => toggle(track.slide)}
                aria-label={`${isPlaying ? 'Pause' : 'Play'} ${title}`}
                className="w-full flex items-center gap-2.5 px-1.5 py-2 rounded-lg text-left"
                style={{
                  background: isCurrent ? 'rgba(31,77,43,0.06)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
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
                        Could not play this clip — check your connection and try again.
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
        onTimeUpdate={(e) => setElapsed(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={handleEnded}
        onError={() => { setPlaying(false); setFailedSlide(currentSlide); }}
      />
    </div>
  );
}
