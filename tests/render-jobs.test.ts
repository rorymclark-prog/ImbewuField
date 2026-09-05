import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createRenderSceneSnapshot,
  decodeRenderSceneSnapshot,
  MAX_RENDER_SCENE_BYTES,
  parseRenderSceneJson,
  type RenderSceneInput,
} from '../lib/render-scene.ts';

import {
  MAX_COMPOSITE_BYTES,
  MAX_SHEETS_PER_JOB,
  RenderJobError,
  dataUrlBytes,
  enqueueRenderJob,
  mapSerially,
  maskHasProtectedAndEditablePixels,
  normaliseRenderJobDoc,
  renderJobRequestError,
  renderJobAttribution,
  qualityCacheSuffix,
  RENDER_QUALITIES,
  type RenderSheetSpec,
} from '../lib/render-jobs.ts';
import {
  MAX_RENDER_SHEETS_PER_JOB as CLIENT_MAX,
  RENDER_ENGINES as CLIENT_ENGINES,
  RENDER_SHEET_KEYS as CLIENT_KEYS,
} from '../lib/render-job-contract.ts';
import {
  MAX_RENDER_SHEETS_PER_JOB as WORKER_MAX,
  RENDER_ENGINES as WORKER_ENGINES,
  RENDER_SHEET_KEYS as WORKER_KEYS,
  workerRenderJobContractError,
} from '../functions/src/render-job-contract.ts';

const png = 'data:image/png;base64,iVBORw0KGgo=';

function sheet(key = 'water', overrides: Partial<RenderSheetSpec> = {}): RenderSheetSpec {
  return {
    key,
    label: 'Water',
    prompt: 'Paint only the editable ground.',
    compositeDataUrl: png,
    ...overrides,
  };
}

function workerJob(sheets: Array<{ key: string; prompt: string }>) {
  return {
    uid: 'farmer-1',
    siteId: 'farm-1',
    style: 'precision_atlas',
    engine: 'openai',
    sheets,
  };
}

test('web client, worker and security rules share one sheet-count contract', () => {
  assert.equal(MAX_SHEETS_PER_JOB, CLIENT_MAX);
  assert.equal(CLIENT_MAX, WORKER_MAX);
  assert.deepEqual([...CLIENT_KEYS].sort(), [...WORKER_KEYS].sort());

  const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  const ruleCap = rules.match(/request\.resource\.data\.sheets\.size\(\)\s*<=\s*(\d+)/)?.[1];
  assert.equal(Number(ruleCap), CLIENT_MAX);
});

test('each known sheet identity is accepted, but two copies of one sheet are rejected before upload', async () => {
  for (const key of CLIENT_KEYS) {
    assert.equal(renderJobRequestError([sheet(key)]), null);
    assert.equal(workerRenderJobContractError(workerJob([{ key, prompt: 'render' }])), null);
  }

  const duplicate = [sheet('water'), sheet('water')];
  assert.match(renderJobRequestError(duplicate) ?? '', /more than once/);
  assert.equal(
    workerRenderJobContractError(workerJob(duplicate.map(({ key, prompt }) => ({ key, prompt })))),
    'duplicate sheet',
  );
  await assert.rejects(
    enqueueRenderJob({
      siteId: 'farm-1',
      style: 'precision_atlas',
      engine: 'openai',
      sheets: duplicate,
    }),
    (error: unknown) => error instanceof RenderJobError && /more than once/.test(error.message),
  );
});

test('unknown sheets and empty prompts cannot consume quota or become paid work', () => {
  assert.match(renderJobRequestError([sheet('../other-user/input')]) ?? '', /Unknown render sheet/);
  assert.equal(
    workerRenderJobContractError(workerJob([{ key: '../other-user/input', prompt: 'render' }])),
    'unknown sheet',
  );
  assert.match(renderJobRequestError([sheet('water', { prompt: '   ' })]) ?? '', /no render instructions/);
  assert.equal(
    workerRenderJobContractError(workerJob([{ key: 'water', prompt: '   ' }])),
    'empty prompt',
  );
});

test('the worker rejects malformed jobs before either usage counter is read or written', () => {
  const source = readFileSync(new URL('../functions/src/index.ts', import.meta.url), 'utf8');
  const validation = source.indexOf('workerRenderJobContractError(job)');
  const counters = source.indexOf("db.doc(`render_usage/");
  assert.ok(validation >= 0);
  assert.ok(counters > validation);
});

test('web client and worker share one render-engine contract', () => {
  assert.deepEqual([...CLIENT_ENGINES].sort(), [...WORKER_ENGINES].sort());
});

test('both sides accept every contracted engine and reject anything else', () => {
  for (const engine of CLIENT_ENGINES) {
    assert.equal(
      workerRenderJobContractError({ ...workerJob([{ key: 'water', prompt: 'render' }]), engine }),
      null,
      `worker rejected contracted engine ${engine}`,
    );
  }
  for (const bogus of ['fal', 'falgpt', 'OpenAI', '', null, undefined, 7]) {
    assert.equal(
      workerRenderJobContractError({ ...workerJob([{ key: 'water', prompt: 'render' }]), engine: bogus }),
      'invalid engine',
      `worker accepted bogus engine ${String(bogus)}`,
    );
  }
});

