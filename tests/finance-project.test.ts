import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { checkProjectAnswers, deriveProject, projectProblems, projectNumber, readProjectDraft, PROJECT_NUMBER_QUESTIONS, type FinanceProjectCase } from '../lib/finance-project.ts';

const cases: FinanceProjectCase[] = JSON.parse(readFileSync(new URL('../lib/course-finance-project.json', import.meta.url), 'utf8')).cases;

test('each connected case reconciles original forecasts, actual source cards and separately authored answers', () => {
  for (const c of cases) {
    assert.deepEqual(projectProblems(c), [], c.id);
    const result = deriveProject(c);
    assert.ok(result.plannedMinimum < 0 && result.plannedClosing > 0, 'a positive closing forecast must not conceal the early gap');
    assert.equal(result.bridge.reduce((sum, row) => sum + row.cents, 0), c.expected.cashDifference);
    assert.equal(result.fullProfit, null, 'missing full-period evidence does not become profit');
    const answers = Object.fromEntries(PROJECT_NUMBER_QUESTIONS.map(q => [q.id, String(c.expected[q.id] / 10 ** q.places)]));
    assert.ok(checkProjectAnswers(c, answers).every(q => q.correct));
    for (const q of PROJECT_NUMBER_QUESTIONS) {
      const changed = { ...answers, [q.id]: String((c.expected[q.id] + 1) / 10 ** q.places) };
      assert.equal(checkProjectAnswers(c, changed).find(x => x.id === q.id)?.correct, false, `reject wrong ${c.id}/${q.id}`);
    }
  }
  assert.equal(deriveProject(cases[1]).cashDifference, 0, 'independent case shows that the same closing cash can conceal different events');
  assert.equal(new Set(cases.map(c => c.expected.actualSales)).size, cases.length, 'fresh cases must not reuse the memorised invoice total');
});

test('source-card mistakes cannot silently teach duplicate income, false dates, missing costs or wrong units', () => {
  const faults: [string, (c: FinanceProjectCase) => void][] = [
    // A withdrawal relabelled as a cost leaves cash unchanged but teaches the wrong category.
    ['withdrawal relabelled expense', c => { c.cashEvents[4].kind = 'transport paid'; }],
    ['owner funds relabelled sales', c => { c.cashEvents[1].kind = 'new sale'; }],
    ['duplicate receipt', c => { c.cashEvents.push({ ...c.cashEvents[3] }); }],
    ['unpaid invoice counted as cash', c => { c.cashEvents[3].amountCents = c.invoice.amountCents; }],
    ['wrong invoice amount', c => { c.invoice.amountCents += 100; }],
    ['unmatched receipt', c => { c.cashEvents[3].invoiceReference = 'another-sale'; }],
    ['wrong delivery quantity', c => { c.destinations[0].quantityGrams += 1000; }],
    ['household food dropped', c => { c.destinations.splice(1, 1); }],
    ['wrong unit', c => { c.invoice.unit = 'bunch'; }],
    ['forecast treated as order', c => { c.plan.marketStatus = 'confirmed'; }],
    ['later receipt moved into month', c => { c.laterPayment.date = c.period.end; }],
    ['actual payment shifted outside month', c => { c.cashEvents[3].date = c.laterPayment.date; }],
    ['invoice in wrong month', c => { c.invoice.date = c.laterPayment.date; }],
    ['opening cash changed', c => { c.opening.cashCents += 100; }],
    ['cash count wrong', c => { c.cashCount.amountCents -= 100; }],
    ['stock count wrong', c => { c.stockCount.quantityGrams -= 1000; }],
    ['fractional cents', c => { c.cashEvents[0].amountCents -= 0.1; }],
    ['wrong harvest site', c => { c.harvest.plotReference = 'missing-plot'; }],
    ['plot outside site', c => { c.site.plot.xM = 100; }],
    ['incorrect worked answer', c => { c.expected.actualSales += 100; }],
  ];
  for (const c of cases) for (const [label, mutate] of faults) {
    const copy = structuredClone(c); mutate(copy);
    assert.ok(projectProblems(copy).length, `${c.id}: ${label}`);
  }
  const zeroCost = JSON.parse(JSON.stringify(cases[0])); zeroCost.unknownCost.amountCents = 0;
  assert.ok(projectProblems(zeroCost).some(p => p.includes('unknown')));
});

test('answers keep cents and decimal-comma kilograms exact and reject partial numeric strings', () => {
  assert.equal(projectNumber('R 312,00', 2), 31200);
  assert.equal(projectNumber('−40.00', 2), -4000);
  assert.equal(projectNumber('6,125', 3), 6125);
  assert.equal(projectNumber('0', 2), 0);
  for (const bad of ['', ' ', '40 apples', '1e2', '3.4.5', '3,4.5', 'NaN', 'Infinity', '1.001', '900719925474099999']) assert.equal(projectNumber(bad, 2), null, bad);
});

test('a stored project restores only bounded worksheet answers, never a claimed pass or someone else’s records', () => {
  assert.deepEqual(readProjectDraft(null), {});
  assert.deepEqual(readProjectDraft('{"actualSales":"312","trail":"G-INV to G-PAY","passed":true,"customer":{"bank":"private"}}'), { actualSales: '312', trail: 'G-INV to G-PAY' });
  assert.deepEqual(readProjectDraft(JSON.stringify({ trail: 'x'.repeat(3001), owed: 112 })), {});
  for (const raw of ['null', '[]', '{', '"text"']) assert.throws(() => readProjectDraft(raw));
});
