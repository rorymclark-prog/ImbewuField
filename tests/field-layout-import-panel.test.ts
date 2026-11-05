import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test, { after } from 'node:test';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import type { FieldImportPanelReview, FieldImportPanelResult, FieldLayoutImportPanelProps } from '../components/design/FieldLayoutImportPanel.tsx';

const panelUrl = new URL('../components/design/FieldLayoutImportPanel.tsx', import.meta.url).href;
const hooks = registerHooks({ load(url, context, next) {
  if (url === panelUrl) return { format: 'module', shortCircuit: true,
    source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX,
    } }).outputText };
  return next(url, context);
} });
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const { default: Panel } = await import('../components/design/FieldLayoutImportPanel.tsx');
after(() => hooks.deregister());
const text = (node: ReactTestInstance | string): string => typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join('');
function review(): FieldImportPanelReview {
  return { status: 'review', excludedPlacemarkCount: 2, candidates: [
    { id: 'outer', name: '<North & field>', status: 'ready', points: [[.1,.1],[.8,.1],[.8,.8],[.1,.8]], conflictingCandidateIds: ['inner'] },
    { id: 'inner', name: 'Inner outline', status: 'ready', points: [[.2,.2],[.3,.2],[.3,.3],[.2,.3]], conflictingCandidateIds: ['outer'] },
    { id: 'held', name: 'Held outline', status: 'held', points: [[.7,.7],[.9,.7],[.9,.9]], reasons: ['This outline crosses an existing field.'] },
  ] };
}
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject };
}
type AppendResult = Awaited<ReturnType<FieldLayoutImportPanelProps['onAppend']>>;
function mount(overrides: Partial<FieldLayoutImportPanelProps> = {}) {
  const original = review();
  const reads: Array<{ file: File; current: () => boolean }> = [];
  const appends: Array<{ review: FieldImportPanelReview; ids: readonly string[]; current: () => boolean }> = [];
  const discards: FieldImportPanelReview[] = [];
  let readHandler: FieldLayoutImportPanelProps['onRead'] = async () => original;
  let appendHandler: FieldLayoutImportPanelProps['onAppend'] = async () => ({ status: 'applied', message: 'Selected outlines added.' });
  const props: FieldLayoutImportPanelProps = { contextKey: 'saved-source-a', sample: false,
    onRead: async (file, current) => { reads.push({ file, current }); return readHandler(file, current); },
    onAppend: async (value, ids, current) => { appends.push({ review: value, ids, current }); return appendHandler(value, ids, current); },
    onDiscard(value) { discards.push(value); }, ...overrides };
  let renderer!: ReactTestRenderer, disposed = false;
  act(() => { renderer = create(React.createElement(Panel, props)); });
  const field = (label: string) => renderer.root.findByProps({ 'aria-label': label });
  const button = (label: string) => {
    const node = renderer.root.findAllByType('button').find(node => text(node) === label);
    assert.ok(node, `Missing action: ${label}`); return node;
  };
  return { renderer, reads, appends, discards, original, props, field, button,
    text: () => text(renderer.root),
    setRead(handler: typeof readHandler) { readHandler = handler; },
    setAppend(handler: typeof appendHandler) { appendHandler = handler; },
    file(value: File | null) { act(() => field('Local KML file').props.onChange({ target: { files: value ? [value] : [] } })); },
    select(index: number, value = true) { act(() => field(`Select outline ${index}`).props.onChange({ target: { checked: value } })); },
    confirm(value = true) { act(() => field('Confirm selected outlines').props.onChange({ target: { checked: value } })); },
    async read() { await act(async () => { await button('Preview outlines').props.onClick(); }); },
    async append() { await act(async () => { await button('Add selected outlines').props.onClick(); }); },
    cancel() { act(() => button('Cancel import').props.onClick()); },
    update(next: Partial<FieldLayoutImportPanelProps>) { Object.assign(props, next); act(() => renderer.update(React.createElement(Panel, props))); },
    dispose() { if (!disposed) { disposed = true; act(() => renderer.unmount()); } },
  };
}
const localFile = () => new File(['synthetic local input'], 'field.kml', { type: 'application/vnd.google-earth.kml+xml' });
async function ready(ui: ReturnType<typeof mount>) { ui.file(localFile()); await ui.read(); }