/**
 * THE PHANTOM FIELD. The worker used to choose its vendor from `job.provider` while the client only
 * ever wrote `job.engine`, so `provider === 'gemini'` was permanently false: a Gemini job would
 * validate, run, and be rendered and BILLED on OpenAI, returning a perfectly good picture with
 * nothing anywhere reporting that the wrong vendor had been charged.
 *
 * That is why this is a source grep and not a behavioural test. A unit test can only check the
 * branch it knows about; the defect was a branch keyed to a field that never arrived, which reads
 * as working code both to a reviewer and to a passing suite. The invariant worth pinning is
 * structural: the job's vendor is decided by exactly ONE field, and it is the one the client writes.
 */
test('the worker chooses its vendor from the same field the client writes, and no other', () => {
  const worker = readFileSync(new URL('../functions/src/index.ts', import.meta.url), 'utf8');
  const client = readFileSync(new URL('../lib/render-jobs.ts', import.meta.url), 'utf8');

  // The client writes `engine` into the job doc...
  assert.match(client, /engine: opts\.engine/);
  // ...and the worker branches on that same field.
  assert.match(worker, /job\.engine === 'gemini'/);

  // Nothing on either side may resurrect a second vendor field. Comment lines are stripped first so
  // the note explaining this history cannot satisfy its own guard.
  const code = (src: string) => src.split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n');
  assert.doesNotMatch(code(worker), /job\.provider/);
  assert.doesNotMatch(code(client), /provider:/);
});

test('completed queue results keep the durable job vendor in every user-visible attribution', () => {
  assert.deepEqual(renderJobAttribution('gemini'), {
    saved: 'gemini',
    gallery: 'gemini',
    label: 'Gemini',
  });
  assert.deepEqual(renderJobAttribution('openai'), {
    saved: 'falgpt',
    gallery: 'openai',
    label: 'gpt-image-2',
  });

  const glossy = readFileSync(new URL('../components/design/DesignGlossy.tsx', import.meta.url), 'utf8');
  const finish = glossy.slice(glossy.indexOf('async function handleSnapshot('));
  assert.match(finish, /const attribution = renderJobAttribution\(job\.engine\)/,
    'the queue finisher no longer reads the vendor from the durable job');
  assert.match(finish, /provider: attribution\.saved/);
  assert.match(finish, /provider: attribution\.gallery/);
  assert.match(finish, /paid \$\{attribution\.label\} result/);
  assert.doesNotMatch(finish, /paid gpt-image-2 result/,
    'a Gemini completion can still be announced as an OpenAI result');
});

test('a locked Gemini Zones sheet burns exact saved regions and does not draw crossing leaders', () => {
  const glossy = readFileSync(new URL('../components/design/DesignGlossy.tsx', import.meta.url), 'utf8');
  const labelsAt = glossy.indexOf('const gutterOwnsLabels = locked');
  const finishSlice = glossy.slice(labelsAt, glossy.indexOf('// Ground first', labelsAt));
  assert.ok(labelsAt >= 0, 'the locked-sheet finisher was not found');
  assert.match(finishSlice, /: f === 'zones'\s*\? \[\]/,
    'Zones can still feed its badges and names into the margin leader engine');

  const zoneFirst = finishSlice.indexOf("const overlayImage = f === 'zones'");
  const lockedFallback = finishSlice.indexOf(': locked', zoneFirst);
  assert.ok(zoneFirst >= 0 && lockedFallback > zoneFirst,
    'the general locked-sheet branch can still suppress the exact zone overlay');
  assert.match(finishSlice, /\? buildZoneOverlay\(renderState, renderRefLayers, W, H\)/,
    'the finisher no longer burns the saved zone polygons over model artwork');
});

test('a Gemini job with no server secret fails by name before any sheet is attempted', () => {
  const source = readFileSync(new URL('../functions/src/index.ts', import.meta.url), 'utf8');
  const guard = source.indexOf('missing_gemini_secret');
  const firstEdit = source.indexOf('await geminiEdit(');
  assert.ok(guard >= 0, 'no missing-secret guard');
  assert.ok(firstEdit > guard, 'the guard must precede any Gemini call');
  assert.match(source, /GEMINI_API_KEY secret is missing/);
});

test('the worker derives every privileged Storage path from owner, job and sheet identity', () => {
  const source = readFileSync(new URL('../functions/src/index.ts', import.meta.url), 'utf8');
  assert.match(source, /const inputPath = `renders\/\$\{job\.uid\}\/\$\{jobId\}\/input-\$\{sheet\.key\}\.jpg`/);
  assert.match(source, /const protectMaskPath = `renders\/\$\{job\.uid\}\/\$\{jobId\}\/mask-\$\{sheet\.key\}\.png`/);
  assert.doesNotMatch(source, /bucket\.file\(sheet\.protectMaskPath\)/);
});

