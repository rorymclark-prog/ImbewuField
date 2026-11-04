import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test, { after } from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer, type ReactTestInstance } from 'react-test-renderer';
import ts from 'typescript';

type Listener = { uid: string; stopped: boolean; handlers: { onPlaces?: () => void; onState?: (state: string) => void } };
const probe = { uid: null as string | null, listeners: [] as Listener[] };
Object.assign(globalThis, { __savedSiteUpdatesProbe: probe });
const moduleUrl = (source: string) => 'data:text/javascript,' + encodeURIComponent(source);
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.endsWith('/components/international/countries/SavedSiteUpdates.tsx')) {
      if (specifier === '@/lib/auth') return { shortCircuit: true, url: moduleUrl(`export function useAuth() {
        const uid = globalThis.__savedSiteUpdatesProbe.uid; return { user: uid ? { uid } : null };
      }`) };
      if (specifier === '@/lib/user-sync') return { shortCircuit: true, url: moduleUrl(`export function subscribeUserPlaces(uid, handlers) {
        const row = { uid, handlers, stopped: false }; globalThis.__savedSiteUpdatesProbe.listeners.push(row);
        handlers.onState?.('syncing'); return () => { row.stopped = true; };
      }`) };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith('/components/international/countries/SavedSiteUpdates.tsx')) return { shortCircuit: true, format: 'module',
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText };
    return nextLoad(url, context);
  },
});
const { default: SavedSiteUpdates, SavedSiteUpdatesProvider } = await import('../components/international/countries/SavedSiteUpdates.tsx');
after(() => { hooks.deregister(); Reflect.deleteProperty(globalThis, '__savedSiteUpdatesProbe'); });
const text = (node: ReactTestInstance | string): string => typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join('');

test('planner country updates dispose account A before B and ignore obsolete callbacks', () => {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const browser = new EventTarget(); Object.defineProperty(globalThis, 'window', { configurable: true, value: browser });
  probe.uid = 'account-a'; probe.listeners.length = 0;
  let refreshed = 0, events = 0;
  const onPlaces = () => { refreshed++; };
  browser.addEventListener('permamap-places-changed', () => { events++; });
  let view!: ReactTestRenderer;
  act(() => { view = create(React.createElement(SavedSiteUpdates, { onPlaces })); });
  try {
    const a = probe.listeners[0]; assert.equal(a.uid, 'account-a');
    act(() => { a.handlers.onState?.('live'); a.handlers.onPlaces?.(); });
    assert.match(text(view.root), /updates are being checked/); assert.equal(refreshed, 1); assert.equal(events, 1);
    probe.uid = 'account-b'; act(() => { view.update(React.createElement(SavedSiteUpdates, { onPlaces })); });
    const b = probe.listeners[1]; assert.equal(a.stopped, true); assert.equal(b.uid, 'account-b');
    act(() => { a.handlers.onPlaces?.(); a.handlers.onState?.('offline'); });
    assert.equal(refreshed, 1); assert.equal(events, 1);
    assert.match(text(view.root), /Checking saved-site/); assert.doesNotMatch(text(view.root), /offline/);
    act(() => { b.handlers.onPlaces?.(); b.handlers.onState?.('offline'); });
    assert.equal(refreshed, 2); assert.match(text(view.root), /may not have arrived/);
    act(() => { view.root.findByType('button').props.onClick(); });
    assert.equal(b.stopped, true); assert.equal(probe.listeners.length, 3);
    assert.match(text(view.root), /Checking saved-site/);
  } finally {
    act(() => { view.unmount(); }); assert.equal(probe.listeners.at(-1)?.stopped, true);
    if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow); else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('a signed-out planner has no cloud subscription or implied save acknowledgement', () => {
  probe.uid = null; probe.listeners.length = 0;
  let view!: ReactTestRenderer;
  act(() => { view = create(React.createElement(SavedSiteUpdates, { onPlaces() {} })); });
  try {
    assert.equal(probe.listeners.length, 0);
    assert.match(text(view.root), /from this device/); assert.match(text(view.root), /unavailable/);
    assert.doesNotMatch(text(view.root), /updates are being checked/);
  } finally { act(() => { view.unmount(); }); }
});


test('multiple route consumers share one account places listener and receive its updates', () => {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });
  probe.uid = 'account-a'; probe.listeners.length = 0;
  let first = 0, second = 0;
  let view!: ReactTestRenderer;
  act(() => { view = create(React.createElement(SavedSiteUpdatesProvider, { children: [
    React.createElement(SavedSiteUpdates, { key: 'first', onPlaces: () => { first++; } }),
    React.createElement(SavedSiteUpdates, { key: 'second', onPlaces: () => { second++; } }),
  ] })); });
  try {
    assert.equal(probe.listeners.length, 1);
    const listener = probe.listeners[0];
    act(() => { listener.handlers.onPlaces?.(); listener.handlers.onState?.('live'); });
    assert.equal(first, 1); assert.equal(second, 1);
    assert.match(text(view.root), /updates are being checked/);
  } finally {
    act(() => { view.unmount(); }); assert.equal(probe.listeners[0].stopped, true);
    if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow); else Reflect.deleteProperty(globalThis, 'window');
  }
});
