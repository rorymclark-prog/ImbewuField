import LearningRegionDraftReview from '@/components/international/locales/LearningRegionDraftReview';
import { loadLearningRegionReviewData } from '@/lib/international/locales/learning-region-review-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default function LearningRegionReviewPage() {
  return <LearningRegionDraftReview data={loadLearningRegionReviewData()} />;
}
