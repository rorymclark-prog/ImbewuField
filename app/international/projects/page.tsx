import type { Metadata } from 'next';
import ProjectWorkflowReview from '@/components/international/projects/ProjectWorkflowReview';

export const metadata: Metadata = { title: 'Project workflow review · ImbewuField', description: 'Review grower-led project workflows and fictional evidence examples.' };

export default function InternationalProjectsPage() {
  return <ProjectWorkflowReview />;
}
