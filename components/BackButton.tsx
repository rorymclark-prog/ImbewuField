'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { useRegisterBackControl } from '@/components/BackControl';

/**
 * A consistent "← Back" control for every sub-page header.
 * Goes to the previous page if there's history, otherwise home (the farmer app).
 */
export default function BackButton({ fallback = '/' }: { fallback?: string }) {
  const router = useRouter();
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
      aria-label="Go back"
      title="Back"
      className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-display transition-all"
      style={{
        background: '#FFFEFA',
        border: '1px solid #E2D8C4',
        color: '#20190F',
        cursor: 'pointer',
        // 44px is the touch-target floor this app holds itself to elsewhere (see the floating
        // fallback in BackControl.tsx) — this in-flow button rendered on 15+ page headers was
        // ~27px tall, and icon-only on mobile (the "Back" label is `hidden` below `sm`).
        minHeight: 44,
        minWidth: 44,
      }}
    >
      <ChevronLeft size={14} strokeWidth={2} />
      <span>Back</span>
    </button>
  );
}
