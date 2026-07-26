'use client';

// A farmer-facing still image (diagram / infographic) for one lesson.
//
// This mirrors CourseAudioPlayer's data discipline on purpose: nothing downloads until the
// learner presses something. On a metered rural connection, an image that loads itself the
// moment the lesson panel opens is exactly the kind of surprise data cost this app avoids
// everywhere else — so the image stays behind a tap, just like the audio clips do.
//
// Deliberate behaviours:
//   • No src is set until the learner presses "Show diagram" — nothing is fetched before that.
//   • loading="lazy" once shown, so it still doesn't block anything else on the page.
//   • A failed load never shows the browser's broken-image icon — it shows a plain sentence
//     instead, the same pattern CourseAudioPlayer uses for a clip that won't play.

import { useState } from 'react';
import { ImageIcon, AlertCircle } from 'lucide-react';

const GREEN = '#1F4D2B';
const MUTED = '#8C7A62';
const HAIRLINE = '#E2D8C4';

interface LessonInfographicProps {
  url: string;
  /** Alt text — also what a farmer reads if the image fails to load. Required: this component
   *  is only ever rendered by callers that have already checked url and alt are both set. */
  alt: string;
  /** Approximate download size, e.g. "~180KB", shown on the placeholder so a learner on
   *  metered data knows what they're about to fetch before they tap. Omit when not known —
   *  the placeholder still works with just the label. */
  sizeHint?: string;
}

export default function LessonInfographic({ url, alt, sizeHint }: LessonInfographicProps) {
  const [shown, setShown] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!shown) {
    return (
      <button
        type="button"
        onClick={() => setShown(true)}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-sans font-semibold transition-colors"
        style={{
          background: 'rgba(31,77,43,0.06)',
          border: `1px solid ${HAIRLINE}`,
          color: GREEN,
          cursor: 'pointer',
          minHeight: 44,
        }}
      >
        <ImageIcon size={15} style={{ flexShrink: 0 }} />
        Show diagram
        {sizeHint && (
          <span className="font-mono text-xs font-normal" style={{ color: MUTED }}>
            ({sizeHint})
          </span>
        )}
      </button>
    );
  }

  if (failed) {
    return (
      <div
        className="flex items-center gap-2 px-3.5 py-3 rounded-xl"
        style={{ background: 'rgba(180,30,30,0.06)', border: '1px solid rgba(180,30,30,0.20)' }}
      >
        <AlertCircle size={14} style={{ color: '#B03A2E', flexShrink: 0 }} />
        <span className="font-sans text-xs leading-snug" style={{ color: '#8B2020' }}>
          Could not load this diagram — check your connection and try again.
        </span>
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className="w-full h-auto rounded-xl"
      style={{ maxWidth: '100%', display: 'block', border: `1px solid ${HAIRLINE}` }}
    />
  );
}
