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
import { useLanguage } from '@/lib/i18n';
import { inlineText } from '@/lib/xh-inline';

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
  const { lang } = useLanguage();
  const heightClass = featured
    ? 'h-[420px] sm:h-[520px] lg:h-[600px]'
    : 'h-[280px] sm:h-[320px]';

  return (
    <figure className="m-0 flex flex-col gap-2.5">
      <div
        className={`w-full flex items-center justify-center overflow-hidden rounded-2xl ${heightClass}`}
        style={{
          background: failed ? 'var(--bg-2)' : 'var(--color-sage-100)',
          border: `1px solid ${failed ? 'var(--border-strong)' : 'var(--color-border)'}`,
          borderStyle: failed ? 'dashed' : 'solid',
          boxShadow: failed ? 'none' : 'var(--shadow-card)',
        }}
      >
        {failed ? (
          <div className="flex flex-col items-center gap-2 px-6 text-center">
            <ImageOff size={22} strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />
            <span className="text-xs font-sans" style={{ color: 'var(--text-muted)' }}>
              {inlineText(lang, 'Screenshot coming soon')}
            </span>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={inlineText(lang, alt)}
            loading="lazy"
            onError={() => setFailed(true)}
            className="w-full h-full"
            style={{ objectFit: 'contain' }}
          />
        )}
      </div>
      <figcaption className="text-center">
        <span className="block text-sm font-display font-semibold" style={{ color: 'var(--text-primary)' }}>
          {inlineText(lang, label)}
        </span>
        {caption && (
          <span className="block mt-1 text-[13px] font-sans leading-snug" style={{ color: 'var(--text-muted)' }}>
            {inlineText(lang, caption)}
          </span>
        )}
      </figcaption>
    </figure>
  );
}

/** The /partners QR image; lives here (a client component) only so its alt text can follow the language. */
export function QrCode() {
  const { lang } = useLanguage();
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/marketing/qr-imbewufield.svg"
      alt={inlineText(lang, 'QR code linking to imbewufield.vercel.app')}
      width={168}
      height={168}
      className="w-[168px] h-[168px]"
    />
  );
}
