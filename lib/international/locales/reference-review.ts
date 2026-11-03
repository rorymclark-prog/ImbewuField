import kenyaSource from '@/docs/international/reference-card-language-packets/kenya-source.json' with { type: 'json' };
import kenyaDrafts from '@/docs/international/reference-card-language-packets/kenya-drafts.json' with { type: 'json' };
import ukSource from '@/docs/international/reference-card-language-packets/uk-source.json' with { type: 'json' };
import ukDrafts from '@/docs/international/reference-card-language-packets/uk-drafts.json' with { type: 'json' };
import usSource from '@/docs/international/reference-card-language-packets/us-source.json' with { type: 'json' };
import usDrafts from '@/docs/international/reference-card-language-packets/us-drafts.json' with { type: 'json' };
import brazilSource from '@/docs/international/reference-card-language-packets/brazil-source.json' with { type: 'json' };
import brazilDrafts from '@/docs/international/reference-card-language-packets/brazil-drafts.json' with { type: 'json' };
import colombiaSource from '@/docs/international/reference-card-language-packets/colombia-source.json' with { type: 'json' };
import colombiaDrafts from '@/docs/international/reference-card-language-packets/colombia-drafts.json' with { type: 'json' };
import canadaSource from '@/docs/international/reference-card-language-packets/canada-source.json' with { type: 'json' };
import canadaDrafts from '@/docs/international/reference-card-language-packets/canada-drafts.json' with { type: 'json' };
import ontarioSoilSource from '@/docs/international/reference-card-language-packets/ontario-soil-source.json' with { type: 'json' };
import ontarioSoilDrafts from '@/docs/international/reference-card-language-packets/ontario-soil-drafts.json' with { type: 'json' };
import australiaSoilSource from '@/docs/international/reference-card-language-packets/australia-soil-source.json' with { type: 'json' };
import australiaSoilDrafts from '@/docs/international/reference-card-language-packets/australia-soil-drafts.json' with { type: 'json' };
import nzSmapSource from '@/docs/international/reference-card-language-packets/new-zealand-smap-source.json' with { type: 'json' };
import nzSmapDrafts from '@/docs/international/reference-card-language-packets/new-zealand-smap-drafts.json' with { type: 'json' };
import indiaImdSource from '@/docs/international/reference-card-language-packets/india-imd-source.json' with { type: 'json' };
import indiaImdDrafts from '@/docs/international/reference-card-language-packets/india-imd-drafts.json' with { type: 'json' };
import kenyaSoilSource from '@/docs/international/reference-card-language-packets/kenya-soil-source.json' with { type: 'json' };
import kenyaSoilDrafts from '@/docs/international/reference-card-language-packets/kenya-soil-drafts.json' with { type: 'json' };
import manifest from '@/docs/international/reference-card-language-packets/manifest.json' with { type: 'json' };

export const REFERENCE_REVIEW_LANGUAGES = [
  ['en', 'English source'], ['fr', 'French'], ['es', 'Spanish'], ['pt-BR', 'Brazilian Portuguese'], ['sw', 'Swahili'],
] as const;
export type ReferenceReviewLanguage = typeof REFERENCE_REVIEW_LANGUAGES[number][0];

interface SourceRow { readonly key: string; readonly english: string; readonly sha256: string }
interface DraftRow extends SourceRow { readonly translation: string }
interface ReferenceReviewPacket {
  readonly label: string;
  readonly source: { readonly sourceCommit: string; readonly messages: readonly SourceRow[] };
  readonly drafts: { readonly sourceSha256: string; readonly reviewStatus: string; readonly runtimeActivation: boolean;
    readonly locales: Readonly<Record<string, readonly DraftRow[]>> };
  readonly binding: { readonly sourceSha256: string; readonly literals: readonly string[] };
}

export const REFERENCE_REVIEW_PACKETS = {
  kenya: { label: 'Kenya · Kiambu bulletin', source: kenyaSource, drafts: kenyaDrafts, binding: manifest.kenya },
  uk: { label: 'United Kingdom · Yeovilton records', source: ukSource, drafts: ukDrafts, binding: manifest.uk },
  us: { label: 'United States · public station observations', source: usSource, drafts: usDrafts, binding: manifest.us },
  brazil: { label: 'Brazil · Redape soil-profile catalogue', source: brazilSource, drafts: brazilDrafts, binding: manifest.brazil },
  colombia: { label: 'Colombia · SiB and IDEAM references', source: colombiaSource, drafts: colombiaDrafts, binding: manifest.colombia },
  canada: { label: 'Canada · Ontario guide and climate normals', source: canadaSource, drafts: canadaDrafts, binding: manifest.canada },
  'ontario-soil': { label: 'Canada · Ontario soil survey', source: ontarioSoilSource, drafts: ontarioSoilDrafts, binding: manifest['ontario-soil'] },
  'australia-soil': { label: 'Australia · TERN soil depth', source: australiaSoilSource, drafts: australiaSoilDrafts, binding: manifest['australia-soil'] },
  'new-zealand-smap': { label: 'New Zealand · S-map soil reference', source: nzSmapSource, drafts: nzSmapDrafts, binding: manifest['new-zealand-smap'] },
  'india-imd': { label: 'India · IMD district bulletin index', source: indiaImdSource, drafts: indiaImdDrafts, binding: manifest['india-imd'] },
  'kenya-soil': { label: 'Kenya · Historical soil catalogue', source: kenyaSoilSource, drafts: kenyaSoilDrafts, binding: manifest['kenya-soil'] },
} satisfies Record<string, ReferenceReviewPacket>;

/** Only this review surface can display these candidates. A damaged binding
 * falls back to captured English and never counts as translated coverage. */
export function referenceReviewRows(packet: ReferenceReviewPacket, language: ReferenceReviewLanguage) {
  const { source, drafts, binding } = packet;
  const candidates = language !== 'en' && drafts.sourceSha256 === binding.sourceSha256
    && drafts.reviewStatus === 'unreviewed-ai-draft' && drafts.runtimeActivation === false
    && drafts.locales && Object.hasOwn(drafts.locales, language) ? drafts.locales[language] : undefined;
  return source.messages.map((row, index) => {
    if (language === 'en') return { ...row, text: row.english, origin: 'english' as const };
    const draft = Array.isArray(candidates) && candidates.length === source.messages.length ? candidates[index] : undefined;
    if (draft?.key !== row.key || draft.english !== row.english || draft.sha256 !== row.sha256
      || typeof draft.translation !== 'string' || !draft.translation.trim()
      || binding.literals.some(literal => row.english.split(literal).length !== draft.translation.split(literal).length)) {
      return { ...row, text: row.english, origin: 'fallback' as const };
    }
    return { ...row, text: draft.translation, origin: 'draft' as const };
  });
}
