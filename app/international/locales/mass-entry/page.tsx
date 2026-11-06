import Link from 'next/link';
import MassEntryDraftReview from '@/components/international/locales/MassEntryDraftReview';
import { loadMassEntryReviewData } from '@/lib/international/locales/mass-entry-review-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default function MassEntryReviewPage() {
  return <>
    <nav aria-label="Language review navigation" className="px-4 pt-4">
      <Link href="/international/locales" className="inline-flex min-h-11 items-center text-sm underline">Back to language draft review</Link>
    </nav>
    <MassEntryDraftReview data={loadMassEntryReviewData()} />
  </>;
}
