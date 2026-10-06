import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { englishSlideRecords, validatePairedDraft } from '../scripts/paired-draft-slides.mjs';
import { deckBeforeNativePairedResidual } from './native-paired-residual-history-checks.ts';

type Segment = { sourceEnglish: string; status: 'draft' | 'english-hold'; text?: string; reason: string; semanticContext?: string };
type Part = { status: string; text?: string; segments?: Segment[]; provenance?: string };
export type MarketDeck = { language: string; sourceLanguage: string; reviewStatus: string; slides: {
  n: number; english: { n: number; heading: string; body: string[] }; target: { heading: Part; body: Part[] };
}[] };
const folder = new URL('../docs/study-translation-reviews/market-ordinary-deck-2026-10-06/', import.meta.url);
const read = (name: string) => readFileSync(new URL(name, folder), 'utf8');
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const languages = ['st', 've', 'ts'];
const beforeHashes: Record<string, string> = { st: '8a869555cfbd372d6dc3c58f94a082b3a10c5cd54bd3f733463472c73d58ea66', ve: '643390831cbefb8654126bf79a0d9e5775a28d5b57e64afb48b1419d4898da80', ts: '68bcf3aed5a37f32229f59286add03b19dcbb478ce148a91d82d904de7fe7454' };
const afterHashes: Record<string, string> = { st: '4c6a44b2d475adfedd176f230dcdd5eee284036d77571377aeba3f733e211c02', ve: '84893eaa81d087870a7bee96e81fe07b64f28fd576c977d970b0d0905839c42f', ts: '035b0f61dde3c456a89c5037d0b926a7c2e1e39958580c545ab39c3ee36f2d9a' };
export const readCurrentMarketDecks = (): Record<string, MarketDeck> => Object.fromEntries(languages.map(language => [language,
  JSON.parse(readFileSync(new URL(`../docs/narration/market-community.${language}.paired-draft.json`, import.meta.url), 'utf8'))]));
export const marketPartText = (part: Part, source: string) => part.status === 'english-hold' ? source : part.status === 'draft' ? part.text! :
  part.segments!.map(segment => segment.status === 'english-hold' ? segment.sourceEnglish : segment.text).join('');

export function marketDeckBeforeNativeResidual(decks = readCurrentMarketDecks()): Record<string, MarketDeck> {
  return Object.fromEntries(languages.map(language => [language,
    deckBeforeNativePairedResidual(decks[language], 'market-community')]));
}

// 2026-10-06: these fifteen compositions preserve independent deck prefixes.
// Validate the entire accepted current layer before exposing an older view; a
// historical rewind must not hide source, unlisted wording or status changes.
export function marketDeckBeforeOrdinary(decks = readCurrentMarketDecks()) {
  // The newer thirteen-cell layer reuses seven Market stills. Validate its
  // complete current six-file source/target state before this dated deck claim.
  decks = marketDeckBeforeNativeResidual(decks);
  assert.equal(digest(read('root-accepted-native-packet.json')), '149618dd0be79b1f91b630c81541ba16b884502b534fed6b59fea6dd912ebf5d');
  const independentBytes = read('independent-check.json');
  assert.equal(digest(independentBytes), 'cb1b0a64bfc6b72ad688aa2e9b5ab6e1148cf6882fcd9823249fe945e3ed4eed');
  const independent = JSON.parse(independentBytes);
  assert.equal(digest(read('ts17-native-warning-supplement.json')), 'd3a4e5d320149883a3d1f5fbc6acf45891a6b1a8c46ed4b9e25749e9892382a9');
  const supplement = JSON.parse(read('ts17-native-warning-supplement.json'));
  assert.equal(independent.changedFields.length, 15);
  const before: Record<string, MarketDeck> = {};
  const source = englishSlideRecords(readFileSync(new URL('../docs/narration/market-community.en.md', import.meta.url), 'utf8'));
  for (const language of languages) {
    assert.equal(digest(read(`${language}-paired-before.json`)), beforeHashes[language]);
    assert.equal(digest(read(`${language}-paired-after.json`)), afterHashes[language]);
    before[language] = JSON.parse(read(`${language}-paired-before.json`));
    validatePairedDraft(decks[language], source, language);
    assert.deepEqual(decks[language], JSON.parse(read(`${language}-paired-after.json`)), 'entire actual current deck equals accepted layer, including unlisted sources/status/order');
  }
  const rewound = structuredClone(decks);
  for (const row of independent.changedFields) {
    const index = Number(row.jsonPath.split('.').at(-1));
    const slide = decks[row.language].slides[row.slideNumber - 1];
    const old = before[row.language].slides[row.slideNumber - 1];
    assert.equal(slide.english.body[index], row.sourceEnglish);
    assert.equal(marketPartText(old.target.body[index], row.sourceEnglish), row.currentDeckTarget);
    const part = slide.target.body[index];
    const expected = row.id === 'ts:slide17:body.2'
      ? row.independentRecommendedTarget.slice(0, row.independentRecommendedTarget.indexOf('Do not assume')) + supplement.checkedCurrentNativeSentence
      : row.independentRecommendedTarget;
    assert.equal(marketPartText(part, row.sourceEnglish), expected, 'independent accepted literal, including both exact source-English repairs');
    assert.ok(part.provenance?.includes('NOT fluent reviewed'));
    if (part.status === 'mixed') {
      assert.equal(part.segments!.map(segment => segment.sourceEnglish).join(''), row.sourceEnglish);
      for (const segment of part.segments!) {
        assert.ok(segment.reason);
        if (segment.status === 'draft') assert.notEqual(segment.text, segment.sourceEnglish, 'a full copied English span cannot pretend to be translated');
        else { assert.equal(segment.status, 'english-hold'); assert.equal(segment.text, undefined); }
      }
    } else { assert.equal(part.status, 'draft'); assert.notEqual(part.text, row.sourceEnglish); }
    rewound[row.language].slides[row.slideNumber - 1].target.body[index] = structuredClone(old.target.body[index]);
  }
  assert.deepEqual(rewound, before, 'all 249 source fields and every unlisted pair/status/provenance/order are exact after only the fifteen approved rewinds');
  return rewound;
}
