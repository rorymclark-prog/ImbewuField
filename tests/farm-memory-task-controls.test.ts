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
import { inlineDraft, inlineText, inlineTemplate, isInlineDraftLang, registerInlineDrafts, registerXhInline } from '../lib/xh-inline.ts';
import { XH_INLINE_SOURCE } from '../lib/locales/xh-inline/index.ts';
import { AF_INLINE_SOURCE } from '../lib/locales/af-inline/index.ts';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../app/cropplan/page.tsx', import.meta.url), 'utf8');
const tree = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const taskList = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'TaskList');
assert.ok(taskList, 'exercise the real planner controls rather than copies of their labels');
const helperNames = new Set(['ACTION_DRAFT_VERB', 'ACTION_SOURCE_VERB', 'taskTitleDraft', 'taskSubtitleDraft', 'ACTION_XH_VERB', 'ACTION_AF_VERB', 'taskTitleXh', 'taskSubtitleXh']);
const helpers = tree.statements.filter(node =>
  (ts.isFunctionDeclaration(node) && helperNames.has(node.name?.text ?? '')) ||
  (ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => helperNames.has(declaration.name.getText(tree)))),
).map(node => node.getText(tree));
const code = ts.transpileModule([...helpers, taskList.getText(tree)].join('\n'), { compilerOptions: {
  jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
} }).outputText;
const Icon = () => null;
const buildTaskList = (IsiZuluDraftSource: React.ComponentType<any>) => new Function('require', 'exports', 'workspace', 'actionMeta', 'taskJournalHref', 'taskHarvestHref', 'farmMemoryText', 'inlineText', 'inlineTemplate', 'isInlineDraftLang', 'IsiZuluDraftSource', 'Link', 'CheckCircle2', 'Circle', 'ClipboardList', 'Scissors', `${code}; return TaskList;`)(
  require, {}, { cards: 'cards' }, () => ({ Icon, color: '#123456' }), taskJournalHref, taskHarvestHref,
  farmMemoryText, inlineText, inlineTemplate, isInlineDraftLang, IsiZuluDraftSource,
  ({ children, ...props }: any) => React.createElement('a', props, children), Icon, Icon, Icon, Icon,
) as React.ComponentType<any>;
const TaskList = buildTaskList(({ english }: { english: string }) => React.createElement('span', null, english));

const task: BoardTask = {
  id: 'crop:harvest', kind: 'crop', title: 'Original task title', subtitle: 'Original bed label',
  icon: '', cropKey: 'lettuce', action: 'harvest', bedId: 'bed-42', bedLabel: 'River bed',
  dueMonth: 10, monthsAway: 0, completed: false,
};

