import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  MAX_COMPOSITE_BYTES,
  MAX_SHEETS_PER_JOB,
  RenderJobError,
  dataUrlBytes,
  enqueueRenderJob,
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

test('decoded data URL size handles base64 padding exactly and enforces the upload cap', () => {
  assert.equal(dataUrlBytes('data:image/png;base64,TQ=='), 1);
  assert.equal(dataUrlBytes('data:image/png;base64,TWE='), 2);
  assert.equal(dataUrlBytes('data:image/png;base64,TWFu'), 3);

  const allowedPayload = 'A'.repeat(Math.floor(MAX_COMPOSITE_BYTES * 4 / 3));
  const tooLargePayload = `${allowedPayload}AAAA`;
  assert.ok(dataUrlBytes(`data:image/png;base64,${allowedPayload}`) <= MAX_COMPOSITE_BYTES);
  assert.ok(dataUrlBytes(`data:image/png;base64,${tooLargePayload}`) > MAX_COMPOSITE_BYTES);
  assert.equal(renderJobRequestError([sheet('water', {
    compositeDataUrl: `data:image/png;base64,${allowedPayload}`,
  })]), null);
  assert.match(renderJobRequestError([sheet('water', {
    compositeDataUrl: `data:image/png;base64,${tooLargePayload}`,
  })]) ?? '', /too large/);
});

test('malformed images and conflicting rendering authorities fail before any job exists', () => {
  assert.match(renderJobRequestError([sheet('water', { compositeDataUrl: 'not an image' })]) ?? '', /valid image/);
  assert.match(renderJobRequestError([sheet('water', { protectMaskDataUrl: 'not a mask' })]) ?? '', /invalid protection mask/);
  assert.match(renderJobRequestError([sheet('water', {
    showcase: true,
    geometryLock: true,
  })]) ?? '', /incompatible render modes/);
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
