import assert from 'node:assert/strict';
import test from 'node:test';
import { PORTFOLIO_LIMIT, PORTFOLIO_STAGES, PORTFOLIO_NOTICE, portfolioStorageKey, portfolioText, readPortfolio } from '../lib/design-portfolio.ts';

test('design notes survive save and reopen without losing multi-line explanations or isiZulu', () => {
  const answers = { brief: 'Ukudla ekhaya\nKeep the route usable.', costs: 'Water cost unknown — do not enter zero.' };
  assert.deepEqual(readPortfolio(JSON.stringify({ version: 1, answers })), answers);
  assert.deepEqual(readPortfolio(null), {});
  assert.deepEqual(readPortfolio('{"version":1,"answers":{}}'), {});
});

test('unreadable, newer or oversized design drafts cannot be silently turned into an empty replacement', () => {
  for (const raw of ['', 'null', '[]', '{}', '{"version":2,"answers":{}}', '{"version":1,"answers":[]}', '{"version":1,"answers":{"brief":12}}', '{"version":1,"answers":{"futureField":"keep me"}}', JSON.stringify({ version: 1, answers: { brief: 'x'.repeat(PORTFOLIO_LIMIT + 1) } })]) assert.throws(() => readPortfolio(raw), raw.slice(0,80));
  assert.equal(readPortfolio(JSON.stringify({ version: 1, answers: { brief: 'x'.repeat(PORTFOLIO_LIMIT) } })).brief.length, PORTFOLIO_LIMIT);
});

test('guest, signed-in and sample learning folders cannot use one another’s storage key', () => {
  const keys = [portfolioStorageKey(null, false), portfolioStorageKey('alice', false), portfolioStorageKey('bob', false), portfolioStorageKey('guest', false), portfolioStorageKey('sample', false), portfolioStorageKey(null, true)];
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(portfolioStorageKey('alice', true), portfolioStorageKey(null, true));
});

test('a downloaded design folder carries every answer, missing-work marker and review criterion without claiming approval', () => {
  const answers = { brief: 'Household agreed access comes first.', revision: 'Keep revision A and check the new evidence.' };
  const output = portfolioText(answers);
  assert.ok(output.startsWith(PORTFOLIO_NOTICE));
  assert.ok(output.includes('not attachments'));
  assert.ok(output.includes(answers.brief)); assert.ok(output.includes(answers.revision));
  assert.ok(output.includes('[Not yet recorded]'));
  const ids = PORTFOLIO_STAGES.flatMap(stage => stage.fields.map(field => field.id));
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(PORTFOLIO_STAGES.map(stage => stage.id), ['d1','d2','d3','d4','d5','d6']);
  for (const stage of PORTFOLIO_STAGES) {
    assert.ok(output.includes(stage.review));
    for (const field of stage.fields) assert.ok(output.includes(field.label) && output.includes(field.prompt));
  }
});