for (const lang of ['en', 'zu', 'xh']) test(`${lang} task links translate controls while retaining original task context and safe destinations`, async () => {
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

test('isiXhosa task links read the Farm memory drafts, the task lines carry isiXhosa verbs, and no line repeats the draft label', async () => {
  registerXhInline(XH_INLINE_SOURCE);
  const seen: Array<Record<string, unknown>> = [];
  const Capture = (props: Record<string, unknown>) => { seen.push(props); return React.createElement('span', null, String(props.english)); };
  const List = buildTaskList(Capture as unknown as React.ComponentType<any>);
  const generated: BoardTask[] = [
    { ...task, id: 'crop:harvest-onions', title: 'Harvest Onions', subtitle: 'Bed 1 · Due this month', action: 'harvest' },
    { ...task, id: 'crop:prep-butternut', title: 'Prep bed for Butternut', subtitle: 'Bed 2 · Due next month', action: 'prep' },
    { ...task, id: 'crop:transplant-tomatoes', title: 'Transplant Tomatoes', subtitle: 'Bed 3 · Due in 3 months', action: 'transplant' },
  ];
  let renderer!: ReactTestRenderer;
  try {
    await act(async () => { renderer = create(React.createElement(List, { tasks: generated, lang: 'xh', onToggle: () => {}, emptyMessage: '', doneLabel: 'Done', notDoneLabel: 'Not done' })); });
    const links = renderer.root.findAllByType('a');
    assert.equal(links[0].children.at(-1), 'Bhala inqaku lasentsimini');
    assert.equal(links[1].children.at(-1), 'Rekhoda oko ukuvuneyo');
    assert.equal(renderer.root.findAllByProps({ lang: 'xh' }).length > 0, true, 'the link group is marked as isiXhosa');
    const byEnglish = new Map(seen.map(props => [props.english, props]));
    assert.equal(byEnglish.get('Harvest Onions')!.xhosa, 'Vuna Amatswele');
    assert.equal(byEnglish.get('Prep bed for Butternut')!.xhosa, 'Lungisa umbhede: Butternut', 'a crop with no recorded draft keeps its name as recorded');
    assert.equal(byEnglish.get('Transplant Tomatoes')!.xhosa, 'Tyala izithole: Iitumato');
    assert.match(String(byEnglish.get('Bed 3 · Due in 3 months')!.xhosa), /^Bed 3 · /);
    // The page-level note says "unreviewed drafts with English sources" once; the per-line label is not repeated.
    assert.ok(seen.length >= 6);
    for (const props of seen) assert.equal(props.draftLabel, false, 'no per-row draft label for isiXhosa');
  } finally { registerXhInline({}); await act(async () => renderer?.unmount()); }
  const zulu = create(React.createElement(buildTaskList(Capture as unknown as React.ComponentType<any>), { tasks: [task], lang: 'zu', onToggle: () => {}, emptyMessage: '', doneLabel: 'Done', notDoneLabel: 'Not done' }));
  const zuluProps = seen.slice(-2);
  for (const props of zuluProps) assert.equal(props.draftLabel, true, 'isiZulu keeps its per-row label');
  zulu.unmount();
});

test('the planner month heading is not paired with an identical English month, and the page shows the isiXhosa note once', () => {
  assert.match(source, /draft === english \? english : `\$\{draft\} \/ \$\{english\}`/, 'a draft equal to the English month is shown once');
  assert.equal((source.match(/Unreviewed isiXhosa drafts with English sources; some farming instructions remain in English for review\./g) ?? []).length, 2, 'one page-level note: its draft key and its English source line');
  assert.match(source, /draftLabel=\{!isInlineDraftLang\(lang\)\}/, 'the per-row isiXhosa and Afrikaans label is switched off');
  assert.equal((source.match(/Unreviewed Afrikaans drafts with English sources; some farming instructions remain in English for review\./g) ?? []).length, 2, 'Afrikaans has the same single page-level note: its draft key and its English source line');
});

test('IsiZuluDraftSource drops only the isiXhosa draft label on request and always keeps the English source line', async () => {
  registerXhInline(XH_INLINE_SOURCE);
  const draftSource = ts.transpileModule(readFileSync(new URL('../components/IsiZuluDraftSource.tsx', import.meta.url), 'utf8'), { compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  const mod = { exports: {} as any };
  new Function('require', 'module', 'exports', draftSource)((name: string) => {
    if (name === '@/lib/records-regional-drafts') return { isRecordsRegionalLang: () => false, recordsDraft: () => null, recordsTemplate: (_l: string, e: string) => e };
    if (name === '@/lib/xh-inline') return { fillInline: (t: string) => t, inlineText, isInlineDraftLang, inlineDraft: (l: string, e: string) => (l === 'xh' && e === 'Due this month' ? 'Kumele kwenziwe kule nyanga' : l === 'af' && e === 'Due this month' ? 'Hierdie maand te doen' : null) };
    return require(name);
  }, mod, mod.exports);
  const Source = mod.exports.default as React.ComponentType<any>;
  const text = (props: Record<string, unknown>) => {
    const r = create(React.createElement(Source, { lang: 'xh', english: 'Due this month', zulu: '', ...props }));
    const out = JSON.stringify(r.toJSON());
    r.unmount();
    return out;
  };
  try {
    assert.match(text({}), /Unreviewed isiXhosa draft\.|Idrafti yesiXhosa engekahlolwa\./, 'the label shows by default');
    const quiet = text({ draftLabel: false });
    assert.doesNotMatch(quiet, /Idrafti yesiXhosa|Unreviewed isiXhosa draft/);
    assert.match(quiet, /Kumele kwenziwe kule nyanga/);
    assert.match(quiet, /English source: /);
    assert.match(quiet, /Due this month/);
    // Afrikaans follows the same rule: the label shows by default and is dropped on request, the English source stays.
    assert.match(text({ lang: 'af' }), /Unreviewed Afrikaans draft\.|Ongetoetste Afrikaanse konsep\./, 'the Afrikaans label shows by default');
    const afQuiet = text({ lang: 'af', draftLabel: false });
    assert.doesNotMatch(afQuiet, /Unreviewed Afrikaans draft|Ongetoetste Afrikaanse konsep/);
    assert.match(afQuiet, /Hierdie maand te doen/);
    assert.match(afQuiet, /English source: /);
    assert.match(afQuiet, /Due this month/);
  } finally { registerXhInline({}); }
});

test('Afrikaans task links read the Farm memory drafts, the task lines carry Afrikaans verbs and crop names, and no line repeats the draft label', async () => {
  registerInlineDrafts('af', AF_INLINE_SOURCE);
  const seen: Array<Record<string, unknown>> = [];
  const Capture = (props: Record<string, unknown>) => { seen.push(props); return React.createElement('span', null, String(props.english)); };
  const List = buildTaskList(Capture as unknown as React.ComponentType<any>);
  const generated: BoardTask[] = [
    { ...task, id: 'crop:harvest-onions', title: 'Harvest Onions', subtitle: 'Bed 1 · Due this month', action: 'harvest' },
    { ...task, id: 'crop:prep-butternut', title: 'Prep bed for Butternut', subtitle: 'Bed 2 · Due next month', action: 'prep' },
    { ...task, id: 'crop:transplant-tomatoes', title: 'Transplant Tomatoes', subtitle: 'Bed 3 · Due in 3 months', action: 'transplant' },
  ];
  let renderer!: ReactTestRenderer;
  try {
    await act(async () => { renderer = create(React.createElement(List, { tasks: generated, lang: 'af', onToggle: () => {}, emptyMessage: '', doneLabel: 'Done', notDoneLabel: 'Not done' })); });
    const links = renderer.root.findAllByType('a');
    assert.equal(links[0].children.at(-1), farmMemoryText('af', 'writeFieldNote'));
    assert.equal(links[0].children.at(-1), "Skryf 'n veldnota");
    assert.equal(links[1].children.at(-1), 'Teken aan wat jy gepluk het');
    assert.equal(renderer.root.findAllByProps({ lang: 'af' }).length > 0, true, 'the link group is marked as Afrikaans');
    const byEnglish = new Map(seen.map(props => [props.english, props]));
    assert.equal(byEnglish.get('Harvest Onions')!.xhosa, 'Oes Uie');
    assert.equal(byEnglish.get('Prep bed for Butternut')!.xhosa, 'Berei bedding voor vir Butternut', 'a crop with no recorded draft keeps its name as recorded');
    assert.equal(byEnglish.get('Transplant Tomatoes')!.xhosa, 'Verplant Tamaties');
    assert.equal(byEnglish.get('Bed 1 · Due this month')!.xhosa, 'Bed 1 · Hierdie maand te doen');
    assert.equal(byEnglish.get('Bed 3 · Due in 3 months')!.xhosa, 'Bed 3 · Oor 3 maande te doen');
    // The page-level note says "unreviewed drafts with English sources" once; the per-line label is not repeated.
    assert.ok(seen.length >= 6);
    for (const props of seen) assert.equal(props.draftLabel, false, 'no per-row draft label for Afrikaans');
  } finally { registerInlineDrafts('af', {}); await act(async () => renderer?.unmount()); }
  // Until the Afrikaans chunk loads the lookups are English.
  assert.equal(inlineDraft('af', 'Harvest'), null);
});