test('a failed serial upload rolls back every completed artifact before job creation', () => {
  // This used to require Promise.allSettled because rejected Promise.all siblings could finish
  // after rollback had snapshotted the list. Uploads are now serial to cap phone memory, so there
  // are no live siblings: every path in `uploaded` is complete when the catch begins.
  const source = readFileSync(new URL('../lib/render-jobs.ts', import.meta.url), 'utf8');
  const serial = source.indexOf('sheets = await mapSerially(opts.sheets');
  const rollback = source.indexOf('uploaded.map((p) => deleteObject', serial);
  const createJob = source.indexOf("await setDoc(doc(fb.db, 'render_jobs', jobId)", serial);
  assert.ok(serial >= 0, 'uploads are no longer inside the serial memory boundary');
  assert.ok(rollback > serial, 'a failed upload no longer cleans up its completed predecessors');
  assert.ok(createJob > rollback, 'the paid job doc can be created before upload rollback completes');
  assert.doesNotMatch(source, /Promise\.allSettled\(uploadTasks\)/,
    'full-resolution uploads and mask validations are concurrent again');
});

test('decoded data URL size handles base64 padding exactly and enforces the upload cap', () => {
  assert.equal(dataUrlBytes('data:image/png;base64,TQ=='), 1);
  assert.equal(dataUrlBytes('data:image/png;base64,TWE='), 2);
  assert.equal(dataUrlBytes('data:image/png;base64,TWFu'), 3);

  const storageRules = readFileSync(new URL('../storage.rules', import.meta.url), 'utf8');
  const renderRule = storageRules.slice(storageRules.indexOf('match /renders/{uid}/{allPaths=**}'));
  const cap = renderRule.match(/request\.resource\.size\s*(<)\s*(\d+)\s*\*\s*1024\s*\*\s*1024/);
  assert.equal(cap?.[1], '<');
  assert.equal(Number(cap?.[2]) * 1024 * 1024, MAX_COMPOSITE_BYTES);

  const allowedPayload = 'A'.repeat(Math.floor((MAX_COMPOSITE_BYTES - 3) * 4 / 3));
  const boundaryPayload = 'A'.repeat(Math.floor(MAX_COMPOSITE_BYTES * 4 / 3));
  assert.ok(dataUrlBytes(`data:image/png;base64,${allowedPayload}`) < MAX_COMPOSITE_BYTES);
  assert.equal(dataUrlBytes(`data:image/png;base64,${boundaryPayload}`), MAX_COMPOSITE_BYTES);
  assert.equal(renderJobRequestError([sheet('water', {
    compositeDataUrl: `data:image/png;base64,${allowedPayload}`,
  })]), null);
  assert.match(renderJobRequestError([sheet('water', {
    compositeDataUrl: `data:image/png;base64,${boundaryPayload}`,
  })]) ?? '', /too large/);
});

test('render rollback may delete an owner-scoped upload without reading null request.resource', () => {
  const storageRules = readFileSync(new URL('../storage.rules', import.meta.url), 'utf8');
  const renderRule = storageRules.slice(storageRules.indexOf('match /renders/{uid}/{allPaths=**}'));

  assert.match(
    renderRule,
    /allow create, update:\s*if request\.auth != null && request\.auth\.uid == uid[\s\S]*?request\.resource\.size < 12 \* 1024 \* 1024[\s\S]*?request\.resource\.contentType\.matches\('image\/\.\*'\);/,
    'render creates and updates must retain the image size/type guards',
  );
  assert.match(
    renderRule,
    /allow delete:\s*if request\.auth != null && request\.auth\.uid == uid;/,
    'rollback deletes must be authorised from owner identity alone because request.resource is null',
  );
});

test('malformed images and conflicting rendering authorities fail before any job exists', () => {
  assert.match(renderJobRequestError([sheet('water', { compositeDataUrl: 'not an image' })]) ?? '', /valid image/);
  assert.match(renderJobRequestError([sheet('water', { compositeDataUrl: 'data:image/png;base64,A' })]) ?? '', /valid image/);
  assert.match(renderJobRequestError([sheet('water', { protectMaskDataUrl: 'not a mask' })]) ?? '', /invalid protection mask/);
  const oversizedMask = `data:image/png;base64,${'A'.repeat(Math.floor(MAX_COMPOSITE_BYTES * 4 / 3) + 4)}`;
  assert.match(renderJobRequestError([sheet('water', { protectMaskDataUrl: oversizedMask })]) ?? '', /protection mask is too large/);
  assert.match(renderJobRequestError([sheet('water', {
    showcase: true,
    geometryLock: true,
  })]) ?? '', /incompatible render modes/);
  assert.equal(workerRenderJobContractError(workerJob([sheet('water', {
    showcase: true,
    geometryLock: true,
  })])), 'conflicting render authority');
});

