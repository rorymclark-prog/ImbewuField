import test from 'node:test';
import assert from 'node:assert/strict';

import { friendlyProviderError } from '../functions/src/provider-errors.ts';

// The real payload from Rory's screen on 2026-08-02, which is what started this.
const HARD_LIMIT = '{ "error": { "message": "Billing hard limit has been reached", "type": "invalid_request_error", "param": null, "code": "hard_limit_reached" } }';

test('a spend-limit failure says the exact maps still work, and shows no JSON', () => {
  const message = friendlyProviderError(400, HARD_LIMIT);

  assert.match(message, /spending limit/i);
  assert.match(message, /exact maps still work/i);
});

test('no provider failure ever leaks a payload, a code or a status number', () => {
  const cases: Array<[number, string]> = [
    [400, HARD_LIMIT],
    [400, '{"error":{"code":"insufficient_quota","message":"You exceeded your current quota"}}'],
    [401, '{"error":{"code":"invalid_api_key"}}'],
    [403, 'Forbidden'],
    [429, 'Rate limit reached for gpt-image-2'],
    [500, 'Internal server error'],
    [503, '<html>upstream connect error</html>'],
    [418, ''],
  ];

  for (const [status, detail] of cases) {
    const message = friendlyProviderError(status, detail);

    // This string is printed under the Design Studio's controls. A farmer must never meet a brace,
    // an error code or an HTTP status — that was the whole defect.
    assert.doesNotMatch(message, /[{}]/, `${status} leaked JSON: ${message}`);
    assert.doesNotMatch(message, /\b(4|5)\d\d\b/, `${status} leaked a status code: ${message}`);
    assert.doesNotMatch(message, /_|hard_limit|insufficient_quota|invalid_api_key/i, `${status} leaked a code: ${message}`);
    assert.ok(message.trim().length > 0);
    assert.ok(/[.!]$/.test(message.trim()), `${status} is not a sentence: ${message}`);
  }
});

test('a failure that only stops PAID renders says so; a transient one asks you to retry', () => {
  // The distinction that matters: "the app is broken" vs "one optional finish is unavailable".
  for (const [status, detail] of [[400, HARD_LIMIT], [401, 'invalid_api_key']] as Array<[number, string]>) {
    assert.match(friendlyProviderError(status, detail), /exact maps still work/i);
  }
  for (const status of [429, 500, 503]) {
    assert.match(friendlyProviderError(status, ''), /again in a few minutes/i);
  }
});
