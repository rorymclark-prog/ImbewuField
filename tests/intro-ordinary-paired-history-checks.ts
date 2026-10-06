import { validateAndRewindIntroFullPaired } from './intro-full-ordinary-paired-checks.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { englishSlideRecords, validatePairedDraft } from '../scripts/paired-draft-slides.mjs';

const folder = new URL('../docs/study-translation-reviews/intro-ordinary-paired-2026-10-06/', import.meta.url);
export const introOrdinaryRead = (name: string) => readFileSync(new URL(name, folder), 'utf8');
export const introOrdinaryDigest = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
export const introOrdinaryPacket = JSON.parse(introOrdinaryRead('root-accepted-final-packet.json'));
export const introOrdinaryChanged = new Set<string>(introOrdinaryPacket.actualRecommendationDelta.changedRowIds);
const before = Object.fromEntries(['ve', 'ts', 'st'].map(language => [language, JSON.parse(introOrdinaryRead(`${language}-paired-before.json`))]));
export const readCurrentIntroDecks = () => Object.fromEntries(['ve', 'ts', 'st'].map(language => [language,
  JSON.parse(readFileSync(new URL(`../docs/narration/intro-permaculture.${language}.paired-draft.json`, import.meta.url), 'utf8'))]));
export type Segment = { sourceEnglish: string; status: string; text?: string; reason?: string };
type Part = { status: string; text?: string; segments?: Segment[]; provenance?: string };
const resolve = (part: Part, source: string) => part.status === 'draft' ? part.text : part.status === 'english-hold' ? source :
  part.segments!.map(segment => segment.status === 'draft' ? segment.text : segment.sourceEnglish).join('');

// 2026-10-06: root accepted 54 complete targets, not every earlier candidate.
// Check the live approved layer first; restoring old fields must not conceal drift.
export function validateAndRewindIntroOrdinary(decks = readCurrentIntroDecks()) {
  // 6 October 2026: validate all72 newer accepted objects and every unlisted
  // source/status first, then preserve the original54-field historical assertions.
  decks = validateAndRewindIntroFullPaired(decks);
  assert.equal(introOrdinaryDigest(introOrdinaryRead('root-accepted-final-packet.json')), '3297c1b24dba1a37de6976a0b66933a9796efffdb2be5bd8be7e9b027b8ee8e9');
  assert.equal(introOrdinaryDigest(introOrdinaryRead('ve-paired-before.json')), '01461eca47f40a5db61a5f8d2c2d507621a1ca949b277b9a06ae2f22bcd1d6e4');
  assert.equal(introOrdinaryDigest(introOrdinaryRead('ts-paired-before.json')), '427cd88461ecf81071dda4e85d71c414718026a634d271a9df04e67629eaf226');
  assert.equal(introOrdinaryChanged.size, 54);
  const source = englishSlideRecords(readFileSync(new URL('../docs/narration/intro-permaculture.en.md', import.meta.url), 'utf8'));
  for (const language of ['ve', 'ts', 'st']) validatePairedDraft(decks[language], source, language);
  // Root inspected these complete actual JSON snapshots before rendering. Binding
  // the approved metadata too prevents historical rewind masking status changes.
  for (const [language, hash] of [['ve', 'b933e501e5e77a6e15ab63ae270d16c56552d1cf1e08d927a02cb43a70dfb9d5'], ['ts', '10d0f9ede93fc7c323d60dab330b670d4c21b30720e073426598d27f8e444603']]) {
    assert.equal(introOrdinaryDigest(introOrdinaryRead(`${language}-paired-after.json`)), hash);
    assert.deepEqual(decks[language], JSON.parse(introOrdinaryRead(`${language}-paired-after.json`)), 'actual entire current deck equals its root-approved layer');
  }
  assert.equal(introOrdinaryDigest(introOrdinaryRead('st-paired-before.json')), '50ac554323e41921cdfc83dd4b6d6abf18f240d8c416b38dc95e01630d4b3df9');
  const restored = structuredClone(decks);
  for (const row of introOrdinaryPacket.verdicts) {
    const slide = decks[row.language].slides[row.slide - 1];
    const oldSlide = before[row.language].slides[row.slide - 1];
    const index = row.field === 'Heading' ? null : Number(row.field.slice(1));
    const sourceText = index === null ? slide.english.heading : slide.english.body[index];
    const part: Part = index === null ? slide.target.heading : slide.target.body[index];
    const old: Part = index === null ? oldSlide.target.heading : oldSlide.target.body[index];
    assert.equal(sourceText, row.sourceEnglish);
    assert.equal(resolve(old, sourceText), row.currentTarget);
    if (!introOrdinaryChanged.has(row.id)) {
      assert.deepEqual(part, old, `${row.id}: rejected/same-target recommendation keeps exact status and metadata`);
      continue;
    }
    assert.equal(resolve(part, sourceText), row.recommendedTarget, `${row.id}: accepted full target is literal`);
    assert.ok(['draft', 'mixed'].includes(part.status));
    assert.ok(part.provenance?.includes('NOT fluent reviewed'));
    if (part.status === 'mixed') {
      assert.equal(part.segments!.map(segment => segment.sourceEnglish).join(''), sourceText);
      for (const segment of part.segments!) {
        assert.ok(segment.reason, 'semantic source/hold reason is inspectable');
        if (segment.status === 'draft') assert.notEqual(segment.text, segment.sourceEnglish, 'literal English copy must be an explicit hold');
        else { assert.equal(segment.status, 'english-hold'); assert.equal(segment.text, undefined); }
      }
    } else assert.notEqual(part.text, sourceText, 'unchanged English cannot masquerade as a draft');
    const rewindSlide = restored[row.language].slides[row.slide - 1];
    if (index === null) rewindSlide.target.heading = structuredClone(old);
    else rewindSlide.target.body[index] = structuredClone(old);
  }
  assert.deepEqual(restored, before, 'all unlisted target/status/provenance, 330 source fields, order and ST deck remain exact');
  return restored;
}

export function introDeckBeforeOrdinary(language: string) {
  assert.ok(['ve', 'ts', 'st'].includes(language));
  return validateAndRewindIntroOrdinary()[language];
}