test('malformed render metadata fails before upload and before worker quota accounting', () => {
  const malformed: Array<[Partial<RenderSheetSpec>, RegExp, string]> = [
    [{ showcase: 'yes' as unknown as boolean }, /showcase flag/, 'invalid showcase flag'],
    [{ geometryLock: 1 as unknown as boolean }, /geometry-lock flag/, 'invalid geometry lock flag'],
    [{ useProtectMaskForEdit: 'false' as unknown as boolean }, /protection-mask mode/, 'invalid mask mode'],
    [{ resultKind: 'exact' as RenderSheetSpec['resultKind'] }, /result kind/, 'invalid result kind'],
  ];

  for (const [override, clientMessage, workerMessage] of malformed) {
    const invalidSheet = sheet('water', override);
    assert.match(renderJobRequestError([invalidSheet]) ?? '', clientMessage);
    assert.equal(
      workerRenderJobContractError(workerJob([invalidSheet])),
      workerMessage,
    );
  }
});

test('worker input validation is exhaustive for empty, oversized and wrong-engine jobs', () => {
  const valid = workerJob([{ key: 'water', prompt: 'render' }]);
  assert.equal(workerRenderJobContractError({ ...valid, sheets: [] }), 'no sheets');
  assert.equal(workerRenderJobContractError({
    ...valid,
    sheets: Array.from({ length: WORKER_MAX + 1 }, (_, index) => ({
      key: WORKER_KEYS[index % WORKER_KEYS.length],
      prompt: 'render',
    })),
  }), 'too many sheets');
  assert.equal(workerRenderJobContractError({ ...valid, engine: 'other' }), 'invalid engine');
  assert.equal(workerRenderJobContractError({ ...valid, siteId: '' }), 'invalid site');
});

test('a queue mask must contain both protected and editable pixels', () => {
  assert.equal(maskHasProtectedAndEditablePixels(new Uint8ClampedArray([0, 0, 0, 0])), false);
  assert.equal(maskHasProtectedAndEditablePixels(new Uint8ClampedArray([0, 0, 0, 255])), false);
  assert.equal(maskHasProtectedAndEditablePixels(new Uint8ClampedArray([
    0, 0, 0, 0,
    0, 0, 0, 255,
  ])), true);
  // Anti-aliased protection still matters: restoration blends partial alpha rather than ignoring it.
  assert.equal(maskHasProtectedAndEditablePixels(new Uint8ClampedArray([0, 0, 0, 128])), true);
});

test('subscription snapshots are accepted only when every storage path belongs to that exact job', () => {
  const jobId = 'farmer-1_123_abc';
  const valid = {
    uid: 'farmer-1',
    siteId: 'farm-1',
    style: 'precision_atlas',
    engine: 'openai',
    status: 'complete',
    sheets: [{
      key: 'water',
      label: 'Water',
      prompt: 'render',
      inputPath: `renders/farmer-1/${jobId}/input-water.jpg`,
      protectMaskPath: `renders/farmer-1/${jobId}/mask-water.png`,
      useProtectMaskForEdit: false,
      status: 'done',
      outputPath: `renders/farmer-1/${jobId}/output-water.png`,
      showcase: false,
      geometryLock: true,
      resultKind: 'hybrid',
    }],
  };

  assert.deepEqual(normaliseRenderJobDoc(jobId, valid), valid);
  assert.equal(normaliseRenderJobDoc(jobId, {
    ...valid,
    sheets: [{ ...valid.sheets[0], outputPath: 'renders/another-user/private.png' }],
  }), null);
  assert.equal(normaliseRenderJobDoc(jobId, {
    ...valid,
    sheets: [{ ...valid.sheets[0], inputPath: `renders/farmer-1/another-job/input-water.jpg` }],
  }), null);
  assert.ok(normaliseRenderJobDoc(jobId, {
    ...valid,
    sheets: [{ ...valid.sheets[0], outputPath: `renders/farmer-1/${jobId}/output-water.jpg` }],
  }));
});

test('subscription snapshots reject impossible status, authority and identity combinations', () => {
  const jobId = 'farmer-1_123_abc';
  const baseSheet = {
    key: 'water',
    label: 'Water',
    prompt: 'render',
    inputPath: `renders/farmer-1/${jobId}/input-water.jpg`,
    status: 'queued',
    showcase: false,
    geometryLock: true,
    resultKind: 'hybrid',
  };
  const job = {
    uid: 'farmer-1',
    siteId: 'farm-1',
    style: 'precision_atlas',
    engine: 'openai',
    status: 'queued',
    sheets: [baseSheet],
  };

  assert.ok(normaliseRenderJobDoc(jobId, job));
  assert.equal(normaliseRenderJobDoc(jobId, { ...job, status: 'invented' }), null);
  assert.equal(normaliseRenderJobDoc(jobId, {
    ...job,
    sheets: [{ ...baseSheet, key: 'unknown' }],
  }), null);
  assert.equal(normaliseRenderJobDoc(jobId, {
    ...job,
    sheets: [baseSheet, { ...baseSheet }],
  }), null);
  assert.equal(normaliseRenderJobDoc(jobId, {
    ...job,
    sheets: [{ ...baseSheet, showcase: true }],
  }), null);
  assert.equal(normaliseRenderJobDoc(jobId, {
    ...job,
    sheets: [{ ...baseSheet, status: 'done' }],
  }), null);
  assert.equal(normaliseRenderJobDoc(jobId, {
    ...job,
    sheets: [{ ...baseSheet, outputPath: `renders/farmer-1/${jobId}/output-water.png` }],
  }), null);
});

