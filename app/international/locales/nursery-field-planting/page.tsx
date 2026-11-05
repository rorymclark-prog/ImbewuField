import NurseryFieldPlantingDraftReview from '@/components/international/locales/NurseryFieldPlantingDraftReview';
import { loadNurseryReviewData } from '@/lib/international/locales/nursery-field-planting-review-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default function NurseryFieldPlantingReviewPage() {
  return <NurseryFieldPlantingDraftReview data={loadNurseryReviewData()} />;
}
