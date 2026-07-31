import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  createElement,
  useCallback,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import {
  fullTreatmentProtectPolicy,
  lockedPolishAction,
  lockedPolishResultKind,
  lockedPolishStyle,
  useLockedPolishHandoff,
  type LockedPolishStage,
  type LockedPolishState,
  type SheetOutputMode,
} from '@/lib/locked-polish-flow';

const DESIGN_GLOSSY_SOURCE = readFileSync(
  new URL('../components/design/DesignGlossy.tsx', import.meta.url),
  'utf8',
);

const READY: LockedPolishState = {
  outputMode: 'hybrid',
  exactFlipPending: false,
  hybridAfterExactPending: false,
  hybridFlipPending: false,
  polishAfterHybridPending: false,
  polishFlipPending: false,
  mode: 'ai',
  isExactRender: false,
  loading: false,
  hasResult: false,
};

interface EnqueuedSheet {
  resultKind: 'hybrid' | 'ai-polished';
  compositeDataUrl: string | null;
  committedStage: LockedPolishStage;
}

interface HandoffController {
  startHybrid: () => void;
  completeHybrid: (finishedHybrid: string, visibleInPreview?: boolean) => void;
  completeHybridWithoutInput: () => void;
  settleCurrentJob: () => void;
}

interface HandoffHarnessProps {
  outputMode: Extract<SheetOutputMode, 'hybrid' | 'full'>;
  enqueued: EnqueuedSheet[];
  errors: string[];
  controller: MutableRefObject<HandoffController | null>;
}

function HandoffHarness({
  outputMode,
  enqueued,
  errors,
  controller,
}: HandoffHarnessProps) {
  const requestedModeRef = useRef<SheetOutputMode>(outputMode);
  requestedModeRef.current = outputMode;
  const polishAfterHybridRef = useRef(outputMode === 'full');
  const polishAfterFlipRef = useRef(false);
  const hybridResultRef = useRef<string | null>(null);
  const [stage, setStage] = useState<LockedPolishStage>('hybrid');
  const [loading, setLoading] = useState(false);
  const [hasResult, setHasResult] = useState(false);
  const [hybridHandoffReady, setHybridHandoffReady] = useState(false);

  // This is the queue edge the production hook invokes. Deriving provenance from the committed
  // stage means the test catches the stale-closure failure too: an early dispatch records another
  // Hybrid instead of the required ai-polished job.
  const renderCurrentSheet = useCallback(() => {
    const resultKind = lockedPolishResultKind(stage);
    enqueued.push({
      resultKind,
      compositeDataUrl: resultKind === 'ai-polished'
        ? hybridResultRef.current
        : 'exact-input',
      committedStage: stage,
    });
    if (resultKind === 'ai-polished') hybridResultRef.current = null;
    setLoading(true);
  }, [enqueued, stage]);

  const clearResult = useCallback(() => setHasResult(false), []);
  const recordError = useCallback((message: string) => errors.push(message), [errors]);
  const ignoreNotice = useCallback((_message: string) => undefined, []);

  useLockedPolishHandoff(
    {
      exactFlipPending: false,
      hybridAfterExactPending: false,
      hybridFlipPending: false,
      polishAfterHybridPending: polishAfterHybridRef.current,
      polishFlipPending: polishAfterFlipRef.current,
      mode: 'ai',
      isExactRender: false,
      loading,
      hasResult,
      stage,
      hybridHandoffReady,
    },
    {
      requestedModeRef,
      polishAfterHybridRef,
      polishAfterFlipRef,
      hybridResultRef,
      setHybridHandoffReady,
      setStage,
      setError: recordError,
      missingHybridMessage: 'missing finished Hybrid',
      setNotice: ignoreNotice,
      startingPolishMessage: 'starting polish',
      polishingMessage: 'polishing',
      clearResult,
      renderCurrentSheet,
    },
  );

  controller.current = {
    startHybrid: renderCurrentSheet,
    completeHybrid: (finishedHybrid: string, visibleInPreview = true) => {
      setHasResult(visibleInPreview);
      if (polishAfterHybridRef.current) {
        hybridResultRef.current = finishedHybrid;
        setHybridHandoffReady(true);
      }
      setLoading(false);
    },
    completeHybridWithoutInput: () => {
      setHasResult(true);
      setHybridHandoffReady(true);
      setLoading(false);
    },
    settleCurrentJob: () => setLoading(false),
  };

  return null;
}

