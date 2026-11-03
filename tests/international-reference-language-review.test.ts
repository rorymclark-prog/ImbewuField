import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { REFERENCE_REVIEW_PACKETS, referenceReviewRows } from '../lib/international/locales/reference-review.ts';

const receiptPath = new URL('../docs/international/reference-card-language-packets/', import.meta.url);
const hash = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');

test('the review workspace preserves captured English before a reviewer chooses a draft', () => {
  for (const packet of Object.values(REFERENCE_REVIEW_PACKETS)) {
    const rows = referenceReviewRows(packet, 'en');
    assert.deepEqual(rows.map(row => row.text), packet.source.messages.map(row => row.english));
    assert.ok(rows.every(row => row.origin === 'english'));
  }
});

test('all four choices use the checked wording for the selected pilot and remain drafts', () => {
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', receiptPath), 'utf8'));
  const counts: Record<string, number> = {};
  for (const [pilot, packet] of Object.entries(REFERENCE_REVIEW_PACKETS)) {
    const binding = manifest[pilot];
    assert.equal(hash(readFileSync(new URL(`${pilot}-source.json`, receiptPath))), binding.sourceSha256);
    assert.equal(hash(readFileSync(new URL(`${pilot}-drafts.json`, receiptPath))), binding.draftsSha256);
    assert.equal(binding.reviewedByHuman, false);
    assert.equal(binding.runtimeActivation, false);
    for (const language of ['fr', 'es', 'pt-BR', 'sw'] as const) {
      const rows = referenceReviewRows(packet, language);
      assert.ok(rows.every(row => row.origin === 'draft' && hash(row.english) === row.sha256));
      assert.deepEqual(rows.map(row => row.text), packet.drafts.locales[language].map(row => row.translation));
      counts[pilot] = (counts[pilot] ?? 0) + rows.length;
    }
  }
  assert.deepEqual(counts, { kenya: 64, uk: 52, us: 76, brazil: 16, colombia: 16, canada: 16 });
});

test('Colombian wording keeps the linked publication date and falls back if its year is lost', () => {
  const packet = structuredClone(REFERENCE_REVIEW_PACKETS.colombia);
  const dates = { fr: '26 octobre 2026', es: '26 de octubre de 2026', 'pt-BR': '26 de outubro de 2026', sw: '26 Oktoba 2026' };
  for (const language of ['fr', 'es', 'pt-BR', 'sw'] as const) {
    const row = referenceReviewRows(packet, language).find(entry => entry.key === 'colombiaIdeamClaim');
    assert.equal(row?.origin, 'draft');
    assert.ok(row.text.includes(dates[language]));
  }
  const draft = packet.drafts.locales.sw.find(row => row.key === 'colombiaIdeamClaim')!;
  draft.translation = draft.translation.replace('2026', '2025');
  const rows = referenceReviewRows(packet, 'sw');
  assert.deepEqual(rows.filter(row => row.origin === 'fallback').map(row => row.key), ['colombiaIdeamClaim']);
  assert.equal(rows.at(-1)?.text, draft.english);
});

test('the Brazilian licence wording falls back when the recorded label is missing', () => {
  const packet = structuredClone(REFERENCE_REVIEW_PACKETS.brazil);
  const licence = packet.drafts.locales['pt-BR'].at(-1)!;
  licence.translation = licence.translation.replace('CC BY-NC 4.0', '');
  const rows = referenceReviewRows(packet, 'pt-BR');
  assert.deepEqual(rows.filter(row => row.origin === 'fallback').map(row => row.key), ['redape04']);
  assert.equal(rows.at(-1)?.text, licence.english);
});

test('a stale source binding, absent language or unexpected activation keeps every row in English', () => {
  const packet = REFERENCE_REVIEW_PACKETS.uk;
  const variants = [
    { ...packet.drafts, sourceSha256: 'stale' },
    { ...packet.drafts, locales: {} },
    { ...packet.drafts, runtimeActivation: true },
    { ...packet.drafts, reviewStatus: 'human-reviewed' },
  ];
  for (const drafts of variants) {
    const rows = referenceReviewRows({ ...packet, drafts }, 'pt-BR');
    assert.ok(rows.every(row => row.origin === 'fallback' && row.text === row.english));
  }
});

test('a mismatched English line or missing reference literal only falls back for the affected row', () => {
  const packet = structuredClone(REFERENCE_REVIEW_PACKETS.us);
  packet.drafts.locales.fr[0].english = 'Changed source';
  const last = packet.drafts.locales.fr.at(-1)!;
  last.translation = last.translation.replace('NWS', '');
  const rows = referenceReviewRows(packet, 'fr');
  assert.deepEqual(rows.filter(row => row.origin === 'fallback').map(row => row.key), [rows[0].key, rows.at(-1)!.key]);
  assert.ok(rows.filter(row => row.origin === 'fallback').every(row => row.text === row.english));
  assert.equal(referenceReviewRows(packet, 'sw').filter(row => row.origin === 'draft').length, rows.length);
});

test('the Canada climate draft falls back to English when its historical period is lost', () => {
  const packet = structuredClone(REFERENCE_REVIEW_PACKETS.canada);
  const climate = packet.drafts.locales.sw.find(row => row.key === 'canadaNormalsClaim')!;
  climate.translation = climate.translation.replace('1991–2020', '');
  const rows = referenceReviewRows(packet, 'sw');
  assert.deepEqual(rows.filter(row => row.origin === 'fallback').map(row => row.key), [climate.key]);
  assert.equal(rows.find(row => row.key === climate.key)?.text, climate.english);
});
