import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// EVERY PAID POLISH PASS MUST BE MEASURED.
//
// The history this guards: Rory paid for Full Treatment repeatedly and got back the picture he
// already had. Six commits over two days were each reported as fixing it, with a green suite,
// because no code in the app had ever looked at an output image — a pass that returned its own
// input verbatim satisfied every check, including the protected-pixel verifier, which a copy
// passes perfectly. It was then stored, labelled "AI polished", and charged for.
//
// lib/render-difference.ts and the gate in the job-completion handler fixed that. But the baseline
// it compares against, `polishInputRef.current`, was set in generateOneViaQueue only — so the three
// ANALYSIS sheets (01 Site, 02 Sector, 08 Phasing) went on paying for an unverified pass. Those are
// the sheets where the app composites the most back on top afterwards, so a near-copy underneath is
// hardest of all to notice by eye.
//
// This is a source-level check because the invariant is cross-cutting and lives inside a large
// React component that cannot be unit-tested without a DOM and a Firebase queue. A test that reads
// the source is not elegant; it is, however, the test that would have caught this.

const SOURCE = readFileSync(join(process.cwd(), 'components/design/DesignGlossy.tsx'), 'utf8');

/** Body of a `const <name> = useCallback(...)` up to the closing `}, [deps]);` at that indent. */
function callbackBody(name: string): string {
  const start = SOURCE.indexOf(`const ${name} = useCallback(`);
  assert.notEqual(start, -1, `${name} not found — this test needs updating, not deleting`);
  const end = SOURCE.indexOf('\n  }, [', start);
  assert.notEqual(end, -1, `could not find the end of ${name}`);
  return SOURCE.slice(start, end);
}

// The three queue flows that can enqueue a PAID polish stage. If a fourth is added, it belongs
// here — and the test below will not know about it, which is why the count check exists too.
const PAID_FLOWS = ['generateOneViaQueue', 'generateSectorViaQueue', 'generatePhasingViaQueue'];

test('every flow that enqueues a paid polish stage records what to compare against', () => {
  for (const flow of PAID_FLOWS) {
    const body = callbackBody(flow);
    assert.match(
      body,
      /polishInputRef\.current\s*=\s*(?!null)/,
      `${flow} enqueues a paid pass without setting the difference baseline — its output will never be checked, and a verbatim copy will be stored and charged for`,
    );
  }
});

test('a polish stage is never enqueued from a flow this test does not know about', () => {
  // The gate is only as good as its coverage, so a fourth flow must not appear silently.
  //
  // Matches only the flows that CAPTURE the decision into a local — `const polishStage =
  // lockedPolishStage === 'polish'` — which is what a flow does before branching its prompt,
  // its mask and its enqueue on it. A bare inline comparison is something else: there is one at
  // the progress counter that renders "Step 2 of 3" versus "of 2", and counting that as an
  // unmeasured paid flow is a false alarm, which is the fastest way to get a test ignored.
  const captured = SOURCE.match(/const\s+\w+\s*=\s*lockedPolishStage === 'polish'/g) ?? [];
  assert.equal(
    captured.length,
    PAID_FLOWS.length,
    `${captured.length} flows capture the polish stage but ${PAID_FLOWS.length} are covered here — add it to PAID_FLOWS and make sure it sets polishInputRef`,
  );
});

test('the phasing baseline is captured BEFORE the schedule panel is blanked', () => {
  // Phasing blanks its own schedule panel out of the image before sending it, so the model never
  // sees real dates. If the baseline were taken after that, the app's own redraw of the panel would
  // be scored as the model's work and a verbatim copy would pass as "redrawn" — a gate that
  // certifies the exact failure it exists to catch is worse than no gate at all.
  const body = callbackBody('generatePhasingViaQueue');
  const baseline = body.indexOf('polishInputRef.current =');
  const blank = body.indexOf('blankPhasingPanel(');
  assert.ok(baseline !== -1 && blank !== -1, 'expected both the baseline and the blanking step');
  assert.ok(baseline < blank, 'the baseline must be captured before blankPhasingPanel');
});

test('the gate compares against the baseline and refuses to save an unchanged pass', () => {
  // Guards the consumer end: the measurement is pointless if its verdict is not acted on.
  assert.match(SOURCE, /measureRenderDifference\(polishInputRef\.current,/);
  // Both paid stages now share paidRenderDecision instead of spelling the verdict comparison twice.
  // Assert the decision is consumed, not the old inline expression.
  assert.match(SOURCE, /paidRenderDecision\(diff, 'polish'\)/);
  assert.match(SOURCE, /if \(!decision\.keep\)/);
  assert.match(SOURCE, /polishRejected = true/);
});

test('scoring can never reject a render it merely failed to measure', () => {
  // A measurement that throws away work it could not measure is worse than none. The catch around
  // the scoring must keep the sheet, not drop it.
  const gate = SOURCE.slice(SOURCE.indexOf('let polishRejected = false;'));
  const window = gate.slice(0, gate.indexOf('if (polishRejected)'));
  assert.match(window, /catch\s*\(/, 'the scoring call must be wrapped');
  assert.doesNotMatch(
    window.slice(window.indexOf('catch')),
    /polishRejected\s*=\s*true/,
    'a failure to measure must not reject the render',
  );
});

test('the first paid Hybrid is scored raw input-vs-output before exact content is composited back', () => {
  const inputFetch = SOURCE.indexOf(
    "const sourceImage = (isHybridResult || sheet.protectMaskPath)",
  );
  const hybridScore = SOURCE.indexOf(
    "measureRenderDifference(sourceImage, raw, protectMask)",
    inputFetch,
  );
  const finalAssembly = SOURCE.indexOf('const finalSheet =', inputFetch);

  assert.ok(inputFetch !== -1, 'Hybrid completion must fetch the exact uploaded model input');
  assert.ok(hybridScore > inputFetch, 'Hybrid must compare its uploaded input with the raw model return');
  assert.ok(
    hybridScore < finalAssembly,
    'Hybrid scoring must happen before app-owned geometry and chrome can manufacture a difference',
  );
});

test('an unchanged Hybrid is not saved, labelled, or advanced into Full Treatment polish', () => {
  const gateStart = SOURCE.indexOf("const decision = paidRenderDecision(diff, 'hybrid')");
  const gateEnd = SOURCE.indexOf('// finishStyledSheet', gateStart);
  const gate = SOURCE.slice(gateStart, gateEnd);

  assert.match(gate, /if \(!decision\.keep\)/);
  assert.match(gate, /polishAfterHybridRef\.current = false/);
  assert.match(gate, /hybridResultRef\.current = null/);
  assert.match(gate, /continue/);
});
