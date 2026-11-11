import { csvCell } from '../../journal-export';
import type { LearningReviewLocale, LearningReviewRow } from './learning-region-review';

const header = ['Draft language', 'Message key', 'Row kind', 'Source file', 'Frozen English', 'Current English (blank if unverified)',
  'Inactive draft or fixed literal', 'Source/draft check', 'Fragment', 'Context required', 'Context note', 'English SHA256',
  'Captured AST binding (JSON)', 'Human approval', 'Reviewer name (blank worksheet field)', 'Reviewer notes (blank worksheet field)'];

/** Every cell uses the existing export-only formula protection. A downloaded
 * name/note worksheet is not an authenticated identity or a saved approval. */
export function learningRegionReviewCsv(locale: LearningReviewLocale, rows: readonly LearningReviewRow[]): string {
  const lines = [header.map(csvCell).join(','), ...rows.map(row => [locale, row.key,
    row.kind === 'fixed-literal' ? 'Fixed source literal; not an AI-authored translation' : 'Unreviewed AI draft',
    row.bindings[0].file, row.english, row.currentEnglish ?? '', row.translation ?? '', row.state === 'reviewed' ? 'needs-review' : row.state,
    String(row.fragment), String(row.contextRequired), row.contextNote, row.sha256, JSON.stringify(row.bindings), 'Not recorded', '', ''].map(csvCell).join(','))];
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