test('choosing a local file does not read or save it; preview keeps the exact parent review and starts with no selections', async () => {
  const ui = mount(), file = localFile(), before = JSON.stringify(ui.original); let textReads = 0;
  Object.defineProperty(file, 'text', { value: () => { textReads++; throw Error('Reading belongs to the parent'); } });
  try {
    assert.match(ui.field('Local KML file').props.accept, /\.kml/);
    ui.file(file); assert.equal(ui.reads.length, 0); assert.equal(ui.appends.length, 0);
    await ui.read(); assert.equal(ui.reads[0].file, file); assert.equal(textReads, 0);
    assert.equal(ui.reads[0].current(), true, 'read completion must not revoke the later append form proof');
    assert.equal(ui.field('Select outline 1').props.checked, false);
    assert.equal(ui.field('Select outline 2').props.checked, false);
    assert.equal(ui.field('Select outline 3').props.disabled, true);
    assert.equal(ui.field('Confirm selected outlines').props.checked, false);
    assert.equal(ui.button('Add selected outlines').props.disabled, true);
    assert.match(ui.text(), /Excluded placemarks: 2/); assert.match(ui.text(), /crosses an existing field/);
    assert.match(ui.text(), /Nested or overlapping/); assert.match(ui.text(), /<North & field>/);
    assert.equal(ui.renderer.root.findAllByType('polygon').length, 3);
    assert.equal(ui.renderer.root.findAllByType('polygon')[0].props.points, '10,10 80,10 80,80 10,80');
    assert.equal(JSON.stringify(ui.original), before); assert.equal(ui.appends.length, 0);
  } finally { ui.dispose(); }
});

test('only an explicit confirmed non-conflicting selection appends, and a completed review cannot be replayed', async () => {
  const ui = mount(); try {
    await ready(ui); await ui.append(); assert.equal(ui.appends.length, 0);
    ui.select(3); assert.equal(ui.field('Select outline 3').props.checked, false);
    ui.select(1); ui.select(2); ui.confirm();
    assert.equal(ui.button('Add selected outlines').props.disabled, true);
    assert.match(ui.text(), /Selected outlines overlap/); await ui.append(); assert.equal(ui.appends.length, 0);
    ui.select(2, false); assert.equal(ui.field('Confirm selected outlines').props.checked, false);
    assert.equal(ui.renderer.root.findAllByType('polygon')[0].props.strokeWidth, 1);
    ui.confirm(); const old = ui.button('Add selected outlines').props.onClick;
    await ui.append(); assert.equal(ui.appends.length, 1); assert.equal(ui.appends[0].review, ui.original);
    assert.deepEqual(ui.appends[0].ids, ['outer']); assert.equal(Object.isFrozen(ui.appends[0].ids), true);
    assert.match(ui.text(), /Selected outlines added/); assert.equal(ui.renderer.root.findAllByType('polygon').length, 0);
    await act(async () => { await old(); }); assert.equal(ui.appends.length, 1);
    assert.equal(ui.reads[0].current(), false);
    assert.equal(ui.discards.length, 0, 'The parent can still replay its queued append updater before changed source props arrive');
    ui.update({ contextKey: 'saved-after-append' }); assert.deepEqual(ui.discards, [ui.original]);
    ui.dispose(); assert.equal(ui.discards.length, 1);
  } finally { ui.dispose(); }
});