function sceneInput(): RenderSceneInput {
  const frame = { centerLng: 31.9, centerLat: -27.7, zoom: 18, imgW: 960, imgH: 640, mPerPx: 0.4 };
  return {
    state: {
      siteId: 'farm-1', frame: { ...frame, underlayDataUrl: png },
      items: [{ id: 'tree-1', defId: 'existing-tree', x: 0.25, y: 0.5 }],
      zones: [{ id: 'bed-1', zone: 1, points: [[0.1, 0.1], [0.3, 0.1], [0.3, 0.3]] }],
      lines: [{ id: 'water-1', kind: 'pipe', points: [[0.2, 0.3], [0.5, 0.8]] }],
      step: 'review', updatedAt: '2026-09-04T12:00:00Z', rev: 3,
    },
    frame: { ...frame, satDataUrl: png, underlayDataUrl: png },
    refLayers: { boundary: [[0, 0], [1, 0], [1, 1], [0, 1]], house: [], driveway: [], drivewayClosed: false },
    site: { rainfallMm: 800 }, placeName: 'Farm', labelMode: 'codes', underlay: 'satellite',
    outputScale: 2, renderRecipe: 'snapshot-test', planVersion: 'v93', cacheSuffix: ':test',
  };
}

test('a paid scene survives a reload without borrowing a moved tree, changed scale or another base image', async () => {
  const input = sceneInput();
  const pending = createRenderSceneSnapshot(input);
  // Change the original objects before the asynchronous hash finishes, just as live editing can.
  input.state.items[0].x = 0.9;
  input.refLayers.boundary[0][0] = 0.2;
  input.frame.mPerPx = 2;
  input.frame.satDataUrl = 'data:image/png;base64,TQ==';
  const prepared = await pending;
  const restored = await decodeRenderSceneSnapshot(prepared.sceneJson, prepared.designRevision, prepared.sourceDataUrl);
  assert.equal(restored.state.items[0].x, 0.25);
  assert.deepEqual(restored.refLayers.boundary[0], [0, 0]);
  assert.equal(restored.frame.mPerPx, 0.4);
  assert.equal(restored.frame.satDataUrl, png);
  assert.equal(restored.state.rev, 3);
  assert.equal(restored.labelMode, 'codes');
  assert.equal(restored.outputScale, 2);
  assert.equal(restored.cacheSuffix, ':test');
  assert.doesNotMatch(prepared.sceneJson, /satDataUrl|underlayDataUrl|data:image/,
    'large inline imagery must not leak into Firestore through either frame');
  restored.state.items[0].x = 0.7;
  const again = await decodeRenderSceneSnapshot(prepared.sceneJson, prepared.designRevision, prepared.sourceDataUrl);
  assert.equal(again.state.items[0].x, 0.25, 'decoded copies must not share mutable geometry');
  await assert.rejects(decodeRenderSceneSnapshot(prepared.sceneJson, prepared.designRevision, input.frame.satDataUrl), /source image does not match/);
});

test('a design revision ignores navigation and key insertion order but notices geometry, imagery and render settings', async () => {
  const original = sceneInput();
  const expected = await createRenderSceneSnapshot(original);
  const reordered = sceneInput();
  reordered.state = { ...reordered.state, step: 'planting', rev: 30, updatedAt: '2026-09-05T12:00:00Z' };
  reordered.state.items[0] = { y: 0.5, x: 0.25, defId: 'existing-tree', id: 'tree-1' };
  assert.equal((await createRenderSceneSnapshot(reordered)).designRevision, expected.designRevision);
  const changes: Array<(input: RenderSceneInput) => void> = [
    (input) => { input.state.items[0].x += 0.01; },
    (input) => { input.state.lines[0].points[0][0] += 0.01; },
    (input) => { input.refLayers.boundary[0][0] += 0.01; },
    (input) => { input.frame.satDataUrl = 'data:image/png;base64,TQ=='; },
    (input) => { input.frame.mPerPx = 0.5; },
    (input) => { input.labelMode = 'names'; },
    (input) => { input.outputScale = 3; },
    (input) => { input.renderRecipe = 'another-recipe'; },
  ];
  for (const change of changes) {
    const changed = sceneInput();
    change(changed);
    assert.notEqual((await createRenderSceneSnapshot(changed)).designRevision, expected.designRevision);
  }
  const tampered = JSON.parse(expected.sceneJson);
  tampered.state.items[0].x = 0.8;
  await assert.rejects(decodeRenderSceneSnapshot(JSON.stringify(tampered), expected.designRevision, expected.sourceDataUrl), /revision does not match/);
});

