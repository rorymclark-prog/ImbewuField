import { doc, getDoc } from 'firebase/firestore';
import { getFirebase } from './firebase/init';
import { fetchRenderOutput, normaliseRenderJobDoc } from './render-jobs';
import { comparisonSource, originalJobSheet, type IllustrationIdentity } from './saved-plan-comparison';

/** Read a surviving original from before the device gallery began keeping its own copy. */
export async function readOriginalPlan(id: IllustrationIdentity, siteId: string) {
  const fb = getFirebase();
  if (!fb || !id.jobId || id.jobId.includes('/')) return null;
  const snap = await getDoc(doc(fb.db, 'render_jobs', id.jobId));
  const job = snap.exists() ? normaliseRenderJobDoc(id.jobId, snap.data()) : null;
  if (!job || !job.sceneJson) return null;
  const sheet = originalJobSheet(job, id, siteId);
  if (!sheet) return null;
  const image = job.sourcePath ? await fetchRenderOutput(job.sourcePath) : undefined;
  return comparisonSource(job, sheet, image) ?? null;
}