test('read locks prevent duplicate requests and held or failed reads never reveal a candidate or private exception', async () => {
  const gate = deferred<FieldImportPanelResult>(), ui = mount(); let completion!: Promise<void>;
  try {
    ui.file(localFile()); ui.setRead(() => gate.promise);
    const action = ui.button('Preview outlines').props.onClick;
    act(() => { completion = action(); }); act(() => { void action(); }); assert.equal(ui.reads.length, 1);
    assert.equal(ui.button('Preview outlines').props.disabled, true); assert.match(ui.text(), /Reading outlines/);
    await act(async () => { gate.reject(Error('private local contents')); await completion; });
    assert.match(ui.text(), /Could not read this KML/); assert.doesNotMatch(ui.text(), /private local contents/);
    ui.setRead(async () => ({ status: 'held', message: 'Check the current saved map first.' })); await ui.read();
    assert.match(ui.text(), /Check the current saved map first/); assert.equal(ui.renderer.root.findAllByType('polygon').length, 0);
    assert.equal(ui.appends.length, 0);
  } finally { ui.dispose(); }
});

test('an old append button cannot borrow a newer selection or bypass its newly introduced conflict', async () => {
  const ui = mount(); try {
    await ready(ui); ui.select(1); ui.confirm();
    const old = ui.button('Add selected outlines').props.onClick;
    ui.select(2); ui.confirm();
    await act(async () => { await old(); }); assert.equal(ui.appends.length, 0);
    ui.select(1, false); ui.confirm();
    await act(async () => { await old(); }); assert.equal(ui.appends.length, 0);
    await ui.append(); assert.deepEqual(ui.appends[0].ids, ['inner']);
  } finally { ui.dispose(); }
});

for (const transition of ['cancel', 'file', 'context', 'sample', 'unmount'] as const) {
  test(`a pending read is withdrawn permanently by ${transition}, including return to the original context`, async () => {
    const gate = deferred<FieldImportPanelResult>(), ui = mount(), file = localFile(); let completion!: Promise<void>;
    try {
      ui.file(file); ui.setRead(() => gate.promise);
      act(() => { completion = ui.button('Preview outlines').props.onClick(); }); assert.equal(ui.reads[0].current(), true);
      if (transition === 'cancel') ui.cancel();
      if (transition === 'file') { ui.file(localFile()); ui.file(file); }
      if (transition === 'context') { ui.update({ contextKey: 'source-b' }); ui.update({ contextKey: 'saved-source-a' }); }
      if (transition === 'sample') { ui.update({ sample: true }); ui.update({ sample: false }); }
      if (transition === 'unmount') ui.dispose();
      assert.equal(ui.reads[0].current(), false);
      await act(async () => { gate.resolve(ui.original); await completion; });
      assert.deepEqual(ui.discards, [ui.original], 'Even an obsolete late review releases its original parent proof once');
      if (transition !== 'unmount') {
        assert.equal(ui.renderer.root.findAllByType('polygon').length, 0);
        assert.doesNotMatch(ui.text(), /Reading outlines/);
      }
      assert.equal(ui.appends.length, 0);
    } finally { ui.dispose(); }
  });
}

for (const transition of ['cancel', 'file', 'context', 'sample', 'unmount'] as const) {
  test(`a pending append guard withdraws on ${transition} and cannot show a late success`, async () => {
    const gate = deferred<AppendResult>(), ui = mount(); let completion!: Promise<void>;
    try {
      await ready(ui); ui.select(1); ui.confirm(); ui.setAppend(() => gate.promise);
      const action = ui.button('Add selected outlines').props.onClick;
      act(() => { completion = action(); }); act(() => { void action(); }); assert.equal(ui.appends.length, 1);
      assert.equal(ui.appends[0].current(), true); assert.equal(ui.button('Add selected outlines').props.disabled, true);
      if (transition === 'cancel') ui.cancel();
      if (transition === 'file') ui.file(localFile());
      if (transition === 'context') { ui.update({ contextKey: null }); ui.update({ contextKey: 'saved-source-a' }); }
      if (transition === 'sample') { ui.update({ sample: true }); ui.update({ sample: false }); }
      if (transition === 'unmount') ui.dispose();
      assert.equal(ui.appends[0].current(), false);
      assert.deepEqual(ui.discards, [ui.original]);
      await act(async () => { gate.resolve({ status: 'applied', message: 'Late obsolete success' }); await completion; });
      if (transition !== 'unmount') assert.doesNotMatch(ui.text(), /Late obsolete success|Adding selected outlines/);
    } finally { ui.dispose(); }
  });
}

