import { doc, getDoc } from 'firebase/firestore';
import { getFirebase } from './firebase/init';
import { fetchRenderOutput, normaliseRenderJobDoc } from './render-jobs';
import { comparisonSource, originalRecipe, originalJobSheet, type IllustrationIdentity } from './saved-plan-comparison';

/** Read a surviving original from before the device gallery began keeping its own copy. */
async function readOriginalJob(id: IllustrationIdentity, siteId: string) {
  const fb = getFirebase();
  if (!fb || !id.jobId || id.jobId.includes('/')) return null;
  const snap = await getDoc(doc(fb.db, 'render_jobs', id.jobId));
  const job = snap.exists() ? normaliseRenderJobDoc(id.jobId, snap.data()) : null;
  if (!job || !job.sceneJson) return null;
  const sheet = originalJobSheet(job, id, siteId);
  if (!sheet) return null;
  return {job, sheet};
}

export async function readOriginalRecipe(id: IllustrationIdentity, siteId: string) {
  const original = await readOriginalJob(id, siteId);
  if (!original) return null;
  const { job, sheet } = original;
  const input = await fetchRenderOutput(sheet.inputPath);
  const mask = sheet.protectMaskPath ? await fetchRenderOutput(sheet.protectMaskPath) : undefined;
  return originalRecipe(job, sheet, input, mask);
}

export async function readOriginalPlan(id: IllustrationIdentity, siteId: string) {
  const original = await readOriginalJob(id, siteId);
  if (!original) return null;
  const { job, sheet } = original;
  const image = job.sourcePath ? await fetchRenderOutput(job.sourcePath) : undefined;
  return comparisonSource(job, sheet, image) ?? null;
}
