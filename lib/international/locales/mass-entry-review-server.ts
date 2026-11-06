import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildMassEntryReviewData, MASS_ENTRY_REVIEW_LOCALES, type MassEntryReviewLocale } from './mass-entry-review';
import { MASS_ENTRY_REVIEW_SOURCE as binding } from './mass-entry-review-source';

function read(path: string): string | undefined {
  try { return readFileSync(join(process.cwd(), path), 'utf8'); } catch { return undefined; }
}

/** Only fixed application-source and draft-packet paths are read. A deployment
 * without source files reports unknown English; frozen text cannot substitute
 * for the current interface. No account, farmer store or provider is consulted. */
export function loadMassEntryReviewData() {
  const packetRoot = 'lib/international/locales/mass-entry-drafts';
  return buildMassEntryReviewData({ sourceText: read(`${packetRoot}/source.json`),
    currentSources: Object.fromEntries(binding.files.map(file => [file.path, read(file.path)])),
    packets: Object.fromEntries(MASS_ENTRY_REVIEW_LOCALES.map(locale => [locale, read(`${packetRoot}/${locale}.json`)])) as Readonly<Partial<Record<MassEntryReviewLocale, string>>>,
  });
}
