import type { Metadata } from 'next';
import LimaBar from '@/components/LimaBar';

export const metadata: Metadata = { title: 'Language draft review — ImbewuField' };

export default function InternationalLocaleReviewLayout({ children }: { children: React.ReactNode }) {
  // The root clips a viewport-height body, so this review area must own scrolling.
  // Keep help in that same flow after every draft, including short filtered views.
  return <div
    data-language-draft-review
    role="region"
    aria-label="Language draft review"
    lang="en"
    tabIndex={0}
    className="h-dvh overflow-y-auto overscroll-y-contain pb-[env(safe-area-inset-bottom)] print:h-auto print:overflow-visible"
  >
    {/* Release the clipping ancestor only when printing a mounted review workspace. */}
    <style>{`@media print {
      body:has([data-language-draft-review]) { height: auto !important; overflow: visible !important; }
    }`}</style>
    {children}
    {/* An in-flow help strip cannot cover a translation or its review/export controls. */}
    <div className="print:hidden">
      <LimaBar inPlace />
    </div>
  </div>;
}
