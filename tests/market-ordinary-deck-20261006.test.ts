import test from 'node:test';
import assert from 'node:assert/strict';
import { marketDeckBeforeOrdinary, readCurrentMarketDecks, marketPartText } from './market-ordinary-deck-checks.ts';

test('Market ordinary slides preserve the full source/unlisted layer before historical reconstruction', () => {
  const current = readCurrentMarketDecks();
  const before = marketDeckBeforeOrdinary(current);
  assert.equal(before.ve.slides[14].target.body[3].status, 'english-hold');
  assert.equal(current.ve.slides[14].target.body[3].status, 'mixed');
  for (const language of ['st', 've', 'ts']) {
    assert.deepEqual(current[language].slides[4], before[language].slides[4], 'PR844 measured units and destinations remain untouched');
  }
});

test('Market cost, seed permission, only-when and nearest/measuring predicates retain exact source anchors', () => {
  const decks = readCurrentMarketDecks();
  marketDeckBeforeOrdinary(decks);
  const ve = decks.ve.slides;
  const terms = ve[14].target.body[3];
  assert.deepEqual(terms.segments!.filter(s => s.status === 'english-hold').map(s => s.sourceEnglish), ['variety', 'permission']);
  assert.match(marketPartText(terms, ve[14].english.body[3]), /^Ni sa athu.*arali variety yo tsireledzwa na arali permission i tshi ṱoḓea/);
  assert.ok(ve[10].target.body[2].segments!.some(s => s.status === 'english-hold' && s.sourceEnglish === 'what happens when crops are short. Regular orders'));
  assert.match(marketPartText(ve[10].target.body[2], ve[10].english.body[2]), /fhedzi musi vharengi na vhalimi vha tshi kona/);
  assert.equal(ve[16].target.body[1].segments!.at(-1)!.sourceEnglish, 'selling costs still need measuring.');
  const warning = decks.ts.slides[16].target.body[2].segments!;
  assert.ok(warning.some(s => s.status === 'english-hold' && s.sourceEnglish === 'nearest buyer'));
  assert.ok(warning.some(s => s.status === 'english-hold' && s.sourceEnglish === 'best return'));
  const context = warning.filter(s => s.semanticContext === 'nearest-return-predicate');
  assert.equal(context.map(s => s.sourceEnglish).join(''), ' always gives the best return.');
  assert.equal(context.map(s => s.status === 'draft' ? s.text : s.sourceEnglish).join(''), ' u nyika best return minkarhi hinkwato.');
  assert.match(marketPartText(decks.ts.slides[16].target.body[2], decks.ts.slides[16].english.body[2]), /U nga ehleketi leswaku nearest buyer u nyika best return minkarhi hinkwato\./);
  assert.match(marketPartText(ve[6].target.body[1], ve[6].english.body[1]), /R18 nga kilogram.*R15 nga kilogram/);
  assert.match(ve[6].target.body[1].segments!.at(-1)!.reason, /modifier order differs|target places yo bulwaho/);
  assert.match(marketPartText(ve[6].target.body[1], ve[6].english.body[1]), /cost yo bulwaho/);
});

test('Market deck guards reject source, current wording, unlisted, order and false draft-hold mutations', () => {
  const mutate = (change: (decks: ReturnType<typeof readCurrentMarketDecks>) => void) => {
    const decks = readCurrentMarketDecks(); change(decks); assert.throws(() => marketDeckBeforeOrdinary(decks));
  };
  mutate(d => { d.ve.slides[14].english.body[3] = d.ve.slides[14].english.body[3].replace('whether', 'because'); });
  mutate(d => { d.ve.slides[10].target.body[2].segments!.at(-1)!.text = 'Always supplies'; });
  mutate(d => { d.st.slides[0].target.body[0].text += ' changed'; });
  mutate(d => { d.ts.slides.reverse(); });
  mutate(d => { const p = d.ve.slides[14].target.body[3].segments![1]; p.status = 'draft'; p.text = p.sourceEnglish; });
  mutate(d => { d.ts.slides[16].target.body[2].segments!.at(-1)!.sourceEnglish = 'Always choose a nearby buyer.'; });
});
