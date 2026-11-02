// Run with Node 24 and the repository's alias loader; no app/provider execution.
import { readFileSync } from 'node:fs';
import { SOURCE_MESSAGES } from './source.ts';
import { DRAFT_DICTIONARIES } from './dictionaries.ts';
import { coverageReport } from './coverage.ts';
import { readCurrentEnglish } from './source-reader.ts';
import { formattingContext } from './formatting.ts';

const flags = process.argv.slice(2);
if (flags.some((flag) => !['--json', '--require-reviewed'].includes(flag))) {
  process.stderr.write('Usage: coverage-cli.mjs [--json] [--require-reviewed]\n');
  process.exitCode = 2;
} else {
  const current = readCurrentEnglish(readFileSync(new URL('../../i18n.tsx', import.meta.url), 'utf8'), SOURCE_MESSAGES);
  const reports = Object.entries(DRAFT_DICTIONARIES).map(([language, dictionary]) => {
    const report = coverageReport(SOURCE_MESSAGES, current, dictionary, language);
    return { language, total: report.total, counts: report.counts, reviewedPercent: report.reviewedPercent,
      formatting: formattingContext(language), extras: report.extras,
      problems: report.rows.filter((row) => !['draft', 'reviewed'].includes(row.state)).map(({ key, state, issues }) => ({ key, state, issues })) };
  });
  process.stdout.write(flags.includes('--json') ? `${JSON.stringify(reports, null, 2)}\n`
    : reports.map((report) => `${report.language}: ${report.counts.draft} drafts, ${report.counts.reviewed}/${report.total} reviewed; ${report.problems.length} source/format problems; ICU ${report.formatting.status}`).join('\n') + '\n');
  if (reports.some((report) => report.problems.length || report.extras.length
    || (flags.includes('--require-reviewed') && report.counts.reviewed !== report.total))) process.exitCode = 1;
}
