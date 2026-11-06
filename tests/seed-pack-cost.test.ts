import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSeedPackPriceInput, reviewSeedPackCost } from '../lib/seed-pack-cost.ts';
import { INVOICE_PILOT_CURRENCIES } from '../lib/invoice-currency.ts';
import { exactDecimalQuantityProduct } from '../lib/farm-records.ts';

// Synthetic entered prices/counts exercise planning arithmetic only. They are not
// suggested prices, supplier offers, purchases, stock observations or farm advice.
function frozen(value: unknown): void {
  if (value && typeof value === 'object') { assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen); }
}
function priceInvalid(input: unknown): void {
  const result = parseSeedPackPriceInput(input);
  assert.equal(result.status, 'invalid'); assert.equal(result.value, null);
  assert.equal(result.rawText, typeof input === 'string' ? input : null);
  assert.equal(typeof result.reason, 'string'); assert.ok(result.reason); frozen(result);
}
function shape(result: ReturnType<typeof reviewSeedPackCost>): void {
  assert.deepEqual(Object.keys(result).sort(), ['currency', 'estimatedCost', 'packsNeeded', 'reason', 'status', 'unitPrice']); frozen(result);
  if (result.status !== 'complete') assert.equal(result.estimatedCost, null);
}
for (const raw of ['', ' ', '\t\n ']) test('blank price stays unknown rather than becoming a free pack: ' + JSON.stringify(raw), () => {
  const result = parseSeedPackPriceInput(raw);
  assert.deepEqual(result, { status: 'unknown', rawText: raw, value: null, reason: null }); frozen(result);
});
for (const [raw, value] of [['0', 0], ['0.00', 0], ['0,00', 0], ['2', 2], ['1.25', 1.25], ['1,25', 1.25],
  ['  +01,20  ', 1.2], ['.5', 0.5], [',5', 0.5], ['1.', 1], ['1,', 1], ['1,234', 1.234]] as const) {
  test('exact decimal entry preserves authored text and known value for ' + JSON.stringify(raw), () => {
    const result = parseSeedPackPriceInput(raw);
    assert.deepEqual(result, { status: 'ready', rawText: raw, value, reason: null }); frozen(result);
  });
}
for (const raw of ['-', '+', '.', ',', '-.', '+,', '-1', '-0', '-0.0', '-0,00', '-000',
  '12pack', '1e2', '0x10', '1_000', '1 000', '1,000.00', '1.000,00', '$1', 'USD 1', 'Infinity', 'NaN',
  '9007199254740993', '0.10000000000000001', '0.' + '0'.repeat(400) + '1']) {
  test('malformed, negative, signed-zero or lossy entry cannot become a known price: ' + raw.slice(0, 32), () => priceInvalid(raw));
}
test('nontext price inputs are invalid without being coerced to zero or a price string', () => {
  for (const input of [null, undefined, 0, -0, 1.2, NaN, Infinity, false, BigInt(0), Symbol('price'), [], ['1'], new String('1')]) priceInvalid(input);
});
for (const currency of INVOICE_PILOT_CURRENCIES) test('an explicit pilot denomination remains exactly ' + currency + ' without FX or country inference', () => {
  const result = reviewSeedPackCost(4, '1,25', currency);
  assert.deepEqual(result, { status: 'complete', packsNeeded: 4, unitPrice: 1.25, currency, estimatedCost: 5, reason: null }); shape(result);
});
test('the existing exact decimal product prevents floating-point multiplication tails in a planned line cost', () => {
  const result = reviewSeedPackCost(3, '0.1', 'USD');
  assert.equal(3 * 0.1 === 0.3, false, 'independent fixture must distinguish ordinary binary multiplication');
  assert.deepEqual(result, { status: 'complete', packsNeeded: 3, unitPrice: 0.1, currency: 'USD', estimatedCost: 0.3, reason: null }); shape(result);
  assert.equal(reviewSeedPackCost(3, '0.07', 'EUR').estimatedCost, 0.21);
});
test('known zero factors produce a known zero cost only when count, price and denomination are all known', () => {
  for (const [packs, price] of [[0, '1.25'], [3, '0'], [0, '0']] as const) {
    const result = reviewSeedPackCost(packs, price, 'GBP');
    assert.equal(result.status, 'complete'); assert.ok(Object.is(result.estimatedCost, 0)); assert.equal(result.reason, null); shape(result);
  }
  for (const [packs, price, currency] of [[0, '', 'GBP'], [0, '0', undefined], [null, '0', 'GBP'], [0, '0', '']] as const) {
    const result = reviewSeedPackCost(packs, price, currency); assert.equal(result.status, 'unknown'); assert.equal(result.reason, null); shape(result);
  }
});
test('unknown count, price or denomination retains the other independently valid fields without legacy-rand fallback', () => {
  const cases: Array<[unknown, unknown, unknown, number | null, number | null, string | null]> = [
    [null, '2', 'USD', null, 2, 'USD'], [undefined, '2', 'KES', null, 2, 'KES'],
    [3, '', 'EUR', 3, null, 'EUR'], [3, ' \t ', 'ZAR', 3, null, 'ZAR'],
    [3, '2', undefined, 3, 2, null], [3, '2', null, 3, 2, null], [3, '2', '', 3, 2, null], [3, '2', ' \t ', 3, 2, null],
  ];
  for (const [packs, price, denomination, packsNeeded, unitPrice, currency] of cases) {
    const result = reviewSeedPackCost(packs, price, denomination);
    assert.deepEqual(result, { status: 'unknown', packsNeeded, unitPrice, currency, estimatedCost: null, reason: null }); shape(result);
  }
});
test('safe whole pack counts are consumed as supplied and never rounded or reconstructed from seed demand', () => {
  for (const packs of [0, 1, Number.MAX_SAFE_INTEGER]) {
    const result = reviewSeedPackCost(packs, '1', 'ZAR');
    assert.equal(result.status, 'complete'); assert.equal(result.packsNeeded, packs); assert.equal(result.estimatedCost, packs); shape(result);
  }
  for (const packs of [-0, -1, 0.5, Number.MAX_SAFE_INTEGER + 1, Infinity, NaN, '3', false, BigInt(3), new Number(3), {}, []]) {
    const result = reviewSeedPackCost(packs, '2', 'USD');
    assert.equal(result.status, 'invalid'); assert.equal(result.packsNeeded, null); assert.equal(result.unitPrice, 2); assert.equal(result.currency, 'USD');
    assert.equal(typeof result.reason, 'string'); shape(result);
  }
});
for (const currency of ['usd', ' USD', 'USD ', 'US', 'US$', 'R', 'ZA', 'INR', 0, false, {}, ['USD'], new String('USD')]) {
  test('an explicit unsupported denomination is invalid rather than normalized or inferred: ' + typeof currency + '/' + String(currency), () => {
    const result = reviewSeedPackCost(3, '2', currency);
    assert.equal(result.status, 'invalid'); assert.equal(result.packsNeeded, 3); assert.equal(result.unitPrice, 2); assert.equal(result.currency, null); shape(result);
  });
}
test('malformed inputs take precedence over unknown factors in count, then price, then currency order', () => {
  const countReason = reviewSeedPackCost(-1, '2', 'USD').reason;
  const priceReason = reviewSeedPackCost(3, 'bad', 'USD').reason;
  const currencyReason = reviewSeedPackCost(3, '2', 'usd').reason;
  assert.equal(typeof countReason, 'string'); assert.equal(typeof priceReason, 'string'); assert.equal(typeof currencyReason, 'string');
  for (const [packs, price, currency, expectedReason] of [
    [-1, 'bad', 'usd', countReason], [-1, '', undefined, countReason],
    [null, 'bad', 'usd', priceReason], [undefined, 'bad', undefined, priceReason],
    [null, '', 'usd', currencyReason], [0, '0', 'usd', currencyReason],
  ] as const) {
    const result = reviewSeedPackCost(packs, price, currency); assert.equal(result.status, 'invalid'); assert.equal(result.reason, expectedReason); shape(result);
  }
  assert.deepEqual(reviewSeedPackCost(-1, '2', 'USD'), { status: 'invalid', packsNeeded: null, unitPrice: 2, currency: 'USD', estimatedCost: null, reason: countReason });
  assert.deepEqual(reviewSeedPackCost(3, 'bad', 'USD'), { status: 'invalid', packsNeeded: 3, unitPrice: null, currency: 'USD', estimatedCost: null, reason: priceReason });
});
test('a known exact price whose line product cannot be represented forwards the arithmetic hold and retains its factors', () => {
  const unitPrice = 9007199254740991, authority = exactDecimalQuantityProduct([3, unitPrice]);
  assert.deepEqual(authority, { status: 'held', reason: 'decimal-representation-loss' });
  if (authority.status !== 'held') throw Error('Independent product representation-loss control did not hold');
  const result = reviewSeedPackCost(3, String(unitPrice), 'USD');
  assert.deepEqual(result, { status: 'held', packsNeeded: 3, unitPrice, currency: 'USD', estimatedCost: null, reason: authority.reason }); shape(result);
});
test('an overflowing unbounded price is either held at the permitted entry ceiling or forwards the exact arithmetic reason', () => {
  const raw = '1' + '0'.repeat(300), value = 1e300;
  const authority = exactDecimalQuantityProduct([Number.MAX_SAFE_INTEGER, value]);
  assert.deepEqual(authority, { status: 'held', reason: 'outside-finite-range' });
  if (authority.status !== 'held') throw Error('Independent overflow control did not hold');
  const parsed = parseSeedPackPriceInput(raw), result = reviewSeedPackCost(Number.MAX_SAFE_INTEGER, raw, 'USD');
  if (parsed.status === 'ready') {
    assert.equal(parsed.value, value); assert.equal(result.status, 'held'); assert.equal(result.reason, authority.reason); assert.equal(result.unitPrice, value);
  } else {
    assert.equal(parsed.status, 'invalid', 'the optional entry ceiling holds long text, never silently truncates it or makes it unknown');
    assert.equal(result.status, 'invalid'); assert.equal(result.unitPrice, null);
  }
  assert.equal(result.estimatedCost, null); assert.equal(result.packsNeeded, Number.MAX_SAFE_INTEGER); assert.equal(result.currency, 'USD'); shape(result);
});
test('ordinary objects, getters and coercion hooks are never invoked or changed in any scalar argument', () => {
  let calls = 0;
  const unsafe = Object.defineProperties({}, {
    valueOf: { get() { calls++; throw Error('value getter'); } }, toString: { get() { calls++; throw Error('string getter'); } },
    currencyCode: { get() { calls++; throw Error('currency getter'); } }, [Symbol.toPrimitive]: { get() { calls++; throw Error('primitive getter'); } },
  });
  const before = Object.getOwnPropertyDescriptors(unsafe);
  priceInvalid(unsafe);
  for (const [packs, price, currency] of [[unsafe, '2', 'USD'], [3, unsafe, 'USD'], [3, '2', unsafe], [unsafe, unsafe, unsafe]]) {
    const result = reviewSeedPackCost(packs, price, currency); assert.equal(result.status, 'invalid'); shape(result);
  }
  assert.equal(calls, 0); assert.deepEqual(Object.getOwnPropertyDescriptors(unsafe), before);
});
