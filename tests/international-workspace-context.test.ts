import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test, { after } from 'node:test';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import {
  createWorkspacePlanningReference, removeWorkspacePlanningReference, replaceWorkspacePlanningReference,
  resolveWorkspacePlanningReference, sanitiseWorkspacePlanningReferences, validWorkspacePlanningId,
  type WorkspacePlanningReference,
} from '../lib/international/workspace-context.ts';

const instant = '2026-11-02T12:00:00.000Z';
const reference = createWorkspacePlanningReference('virtual-bed', true, instant)!;

test('a legacy or corrupt plan never chooses South African reference planning implicitly', () => {
  for (const value of [undefined, null, {}, 'ZA', true, [null], [{ countryCode: 'ZA' }]]) {
    assert.deepEqual(sanitiseWorkspacePlanningReferences(value), []);
    assert.equal(resolveWorkspacePlanningReference(value, 'virtual-bed'), null);
  }
  assert.equal(createWorkspacePlanningReference('virtual-bed', false, instant), null);
  assert.equal(createWorkspacePlanningReference('virtual-bed', true, '2026-02-30'), null);
});

test('the reference choice belongs to one unmapped workspace and never matches a coordinate site', () => {
  for (const id of ['virtual-bed', 'design:local', 'design:Cloud_abc-123.4']) assert.equal(validWorkspacePlanningId(id), true);
  for (const id of ['site:0.00000,0.00000', 'design:site:0.00000,0.00000', 'design:', 'design:../x', 'design:x/y', 'design:x\n', '', null]) {
    assert.equal(validWorkspacePlanningId(id), false, String(id));
    assert.equal(createWorkspacePlanningReference(id, true, instant), null);
    assert.equal(resolveWorkspacePlanningReference([reference], id), null);
  }
  assert.deepEqual(resolveWorkspacePlanningReference([reference], 'virtual-bed'), reference);
  assert.equal(resolveWorkspacePlanningReference([reference], 'design:local'), null);
});

test('foreign-country and approval flags cannot be carried by a workspace reference', () => {
  const malicious = { ...reference, countryCode: 'KE', agriculturalRegionId: 'reviewed', localAgronomyApproved: true, productionPlanSupported: true };
  assert.deepEqual(sanitiseWorkspacePlanningReferences([malicious]), [reference]);
  assert.deepEqual(Object.keys(sanitiseWorkspacePlanningReferences([malicious])[0]).sort(), ['acknowledgedAt', 'basis', 'workspaceId']);
  assert.deepEqual(sanitiseWorkspacePlanningReferences([{ ...reference, basis: 'local-agronomy-approved' }]), []);
});

test('replacing or revoking one workspace preserves every other workspace choice', () => {
  const local = createWorkspacePlanningReference('design:local', true, instant)!;
  const next = { ...reference, acknowledgedAt: '2026-11-03T12:00:00.000Z' };
  assert.deepEqual(sanitiseWorkspacePlanningReferences([next, reference, local]), [next, local]);
  const replaced = replaceWorkspacePlanningReference([reference, local], next);
  assert.deepEqual(resolveWorkspacePlanningReference(replaced, 'virtual-bed'), next);
  assert.deepEqual(resolveWorkspacePlanningReference(replaced, 'design:local'), local);
  assert.deepEqual(removeWorkspacePlanningReference(replaced, 'virtual-bed'), [local]);
});

const root = new URL('../', import.meta.url).href;
const hooks = registerHooks({
  load(url, context, nextLoad) {
    if (url.startsWith(root) && url.endsWith('.tsx')) return { format: 'module', shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: {
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX,
      } }).outputText };
    return nextLoad(url, context);
  },
});
const { default: WorkspaceReferencePanel } = await import('../components/international/countries/WorkspaceReferencePanel.tsx');
after(() => hooks.deregister());

function text(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join('');
}

function mount(id: string | null = 'virtual-bed', initial: WorkspacePlanningReference | null = null) {
  let reference = initial, workspaceId = id, accepted = true;
  const saves: Array<WorkspacePlanningReference | null> = [];
  let renderer: ReactTestRenderer;
  const render = () => React.createElement(WorkspaceReferencePanel, { workspaceId, reference,
    onReference(next: WorkspacePlanningReference | null) {
      saves.push(next);
      if (!accepted) return false;
      reference = next; renderer.update(render()); return true;
    },
  });
  act(() => { renderer = create(render()); });
  return {
    get renderer() { return renderer; }, saves,
    text: () => text(renderer.root),
    check() { act(() => renderer.root.findByType('input').props.onChange({ target: { checked: true } })); },
    submit() { act(() => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} })); },
    revoke() { act(() => renderer.root.findAllByType('button').find(button => text(button) === 'Remove reference choice')!.props.onClick()); },
    failSave() { accepted = false; },
    workspace(next: string) { workspaceId = next; reference = null; act(() => renderer.update(render())); },
    dispose() { act(() => renderer.unmount()); },
  };
}

test('an explicit real form acknowledgement saves and revokes the reference without declaring a country', () => {
  const screen = mount();
  try {
    assert.equal(screen.saves.length, 0);
    assert.equal(screen.renderer.root.findByType('input').props.checked, false);
    assert.equal(screen.renderer.root.findByType('button').props.disabled, true);
    screen.submit();
    assert.equal(screen.saves.length, 0);
    screen.check(); screen.submit();
    assert.equal(screen.saves.length, 1);
    assert.equal(screen.saves[0]?.workspaceId, 'virtual-bed');
    assert.equal(screen.saves[0]?.basis, 'south-african-reference');
    assert.match(screen.text(), /saved with this device’s crop plan/);
    assert.match(screen.text(), /does not confirm a farm country or local farming approval/);
    screen.revoke();
    assert.equal(screen.saves[1], null);
    assert.equal(screen.renderer.root.findByType('input').props.checked, false);
    assert.match(screen.text(), /saved sowing entries remain/);
  } finally { screen.dispose(); }
});

test('storage refusal does not falsely announce a saved choice or reuse unfinished consent on another workspace', () => {
  const screen = mount();
  try {
    screen.failSave(); screen.check(); screen.submit();
    assert.match(screen.text(), /could not be saved/);
    assert.equal(screen.renderer.root.findAllByProps({ role: 'alert' }).length, 1);
    assert.doesNotMatch(screen.text(), /choice saved with/);
    screen.workspace('design:local');
    assert.equal(screen.renderer.root.findByType('input').props.checked, false);
    assert.equal(screen.renderer.root.findByType('button').props.disabled, true);
  } finally { screen.dispose(); }
});

test('mapped site identifiers cannot expose the no-map acknowledgement form', () => {
  const screen = mount('site:0.00000,0.00000', reference);
  try {
    assert.equal(screen.renderer.root.findAllByType('form').length, 0);
    assert.equal(screen.renderer.root.findAllByType('button').length, 0);
    assert.equal(screen.saves.length, 0);
  } finally { screen.dispose(); }
});
