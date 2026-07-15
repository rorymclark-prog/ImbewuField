'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

/**
 * A consistent "← Back" control for every sub-page header.
 * Goes to the previous page if there's history, otherwise home (the farmer app).
 */
export default function BackButton({ fallback = '/' }: { fallback?: string }) {
  const router = useRouter();
  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push(fallback);
  };
  return (
    <button
      onClick={goBack}
      aria-label="Go back"
      title="Back"
      className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-display transition-all"
      style={{
        background: '#FFFEFA',
        border: '1px solid #E2D8C4',
        color: '#20190F',
        cursor: 'pointer',
      }}
    >
      <ChevronLeft size={14} strokeWidth={2} />
      <span className="hidden sm:inline">Back</span>
    </button>
  );
}
