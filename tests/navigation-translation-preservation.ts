import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const packet = JSON.parse(readFileSync(new URL('../docs/translation/four-language-completion/navigation-account-drafts.json', import.meta.url), 'utf8')) as {
  entries: Array<{ key: string; st: string; ts: string; ve: string }>;
  notices: Record<'st' | 'ts' | 've', Record<string, string>>;
};

/**
 * Study snapshots protect calibrated learning content, not a permanent ban on translating Login.
 * Remove only the declared app-control additions; the historical whole-file hashes still verify
 * every pre-existing byte. Extra fields, overrides or edits anywhere else continue to fail.
 */
export function beforeNavigationTranslations(source: string, locale: 'st' | 'ts' | 've'): string {
  const opening = '\n  // Whole-app translation: navigation and account controls. Unreviewed AI drafts.\n';
  const closing = '  // End navigation and account translation drafts.\n';
  const expected = Object.fromEntries(packet.entries.map((entry) => [entry.key, entry[locale]]));
  Object.assign(expected, packet.notices[locale]);
  const block = opening
    + '  // Source pairs and review status: docs/translation/four-language-completion/navigation-account-drafts.json\n'
    + Object.entries(expected).map(([key, value]) => `  ${key}: ${JSON.stringify(value)},\n`).join('')
    + closing;
  assert.equal(source.split(opening).length, 2, `${locale}: one declared app-control translation block`);
  assert.ok(source.includes(block), `${locale}: only the source-paired controls and notices may be added`);
  const before = source.replace(block, '\n');
  for (const key of Object.keys(expected)) {
    assert.doesNotMatch(before, new RegExp(`^  ${key}:`, 'm'), `${locale}: an app-control addition must not override an existing translation`);
  }
  return before;
}
