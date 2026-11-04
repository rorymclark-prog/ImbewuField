import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  INVOICE_PILOT_CURRENCIES,
  inspectInvoiceCurrencyBasis,
  invoiceRandConsumerEligibility,
  type InvoicePilotCurrency,
} from '../lib/invoice-currency.ts';

test('pilot currencies order and content are strictly preserved and runtime-frozen', () => {
  assert.deepEqual(INVOICE_PILOT_CURRENCIES, ['ZAR', 'KES', 'GBP', 'USD', 'EUR', 'BRL']);
  assert.equal(Object.isFrozen(INVOICE_PILOT_CURRENCIES), true, 'Catalog array must be frozen');

  // Attempting mutation must fail (throw in strict mode) and unsupported codes like CAD remain held
  assert.throws(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (INVOICE_PILOT_CURRENCIES as any).push('CAD');
  }, TypeError);

  assert.deepEqual(
    inspectInvoiceCurrencyBasis({ currencyCode: 'CAD' }),
    { status: 'held', reason: 'currency-outside-pilot' },
    'CAD must remain held as outside pilot',
  );
});

test('genuinely absent currencyCode on plain object is legacy-rand', () => {
  const plain = { id: 'inv-1', no: 42, total: 100 };
  assert.deepEqual(inspectInvoiceCurrencyBasis(plain), {
    status: 'legacy-rand',
    currency: 'ZAR',
  });

  const nullProto = Object.create(null);
  nullProto.id = 'inv-2';
  assert.deepEqual(inspectInvoiceCurrencyBasis(nullProto), {
    status: 'legacy-rand',
    currency: 'ZAR',
  });
});

test('all six pilot currency codes match exact recorded status', () => {
  for (const code of INVOICE_PILOT_CURRENCIES) {
    const inv = { id: 'test', currencyCode: code };
    assert.deepEqual(inspectInvoiceCurrencyBasis(inv), {
      status: 'recorded',
      currency: code,
    });
  }
});

test('present malformed or unsupported currencyCode yields currency-outside-pilot', () => {
  // Lowercase, padded/whitespace, empty, numbers, null, undefined present data value
  const cases = [
    { currencyCode: 'zar' },
    { currencyCode: ' ZAR' },
    { currencyCode: 'ZAR ' },
    { currencyCode: '' },
    { currencyCode: '   ' },
    { currencyCode: 710 },
    { currencyCode: null },
    { currencyCode: undefined },
    { currencyCode: false },
    { currencyCode: Symbol('ZAR') },
    { currencyCode: {} },
    { currencyCode: 'AUD' },
    { currencyCode: 'CAD' },
  ];

  for (const c of cases) {
    assert.deepEqual(
      inspectInvoiceCurrencyBasis(c),
      { status: 'held', reason: 'currency-outside-pilot' },
      `Expected outside-pilot for ${String(c.currencyCode)}`,
    );
  }
});

test('own accessor descriptor yields currency-property-unreadable even with undefined get/set without calling getter', () => {
  let getterCalls = 0;
  const obj = {};
  Object.defineProperty(obj, 'currencyCode', {
    get() {
      getterCalls++;
      return 'ZAR';
    },
    enumerable: true,
    configurable: true,
  });

  const res = inspectInvoiceCurrencyBasis(obj);
  assert.deepEqual(res, { status: 'held', reason: 'currency-property-unreadable' });
  assert.equal(getterCalls, 0, 'Getter must never be evaluated');

  // Accessor descriptor with get/set explicitly undefined is still an accessor descriptor
  const accessorUndefined = {};
  Object.defineProperty(accessorUndefined, 'currencyCode', {
    get: undefined,
    set: undefined,
    enumerable: true,
    configurable: true,
  });
  assert.deepEqual(
    inspectInvoiceCurrencyBasis(accessorUndefined),
    { status: 'held', reason: 'currency-property-unreadable' },
    'Accessor with undefined get/set must be detected as accessor and held as unreadable property',
  );

  // By contrast, a data descriptor with value: undefined is held as currency-outside-pilot
  const dataUndefined = {};
  Object.defineProperty(dataUndefined, 'currencyCode', {
    value: undefined,
    writable: true,
    enumerable: true,
    configurable: true,
  });
  assert.deepEqual(
    inspectInvoiceCurrencyBasis(dataUndefined),
    { status: 'held', reason: 'currency-outside-pilot' },
    'Data descriptor with value undefined must be held as currency-outside-pilot',
  );
});

test('non-plain objects, arrays, primitives, and functions yield invoice-shape-unreadable', () => {
  class CustomInvoice {
    currencyCode = 'ZAR';
  }

  const badContainers = [
    null,
    undefined,
    123,
    'ZAR',
    true,
    Symbol('inv'),
    [],
    ['ZAR'],
    () => {},
    new Date(),
    new Map(),
    new Set(),
    new CustomInvoice(),
  ];

  for (const item of badContainers) {
    assert.deepEqual(
      inspectInvoiceCurrencyBasis(item),
      { status: 'held', reason: 'invoice-shape-unreadable' },
      `Expected invoice-shape-unreadable for ${String(item)}`,
    );
  }
});

