import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import ts from 'typescript';
import { MAP_SOURCE, SEAMS, bind } from './map-source-seams.ts';

// The supplied desktop captures showed status text over Records/Account. These
// checks execute the actual layout shell and resize effect, not a browser/CSS
// measurement or the complete Map/Draw application. Canvas is a lifecycle spy.
function attribute(node: ts.JsxElement, name: string) {
  return node.openingElement.attributes.properties.find(item => ts.isJsxAttribute(item) && item.name.getText() === name) as ts.JsxAttribute | undefined;
}
function className(node: ts.JsxElement): string {
  const value = attribute(node, 'className')?.initializer;
  assert.ok(value && ts.isStringLiteral(value)); return value.text;
}
function containsClass(node: ts.JsxElement, name: string) {
  return className(node).split(/\s+/).includes(name);
}
function layout(sourceText: string) {
  const source = ts.createSourceFile('Map.tsx', sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal((source as ts.SourceFile & { parseDiagnostics?: readonly unknown[] }).parseDiagnostics?.length ?? 0, 0);
  const matches: ts.JsxElement[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxElement(node) && attribute(node, 'data-map-workspace')) matches.push(node);
    ts.forEachChild(node, visit);
  };
  visit(source); assert.equal(matches.length, 1, 'one stable normal map workspace');
  const root = matches[0], children = root.children.filter(ts.isJsxElement);
  assert.equal(children.length, 2, 'the status and viewport are stable, direct siblings');
  const [region, viewport] = children;
  assert.ok(attribute(region, 'data-map-sync-region'), 'status occupies its own flow row before the viewport');
  assert.ok(attribute(viewport, 'data-map-viewport'), 'the viewport is not conditionally mounted with a notice');
  for (const token of ['relative', 'flex', 'flex-col', 'h-full', 'min-h-0']) assert.ok(containsClass(root, token), token);
  for (const token of ['shrink-0', 'overflow-y-auto', 'overscroll-contain']) assert.ok(containsClass(region, token), token);
  for (const token of ['relative', 'flex-1', 'min-h-0']) assert.ok(containsClass(viewport, token), token);
  for (const node of [root, region, viewport]) for (const token of ['fixed', 'absolute']) assert.equal(containsClass(node, token), false);
  const style = attribute(region, 'style')?.initializer;
  assert.ok(style && ts.isJsxExpression(style) && style.expression && ts.isObjectLiteralExpression(style.expression));
  const cap = style.expression.properties.find(item => ts.isPropertyAssignment(item) && item.name.getText() === 'maxHeight');
  assert.ok(cap && ts.isPropertyAssignment(cap) && ts.isStringLiteral(cap.initializer));
  const percent = /^([0-9]+(?:\.[0-9]+)?)%$/.exec(cap.initializer.text); assert.ok(percent);
  assert.ok(Number(percent[1]) > 0 && Number(percent[1]) < 100, 'a long tray must leave part of the map available');
  const banner = SEAMS.syncBanner();
  const bannerPosition = sourceText.indexOf(banner);
  assert.ok(bannerPosition > region.openingElement.end && bannerPosition < region.closingElement.pos);
  assert.doesNotMatch(banner, /className="[^"]*\bfixed\b|safe-area-inset-top|100vw/,
    'sync status must use its map column, never viewport/header positioning');
  const maps: ts.JsxElement[] = [], toolbars: ts.JsxElement[] = [];
  const inspect = (node: ts.Node) => {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText() === 'ReactMapGL') maps.push(node);
    if (ts.isJsxElement(node)) {
      const value = attribute(node, 'className')?.initializer;
      if (value && ts.isStringLiteral(value) && value.text.includes('absolute top-3 left-3')) toolbars.push(node);
    }
    ts.forEachChild(node, inspect);
  };
  inspect(viewport); assert.equal(maps.length, 1); assert.ok(toolbars.length > 0, 'existing toolbar stays inside the resized viewport');
  assert.equal(attribute(maps[0], 'key'), undefined, 'notice state must not key/remount the actual map');
  return { source, root, region, viewport };
}

test('actual map shell separates sync notices, navigation and the existing toolbar without header-height arithmetic', () => {
  layout(MAP_SOURCE);
});

for (const fault of ['overlay-row', 'uncapped-tray', 'missing-flow', 'conditional-viewport'] as const) {
  test(`${fault} cannot pass the layout separation check`, () => {
    const { root, viewport } = layout(MAP_SOURCE);
    const changed = fault === 'overlay-row' ? MAP_SOURCE.replace('min-w-0 shrink-0 overflow-y-auto overscroll-contain', 'absolute min-w-0 shrink-0 overflow-y-auto overscroll-contain')
      : fault === 'uncapped-tray' ? MAP_SOURCE.replace("maxHeight: '40%'", "maxHeight: '100%'")
      : fault === 'missing-flow' ? MAP_SOURCE.replace('relative flex w-full h-full min-h-0 flex-col', 'relative w-full h-full min-h-0')
      : MAP_SOURCE.slice(0, viewport.getStart()) + '{shapeSyncNoticeNow && ' + viewport.getText() + '}' + MAP_SOURCE.slice(viewport.end);
    assert.notEqual(changed, MAP_SOURCE); assert.throws(() => layout(changed));
    assert.ok(root.getText().includes('data-map-sync-region'));
  });
}

