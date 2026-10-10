import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolveIsiZuluSilentDeckDraft } from '../lib/course-deck-silent-drafts-registry.ts';
import { slideImageFor } from '../lib/course-deck.ts';
import { trackUrl } from '../lib/course-audio.ts';
import { offlinePack } from '../lib/offline-pack.ts';
import { reading14Files, reading14ManifestBefore } from './reading-comparisons-media-history-checks.ts';

const folder = 'docs/study-translation-reviews/reading-comparisons-2026-10-07/';
const candidate = JSON.parse(readFileSync(folder + 'reading-zu14-silent-candidate.json', 'utf8'));
const sha = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');

test('longest comparison uses a distinct silent card and cannot play its older long-time recording', () => {
  const row = resolveIsiZuluSilentDeckDraft('reading-landscape', 14)!;
  assert.ok(row);
  assert.deepEqual(row.sourceEnglish, candidate.sourceBinding.source);
  assert.deepEqual(row.correctedTarget, candidate.correctedTarget);
  assert.match(row.correctedTarget[0], /isikhathi eside kunazo zonke/);
  assert.deepEqual(row.correctedTarget.map(p => p.replace('kuhlala khona isikhathi eside kunazo zonke.', 'kuhlala khona isikhathi eside.')),
    candidate.sourceBinding.recordedTarget, 'every other archived target byte is preserved');
  assert.equal(row.audioBinding, 'none');
  assert.equal(trackUrl('reading-landscape', 'zu', 14), null);
  assert.ok(trackUrl('reading-landscape', 'en', 14), 'English voice remains an optional separate choice');
  assert.ok(trackUrl('reading-landscape', 'zu', 13), 'unaffected own voice remains available');
  assert.equal(slideImageFor('reading-landscape', 'zu', 14)?.url, row.imageUrl);
  assert.equal(sha(readFileSync('public' + candidate.sourceBinding.audioUrl)), candidate.sourceBinding.audioSha256);
  assert.equal(sha(readFileSync('public' + candidate.sourceBinding.imageUrl)), candidate.sourceBinding.imageSha256);
  assert.equal(sha(readFileSync('public' + row.imageUrl)), row.imageSha256);
  const pack = offlinePack('reading-landscape', 'zu', 'standard', 'full');
  assert.ok(pack.entries.some(e => e.url === row.imageUrl));
  assert.ok(!pack.entries.some(e => e.url === candidate.sourceBinding.audioUrl), 'offline cannot pair revised text with stale audio');
});

test('the new still adds exactly one offline entry while full unlisted manifest bytes stay guarded', () => {
  const file = 'lib/course-asset-sizes.ts';
  const proof = reading14Files[file];
  const url = '/course-decks/reading-landscape/zu-silent/slide-14.webp';
  const row = resolveIsiZuluSilentDeckDraft('reading-landscape', 14)!;
  const entries = (text: string) => [...text.matchAll(/^  '([^']+)': (\d+),$/gm)].map(m => [m[1], Number(m[2])]);
  const after = entries(proof.after);
  assert.deepEqual(after.filter(e => e[0] !== url), entries(proof.before));
  assert.deepEqual(after.filter(e => e[0] === url), [[url, row.imageBytes]]);
  assert.equal(reading14ManifestBefore(readFileSync(file, 'utf8')), proof.before);
  assert.throws(() => reading14ManifestBefore(proof.after.replace(String(row.imageBytes), '1')));
  assert.throws(() => reading14ManifestBefore(proof.after + '\n// unlisted corruption'));
});