test('exotic prototype with inherited accessor is held as invoice-shape-unreadable before inspecting property and calls zero getters', () => {
  // Creating an intermediate object as prototype produces an exotic prototype (proto !== Object.prototype && proto !== null).
  // The inspector shape gate rejects exotic prototypes first with 'invoice-shape-unreadable',
  // ensuring non-plain objects are never admitted while still never invoking inherited getters.
  let inheritedCalls = 0;
  const proto = {};
  Object.defineProperty(proto, 'currencyCode', {
    get() {
      inheritedCalls++;
      return 'ZAR';
    },
    enumerable: true,
    configurable: true,
  });

  const child = Object.create(proto);
  child.id = 'child-inv';

  const res = inspectInvoiceCurrencyBasis(child);
  assert.deepEqual(res, { status: 'held', reason: 'invoice-shape-unreadable' });
  assert.equal(inheritedCalls, 0, 'Inherited getter must never be evaluated');
});

test('unrelated property accessor is never evaluated', () => {
  let otherGetterCalls = 0;
  const obj = {
    currencyCode: 'ZAR',
  };
  Object.defineProperty(obj, 'otherProp', {
    get() {
      otherGetterCalls++;
      return 'secret';
    },
  });

  const res = inspectInvoiceCurrencyBasis(obj);
  assert.deepEqual(res, { status: 'recorded', currency: 'ZAR' });
  assert.equal(otherGetterCalls, 0, 'Unrelated getter must never be evaluated');
});

test('reflection throwing traps are caught and yield held', () => {
  const throwingProxy = new Proxy(
    {},
    {
      getOwnPropertyDescriptor() {
        throw new Error('Reflection trap blocked');
      },
    },
  );

  const res = inspectInvoiceCurrencyBasis(throwingProxy);
  assert.deepEqual(res, { status: 'held', reason: 'currency-property-unreadable' });

  const protoThrowingProxy = new Proxy(
    {},
    {
      getPrototypeOf() {
        throw new Error('Prototype trap blocked');
      },
    },
  );

  const res2 = inspectInvoiceCurrencyBasis(protoThrowingProxy);
  assert.deepEqual(res2, { status: 'held', reason: 'invoice-shape-unreadable' });
});

test('frozen input is unchanged and operations are deterministic with no mutations', () => {
  const frozenInv = Object.freeze({
    id: 'frozen-1',
    no: 10,
    currencyCode: 'USD' as InvoicePilotCurrency,
  });

  const first = inspectInvoiceCurrencyBasis(frozenInv);
  const second = inspectInvoiceCurrencyBasis(frozenInv);
  assert.deepEqual(first, { status: 'recorded', currency: 'USD' });
  assert.deepEqual(second, { status: 'recorded', currency: 'USD' });
  assert.equal(Object.isFrozen(frozenInv), true);
  assert.deepEqual(Object.keys(frozenInv), ['id', 'no', 'currencyCode']);
});

test('invoiceRandConsumerEligibility correctly classifies legacy, recorded, foreign, and held', () => {
  // Legacy Rand
  assert.deepEqual(invoiceRandConsumerEligibility({ id: 'legacy' }), {
    status: 'eligible',
    basis: 'legacy-rand',
  });

  // Recorded ZAR
  assert.deepEqual(invoiceRandConsumerEligibility({ currencyCode: 'ZAR' }), {
    status: 'eligible',
    basis: 'recorded-rand',
  });

  // Foreign recorded currencies (other 5 pilot codes)
  const foreign: InvoicePilotCurrency[] = ['KES', 'GBP', 'USD', 'EUR', 'BRL'];
  for (const c of foreign) {
    assert.deepEqual(
      invoiceRandConsumerEligibility({ currencyCode: c }),
      { status: 'held', reason: 'foreign-recorded-currency' },
      `Expected foreign-recorded-currency for ${c}`,
    );
  }

  // Malformed or held currencies
  assert.deepEqual(invoiceRandConsumerEligibility({ currencyCode: 'XYZ' }), {
    status: 'held',
    reason: 'unreadable-currency',
  });
  assert.deepEqual(invoiceRandConsumerEligibility(null), {
    status: 'held',
    reason: 'unreadable-currency',
  });
  assert.deepEqual(invoiceRandConsumerEligibility([1, 2, 3]), {
    status: 'held',
    reason: 'unreadable-currency',
  });
  assert.deepEqual(invoiceRandConsumerEligibility({ currencyCode: 100 }), {
    status: 'held',
    reason: 'unreadable-currency',
  });
});
