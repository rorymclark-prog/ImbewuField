import test from 'node:test';
import assert from 'node:assert/strict';
import { selectLocalAdviceSystem } from '../lib/local-advice-prompts.ts';

type ModeArg = Parameters<typeof selectLocalAdviceSystem>[0];

test('selectLocalAdviceSystem personal-site returns supplied personalSystem byte-exact', () => {
  const whitespaceCase = '  \n\tLeading, internal \r\n and trailing whitespace\n\t ';
  assert.equal(selectLocalAdviceSystem('personal-site', whitespaceCase), whitespaceCase);

  const emptyCase = '';
  assert.equal(selectLocalAdviceSystem('personal-site', emptyCase), emptyCase);

  const languageContextSuffix = 'Base prompt\n\nLanguage: isiZulu\nContext: farm-boundary-alpha-7';
  assert.equal(selectLocalAdviceSystem('personal-site', languageContextSuffix), languageContextSuffix);
});

test('selectLocalAdviceSystem general-help returns app-help scope and never leaks personalSystem sentinel', () => {
  const privateSentinelA = 'PRIVATE_SENTINEL_SITE_ID_789456_CONFIDENTIAL_TOKEN';
  const privateSentinelB = 'DIFFERENT_PRIVATE_SENTINEL_SECRET_ALPHA';

  const resultA = selectLocalAdviceSystem('general-help', privateSentinelA);
  const resultB = selectLocalAdviceSystem('general-help', privateSentinelB);

  // Independent of supplied personalSystem sentinel
  assert.equal(resultA, resultB);
  assert.ok(!resultA.includes(privateSentinelA), 'General prompt must not leak private sentinel A');
  assert.ok(!resultA.includes(privateSentinelB), 'General prompt must not leak private sentinel B');

  // Must provide useful app-navigation guidance across screens
  assert.match(
    resultA,
    /Help people use the app's (?:[a-z,\s]+)?maps(?:[a-z,\s]+)?saved sites(?:[a-z,\s]+)?crop planning(?:[a-z,\s]+)?nursery planning(?:[a-z,\s]+)?records(?:[a-z,\s]+)?account/i,
    'Must explicitly guide navigation across maps, saved sites, crop planning, nursery planning, records and account screens'
  );

  // Must instruct on planned versus observed records in plain language
  assert.match(
    resultA,
    /planned versus observed records/i,
    'Must explain navigation and meaning of planned versus observed records'
  );

  // Must withhold personal farm/account verification
  assert.ok(
    resultA.includes('no personal farm, account, sharing settings, project or records have been verified or supplied'),
    'Must withhold personal farm/account verification'
  );

  // Must require legal advice and funding eligibility in the SAME prohibition sentence as site-specific farming recommendations
  assert.match(
    resultA,
    /[^.?!]*\bDo not give site-specific farming recommendations\b[^.?!]*\blegal advice\b[^.?!]*\bfunding eligibility\b[^.?!]*[.?!]/,
    'Must prohibit site-specific farming recommendations, legal advice, and funding eligibility within the same sentence'
  );
});

test('selectLocalAdviceSystem invalid runtime modes throw the same generic error without echoing input or invoking hostile accessors', () => {
  const expectedErrorMessage = 'Unsupported local advice mode';

  const invalidInputs: unknown[] = [
    'invalid-mode-string',
    'PERSONAL-SITE',
    'general_help',
    null,
    undefined,
    123,
    true,
    {},
    [],
  ];

  for (const invalid of invalidInputs) {
    assert.throws(
      () => selectLocalAdviceSystem(invalid as ModeArg, 'synthetic-system-input'),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.equal(err.message, expectedErrorMessage);
        return true;
      }
    );
  }

  // Hostile object counting both getter property reads and function executions
  let toStringGetterReads = 0;
  let toStringFunctionCalls = 0;
  let valueOfGetterReads = 0;
  let valueOfFunctionCalls = 0;

  const hostileMode = {
    get toString() {
      toStringGetterReads += 1;
      return () => {
        toStringFunctionCalls += 1;
        return 'HOSTILE_LEAK_STRING';
      };
    },
    get valueOf() {
      valueOfGetterReads += 1;
      return () => {
        valueOfFunctionCalls += 1;
        return 'HOSTILE_LEAK_VALUE';
      };
    },
  };

  assert.throws(
    () => selectLocalAdviceSystem(hostileMode as unknown as ModeArg, 'synthetic-system-input'),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.equal(err.message, expectedErrorMessage);
      assert.ok(!err.message.includes('HOSTILE_LEAK'));
      return true;
    }
  );

  assert.equal(toStringGetterReads, 0, 'toString getter must never be read');
  assert.equal(toStringFunctionCalls, 0, 'toString function must never be executed');
  assert.equal(valueOfGetterReads, 0, 'valueOf getter must never be read');
  assert.equal(valueOfFunctionCalls, 0, 'valueOf function must never be executed');
});
