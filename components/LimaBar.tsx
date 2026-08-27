'use client';

import { Camera, MessageCircleQuestion } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n';

interface LimaBarProps {
  /** Where the ask-for-help control leads. */
  chatHref?: string;
}

/**
 * THE HELP STRIP ABOVE THE TAB BAR — a labelled control, not an open composer.
 *
 * This used to be a free-text input reading "Ask Lima anything...", pinned to the most valuable
 * strip on the home screen, on every visit. Two problems, both found in the Gogo Test audit:
 *
 *   • AN OPEN TEXT BOX IS THE HARDEST INTERFACE THERE IS for someone who types slowly and does
 *     not know what the machine will accept. It sat under her thumb by default and demanded she
 *     compose a question before she knew one was possible. Free text should be a place she
 *     chooses to go, not the resting state of the screen.
 *   • "LIMA" WAS NEVER INTRODUCED — a proper noun with no referent. Is it a person, the app, her
 *     programme, her mentor? And the placeholder was hardcoded English, so the single most
 *     prominent line on the home screen was untranslated for every non-English speaker.
 *
 * So: one caption that says who Lima is, and two labelled buttons. Tapping either lands in
 * exactly the same place the input did — nothing was taken away, it just stopped being the
 * default posture of the screen. Both labels go through t(), which the placeholder never did.
 */
export default function LimaBar({ chatHref = '/farmer?chat=1' }: LimaBarProps) {
  const { t } = useLanguage();

  return (
    <div
      className="px-4 pt-2 pb-2.5"
      style={{ background: '#FFFEFA', borderTop: '1px solid #E2D8C4', flexShrink: 0 }}
    >
      {/* Who Lima is — said every time rather than once, because it costs one short line and a
          farmer who opens the app twice a season should not have to remember. */}
      <div
        className="flex items-center gap-1.5 font-sans"
        style={{ fontSize: 12, fontWeight: 600, color: '#7A6B52', marginBottom: 6, paddingLeft: 2 }}
      >
        <span
          className="inline-flex items-center justify-center flex-shrink-0"
          style={{ width: 20, height: 20, background: 'linear-gradient(135deg, var(--brand-light), var(--brand-strong))', borderRadius: 6 }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#EAF3E2" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 21V11" />
            <path d="M12 11c0-3.5-2.5-6-6.5-6 0 4 2.5 6 6.5 6Z" />
            <path d="M12 13c0-3 2.2-5.2 6-5.2 0 3.6-2.2 5.2-6 5.2Z" />
          </svg>
        </span>
        {t('limaWhoIs')}
      </div>

      <div className="flex items-center gap-2">
        <Link
          href={chatHref}
          className="flex-1 flex items-center justify-center gap-2 font-sans"
          style={{
            minHeight: 46, borderRadius: 12, textDecoration: 'none',
            background: 'linear-gradient(135deg, var(--brand-light), var(--brand-strong))',
            color: '#F7F2E9', fontSize: 15, fontWeight: 700,
            boxShadow: '0 2px 8px rgba(31,77,43,0.22)',
          }}
        >
          <MessageCircleQuestion size={18} strokeWidth={2} />
          {t('limaAskButton')}
        </Link>

        {/* The camera keeps its own control rather than hiding inside the chat, but it now says
            what it does. An unlabelled icon is a guess, and she only gets one guess. */}
        <Link
          href={`${chatHref}&photo=1`}
          className="flex items-center justify-center gap-1.5 font-sans"
          style={{
            minHeight: 46, padding: '0 13px', borderRadius: 12, textDecoration: 'none',
            background: '#fff', border: '1.5px solid #D8CBB2',
            color: '#4A4034', fontSize: 13.5, fontWeight: 700,
          }}
        >
          <Camera size={17} strokeWidth={2} />
          {t('limaPhotoButton')}
        </Link>
      </div>
    </div>
  );
}
