import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildLearningRegionReviewData } from './learning-region-review';
import { LEARNING_REGION_REVIEW_SOURCE, LEARNING_REGION_REVIEW_LOCALES } from './learning-region-review-source';

const packetRoot = 'lib/international/locales/learning-region-drafts';
function read(path: string): string | undefined {
  try { return readFileSync(join(process.cwd(), path), 'utf8'); } catch { return undefined; }
}

/** Fixed public source/draft paths only. An unavailable deployment source is
 * unknown evidence, never replaced by the frozen snapshot. No account is read. */
export function loadLearningRegionReviewData(readText: (path: string) => string | undefined = read) {
  const safe = (path: string) => { try { return readText(path); } catch { return undefined; } };
  return buildLearningRegionReviewData({ sourceText: safe(`${packetRoot}/source.json`),
    currentSourceText: safe(LEARNING_REGION_REVIEW_SOURCE.sourceFile),
    packets: Object.fromEntries(LEARNING_REGION_REVIEW_LOCALES.map(locale => [locale, safe(`${packetRoot}/${locale}.json`)])) });
}