function mountHandoff(
  outputMode: Extract<SheetOutputMode, 'hybrid' | 'full'>,
): {
  controller: MutableRefObject<HandoffController | null>;
  enqueued: EnqueuedSheet[];
  errors: string[];
  renderer: ReactTestRenderer;
} {
  const controller: MutableRefObject<HandoffController | null> = { current: null };
  const enqueued: EnqueuedSheet[] = [];
  const errors: string[] = [];
  let renderer: ReactTestRenderer | null = null;
  act(() => {
    renderer = create(createElement(HandoffHarness, {
      outputMode,
      enqueued,
      errors,
      controller,
    }));
  });
  assert.ok(renderer);
  assert.ok(controller.current);
  return { controller, enqueued, errors, renderer };
}

test('Full Treatment completion mounts the real effects and enqueues one polish job from the finished Hybrid', () => {
  const { controller, enqueued, errors, renderer } = mountHandoff('full');
  const api = controller.current;
  assert.ok(api);

  act(() => api.startHybrid());
  // A preview can be hidden by its own identity guard. The paid handoff is still valid and must
  // advance from its dedicated completion signal rather than waiting forever on resultImage.
  act(() => api.completeHybrid('finished-hybrid', false));
  // A later state change must not spend a duplicate pass after the render-polish flag was consumed.
  act(() => controller.current?.settleCurrentJob());

  assert.deepEqual(enqueued, [
    {
      resultKind: 'hybrid',
      compositeDataUrl: 'exact-input',
      committedStage: 'hybrid',
    },
    {
      resultKind: 'ai-polished',
      compositeDataUrl: 'finished-hybrid',
      committedStage: 'polish',
    },
  ]);
  assert.deepEqual(errors, []);
  act(() => renderer.unmount());
});

test('a published handoff with no finished Hybrid stops with an error before spending again', () => {
  const { controller, enqueued, errors, renderer } = mountHandoff('full');
  const api = controller.current;
  assert.ok(api);

  act(() => api.startHybrid());
  act(() => api.completeHybridWithoutInput());
  act(() => controller.current?.settleCurrentJob());

  assert.deepEqual(enqueued, [{
    resultKind: 'hybrid',
    compositeDataUrl: 'exact-input',
    committedStage: 'hybrid',
  }]);
  assert.deepEqual(errors, ['missing finished Hybrid']);
  act(() => renderer.unmount());
});

test('Hybrid-only completion stops after its one paid job', () => {
  const { controller, enqueued, errors, renderer } = mountHandoff('hybrid');
  const api = controller.current;
  assert.ok(api);

  act(() => api.startHybrid());
  act(() => api.completeHybrid('finished-hybrid'));
  act(() => controller.current?.settleCurrentJob());

  assert.deepEqual(enqueued, [{
    resultKind: 'hybrid',
    compositeDataUrl: 'exact-input',
    committedStage: 'hybrid',
  }]);
  assert.deepEqual(errors, []);
  act(() => renderer.unmount());
});

