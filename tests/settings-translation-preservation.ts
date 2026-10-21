import { beforeUiDictionary } from './ui-dictionary-preservation.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const packet = JSON.parse(readFileSync(new URL('../docs/translation/four-language-completion/settings-drafts.json', import.meta.url), 'utf8')) as {
  entries: Array<{ key: string } & Record<string, string>>;
  supplementalEntries: Array<{ key: string } & Record<string, string>>;
};

/** Keep the historical learning-content hashes while permitting this declared Settings batch. */
export function beforeSettingsTranslations(source: string, locale: 'zu' | 'st' | 'ts' | 've'): string {
  const opening = '\n  // Settings controls: unreviewed drafts, with source pairs in settings-drafts.json.\n';
  const expected = [...packet.entries, ...packet.supplementalEntries].filter((entry) => entry[locale] !== undefined);
  const block = opening
    + expected.map((entry) => `  ${entry.key}: ${JSON.stringify(entry[locale])},\n`).join('')
    + '  // End Settings translation drafts.\n';
  assert.equal(source.split(opening).length, 2, `${locale}: one declared Settings block`);
  assert.ok(source.includes(block), `${locale}: Settings additions must match the source-pair packet`);
  const before = source.replace(block, '\n');
  for (const entry of expected) {
    assert.doesNotMatch(before, new RegExp(`^  ${entry.key}:`, 'm'), `${locale}: Settings must not override an existing entry`);
  }
  return before;
}

export function englishBeforeSettingsTranslations(source: string): string {
  const added = ["import { SETTINGS_ENGLISH_PENDING } from '@/lib/i18n-pending';\n", '  ...SETTINGS_ENGLISH_PENDING,\n'];
  for (const line of added) {
    assert.equal(source.split(line).length, 2, 'exactly one Settings source import and spread');
    source = source.replace(line, '');
  }
  return source;
}

export function beforeSettingsDictionary(actual: unknown, locale: 'zu' | 'st' | 'ts' | 've'): unknown {
  return beforeUiDictionary(actual, locale, packet);
}
