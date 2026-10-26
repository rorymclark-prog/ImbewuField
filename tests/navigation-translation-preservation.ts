import { beforeUiDictionary, beforeControlIconTranslations, beforeConsentTranslations, beforeOfflineDeviceTranslations, beforeUpdateNoticeTranslations, beforeAccountTranslations, beforeCommunityProfileTranslations,beforeCommunityMemberTranslations,beforeCommunityThreadTranslations ,beforePhotoViewerTranslations} from './ui-dictionary-preservation.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

export type UiLocale = 'zu' | 'st' | 'ts' | 've';
type UiEntry = { key: string; beforeLines?: Partial<Record<UiLocale, string>> } & Partial<Record<UiLocale, string>>;
export interface UiTranslationPacket {
  entries: UiEntry[];
  supplementalEntries?: UiEntry[];
  notices?: Partial<Record<UiLocale, Record<string, string>>>;
}

const readPacket = (name: string): UiTranslationPacket => JSON.parse(readFileSync(
  new URL(`../docs/translation/four-language-completion/${name}.json`, import.meta.url), 'utf8',
));

/**
 * Study snapshots protect calibrated learning content, not a permanent ban on translating UI.
 * Verify and reverse only source-paired additions or explicitly recorded English replacements;
 * the historical hashes still check every pre-existing byte, including every learning field.
 */
export function beforeDeclaredUiTranslations(source: string, locale: UiLocale, packet: UiTranslationPacket, opening: string, closing: string): string {
  source = beforeControlIconTranslations(beforeConsentTranslations(beforeOfflineDeviceTranslations(beforeUpdateNoticeTranslations(beforeAccountTranslations(beforeCommunityProfileTranslations(beforeCommunityMemberTranslations(beforeCommunityThreadTranslations(beforePhotoViewerTranslations(source,locale),locale),locale),locale),locale),locale),locale),locale),locale);
  const entries = [...packet.entries, ...(packet.supplementalEntries ?? [])].filter((entry) => entry[locale] !== undefined);
  const added = Object.fromEntries(entries.filter((entry) => !entry.beforeLines?.[locale]).map((entry) => [entry.key, entry[locale]]));
  Object.assign(added, packet.notices?.[locale] ?? {});
  if (Object.keys(added).length) {
    const block = opening + Object.entries(added).map(([key, value]) => `  ${key}: ${JSON.stringify(value)},\n`).join('') + closing;
    assert.equal(source.split(opening).length, 2, `${locale}: one declared UI translation block`);
    assert.ok(source.includes(block), `${locale}: additions must match the source-pair packet`);
    source = source.replace(block, '\n');
    for (const key of Object.keys(added)) {
      assert.doesNotMatch(source, new RegExp(`^  ${key}:`, 'm'), `${locale}: an addition must not override an existing translation`);
    }
  }
  for (const entry of entries) {
    const before = entry.beforeLines?.[locale];
    if (!before) continue;
    const after = `  ${entry.key}: ${JSON.stringify(entry[locale])},\n`;
    assert.equal(source.split(after).length, 2, `${locale}/${entry.key}: only the recorded English replacement may change`);
    source = source.replace(after, before);
  }
  return source;
}

export function beforeNavigationTranslations(source: string, locale: 'st' | 'ts' | 've'): string {
  return beforeDeclaredUiTranslations(source, locale, readPacket('navigation-account-drafts'),
    '\n  // Whole-app translation: navigation and account controls. Unreviewed AI drafts.\n'
      + '  // Source pairs and review status: docs/translation/four-language-completion/navigation-account-drafts.json\n',
    '  // End navigation and account translation drafts.\n');
}

export function beforeCoreEntryTranslations(source: string, locale: UiLocale): string {
  return beforeDeclaredUiTranslations(source, locale, readPacket('core-entry-drafts'),
    '\n  // Core entry screens: unreviewed drafts; source pairs in core-entry-drafts.json.\n',
    '  // End core entry translation drafts.\n');
}

export function beforeReportViewerTranslations(source: string, locale: UiLocale): string {
  return beforeDeclaredUiTranslations(source, locale, readPacket('report-viewer-drafts'),
    '\n  // Report viewer controls: unreviewed drafts; source pairs in report-viewer-drafts.json.\n',
    '  // End report viewer translation drafts.\n');
}

export function beforeNavigationDictionary(actual: unknown, locale: 'st' | 'ts' | 've'): unknown {
  return beforeUiDictionary(actual, locale, readPacket('navigation-account-drafts'));
}

export function beforeCoreEntryDictionary(actual: unknown, locale: UiLocale): unknown {
  return beforeUiDictionary(actual, locale, readPacket('core-entry-drafts'));
}

export function beforeReportViewerDictionary(actual: unknown, locale: UiLocale): unknown {
  return beforeUiDictionary(actual, locale, readPacket('report-viewer-drafts'));
}