test('DesignGlossy wires queue completion into the mounted handoff and queue provenance', () => {
  assert.match(
    DESIGN_GLOSSY_SOURCE,
    /useLockedPolishHandoff\([\s\S]*requestedModeRef,[\s\S]*renderCurrentSheet: runCurrentSheet/,
    'the production component must mount the tested handoff with stable Full intent',
  );
  assert.match(
    DESIGN_GLOSSY_SOURCE,
    /if \(handoffTargetIsCurrent\) \{[\s\S]*hybridResultRef\.current = finalSheet;[\s\S]*setHybridHandoffReady\(true\)/,
    'a valid finished Hybrid must publish the React signal that starts the tested sequence',
  );
  assert.equal(
    DESIGN_GLOSSY_SOURCE.match(/resultKind: lockedPolishResultKind\(lockedPolishStage\)/g)?.length,
    3,
    'all three paid queue routes must derive resultKind from the committed stage',
  );
});

// THE HANDOFF KEY AND THE CACHE KEY ARE THE SAME KEY, AND MUST BE BUILT THE SAME WAY.
//
// mapKey for a producer sheet is `producer:<style>:<filter>:<mode>`. The handoff comparison was
// written against `producer:<style>:<sheet>` and never updated when the `:<mode>` segment was
// added to give Exact/Hybrid/Full their own cache slots. The two strings could then never be
// equal, so handoffTargetIsCurrent was always false and EVERY Full Treatment aborted the instant
// its Hybrid completed — surfacing as "the AI hybrid finished but its image was not captured"
// while the Hybrid sat finished and saved in the gallery. Two weeks of "it never gets past the
// hybrid" was this one string comparison.
//
// Asserted structurally because the failure is invisible at runtime without paying for a render:
// the abort path looks exactly like a legitimate "farmer navigated away".
test('the Full Treatment handoff tolerates the cache key mode suffix', () => {
  assert.match(
    DESIGN_GLOSSY_SOURCE,
    /mapKeyRef\.current\.startsWith\(`\$\{targetMapKey\}:`\)/,
    'the handoff must accept mapKey mode suffixes — exact-equality against the bare key can never match a producer sheet',
  );

  // And the composed key really does carry a fourth segment, so the prefix test above is load-
  // bearing rather than defensive decoration. If mapKey is ever flattened back to three segments,
  // this fails and whoever does it is told to re-check the handoff.
  assert.match(
    DESIGN_GLOSSY_SOURCE,
    /`producer:\$\{producerStyle\}:\$\{filter\}:\$\{requestedMode\}`/,
    'producer mapKey is style:filter:mode — the handoff prefix match depends on this shape',
  );
});

test('Hybrid mode advances exact render -> switch to hybrid -> hybrid render, then stops', () => {
  assert.equal(lockedPolishAction({
    ...READY,
    exactFlipPending: true,
    hybridAfterExactPending: true,
    mode: 'exact',
    isExactRender: true,
  }), 'render-exact');

  assert.equal(lockedPolishAction({
    ...READY,
    hybridAfterExactPending: true,
    mode: 'exact',
    isExactRender: true,
    hasResult: true,
  }), 'switch-to-hybrid');

  assert.equal(lockedPolishAction({
    ...READY,
    hybridFlipPending: true,
  }), 'render-hybrid');

  // No polishAfterHybridPending set — Hybrid mode has nowhere further to go once rendered.
  assert.equal(lockedPolishAction({
    ...READY,
    hasResult: true,
  }), 'wait');
});

test('Full Treatment continues past Hybrid into a second, polish stage', () => {
  assert.equal(lockedPolishAction({
    ...READY,
    outputMode: 'full',
    exactFlipPending: true,
    hybridAfterExactPending: true,
    polishAfterHybridPending: true,
    mode: 'exact',
    isExactRender: true,
  }), 'render-exact');

  assert.equal(lockedPolishAction({
    ...READY,
    outputMode: 'full',
    hybridAfterExactPending: true,
    polishAfterHybridPending: true,
    mode: 'exact',
    isExactRender: true,
    hasResult: true,
  }), 'switch-to-hybrid');

  assert.equal(lockedPolishAction({
    ...READY,
    outputMode: 'full',
    hybridFlipPending: true,
    polishAfterHybridPending: true,
  }), 'render-hybrid');

  // Hybrid has finished (hasResult) and polishAfterHybridPending is still set — Full Treatment
  // advances again instead of stopping, unlike the Hybrid-only case above.
  assert.equal(lockedPolishAction({
    ...READY,
    outputMode: 'full',
    polishAfterHybridPending: true,
    hasResult: true,
  }), 'switch-to-polish');

  assert.equal(lockedPolishAction({
    ...READY,
    outputMode: 'full',
    polishFlipPending: true,
  }), 'render-polish');
});

test('every stage waits for a settled, non-loading state before firing', () => {
  assert.equal(lockedPolishAction({
    ...READY,
    hybridAfterExactPending: true,
    mode: 'exact',
    isExactRender: true,
  }), 'wait'); // no hasResult yet

  assert.equal(lockedPolishAction({
    ...READY,
    hybridFlipPending: true,
    mode: 'exact',
    isExactRender: true,
    hasResult: true,
  }), 'wait'); // still in exact mode, not flipped to ai yet

  assert.equal(lockedPolishAction({
    ...READY,
    hybridFlipPending: true,
    loading: true,
  }), 'wait'); // a render is already in flight

  assert.equal(lockedPolishAction({
    ...READY,
    outputMode: 'full',
    polishAfterHybridPending: true,
    mode: 'exact', // Full Treatment's polish stage also runs in 'ai' mode, not 'exact'
    isExactRender: true,
    hasResult: true,
  }), 'wait');
});

test('the declared output mode is a hard ceiling on later paid stages', () => {
  const readyExactResult = {
    ...READY,
    mode: 'exact' as const,
    isExactRender: true,
    hasResult: true,
  };

  assert.equal(lockedPolishAction({
    ...readyExactResult,
    outputMode: 'exact',
    hybridAfterExactPending: true,
  }), 'wait', 'Exact-only output must not advance into AI');
  assert.equal(lockedPolishAction({
    ...READY,
    outputMode: 'exact',
    hybridFlipPending: true,
  }), 'wait', 'Exact-only output must not spend a Hybrid render');

  assert.equal(lockedPolishAction({
    ...READY,
    outputMode: 'hybrid',
    polishAfterHybridPending: true,
    hasResult: true,
  }), 'wait', 'Hybrid output must not advance into Full Treatment');
  assert.equal(lockedPolishAction({
    ...READY,
    outputMode: 'hybrid',
    polishFlipPending: true,
  }), 'wait', 'Hybrid output must not spend the polish render');
});

test('Full Treatment remains the only mode allowed to enter both polish transitions', () => {
  assert.equal(lockedPolishAction({
    ...READY,
    outputMode: 'full',
    polishAfterHybridPending: true,
    hasResult: true,
  }), 'switch-to-polish');
  assert.equal(lockedPolishAction({
    ...READY,
    outputMode: 'full',
    polishFlipPending: true,
  }), 'render-polish');
});

test('the exact master step cannot replace the chosen AI style', () => {
  assert.equal(
    lockedPolishStyle('homestead_storybook', 'precision_atlas'),
    'homestead_storybook',
  );
  assert.equal(
    lockedPolishStyle(null, 'precision_atlas'),
    'precision_atlas',
  );
});

test('the guided flow preserves every explicitly selected visual style', () => {
  assert.equal(
    lockedPolishStyle('satellite_overlay', 'precision_atlas'),
    'satellite_overlay',
  );
  assert.equal(
    lockedPolishStyle('master_atlas', 'precision_atlas'),
    'master_atlas',
  );
});

test('Full Treatment restores only the boundary ring, never photographic keyholes', () => {
  const policy = fullTreatmentProtectPolicy();

  // Two real Stage-3 outputs repainted the complete page accurately. Restoring these broad
  // regions afterwards threw away the painted exterior and reintroduced the blurry satellite
  // house/driveway patches that Full Treatment had successfully removed.
  assert.equal(policy.protectOutside, false);
  assert.equal(policy.protectBoundary, true);
  assert.equal(policy.protectDriveway, false);
  assert.equal(policy.protectHouse, false);

  // These regions must remain editable or the completed Hybrid is copied back over the paid
  // artwork. The exact saved Hybrid remains available as the rollback if the paid pass fails.
  assert.equal(policy.protectLines, false);
  assert.equal(policy.protectItems, false);
  assert.equal(policy.protectUnmarkedGround, false);
  assert.match(
    DESIGN_GLOSSY_SOURCE,
    /if \(options\.protectHouse !== false\) \{\s*for \(const footprint of authoritativeHouseFootprints/,
    'the mask builder must honour the policy instead of protecting house pixels unconditionally',
  );
});