test('invalid and oversized render scenes fail before any upload or paid job can start', async () => {
  for (const invalidNumber of [NaN, Infinity, -Infinity]) {
    const input = sceneInput();
    input.state.lines[0].points[0][0] = invalidNumber;
    await assert.rejects(createRenderSceneSnapshot(input), /non-finite/);
  }
  for (const invalidRevision of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    const input = sceneInput();
    input.state.rev = invalidRevision;
    await assert.rejects(createRenderSceneSnapshot(input), /invalid geometry/);
  }
  const input = sceneInput();
  input.state.items[0].note = 'x'.repeat(MAX_RENDER_SCENE_BYTES);
  await assert.rejects(createRenderSceneSnapshot(input), /too large/);
  await assert.rejects(enqueueRenderJob({
    siteId: 'farm-1', style: 'storybook', engine: 'openai', sheets: [sheet()],
    sceneSnapshot: { sceneJson: JSON.stringify(input), designRevision: 'a'.repeat(64) },
  }), /saved render scene is invalid/,
  'scene validation must run before Firebase sign-in or storage access');
  const prepared = await createRenderSceneSnapshot(sceneInput());
  await assert.rejects(enqueueRenderJob({
    siteId: 'farm-1', style: 'storybook', engine: 'openai', sheets: [sheet()],
    sceneSnapshot: { ...prepared, designRevision: 'a'.repeat(64) },
  }), /revision does not match/, 'a correctly shaped but false hash must also fail before uploads');
  await assert.rejects(enqueueRenderJob({
    siteId: 'farm-1', style: 'storybook', engine: 'openai', sheets: [sheet()], attemptId: 'other/job',
  }), /attempt identifier is invalid/);
  assert.equal(parseRenderSceneJson('{}', 'invalid-revision'), null);
});

test('reattachment retains paid quality and the original scene while refusing a source from another job', async () => {
  const prepared = await createRenderSceneSnapshot(sceneInput());
  const jobId = 'farmer-1_123_abc';
  const job = {
    uid: 'farmer-1', siteId: 'farm-1', style: 'storybook', engine: 'openai', quality: 'medium',
    status: 'queued', sceneJson: prepared.sceneJson, designRevision: prepared.designRevision,
    attemptId: 'attempt-123', outputMode: 'hybrid', sourcePath: `renders/farmer-1/${jobId}/source.jpg`,
    sheets: [{ key: 'water', label: 'Water', prompt: 'render', status: 'queued', inputPath: `renders/farmer-1/${jobId}/input-water.jpg` }],
  };
  assert.deepEqual(normaliseRenderJobDoc(jobId, job), job);
  assert.equal(normaliseRenderJobDoc(jobId, { ...job, quality: 'invented' }), null);
  assert.equal(normaliseRenderJobDoc(jobId, { ...job, outputMode: 'invented' }), null);
  assert.equal(normaliseRenderJobDoc(jobId, { ...job, outputMode: 'full' })?.outputMode, 'full',
    'resuming an optional two-pass workflow must retain that intent after React state is gone');
  assert.equal(normaliseRenderJobDoc(jobId, { ...job, sourcePath: 'renders/farmer-1/another-job/source.jpg' }), null);
  assert.equal(normaliseRenderJobDoc(jobId, { ...job, sourcePath: undefined }), null);
  assert.equal(normaliseRenderJobDoc(jobId, { ...job, siteId: 'another-farm' }), null);
  assert.equal(normaliseRenderJobDoc(jobId, { ...job, designRevision: 'corrupt' }), null);
  assert.equal(normaliseRenderJobDoc(jobId, { ...job, attemptId: undefined }), null);
  const plain = sceneInput();
  plain.frame.satDataUrl = null;
  const noImage = await createRenderSceneSnapshot(plain);
  const restored = await decodeRenderSceneSnapshot(noImage.sceneJson, noImage.designRevision);
  assert.equal(restored.frame.satDataUrl, null);
  assert.equal(normaliseRenderJobDoc(jobId, { ...job, sceneJson: noImage.sceneJson, designRevision: noImage.designRevision }), null);
  assert.ok(normaliseRenderJobDoc(jobId, { ...job, sceneJson: noImage.sceneJson, designRevision: noImage.designRevision, sourcePath: undefined }));
});

// ── THE PAID QUALITY DIAL AND ITS CACHE SLOT ────────────────────────────────────────────────
//
// RENDER_QUALITY_CHOICES says the dial exists "so the SAME sheet can be rendered all three ways
// and compared before anyone commits to one". It could not: all three shared one cache key, so
// switching the dial re-served whichever picture rendered last and the control looked inert — on
// a setting that costs roughly 4x at medium and 35x at high versus low. These tests hold the two
// halves of the fix together, because the failure mode is silent: nothing throws, a farmer just
// pays for a render and is shown an older one.

