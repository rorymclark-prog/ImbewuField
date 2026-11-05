import { csvCell } from '../../journal-export';
import type { NurseryReviewLocale, NurseryReviewRow } from './nursery-field-planting-review';

const CSV_HEADER = [
  'Language',
  'Message key',
  'Source file',
  'Frozen English',
  'Current English (blank if not verified)',
  'AI draft',
  'Source/draft check',
  'Human review',
  'Reviewer notes (blank worksheet field)',
] as const;

export function nurseryFieldPlantingReviewCsv(
  locale: NurseryReviewLocale,
  rows: readonly NurseryReviewRow[],
): string {
  const headerLine = CSV_HEADER.map(csvCell).join(',');
  const rowLines = rows.map((row) => {
    const checkState = row.state === 'reviewed' ? 'needs-review' : row.state;
    const values = [
      locale,
      row.key,
      row.sourceFile,
      row.frozenEnglish,
      row.currentEnglish ?? '',
      row.translation ?? '',
      checkState,
      'unreviewed',
      '',
    ];
    return values.map(csvCell).join(',');
  });

  const lines = [headerLine, ...rowLines];
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
