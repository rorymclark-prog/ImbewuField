'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { useRegisterBackControl } from '@/components/BackControl';
import { useLanguage } from '@/lib/i18n';

/**
 * A consistent "← Back" control for every sub-page header.
 * Goes to the previous page if there's history, otherwise home (the farmer app).
 */
export default function BackButton({ fallback = '/' }: { fallback?: string }) {
  const router = useRouter();
  const { lang, t } = useLanguage();
  // Tells the global fallback (BackControl) that this page already offers a way back, so the
  // farmer never sees two back buttons on one screen.
  useRegisterBackControl();
  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push(fallback);
  };
  return (
    <button
      type="button"
      onClick={goBack}
      aria-label={lang === 'zu' ? 'Buyela emuva' : 'Go back'}
      title={t('buttonBack')}
      className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-display transition-all"
      style={{
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        color: 'var(--text-primary)',
        cursor: 'pointer',
        // 44px is the touch-target floor this app holds itself to elsewhere (see the floating
        // fallback in BackControl.tsx) — this in-flow button rendered on 15+ page headers was
        // ~27px tall, and icon-only on mobile (the "Back" label is `hidden` below `sm`).
        minHeight: 44,
        minWidth: 44,
      }}
    >
      <ChevronLeft size={14} strokeWidth={2} />
      <span>{t('buttonBack')}</span>
    </button>
  );
}
