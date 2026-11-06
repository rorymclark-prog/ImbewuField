import assert from 'node:assert/strict';
import test from 'node:test';
import { CROPS } from '../lib/crop-catalog.ts';
import { knownVegetativePropagationUnit } from '../lib/crop-plan.ts';

// Dynamic catalog discovery without hardcoding or repeating agricultural names/crop keys.
const mappedCrop = CROPS.find(crop => knownVegetativePropagationUnit(crop.key) !== null);
const unmappedCrop = CROPS.find(crop => knownVegetativePropagationUnit(crop.key) === null);

assert.ok(mappedCrop, 'Fixture requirement: At least one catalog crop must map to a vegetative unit');
assert.ok(unmappedCrop, 'Fixture requirement: At least one catalog crop must not map to a vegetative unit');

test('at least one existing mapped key returns its exact nonempty material unit consistently', () => {
  const unitFirst = knownVegetativePropagationUnit(mappedCrop.key);
  const unitSecond = knownVegetativePropagationUnit(mappedCrop.key);

  assert.equal(typeof unitFirst, 'string');
  assert.ok(unitFirst !== null);
  assert.ok(unitFirst.length > 0);
  assert.equal(unitFirst, unitSecond);
});

test('unknown catalog key does not imply botanical approval and returns null', () => {
  const unit = knownVegetativePropagationUnit(unmappedCrop.key);
  assert.equal(unit, null);

  const missingKeyUnit = knownVegetativePropagationUnit('nonexistent-catalog-key-xyz-123');
  assert.equal(missingKeyUnit, null);
});

test('prototype names return null and never trigger inherited object properties', () => {
  const prototypeKeys = ['__proto__', 'constructor', 'toString', 'valueOf', 'hasOwnProperty'];
  for (const key of prototypeKeys) {
    assert.equal(knownVegetativePropagationUnit(key), null);
  }
});

test('whitespace and case variations of an actually mapped key are not normalized and return null', () => {
  const validKey = mappedCrop.key;
  const variations = [
    ` ${validKey}`,
    `${validKey} `,
    `  ${validKey}  `,
    `\t${validKey}`,
    `\n${validKey}`,
    validKey.toUpperCase(),
    validKey.charAt(0).toUpperCase() + validKey.slice(1),
  ];

  for (const variation of variations) {
    if (variation !== validKey) {
      assert.equal(knownVegetativePropagationUnit(variation), null);
    }
  }
});

test('non-string primitives and complex non-string objects return null without throwing', () => {
  const nonStringInputs = [
    null,
    undefined,
    true,
    false,
    0,
    1,
    -1,
    123.45,
    NaN,
    Infinity,
    -Infinity,
    Symbol('crop-key'),
    BigInt(100),
    () => mappedCrop.key,
    [mappedCrop.key],
    { key: mappedCrop.key },
  ];

  for (const input of nonStringInputs) {
    assert.equal(knownVegetativePropagationUnit(input), null);
  }
});

test('boxed strings, hostile coercion methods, accessors or Proxies are never interrogated', () => {
  let trapCalls = 0;

  // Boxed String object
  // eslint-disable-next-line no-new-wrappers
  const boxedKey = new String(mappedCrop.key);
  assert.equal(knownVegetativePropagationUnit(boxedKey), null);

  // Object with throwing toString and valueOf coercers
  const hostileCoercer = {
    toString() {
      trapCalls++;
      throw new Error('Hostile toString called');
    },
    valueOf() {
      trapCalls++;
      throw new Error('Hostile valueOf called');
    },
  };
  assert.equal(knownVegetativePropagationUnit(hostileCoercer), null);
  assert.equal(trapCalls, 0);

  // Plain object with enumerable getter accessor
  let accessorCalls = 0;
  const accessorObject = {
    get cropKey() {
      accessorCalls++;
      return mappedCrop.key;
    },
  };
  assert.equal(knownVegetativePropagationUnit(accessorObject), null);
  assert.equal(accessorCalls, 0);

  // Proxy object intercepting all traps
  let proxyInteractions = 0;
  const proxyTarget = { value: mappedCrop.key };
  const proxyKey = new Proxy(proxyTarget, {
    get(target, prop, receiver) {
      proxyInteractions++;
      return Reflect.get(target, prop, receiver);
    },
    has(target, prop) {
      proxyInteractions++;
      return Reflect.has(target, prop);
    },
    ownKeys(target) {
      proxyInteractions++;
      return Reflect.ownKeys(target);
    },
    getOwnPropertyDescriptor(target, prop) {
      proxyInteractions++;
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
  });

  assert.equal(knownVegetativePropagationUnit(proxyKey), null);
  assert.equal(proxyInteractions, 0);
});
