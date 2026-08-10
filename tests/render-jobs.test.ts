import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  MAX_COMPOSITE_BYTES,
  MAX_SHEETS_PER_JOB,
  RenderJobError,
  dataUrlBytes,
  enqueueRenderJob,
  maskHasProtectedAndEditablePixels,
  normaliseRenderJobDoc,
  renderJobRequestError,
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

test('a failed parallel upload waits for slower siblings before taking the rollback list', () => {
  const source = readFileSync(new URL('../lib/render-jobs.ts', import.meta.url), 'utf8');
  const settle = source.indexOf('await Promise.allSettled(uploadTasks)');
  const rollback = source.indexOf('uploaded.map((p) => deleteObject', settle);
  assert.ok(settle >= 0);
  assert.ok(rollback > settle);
  assert.doesNotMatch(source, /sheets\s*=\s*await Promise\.all\(\s*opts\.sheets\.map/);
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
