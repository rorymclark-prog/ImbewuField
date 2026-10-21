import { beforeUiDictionary } from './ui-dictionary-preservation.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { beforeDeclaredUiTranslations, type UiTranslationPacket } from './navigation-translation-preservation.ts';

const packet = JSON.parse(readFileSync(new URL('../docs/translation/four-language-completion/settings-drafts.json', import.meta.url), 'utf8')) as UiTranslationPacket;

/** Keep historical learning-content hashes while permitting the declared Settings batch. */
export function beforeSettingsTranslations(source: string, locale: 'zu' | 'st' | 'ts' | 've'): string {
  return beforeDeclaredUiTranslations(source, locale, packet,
    '\n  // Settings controls: unreviewed drafts, with source pairs in settings-drafts.json.\n',
    '  // End Settings translation drafts.\n');
}

export function englishBeforeSettingsTranslations(source: string): string {
  const added = ["import { REPORT_VIEWER_ENGLISH_PENDING } from '@/lib/i18n-pending';\n", '  ...REPORT_VIEWER_ENGLISH_PENDING,\n', "import { CORE_ENTRY_ENGLISH_PENDING } from '@/lib/i18n-pending';\n", '  ...CORE_ENTRY_ENGLISH_PENDING,\n', "import { SETTINGS_ENGLISH_PENDING } from '@/lib/i18n-pending';\n", '  ...SETTINGS_ENGLISH_PENDING,\n'];
  for (const line of added) {
    assert.equal(source.split(line).length, 2, 'exactly one declared app UI source import and spread');
    source = source.replace(line, '');
  }
  return source;
}

export function beforeSettingsDictionary(actual: unknown, locale: 'zu' | 'st' | 'ts' | 've'): unknown {
  return beforeUiDictionary(actual, locale, packet);
}
