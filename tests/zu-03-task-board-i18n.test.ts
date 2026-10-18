import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import type { PlanBed, Planting } from '../lib/crop-plan.ts';
import { buildCropBoardTasks } from '../lib/task-board.ts';
import { produceLabel } from '../lib/produce-label.ts';

// zu-03 (wave 14): lib/task-board.ts already took a BoardTranslate function so 'Prep bed for…',
// 'Sow…', 'Harvest…' and 'Due this month' COULD render in isiZulu, but nothing passed one in —
// app/home/page.tsx called loadCropBoardTasks() with no translator, so the task list stayed
// English even when the rest of Home was isiZulu. This checks the plumbing end to end: a crop
// name resolves to its isiZulu common name (produceLabel), AND a translator passed through
// buildCropBoardTasks/boardTaskTitle actually receives that isiZulu name, not the raw English one.

const beds: PlanBed[] = [{ id: 'bed-1', label: 'Bed 1', areaM2: 10, minDimM: 1 }];
function planting(overrides: Partial<Planting> = {}): Planting {
  return { id: 'planting-1', bedId: 'bed-1', cropKey: 'lettuce', sowMonth: 1, ...overrides };
}

test('produceLabel gives isiZulu common names for known crops and falls back to English otherwise', () => {
  assert.equal(produceLabel('lettuce', 'zu'), 'Ulethisi');
  assert.equal(produceLabel('sweet-potato', 'zu'), 'Ubhatata');
  assert.equal(produceLabel('lettuce', 'en'), 'Lettuce');
  // A crop with no isiZulu entry falls back to the English catalog name, not a guess.
  assert.equal(produceLabel('oats', 'zu'), produceLabel('oats', 'en'));
  // An unknown key degrades to a readable sentence-cased version of itself rather than throwing.
  assert.equal(produceLabel('not-a-real-crop', 'en'), 'Not a real crop');
});

test('a translator passed through buildCropBoardTasks receives the isiZulu crop name, not the English one', () => {
  const seen: Array<{ key: string; crop?: string }> = [];
  const zuTranslate = (key: string, vars?: Record<string, string>) => {
    seen.push({ key, crop: vars?.crop });
    return vars?.crop ? `${key}:${vars.crop}` : key;
  };
  const tasks = buildCropBoardTasks([planting()], beds, 12, new Set(), zuTranslate, 'zu');
  assert.ok(tasks.length > 0, 'expected at least one task for a lettuce planting');
  assert.ok(seen.some((call) => call.crop === 'Ulethisi'), 'the crop placeholder must carry the isiZulu name when lang is zu');
  assert.ok(!seen.some((call) => call.crop === 'Lettuce'), 'the English name must not leak through once a zu translator is supplied');
});

test('buildCropBoardTasks defaults to English when no lang is given, unchanged from before this wave', () => {
  const seen: string[] = [];
  const translate = (key: string, vars?: Record<string, string>) => {
    if (vars?.crop) seen.push(vars.crop);
    return key;
  };
  buildCropBoardTasks([planting()], beds, 12, new Set(), translate);
  assert.ok(seen.includes('Lettuce'), 'omitting lang must keep the pre-existing English behaviour');
});

test('app/home/page.tsx builds a BoardTranslate from the live language and re-renders when it changes', () => {
  const home = readFileSync(new URL('../app/home/page.tsx', import.meta.url), 'utf8');
  assert.match(home, /const boardTranslate: BoardTranslate = \(key, vars\) => \{/, 'Home must build a real translator instead of relying on the English-only default');
  assert.match(home, /loadCropBoardTasks\(loadCompletedTaskIds\(\), boardTranslate, lang\)/, 'the task board must be loaded with both the translator and the current language');
  assert.match(home, /\}, \[lang\]\);/, 'the task-board effect must re-run when the farmer switches language, not only once on mount');
});
