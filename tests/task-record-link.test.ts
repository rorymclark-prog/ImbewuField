import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCropBoardTasks, type BoardTask } from '../lib/task-board.ts';
import {
  parseTaskHarvestQuery, parseTaskJournalQuery, taskHarvestHref, taskJournalHref,
} from '../lib/task-record-link.ts';
import { CROPS } from '../lib/crop-catalog.ts';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const task: BoardTask = {
  id: 'planting:with:colons:harvest:1', kind: 'crop', title: 'Harvest Lettuce',
  subtitle: 'Kitchen bed · Due this month', icon: '', cropKey: 'lettuce',
  action: 'harvest', bedId: 'bed-42', bedLabel: 'Kitchen bed', dueMonth: 10,
  monthsAway: 0, completed: false,
};
const query = (href: string) => new URL(href, 'https://example.test').searchParams;

test('a task opens a journal draft with the crop and structured bed rather than parsing a translated subtitle', () => {
  const href = taskJournalHref({ ...task, subtitle: 'A translated sentence with no bed reference' });
  assert.ok(href);
  assert.deepEqual(parseTaskJournalQuery(query(href)), {
    cropKey: 'lettuce', cropName: 'Lettuce', action: 'harvest', category: 'harvest',
    title: 'Harvest Lettuce', bedId: 'bed-42', bedLabel: 'Kitchen bed',
  });
  assert.deepEqual(Object.keys(Object.fromEntries(query(href))).sort(), ['action', 'bed', 'bedLabel', 'crop', 'task', 'title']);
  assert.equal(task.completed, false, 'opening a draft must not complete the planned work');
});

test('journal drafts choose a relevant category but leave dates, notes and completion to the farmer', () => {
  for (const [action, category] of [
    ['sow', 'planting'], ['transplant', 'planting'], ['prep', 'maintenance'],
    ['mulch', 'maintenance'], ['terminate-cover', 'maintenance'],
    ['weed-early', 'maintenance'], ['weed-mid', 'maintenance'], ['harvest', 'harvest'],
  ] as const) {
    const href = taskJournalHref({ ...task, action });
    assert.ok(href);
    const params = query(href);
    params.set('date', '2000-01-01');
    params.set('notes', 'Already done');
    params.set('completed', 'true');
    const draft = parseTaskJournalQuery(params);
    assert.ok(draft);
    assert.equal(draft.category, category);
    assert.ok(!('date' in draft) && !('notes' in draft) && !('completed' in draft));
  }
});

test('only an explicit known-crop task can suggest a journal draft', () => {
  const href = taskJournalHref(task)!;
  for (const [key, value] of [['task', '0'], ['crop', 'javascript:alert(1)'], ['action', 'done'], ['title', '<script>alert(1)</script>']] as const) {
    const params = query(href);
    params.set(key, value);
    assert.equal(parseTaskJournalQuery(params), null, key);
  }
  for (const key of ['task', 'crop', 'action', 'title']) {
    const params = query(href);
    params.append(key, params.get(key)!);
    assert.equal(parseTaskJournalQuery(params), null, `ambiguous ${key}`);
  }
  assert.equal(taskJournalHref({ ...task, kind: 'lesson' }), null);
  assert.equal(taskJournalHref({ ...task, cropKey: 'unreviewed-crop' }), null);
});

test('long draft copy is bounded without truncating a bed id into another reference', () => {
  const href = taskJournalHref({ ...task, title: 'T'.repeat(200), bedLabel: 'B'.repeat(100) });
  assert.ok(href);
  const draft = parseTaskJournalQuery(query(href));
  assert.equal(draft?.title.length, 120);
  assert.equal(draft?.bedLabel?.length, 60);
  const badBed = taskJournalHref({ ...task, bedId: 'b'.repeat(100) });
  assert.ok(badBed);
  assert.equal(parseTaskJournalQuery(query(badBed))?.bedId, undefined);
  assert.equal(parseTaskJournalQuery(query(badBed))?.bedLabel, undefined);
});