test('held and failed appends keep the preview for a deliberate retry, without silently selecting or saving other outlines', async () => {
  const ui = mount(); try {
    await ready(ui); ui.select(2); ui.confirm();
    ui.setAppend(async () => ({ status: 'held', message: 'The saved layout changed. Check it before adding fields.' })); await ui.append();
    assert.match(ui.text(), /saved layout changed/); assert.equal(ui.field('Select outline 2').props.checked, true);
    ui.setAppend(async () => { throw Error('private account detail'); }); await ui.append();
    assert.match(ui.text(), /Could not add these outlines/); assert.doesNotMatch(ui.text(), /private account detail/);
    assert.deepEqual(ui.appends.map(value => value.ids), [['inner'], ['inner']]);
    ui.cancel(); assert.equal(ui.renderer.root.findAllByType('polygon').length, 0);
  } finally { ui.dispose(); }
});

test('discard releases a displayed review exactly once on cancel, replacement, context withdrawal or unmount', async () => {
  for (const transition of ['cancel', 'file', 'context', 'unmount'] as const) {
    const ui = mount(); try {
      await ready(ui);
      if (transition === 'cancel') { ui.cancel(); ui.cancel(); }
      if (transition === 'file') { ui.file(localFile()); ui.file(localFile()); }
      if (transition === 'context') { ui.update({ contextKey: 'other' }); ui.update({ contextKey: 'saved-source-a' }); }
      if (transition === 'unmount') ui.dispose();
      assert.deepEqual(ui.discards, [ui.original]); ui.dispose(); assert.equal(ui.discards.length, 1);
    } finally { ui.dispose(); }
  }
});

test('a missing source disables reading, DEMO stays explicit and controls fit the narrow panel without fixed widths', async () => {
  const ui = mount({ contextKey: null, sample: true }); try {
    assert.match(ui.text(), /DEMO/); assert.match(ui.text(), /saved satellite layout/);
    assert.equal(ui.field('Local KML file').props.disabled, true); ui.file(localFile()); await ui.read(); assert.equal(ui.reads.length, 0);
    assert.equal(ui.button('Preview outlines').props.style.minHeight, 44);
    assert.equal(ui.button('Cancel import').props.style.minHeight, 44);
    assert.equal(ui.field('Local KML file').props.style.minWidth, 0);
    ui.update({ contextKey: 'sample-source' }); ui.file(localFile()); await ui.read();
    assert.equal(ui.renderer.root.findByType('svg').props.style.width, '100%');
    for (const label of ui.renderer.root.findAllByType('label')) assert.ok(label.props.style.minHeight === 44 || label.findAllByType('input').some(input => input.props.type === 'file'));
  } finally { ui.dispose(); }
});

test('duplicate candidate identities or unreviewable coordinates cannot become an append selection', async () => {
  for (const candidates of [
    [{ ...review().candidates[0], points: undefined }],
    [{ ...review().candidates[0], points: [[Infinity, .1],[.8,.1],[.8,.8]] as const }],
    [review().candidates[0], review().candidates[0]],
  ]) {
    const ui = mount(); try {
      ui.setRead(async () => ({ status: 'review', candidates, excludedPlacemarkCount: 0 })); await ready(ui);
      assert.equal(ui.field('Select outline 1').props.disabled, true); ui.select(1); ui.confirm(); await ui.append();
      assert.equal(ui.appends.length, 0);
    } finally { ui.dispose(); }
  }
});
