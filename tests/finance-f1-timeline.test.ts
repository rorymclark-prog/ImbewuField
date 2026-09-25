import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { f1Positions, type F1Practice } from '../lib/finance-f1-timeline.ts';

const practice: F1Practice = JSON.parse(readFileSync(new URL('../lib/finance-f1-practice.json', import.meta.url), 'utf8'));

test('a later buyer receipt clears the earlier debt without counting the same sale twice', () => {
  const positions = f1Positions(practice);
  const c04 = positions.find(position => position.card?.id === 'C04');
  const c07 = positions.find(position => position.card?.id === 'C07');
  assert.deepEqual([c04?.cash, c04?.sales, c04?.buyerOwes], [138000, 35000, 15000]);
  assert.deepEqual([c07?.cash, c07?.sales, c07?.buyerOwes], [195000, 35000, 0]);
});

test('loan cash and principal remain separate from produce sales', () => {
  const positions = f1Positions(practice);
  const c05 = positions.find(position => position.card?.id === 'C05');
  const c06 = positions.find(position => position.card?.id === 'C06');
  const c10 = positions.find(position => position.card?.id === 'C10');
  assert.equal(c06?.sales, c05?.sales);
  assert.equal(c06?.cash, (c05?.cash ?? 0) + 50000);
  assert.equal(c06?.loanOwes, 50000);
  assert.equal(c10?.loanOwes, 40000);
});

test('a repeated or unlinked settlement cannot silently make the buyer balance wrong', () => {
  const repeated: F1Practice = { ...practice, events: [...practice.events, { ...practice.events[6], id: 'repeat' }] };
  assert.throws(() => f1Positions(repeated), /Invalid F1 settlement/);
});
