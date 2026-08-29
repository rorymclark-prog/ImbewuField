'use client';

// A single screenshot tile for the public /partners showcase.
//
// These five images (public/marketing/shot-*.png) are captured and committed separately from
// this page's code — see the PR body for the exact list. Until that happens (and if any single
// capture ever goes missing later), a bare <img> would show the browser's broken-image glyph,
// which reads as a broken product to exactly the audience this page exists to reassure. So the
// failure is caught and replaced with a framed placeholder that still names the screen — same
// onError-swap pattern as components/course/LessonInfographic.tsx uses for lesson diagrams.

import { useState } from 'react';
import { ImageOff } from 'lucide-react';

interface ScreenshotProps {
  src: string;
  alt: string;
  label: string;
  caption?: string;
  /** The one screen worth more room — a full farm design, not an icon-sized thumbnail of one. */
  featured?: boolean;
}

export default function Screenshot({ src, alt, label, caption, featured = false }: ScreenshotProps) {
  const [failed, setFailed] = useState(false);
  const heightClass = featured
    ? 'h-[420px] sm:h-[520px] lg:h-[600px]'
    : 'h-[280px] sm:h-[320px]';

  return (
    <figure className="m-0 flex flex-col gap-2.5">
      <div
        className={`w-full flex items-center justify-center overflow-hidden rounded-2xl ${heightClass}`}
        style={{
          background: failed ? 'var(--surface-2)' : 'var(--color-sage-100)',
          border: `1px solid ${failed ? 'var(--border-strong)' : 'var(--color-border)'}`,
          borderStyle: failed ? 'dashed' : 'solid',
          boxShadow: failed ? 'none' : 'var(--shadow-card)',
        }}
      >
        {failed ? (
          <div className="flex flex-col items-center gap-2 px-6 text-center">
            <ImageOff size={22} strokeWidth={1.5} style={{ color: 'var(--text-3)' }} />
            <span className="text-xs font-sans" style={{ color: 'var(--text-3)' }}>
              Screenshot coming soon
            </span>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt}
            loading="lazy"
            onError={() => setFailed(true)}
            className="w-full h-full"
            style={{ objectFit: 'contain' }}
          />
        )}
      </div>
      <figcaption className="text-center">
        <span className="block text-sm font-display font-semibold" style={{ color: 'var(--text)' }}>
          {label}
        </span>
        {caption && (
          <span className="block mt-1 text-[13px] font-sans leading-snug" style={{ color: 'var(--text-3)' }}>
            {caption}
          </span>
        )}
      </figcaption>
    </figure>
  );
}
