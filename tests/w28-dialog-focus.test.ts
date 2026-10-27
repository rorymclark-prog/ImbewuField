import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as React from 'react';
import { act, create } from 'react-test-renderer';
import { nextTabTarget, useDialogFocus } from '../lib/use-dialog-focus.ts';

test('nextTabTarget wraps at both ends and pulls stray focus back in', () => {
  const c = 'container';
  const items = ['a', 'b', 'c'];
  assert.equal(nextTabTarget(items, 'c', false, c), 'a');
  assert.equal(nextTabTarget(items, 'a', true, c), 'c');
  assert.equal(nextTabTarget(items, 'a', false, c), null);
  assert.equal(nextTabTarget(items, 'b', true, c), null);
  assert.equal(nextTabTarget(items, 'outside', false, c), 'a');
  assert.equal(nextTabTarget(items, 'outside', true, c), 'c');
  assert.equal(nextTabTarget(items, c, false, c), 'a');
  assert.equal(nextTabTarget([], 'x', false, c), c);
});

// A small DOM shim: just what the hook touches.
function shim() {
  const listeners: Array<(e: any) => void> = [];
  const doc: any = {
    activeElement: null,
    addEventListener: (_t: string, fn: any) => listeners.push(fn),
    removeEventListener: (_t: string, fn: any) => { listeners.splice(listeners.indexOf(fn), 1); },
  };
  const el = (name: string, inert = false): any => ({
    name, hidden: false, isConnected: true,
    focus() { doc.activeElement = this; },
    getClientRects: () => [{}],
    closest: (sel: string) => (sel === '[inert]' && inert ? {} : null),
  });
  (globalThis as any).document = doc;
  return { doc, el, listeners };
}

function mount(open: boolean, container: any, options?: { initialFocus?: 'first' | 'container' }) {
  const Probe = ({ open }: { open: boolean }) => {
    const ref = React.useRef<any>(null);
    ref.current = container;
    // The hook reads ref.current inside its effect; createNodeMock is not needed with a plain ref.
    useDialogFocus(open, ref, options);
    return null;
  };
  let renderer!: ReturnType<typeof create>;
  act(() => { renderer = create(React.createElement(Probe, { open })); });
  return { renderer, set: (o: boolean) => act(() => renderer.update(React.createElement(Probe, { open: o }))) };
}

test('moves focus in, traps Tab, returns focus on close', () => {
  const { doc, el, listeners } = shim();
  const opener = el('opener');
  const first = el('first'); const last = el('last'); const hidden = el('hidden', true);
  const container: any = {
    ...el('container'),
    hasAttribute: () => false,
    querySelector: () => null,
    querySelectorAll: () => [first, hidden, last],
  };
  doc.activeElement = opener;
  const m = mount(false, container);
  assert.equal(doc.activeElement, opener);
  m.set(true);
  assert.equal(doc.activeElement, first);
  assert.equal(listeners.length, 1);

  let prevented = false;
  const tab = (shiftKey: boolean) => ({ key: 'Tab', shiftKey, defaultPrevented: false, target: { closest: () => null }, preventDefault: () => { prevented = true; } });
  doc.activeElement = last; listeners[0](tab(false));
  assert.ok(prevented); assert.equal(doc.activeElement, first);
  prevented = false; listeners[0](tab(true));
  assert.ok(prevented); assert.equal(doc.activeElement, last);

  // Tab from inside a different aria-modal overlay is that overlay's business.
  prevented = false; doc.activeElement = last;
  listeners[0]({ ...tab(false), target: { closest: () => ({ other: true }) } });
  assert.equal(prevented, false);

  m.set(false);
  assert.equal(doc.activeElement, opener);
  assert.equal(listeners.length, 0);
});

test('does not return focus to an opener that left the page; container focus mode', () => {
  const { doc, el } = shim();
  const opener = el('opener');
  const container: any = { ...el('container'), tabIndex: 0, hasAttribute: () => false, querySelector: () => null, querySelectorAll: () => [el('x')] };
  doc.activeElement = opener;
  const m = mount(true, container, { initialFocus: 'container' });
  assert.equal(doc.activeElement.name, 'container');
  assert.equal(container.tabIndex, -1);
  opener.isConnected = false;
  m.set(false);
  assert.equal(doc.activeElement.name, 'container');
});

test('every overlay calls useDialogFocus', () => {
  for (const f of [
    'components/ThemePanel.tsx', 'components/NavDrawer.tsx', 'components/AddSheet.tsx',
    'components/EvidenceCatalogue.tsx', 'components/EvidenceSheet.tsx', 'components/ProfileSheet.tsx',
    'components/PopiaConsent.tsx', 'components/design/BasePhotoImport.tsx', 'components/design/LessonLink.tsx',
    'components/AppConfirm.tsx', 'app/records/page.tsx',
  ]) {
    const src = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
    assert.match(src, /useDialogFocus\(/, f);
  }
  const nav = readFileSync(new URL('../components/NavDrawer.tsx', import.meta.url), 'utf8');
  assert.match(nav, /role="dialog"/);
  assert.match(nav, /aria-modal=\{open\}/);
  const popia = readFileSync(new URL('../components/PopiaConsent.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(popia, /key === 'Escape'/);
});

test('the Lima launcher opens from the keyboard and gets focus back on close (w28-05)', () => {
  const src = readFileSync(new URL('../components/ChatWidget.tsx', import.meta.url), 'utf8');
  // Enter/Space produce a click with detail 0 and no pointer events; pointer taps still open via onPointerUp.
  assert.match(src, /onClick=\{e => \{ if \(e\.detail === 0\) setOpen\(true\); \}\}/);
  assert.match(src, /ref=\{fabRef\}/);
  assert.match(src, /if \(!opener\?\.isConnected \|\| opener === document\.body\) openerRef\.current = fabRef\.current;/);
});

test('Escape closes overlays through one stable listener (w28-06)', () => {
  const hook = readFileSync(new URL('../lib/use-escape-close.ts', import.meta.url), 'utf8');
  // Keyed on open only: a listener re-created mid-keydown (onClose in the deps) is skipped by the browser.
  assert.match(hook, /\}, \[open\]\);/);
  assert.match(hook, /onCloseRef\.current\(\)/);
  for (const f of [
    'components/AddSheet.tsx', 'components/EvidenceCatalogue.tsx', 'components/EvidenceSheet.tsx',
    'components/ProfileSheet.tsx', 'components/design/BasePhotoImport.tsx', 'components/journal/JournalEntrySheet.tsx',
    'components/ThemePanel.tsx', 'components/NavDrawer.tsx',
  ]) {
    const src = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
    assert.match(src, /useEscapeClose\((open|true), onClose\)/, f);
    assert.doesNotMatch(src, /e\.key === 'Escape'\) onClose\(\)/, `${f} still has its own Escape listener keyed on onClose`);
  }
});