test('the quality suffix is empty at the default, so no paid sheet is orphaned', () => {
  // The whole reason this can ship without a PLAN_VERSION bump. 'high' was the only value that
  // existed before the dial, and an older job doc carries no quality at all — both must key
  // byte-identically to the sheets already sitting in farmers' galleries.
  assert.equal(qualityCacheSuffix('high'), '');
  assert.equal(qualityCacheSuffix(undefined), '');
  assert.equal(qualityCacheSuffix('medium'), ':qmedium');
  assert.equal(qualityCacheSuffix('low'), ':qlow');
});

test('every render quality gets a distinct cache slot', () => {
  // The dial's stated purpose is comparison, which needs three slots and not one.
  const suffixes = RENDER_QUALITIES.map(qualityCacheSuffix);
  assert.equal(new Set(suffixes).size, RENDER_QUALITIES.length, 'two qualities share a cache slot');
});

const GLOSSY_SRC = readFileSync('components/design/DesignGlossy.tsx', 'utf8');

test('the queue result is filed under the JOB\'s quality, never the live dial', () => {
  // A render takes minutes and the farmer may move the dial while it runs. Keying the saved
  // result off current state would file a medium picture under the high key — the same read/write
  // divergence that once wrote every queued Hybrid to a slot nothing read, arriving by a new route.
  const at = GLOSSY_SRC.indexOf('const qualitySuffix = qualityCacheSuffix(');
  assert.ok(at > 0, 'the queue-completion save no longer computes a quality suffix');
  const call = GLOSSY_SRC.slice(at, at + 120);
  assert.ok(call.includes('job.quality'), 'the save key stopped using the job\'s own quality');
  assert.ok(!/qualityCacheSuffix\(quality\)[^;]*saveKey/.test(GLOSSY_SRC.slice(at, at + 400)));
});

test('deterministic exact sheets never carry a quality suffix', () => {
  // Quality is an instruction to the MODEL. It changes nothing about an exact sheet's pixels, so
  // appending it there would split those caches for no reason and strand sheets already stored.
  assert.ok(GLOSSY_SRC.includes('isPaidMapKey ? qualityCacheSuffix(quality) : \'\''),
    'the read-path quality suffix is gone or is no longer gated to paid keys');
  assert.ok(/const isPaidMapKey = [^;]*Boolean\(producerStyle\)/.test(GLOSSY_SRC),
    'isPaidMapKey stopped requiring a producer style — exact sheets would start splitting caches');
});

