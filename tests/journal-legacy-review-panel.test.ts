import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === './JournalExplore.module.css' && context.parentURL?.endsWith('/JournalLegacyReviewPanel.tsx')) {
      return { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent('export default { exports: "exp", help: "hlp", exportButtons: "btn", photoChoice: "pc" };') };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith('/JournalLegacyReviewPanel.tsx')) {
      return { shortCircuit: true, format: 'module', source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
      }).outputText };
    }
    return next(url, context);
  },
});

const { JournalLegacyReviewPanel } = await import('../components/journal/JournalLegacyReviewPanel.tsx');
hooks.deregister();

const labels = { heading: 'H', description: 'D', currentCount: 'C:2', olderCount: 'O:1', olderUnreadable: 'Unreadable', download: 'DL', keepCurrent: 'KC', chooseNotes: 'CN', noCandidates: 'None', recoverSelected: 'RS' };
const candidate = { id: 'secret-id-xyz', date: '2026-05-10', title: '<script>alert(1)</script>', notes: 'Note & text' };

type PanelProps = React.ComponentProps<typeof JournalLegacyReviewPanel>;

function render(overrides: Partial<PanelProps> = {}) {
  const calls = { toggle: 0, recover: 0, dl: 0, keep: 0 };
  const props = { review: { currentCount: 2, olderCount: 1 }, candidates: [candidate], selectedIds: [] as string[], busy: false, canKeep: false,
    onToggleCandidate: () => { calls.toggle++; }, onRecoverSelected: () => { calls.recover++; }, onDownload: () => { calls.dl++; }, onKeepCurrent: () => { calls.keep++; }, labels, ...overrides };
  const html = renderToStaticMarkup(React.createElement(JournalLegacyReviewPanel, props));
  const disabled = (label: string) => new RegExp(`<button[^>]*disabled[^>]*>${label}<\\/button>`).test(html);
  const present = (label: string) => html.includes(`>${label}</button>`);
  return { html, disabled, present, calls };
}

test('unreadable older copy shows unreadable wording, omits recover, and keeps download enabled when idle', () => {
  const { html, present, disabled } = render({ review: { currentCount: 2, olderCount: null }, candidates: [] });
  assert.ok(html.includes('Unreadable') && !html.includes('O:1') && html.includes('None'));
  assert.ok(!present('RS') && present('DL') && !disabled('DL'));
});

test('recover and keep buttons follow truth table for busy, canKeep and selection', () => {
  const matrix = [
    { busy: false, canKeep: false, selected: [], recoverDis: true, keepDis: true },
    { busy: false, canKeep: true, selected: ['stale-id'], recoverDis: true, keepDis: false },
    { busy: false, canKeep: true, selected: [candidate.id], recoverDis: false, keepDis: false },
    { busy: true, canKeep: true, selected: [candidate.id], recoverDis: true, keepDis: true },
  ];
  for (const row of matrix) {
    const { disabled, present } = render({ busy: row.busy, canKeep: row.canKeep, selectedIds: row.selected });
    assert.ok(present('RS') && present('KC'));
    assert.equal(disabled('RS'), row.recoverDis, `RS disabled for ${JSON.stringify(row)}`);
    assert.equal(disabled('KC'), row.keepDis, `KC disabled for ${JSON.stringify(row)}`);
  }
});

test('user text is properly escaped, internal IDs never appear in markup, and render causes no callbacks', () => {
  const { html, calls } = render({ selectedIds: [candidate.id] });
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;') && html.includes('Note &amp; text'));
  assert.ok(!html.includes('secret-id-xyz'));
  assert.deepEqual(calls, { toggle: 0, recover: 0, dl: 0, keep: 0 });
});