test('actual shell keeps one canvas mounted through status, warning and conflict changes while preserving interactive decisions', () => {
  const { root, viewport } = layout(MAP_SOURCE), start = root.getStart();
  const shell = root.getText().slice(0, viewport.openingElement.end - start) + '<MapCanvas />'
    + root.getText().slice(viewport.closingElement.pos - start);
  let mounts = 0, unmounts = 0, backups = 0, toggles = 0;
  function MapCanvas() {
    React.useEffect(() => { mounts++; return () => { unmounts++; }; }, []);
    return React.createElement('div', { 'data-canvas-spy': true });
  }
  const icon = () => null, viewportRef = { current: null };
  const conflict = { conflictId: 'synthetic-conflict', shapeId: 'synthetic-shape', kind: 'concurrent-edit', live: true,
    current: { properties: { name: 'Synthetic shape' } }, other: { properties: { name: 'Other synthetic shape' } } };
  const conflictCopy = bind(SEAMS.shapeConflictText(), {});
  function Shell({ notice, conflicts = [] }: { notice: Record<string, unknown> | null; conflicts?: typeof conflict[] }) {
    return bind<React.ReactNode>(shell, { React, MapCanvas, mapViewportRef: viewportRef, pinDraw: null, editPin: null,
      shapeSyncNoticeNow: notice, shapeConflicts: conflicts, conflictsOpen: false, setConflictsOpen: () => { toggles++; },
      downloadShapeRecovery: () => { backups++; }, resolveShapeConflict: () => {}, AlertTriangle: icon, ChevronDown: icon,
      SHAPE_CONFLICT_TEXT: conflictCopy });
  }
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(React.createElement(Shell, { notice: null })); });
  try {
    const canvas = renderer.root.findByProps({ 'data-canvas-spy': true });
    act(() => renderer.update(React.createElement(Shell, { notice: { level: 'info', text: 'Synthetic pending', offerBackup: false } })));
    assert.equal(renderer.root.findByProps({ 'data-canvas-spy': true }), canvas); assert.equal(mounts, 1); assert.equal(unmounts, 0);
    const status = renderer.root.findByProps({ role: 'status' }); assert.equal(status.props['aria-live'], 'polite');
    const region = renderer.root.findByProps({ 'data-map-sync-region': true });
    assert.ok(region.findAllByProps({ role: 'status' }).length); assert.match(region.props.className, /overflow-y-auto/);
    act(() => renderer.update(React.createElement(Shell, { notice: { level: 'error', text: 'Synthetic warning', offerBackup: true }, conflicts: [conflict] })));
    const buttons = renderer.root.findAllByType('button');
    act(() => buttons.find(button => button.children.includes('Download backup'))!.props.onClick());
    act(() => buttons.find(button => button.props.className?.includes('w-full flex'))!.props.onClick());
    assert.equal(backups, 1); assert.equal(toggles, 1);
    assert.equal(renderer.root.findByProps({ 'data-map-sync-region': true }).props.tabIndex, 0, 'the bounded decision region is keyboard-scrollable');
    assert.equal(renderer.root.findByProps({ 'data-canvas-spy': true }), canvas); assert.equal(mounts, 1); assert.equal(unmounts, 0);
    assert.equal(renderer.root.findByProps({ role: 'alert' }).props.style.pointerEvents, 'auto');
    act(() => renderer.update(React.createElement(Shell, { notice: null })));
    assert.equal(renderer.root.findByProps({ 'data-canvas-spy': true }), canvas); assert.equal(unmounts, 0);
  } finally { act(() => renderer.unmount()); }
  assert.equal(unmounts, 1);
});

test('the actual viewport observer repaints only the current map and disconnects without stale callbacks or geometry operations', () => {
  const source = ts.createSourceFile('Map.tsx', MAP_SOURCE, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const effects: ts.ArrowFunction[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'useEffect'
      && node.arguments[0] && ts.isArrowFunction(node.arguments[0]) && node.arguments[0].getText().includes('new ResizeObserver')) effects.push(node.arguments[0]);
    ts.forEachChild(node, visit);
  };
  visit(source); assert.equal(effects.length, 1);
  const observed: unknown[] = []; let disconnected = 0, paints = 0, callback!: () => void;
  class Observer {
    constructor(fn: () => void) { callback = fn; }
    observe(value: unknown) { observed.push(value); }
    disconnect() { disconnected++; }
  }
  const viewport = {}, mapRef: { current: { getMap: () => { resize: () => void } } | null } = {
    current: { getMap: () => ({ resize: () => { paints++; } }) },
  };
  const run = bind<() => (() => void) | undefined>(effects[0].getText(), { mapViewportRef: { current: viewport }, mapRef, ResizeObserver: Observer });
  const cleanup = run(); assert.ok(cleanup); assert.deepEqual(observed, [viewport]); assert.equal(paints, 0);
  callback(); assert.equal(paints, 1);
  mapRef.current = null; assert.doesNotThrow(() => callback()); assert.equal(paints, 1);
  mapRef.current = { getMap: () => ({ resize: () => { paints++; } }) };
  cleanup(); assert.equal(disconnected, 1); callback(); assert.equal(paints, 1, 'a queued callback after cleanup cannot repaint a later map');
  const unsupported = bind<() => unknown>(effects[0].getText(), { mapViewportRef: { current: viewport }, mapRef, ResizeObserver: undefined });
  assert.equal(unsupported(), undefined);
});
