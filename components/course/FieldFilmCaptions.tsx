'use client';

import { useEffect, useState, type RefObject } from 'react';
import type { FilmLanguage } from '@/lib/field-films';

type Cue = { from: number; until: number; text: string };

function seconds(stamp: string) {
  return stamp.split(':').reduce((total, part) => total * 60 + Number(part), 0);
}

// These authored sidecars use plain WebVTT timestamps and text, with no cue settings.
// Reading the same file that a learner can download keeps the two copies of the lesson in sync.
export function readFieldCaptions(vtt: string): Cue[] {
  const cues: Cue[] = [];
  for (const block of vtt.trim().split(/\r?\n\s*\r?\n/)) {
    const [timing, ...lines] = block.split(/\r?\n/);
    const [start, end] = timing.split(' --> ');
    if (!end || !lines.length) continue;
    const from = seconds(start), until = seconds(end);
    if (Number.isFinite(from) && until > from) cues.push({ from, until, text: lines.join(' ') });
  }
  if (!cues.length) throw new Error('Empty field film captions');
  return cues;
}

export default function FieldFilmCaptions({ video, src, lang, errorText, onUnavailable }: {
  video: RefObject<HTMLVideoElement>; src: string; lang: FilmLanguage; errorText: string; onUnavailable: () => void;
}) {
  const [text, setText] = useState('');
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    const abort = new AbortController();
    let cues: Cue[] = [];
    const update = () => {
      if (!cues.length) return;
      const now = element.currentTime;
      const active = cues.find(cue => now >= cue.from && now < cue.until);
      setText(active?.text ?? (element.ended ? cues[cues.length - 1]?.text : '') ?? '');
    };
    fetch(src, { signal: abort.signal }).then(async response => {
      if (!response.ok) throw new Error('Missing field film captions');
      const loaded = readFieldCaptions(await response.text());
      if (!abort.signal.aborted) { cues = loaded; update(); }
    }).catch(() => {
      if (!abort.signal.aborted) { setText(errorText); onUnavailable(); }
    });
    element.addEventListener('timeupdate', update);
    element.addEventListener('seeked', update);
    return () => {
      abort.abort();
      element.removeEventListener('timeupdate', update);
      element.removeEventListener('seeked', update);
    };
  }, [src, video, errorText, onUnavailable]);
  return <p lang={lang} data-film-caption={lang} className="field-film-caption">{text}</p>;
}
