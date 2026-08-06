// On 2026-08-06 Rory generated a Comprehensive site report and got back three pages: the sections
// written in code, and ELEVEN identical lines reading "A section could not be generated — please
// regenerate the report." He reported the report generator as broken.
//
// It was not broken. Every one of the 11 batches had received a clear, actionable 400 from the API:
// "Your credit balance is too low to access the Anthropic API." The catch block had no error
// binding at all — `} catch {` — so it discarded that and substituted advice of its own. Advice
// that could never work, because regenerating costs credit that does not exist; it would have
// failed identically, forever. Diagnosing it meant reading the route, counting the batches by hand
// and calling the API directly.
//
// That is this codebase's signature failure wearing a new coat: a plausible value standing in for a
// real one, indistinguishable in the output. Here the value was an error message, and the cost was
// an afternoon spent looking for a bug in code that was working correctly.
//
// The rule these tests hold: SAY WHAT HAPPENED, and never tell someone to retry something that
// cannot succeed. Telling a person to try again is worse than saying nothing when it cannot work,
// because they believe you and spend their time on it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeGenerationFailure } from '@/lib/report-generation-errors';

/** Shaped like the SDK's error: a status plus the upstream message. */
function apiError(status: number, message: string): Error & { status: number } {
  return Object.assign(new Error(message), { status });
}

test('an exhausted credit balance says so, and does not say "regenerate"', () => {
  const out = describeGenerationFailure(
    apiError(400, 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.'),
  );
  assert.match(out.reader, /credit/i, 'the reader is not told the actual reason');
  assert.match(out.reader, /top up/i, 'the reader is not told the one action that works');
  assert.match(out.log, /credit/i);
});

test('retrying is never offered as the whole remedy for a permanent failure', () => {
  // The first draft of this test banned the word "again" outright and failed on the credit message,
  // which reads "Top up the API balance and generate the report again". That message is correct:
  // the retry is gated on the one action that unblocks it, and a farmer who tops up SHOULD then
  // press generate. Banning the word would have forced a worse message to satisfy a crude rule.
  //
  // The defect in production was narrower and worse than "mentions retrying". It was
  // "please regenerate the report" as the ENTIRE remedy, with no cause and no precondition — a
  // retry loop that could never terminate. So what must hold is that a permanent failure always
  // names the thing that is actually blocking it. Retry may follow that; it may never replace it.
  const permanent: Array<[Error, RegExp]> = [
    [apiError(400, 'Your credit balance is too low to access the Anthropic API.'), /top up/i],
    [apiError(401, 'authentication_error: invalid x-api-key'), /not something regenerating will fix/i],
  ];
  for (const [err, unblocker] of permanent) {
    const { reader } = describeGenerationFailure(err);
    assert.match(reader, unblocker, `no blocking action named, so retry is the only thing left: "${reader}"`);
  }
});

test('no message offers retrying without first saying what to do about it', () => {
  // The generalisation of the same rule, over every branch: if a message suggests generating again,
  // it must also name a cause or a precondition. "Try again" alone is what sent Rory hunting for a
  // bug in working code.
  const all = [
    apiError(400, 'Your credit balance is too low to access the Anthropic API.'),
    apiError(401, 'authentication_error'),
    apiError(429, 'rate_limit_error'),
    apiError(529, 'overloaded_error'),
    new Error('The operation was aborted due to timeout'),
    new Error('something unmapped'),
  ];
  // Matches an INSTRUCTION to regenerate, not any use of the word "again". The unmapped-error
  // message ends "if it happens again the log will say why", which is a condition, not advice —
  // and a bare /again/ test flagged it, which would have pushed a true sentence out of the copy.
  const suggestsRetry = /(generat\w*|try|run)\b[^.]{0,40}\bagain/i;
  for (const err of all) {
    const { reader } = describeGenerationFailure(err);
    if (!suggestsRetry.test(reader)) continue;
    assert.match(
      reader,
      /top up|wait|shorter|fewer|busy|slow down/i,
      `suggests generating again with no cause or precondition: "${reader}"`,
    );
  }
});

test('a transient failure DOES tell the reader to try again, because it works', () => {
  // The opposite error is just as real: withholding retry advice when retrying is the fix leaves a
  // farmer stuck in front of a report that would have completed on a second press.
  const transient = [
    apiError(429, 'rate_limit_error: number of request tokens has exceeded your per-minute limit'),
    apiError(529, 'overloaded_error'),
    Object.assign(new Error('The operation was aborted due to timeout'), {}),
  ];
  for (const err of transient) {
    const { reader } = describeGenerationFailure(err);
    assert.match(reader, /again|shorter|wait/i, `gave no way forward on a recoverable failure: "${reader}"`);
  }
});

test('rate limiting is named as our own doing, not the farmer\'s', () => {
  const { reader } = describeGenerationFailure(apiError(429, 'rate_limit_error'));
  assert.match(reader, /too many sections/i, 'the cause is that WE asked for too much at once');
});

test('an unrecognised failure admits it is unrecognised and records the detail', () => {
  const { log, reader } = describeGenerationFailure(new Error('ECONNRESET socket hang up'));
  assert.match(log, /ECONNRESET/, 'the log must carry the real message or the next one is undiagnosable too');
  assert.ok(!/credit|rate|overload/i.test(reader), 'must not guess at a cause it does not know');
});

test('a non-Error throw does not itself throw', () => {
  // Anything can be thrown. A helper on the failure path that fails is the worst possible one.
  for (const junk of [undefined, null, 'a string', 42, { status: 500 }]) {
    const out = describeGenerationFailure(junk);
    assert.equal(typeof out.reader, 'string');
    assert.ok(out.reader.length > 0);
    assert.equal(typeof out.log, 'string');
  }
});

test('every message is written for a farmer, not for a developer', () => {
  const errs = [
    apiError(400, 'Your credit balance is too low to access the Anthropic API.'),
    apiError(401, 'authentication_error'),
    apiError(429, 'rate_limit_error'),
    apiError(529, 'overloaded_error'),
    new Error('aborted'),
    new Error('something unmapped'),
  ];
  for (const err of errs) {
    const { reader } = describeGenerationFailure(err);
    assert.ok(!/\b[45]\d\d\b/.test(reader), `status code leaked to the reader: "${reader}"`);
    assert.ok(!/anthropic|api key|x-api-key|token/i.test(reader), `vendor or key detail leaked: "${reader}"`);
    assert.ok(reader.trim().endsWith('.'), `not a finished sentence: "${reader}"`);
  }
});