test('harvest opens the real Picked tab with a reviewed crop and no forecast quantity', () => {
  const href = taskHarvestHref(task);
  assert.ok(href);
  assert.equal(new URL(href, 'https://example.test').pathname, '/records');
  assert.equal(query(href).get('tab'), 'picked');
  assert.deepEqual(parseTaskHarvestQuery(query(href)), { cropKey: 'lettuce', cropName: 'Lettuce' });
  const malicious = query(href);
  malicious.set('quantity', '999');
  malicious.set('kg', '999');
  malicious.set('save', 'true');
  assert.deepEqual(parseTaskHarvestQuery(malicious), { cropKey: 'lettuce', cropName: 'Lettuce' });
  assert.deepEqual([...query(href).keys()].sort(), ['crop', 'tab']);
  assert.equal(taskHarvestHref({ ...task, action: 'sow' }), null);
  assert.equal(taskHarvestHref({ ...task, kind: 'survey' }), null);
});

test('unknown crops, duplicate crop parameters and non-food cover crops never prefill a harvest', () => {
  assert.equal(parseTaskHarvestQuery(new URLSearchParams('tab=picked&crop=unknown')), null);
  assert.equal(parseTaskHarvestQuery(new URLSearchParams('tab=sold&crop=lettuce')), null);
  assert.equal(parseTaskHarvestQuery(new URLSearchParams('tab=picked&crop=lettuce&crop=tomatoes')), null);
  const covers = CROPS.filter(crop => crop.yieldKgPerM2 === 0);
  assert.ok(covers.length > 0);
  for (const cover of covers) assert.equal(taskHarvestHref({ ...task, cropKey: cover.key }), null);
});

test('crop tasks carry the actual planting bed even when planting ids have colons', () => {
  const tasks = buildCropBoardTasks([
    { id: 'planting:with:colons', bedId: 'bed-42', cropKey: 'lettuce', sowMonth: 10 },
  ], [{ id: 'bed-42', label: 'Kitchen bed', areaM2: 4 }], 10, new Set());
  assert.ok(tasks.length > 0);
  assert.ok(tasks.every(task => task.bedId === 'bed-42' && task.bedLabel === 'Kitchen bed'));
});

test('the harvest form consumes a task once, preserving other query state and leaving quantity blank', () => {
  const source = readFileSync(new URL('../components/MyRecords.tsx', import.meta.url), 'utf8');
  const tree = ts.createSourceFile('MyRecords.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const form = tree.statements.find((statement): statement is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(statement) && statement.name?.text === 'LogProductionForm');
  assert.ok(form);
  let effect: ts.ArrowFunction | undefined;
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && node.expression.getText(tree) === 'useEffect') {
      const callback = node.arguments[0];
      if (callback && ts.isArrowFunction(callback) && callback.getText(tree).includes('parseTaskHarvestQuery')) effect = callback;
    }
    ts.forEachChild(node, visit);
  }
  visit(form);
  assert.ok(effect, 'exercise the real form handoff effect rather than a copy of its URL logic');
  const code = ts.transpileModule(`return (${effect.getText(tree)})();`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  let href = 'https://example.test/records?tab=picked&crop=lettuce&keep=value#picked';
  let state: { crop: string; cropKey: string | null; quantity: string } = { crop: '', cropKey: null, quantity: '' };
  const browser = {
    location: { get href() { return href; } },
  };
  const navigations: { url: string; options: { scroll: boolean } }[] = [];
  const router = { replace(url: string, options: { scroll: boolean }) {
    navigations.push({ url, options });
    href = new URL(url, href).href;
  } };
  const run = new Function('window', 'setForm', 'parseTaskHarvestQuery', 'router', code);
  const update = (updater: (current: typeof state) => typeof state) => { state = updater(state); };
  run(browser, update, parseTaskHarvestQuery, router);
  assert.deepEqual(state, { crop: 'Lettuce', cropKey: 'lettuce', quantity: '' });
  assert.equal(href, 'https://example.test/records?tab=picked&keep=value#picked');
  assert.deepEqual(navigations, [{ url: '/records?tab=picked&keep=value#picked', options: { scroll: false } }],
    'Next must consume the canonical navigation URL too, so HMR and remounts cannot restore the crop');
  state = { crop: 'Tomatoes', cropKey: 'tomatoes', quantity: '4' };
  run(browser, update, parseTaskHarvestQuery, router);
  assert.deepEqual(state, { crop: 'Tomatoes', cropKey: 'tomatoes', quantity: '4' }, 'effect replay cannot replace the next crop or its entered quantity');
  assert.equal(navigations.length, 1);
});
