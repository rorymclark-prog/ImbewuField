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
  type RenderSheetSpec,
} from '../lib/render-jobs.ts';
import {
  MAX_RENDER_SHEETS_PER_JOB as CLIENT_MAX,
  RENDER_SHEET_KEYS as CLIENT_KEYS,
} from '../lib/render-job-contract.ts';
import {
  MAX_RENDER_SHEETS_PER_JOB as WORKER_MAX,
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
