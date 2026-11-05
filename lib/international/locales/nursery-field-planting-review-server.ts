import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildNurseryReviewData } from './nursery-field-planting-review';
import type { NurseryReviewLocale } from './nursery-field-planting-review-locales';

function read(action: () => string): string | undefined {
  try { return action(); }
  catch { return undefined; }
}

/** Only named application sources and published draft packets are inspected.
 * Missing deployment source files are unknown evidence, never a stale snapshot
 * silently presented as the current interface. No account or farm store is read. */
export function loadNurseryReviewData() {
  return buildNurseryReviewData({
    sourceText: read(() => readFileSync(join(process.cwd(), 'lib/international/locales/nursery-field-planting-drafts/source.json'), 'utf8')),
    currentSources: {
      'components/crops/NurseryFieldPlantingObservationForm.tsx': read(() => readFileSync(join(process.cwd(), 'components/crops/NurseryFieldPlantingObservationForm.tsx'), 'utf8')),
      'components/journal/JournalNurseryFieldPlantingSummary.tsx': read(() => readFileSync(join(process.cwd(), 'components/journal/JournalNurseryFieldPlantingSummary.tsx'), 'utf8')),
      'components/crops/SavedGrowerNurseryReviewPanel.tsx': read(() => readFileSync(join(process.cwd(), 'components/crops/SavedGrowerNurseryReviewPanel.tsx'), 'utf8')),
    },
    // Named deployed-file reads remain explicit; the type requires every worksheet choice.
    packets: {
      fr: read(() => readFileSync(join(process.cwd(), 'lib/international/locales/nursery-field-planting-drafts/fr.json'), 'utf8')),
      es: read(() => readFileSync(join(process.cwd(), 'lib/international/locales/nursery-field-planting-drafts/es.json'), 'utf8')),
      'pt-BR': read(() => readFileSync(join(process.cwd(), 'lib/international/locales/nursery-field-planting-drafts/pt-BR.json'), 'utf8')),
      sw: read(() => readFileSync(join(process.cwd(), 'lib/international/locales/nursery-field-planting-drafts/sw.json'), 'utf8')),
      hi: read(() => readFileSync(join(process.cwd(), 'lib/international/locales/nursery-field-planting-drafts/hi.json'), 'utf8')),
      bn: read(() => readFileSync(join(process.cwd(), 'lib/international/locales/nursery-field-planting-drafts/bn.json'), 'utf8')),
      id: read(() => readFileSync(join(process.cwd(), 'lib/international/locales/nursery-field-planting-drafts/id.json'), 'utf8')),
      ar: read(() => readFileSync(join(process.cwd(), 'lib/international/locales/nursery-field-planting-drafts/ar.json'), 'utf8')),
      ur: read(() => readFileSync(join(process.cwd(), 'lib/international/locales/nursery-field-planting-drafts/ur.json'), 'utf8')),
      ne: read(() => readFileSync(join(process.cwd(), 'lib/international/locales/nursery-field-planting-drafts/ne.json'), 'utf8')),
      vi: read(() => readFileSync(join(process.cwd(), 'lib/international/locales/nursery-field-planting-drafts/vi.json'), 'utf8')),
    } satisfies Record<NurseryReviewLocale, string | undefined>,
  });
}