test('full-resolution render preparation runs one sheet at a time on a phone', async () => {
  // Four 1920×1280 masks checked together are roughly 75 MiB of canvas + ImageData before the
  // composites, photographs or upload buffers exist. That is enough to kill iOS Safari. The
  // serial helper is behavioural coverage: putting Promise.all back makes peak concurrency 4.
  let active = 0;
  let peak = 0;
  const started: number[] = [];
  const finished: number[] = [];
  const result = await mapSerially([1, 2, 3, 4], async (value) => {
    active += 1;
    peak = Math.max(peak, active);
    started.push(value);
    await new Promise<void>((resolve) => setTimeout(resolve, 2));
    finished.push(value);
    active -= 1;
    return value * 10;
  });

  assert.equal(peak, 1, 'more than one full-resolution sheet was live at once');
  assert.deepEqual(started, [1, 2, 3, 4]);
  assert.deepEqual(finished, [1, 2, 3, 4]);
  assert.deepEqual(result, [10, 20, 30, 40]);

  const attempted: number[] = [];
  await assert.rejects(
    mapSerially([1, 2, 3], async (value) => {
      attempted.push(value);
      if (value === 2) throw new Error('upload failed');
      return value;
    }),
    /upload failed/,
  );
  assert.deepEqual(attempted, [1, 2],
    'a failed serial upload must stop before another full-resolution sheet starts');

  const renderJobs = readFileSync(new URL('../lib/render-jobs.ts', import.meta.url), 'utf8');
  const uploadStart = renderJobs.indexOf('export async function enqueueRenderJob(');
  const uploadBody = renderJobs.slice(uploadStart, renderJobs.indexOf('\nfunction nonEmptyString', uploadStart));
  assert.match(uploadBody, /mapSerially\(opts\.sheets/,
    'the uploader bypassed the serial memory boundary');

  const capStart = GLOSSY_SRC.indexOf('async function enqueueRenderJobCapped(');
  const capBody = GLOSSY_SRC.slice(capStart, GLOSSY_SRC.indexOf('\n}', capStart) + 2);
  assert.match(capBody, /mapSerially\(opts\.sheets/,
    'AI input capping bypassed the serial memory boundary');
});

// ── Resume-attempt budget ─────────────────────────────────────────────────────
//
// Re-attaching to a FINISHED job runs the heaviest client path in the app, and when iOS kills the
// page for memory mid-finish, the reload finds the same persisted job id and re-runs it — a crash
// LOOP that ends in Safari's "A problem repeatedly occurred", the design URL bricked (Rory's
// 10 August screenshot). The budget below is what turns that into "that render didn't open".

import {
  RENDER_RESUME_ATTEMPT_LIMIT,
  clearResumeAttempts,
  recordResumeAttempt,
  resumeAttemptsExhausted,
  type ResumeAttemptStore,
} from '../lib/render-jobs.ts';

function memoryStore(seed: Record<string, string> = {}): ResumeAttemptStore & { map: Map<string, string> } {
  const map = new Map(Object.entries(seed));
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => { map.set(k, v); },
    removeItem: (k) => { map.delete(k); },
  };
}

test('resume attempts count up per site and clear back to a fresh budget', () => {
  const store = memoryStore();
  assert.equal(recordResumeAttempt(store, 'site:a'), 1);
  assert.equal(recordResumeAttempt(store, 'site:a'), 2);
  assert.equal(recordResumeAttempt(store, 'site:b'), 1, 'sites must not share a crash budget');
  clearResumeAttempts(store, 'site:a');
  assert.equal(recordResumeAttempt(store, 'site:a'), 1, 'clearing must restore the full budget');
  assert.equal(recordResumeAttempt(store, 'site:b'), 2, 'clearing one site must not touch another');
});

test('the budget allows its limit of automatic resumes and then refuses', () => {
  // The walk a crashing phone actually takes: each reload records an attempt BEFORE re-attaching
  // (a killed page records nothing after), so the pointer survives exactly LIMIT resumes.
  const store = memoryStore();
  for (let reload = 1; reload <= RENDER_RESUME_ATTEMPT_LIMIT; reload++) {
    assert.equal(resumeAttemptsExhausted(recordResumeAttempt(store, 'site:x')), false,
      `reload ${reload} is within budget and must re-attach`);
  }
  assert.equal(resumeAttemptsExhausted(recordResumeAttempt(store, 'site:x')), true,
    'the reload after the budget must NOT re-attach — this is the crash-loop breaker');
});

test('garbage or unavailable storage behaves like a first attempt, never like exhaustion', () => {
  // Refusing to resume is the drastic branch; nothing unproven may route into it.
  for (const junk of ['junk', '-3', 'NaN', '']) {
    const store = memoryStore({ 'imbewu_render_job_attempts_site:x': junk });
    assert.equal(recordResumeAttempt(store, 'site:x'), 1, `stored ${JSON.stringify(junk)} must reset, not brick`);
  }
  const broken: ResumeAttemptStore = {
    getItem: () => { throw new Error('storage unavailable'); },
    setItem: () => { throw new Error('storage unavailable'); },
    removeItem: () => { throw new Error('storage unavailable'); },
  };
  assert.equal(recordResumeAttempt(broken, 'site:x'), 1);
  assert.doesNotThrow(() => clearResumeAttempts(broken, 'site:x'));
});

test('the Studio charges the budget before re-attaching and retires it on every terminal path', () => {
  // The order is the point: recordResumeAttempt must run BEFORE setQueueJobId arms the
  // subscription, because a page killed mid-finish never reaches the code after.
  const effect = GLOSSY_SRC.slice(
    GLOSSY_SRC.indexOf('const stored = readPersistedJobId(state.siteId)'),
  );
  const charge = effect.indexOf('recordResumeAttempt(');
  const attach = effect.indexOf('setQueueJobId(stored)');
  assert.ok(charge > 0, 'the mount-resume no longer records an attempt — the crash loop is back');
  assert.ok(attach > charge, 'the attempt must be recorded BEFORE re-attaching, not after');
  // Refusal must clear the pointer AND explain — a silent refusal looks like a lost render.
  const refusal = effect.slice(0, attach);
  assert.ok(refusal.includes('resumeAttemptsExhausted('), 'the budget check is gone');
  assert.ok(refusal.includes('clearPersistedJobId(state.siteId)'),
    'an exhausted job must clear its pointer or every visit re-hits the budget message');
  assert.ok(refusal.includes("designGlossyResumeGaveUp"), 'the farmer must be told, not left guessing');
  // Both pointer helpers retire the count: a finished job and a fresh job each reset the budget.
  const persistFn = GLOSSY_SRC.slice(GLOSSY_SRC.indexOf('function persistJobId('), GLOSSY_SRC.indexOf('function readPersistedJobId('));
  const clearFn = GLOSSY_SRC.slice(GLOSSY_SRC.indexOf('function clearPersistedJobId('), GLOSSY_SRC.indexOf('const resumeAttemptChargedThisPageLoad'));
  assert.ok(persistFn.includes('clearResumeAttempts('), 'a new job must start with a full budget');
  assert.ok(clearFn.includes('clearResumeAttempts('), 'terminal paths must retire the count');
});
