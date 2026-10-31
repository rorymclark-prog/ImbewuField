import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { create, act, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import { farmMemoryText } from '../lib/farm-memory-copy.ts';
import { taskJournalHref, taskHarvestHref } from '../lib/task-record-link.ts';
import type { BoardTask } from '../lib/task-board.ts';
import { inlineText, inlineTemplate, isInlineDraftLang } from '../lib/xh-inline.ts';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../app/cropplan/page.tsx', import.meta.url), 'utf8');
const tree = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const taskList = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'TaskList');
assert.ok(taskList, 'exercise the real planner controls rather than copies of their labels');
const helperNames = new Set(['ACTION_DRAFT_VERB', 'ACTION_SOURCE_VERB', 'taskTitleDraft', 'taskSubtitleDraft', 'ACTION_XH_VERB', 'taskTitleXh', 'taskSubtitleXh']);
const helpers = tree.statements.filter(node =>
  (ts.isFunctionDeclaration(node) && helperNames.has(node.name?.text ?? '')) ||
  (ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => helperNames.has(declaration.name.getText(tree)))),
).map(node => node.getText(tree));
const code = ts.transpileModule([...helpers, taskList.getText(tree)].join('\n'), { compilerOptions: {
  jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
} }).outputText;
const Icon = () => null;
const TaskList = new Function('require', 'exports', 'workspace', 'actionMeta', 'taskJournalHref', 'taskHarvestHref', 'farmMemoryText', 'inlineText', 'inlineTemplate', 'isInlineDraftLang', 'IsiZuluDraftSource', 'Link', 'CheckCircle2', 'Circle', 'ClipboardList', 'Scissors', `${code}; return TaskList;`)(
  require, {}, { cards: 'cards' }, () => ({ Icon, color: '#123456' }), taskJournalHref, taskHarvestHref,
  farmMemoryText, inlineText, inlineTemplate, isInlineDraftLang, ({ english }: { english: string }) => React.createElement('span', null, english),
  ({ children, ...props }: any) => React.createElement('a', props, children), Icon, Icon, Icon, Icon,
) as React.ComponentType<any>;

const task: BoardTask = {
  id: 'crop:harvest', kind: 'crop', title: 'Original task title', subtitle: 'Original bed label',
  icon: '', cropKey: 'lettuce', action: 'harvest', bedId: 'bed-42', bedLabel: 'River bed',
  dueMonth: 10, monthsAway: 0, completed: false,
};

for (const lang of ['en', 'zu']) test(`${lang} task links translate controls while retaining original task context and safe destinations`, async () => {
  let renderer!: ReactTestRenderer;
  const toggles: string[] = [];
  await act(async () => { renderer = create(React.createElement(TaskList, {
    tasks: [task], lang, onToggle: (id: string) => toggles.push(id), emptyMessage: '', doneLabel: 'Done', notDoneLabel: 'Not done',
  })); });
  try {
    const links = renderer.root.findAllByType('a');
    assert.equal(links[0].children.at(-1), farmMemoryText(lang, 'writeFieldNote'));
    assert.equal(links[1].children.at(-1), farmMemoryText(lang, 'logPicked'));
    assert.equal(links[0].props['aria-label'], farmMemoryText(lang, 'writeFieldNoteAria', { title: task.title }));
    assert.equal(links[1].props['aria-label'], farmMemoryText(lang, 'logPickedAria', { title: task.title }));
    assert.equal(links[0].props.href, taskJournalHref(task));
    assert.equal(links[1].props.href, taskHarvestHref(task));
    assert.ok(renderer.root.findAllByProps({ lang }).length > 0);
    assert.deepEqual(toggles, [], 'showing links must not claim any work has been completed');
    await act(async () => renderer.root.findByType('button').props.onClick());
    assert.deepEqual(toggles, [task.id], 'the explicit completion control stays independent');
  } finally { await act(async () => renderer.unmount()); }
});
