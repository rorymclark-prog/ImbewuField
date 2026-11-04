import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import { advisorRegionPresentation, observeDesignAdvisorLayout, visibleAdvisorRegion,
  type AdvisorLayoutHost, type AdvisorLayoutRect, type AdvisorVisibleRegion } from '../lib/design-advisor-layout.ts';

const viewport = { top: 0, bottom: 844, left: 0, right: 390 };
const canvas = { top: 405, bottom: 794, left: 0, right: 390 };
const sheet = { top: 566, bottom: 844, left: 0, right: 390 };

test('the real phone overlap raises the advisor above the sheet without resizing the canvas or guessing its cap', () => {
  const original = JSON.stringify({ canvas, sheet });
  const region = visibleAdvisorRegion(canvas, sheet, viewport);
  assert.deepEqual(region, { topInset: 0, bottomInset: 228, availableHeight: 161 });
  const style = advisorRegionPresentation(true, region);
  assert.equal(style.bottom, 228); assert.equal(style.top, 0);
  // The existing advisor's ten-pixel paint gap is retained. Its former anchor was
  // inside the fixed sheet; the measured wrapper changes only that containing box.
  assert.ok(canvas.bottom - 10 > sheet.top);
  assert.equal(canvas.bottom - Number(style.bottom) - 10, sheet.top - 10);
  assert.equal(style.overflow, 'hidden'); assert.equal(style.visibility, 'visible');
  assert.equal(JSON.stringify({ canvas, sheet }), original);
});

test('the visible viewport clips an overflowing canvas even when the phone sheet is absent', () => {
  const region = visibleAdvisorRegion({ ...canvas, top: -100, bottom: 1000 }, null, viewport);
  assert.deepEqual(region, { topInset: 100, bottomInset: 156, availableHeight: 844 });
  assert.equal(advisorRegionPresentation(true, region).visibility, 'visible');
  assert.deepEqual(visibleAdvisorRegion(canvas, null, viewport), { topInset: 0, bottomInset: 0, availableHeight: 389 });
});

test('a nonoverlapping, zero-size or offscreen sheet cannot reserve an invented advisor position', () => {
  const without = visibleAdvisorRegion(canvas, null, viewport);
  for (const absent of [
    { ...sheet, left: 400, right: 800 }, { ...sheet, top: 800, bottom: 844 },
    { ...sheet, top: 0, bottom: 300 }, { ...sheet, bottom: sheet.top }, { ...sheet, right: sheet.left },
  ]) assert.deepEqual(visibleAdvisorRegion(canvas, absent, viewport), without);
});

test('a sheet covering all visible canvas leaves no active offscreen reference, while desktop removes the phone adapter', () => {
  const covered = visibleAdvisorRegion(canvas, { ...sheet, top: 300 }, viewport);
  assert.equal(covered?.availableHeight, 0); assert.equal(advisorRegionPresentation(true, covered).visibility, 'hidden');
  for (const hidden of [{ ...canvas, top: 900, bottom: 1000 }, { ...canvas, top: -100, bottom: -10 }, { ...canvas, left: 400, right: 500 }]) {
    const region = visibleAdvisorRegion(hidden, sheet, viewport); assert.equal(region, null);
    assert.equal(advisorRegionPresentation(true, region).visibility, 'hidden');
  }
  assert.equal(visibleAdvisorRegion({ ...canvas, bottom: NaN }, sheet, viewport), null);
  const desktop = advisorRegionPresentation(false, covered);
  assert.equal(desktop.top, 0); assert.equal(desktop.bottom, 0); assert.equal(desktop.overflow, undefined); assert.equal(desktop.visibility, undefined);
});

function eventSource() {
  const listeners = new Map<string, Set<() => void>>();
  const captures: Array<[string, boolean]> = [];
  return {
    captures,
    addEventListener(type: string, callback: () => void, capture = false) {
      captures.push([type, capture]); const key = `${type}:${capture}`;
      if (!listeners.has(key)) listeners.set(key, new Set()); listeners.get(key)!.add(callback);
    },
    removeEventListener(type: string, callback: () => void, capture = false) { listeners.get(`${type}:${capture}`)?.delete(callback); },
    fire(type: string) { for (const [key, callbacks] of listeners) if (key.startsWith(`${type}:`)) for (const callback of [...callbacks]) callback(); },
    count() { return [...listeners.values()].reduce((count, entries) => count + entries.size, 0); },
  };
}
function fixture(withVisualViewport = false) {
  const changes: Array<AdvisorVisibleRegion | null> = [], observers: FakeObserver[] = [];
  class FakeObserver {
    observed: Element[] = []; disconnected = false;
    readonly callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) { this.callback = callback; observers.push(this); }
    observe(element: Element) { this.observed.push(element); }
    unobserve() {}
    disconnect() { this.disconnected = true; }
    fire() { this.callback([], this as unknown as ResizeObserver); }
  }
  const canvasNode = { isConnected: true, rect: { ...canvas }, getBoundingClientRect() { return this.rect; } };
  const sheetNode = { isConnected: true, rect: { ...sheet }, getBoundingClientRect() { return this.rect; } };
  const visual = Object.assign(eventSource(), { offsetLeft: 0, offsetTop: 0, width: 390, height: 844 });
  const host = Object.assign(eventSource(), { innerWidth: 390, innerHeight: 844,
    visualViewport: withVisualViewport ? visual : null, ResizeObserver: FakeObserver });
  const begin = (mountedSheet = true) => observeDesignAdvisorLayout({ canvas: canvasNode as unknown as HTMLElement,
    sheet: mountedSheet ? sheetNode as unknown as HTMLElement : null, host: host as unknown as AdvisorLayoutHost,
    onChange: region => changes.push(region) });
  return { changes, observers, canvasNode, sheetNode, visual, host, begin };
}

test('the actual observer follows palette content/compact height, viewport resize and captured page scroll', () => {
  const f = fixture(), stop = f.begin();
  try {
    assert.deepEqual(f.changes.at(-1), { topInset: 0, bottomInset: 228, availableHeight: 161 });
    assert.deepEqual(f.observers[0].observed, [f.canvasNode, f.sheetNode]);
    f.sheetNode.rect.top = 750; f.observers[0].fire();
    assert.deepEqual(f.changes.at(-1), { topInset: 0, bottomInset: 44, availableHeight: 345 });
    f.canvasNode.rect.top = 300; f.host.fire('scroll');
    assert.deepEqual(f.changes.at(-1), { topInset: 0, bottomInset: 44, availableHeight: 450 });
    assert.ok(f.host.captures.some(([type, capture]) => type === 'scroll' && capture));
    f.host.innerHeight = 700; f.host.fire('resize');
    assert.deepEqual(f.changes.at(-1), { topInset: 0, bottomInset: 94, availableHeight: 400 });
  } finally { stop(); }
});

test('unmounted or missing sheets release their reservation and stale observers cannot publish after cleanup', () => {
  const f = fixture(), stop = f.begin();
  f.sheetNode.isConnected = false; f.observers[0].fire();
  assert.deepEqual(f.changes.at(-1), { topInset: 0, bottomInset: 0, availableHeight: 389 });
  stop(); assert.equal(f.observers[0].disconnected, true); assert.equal(f.host.count(), 0);
  const count = f.changes.length;
  f.observers[0].fire(); f.host.fire('resize'); f.host.fire('scroll'); assert.equal(f.changes.length, count);
  const stopWithoutSheet = f.begin(false);
  assert.deepEqual(f.changes.at(-1), { topInset: 0, bottomInset: 0, availableHeight: 389 });
  f.canvasNode.isConnected = false; f.host.fire('resize'); assert.equal(f.changes.at(-1), null);
  stopWithoutSheet(); assert.equal(f.host.count(), 0);
});

test('visual viewport changes remeasure the safe span and release every original viewport subscription', () => {
  const f = fixture(true), stop = f.begin();
  f.visual.offsetTop = 430; f.visual.height = 100; f.visual.fire('resize');
  assert.deepEqual(f.changes.at(-1), { topInset: 25, bottomInset: 264, availableHeight: 100 });
  f.visual.offsetTop = 450; f.visual.height = 150; f.visual.fire('scroll');
  assert.deepEqual(f.changes.at(-1), { topInset: 45, bottomInset: 228, availableHeight: 116 });
  assert.equal(f.visual.count(), 2);
  // Cleanup owns the target captured at subscription, even if the host object changes.
  f.host.visualViewport = null; stop(); assert.equal(f.visual.count(), 0); assert.equal(f.host.count(), 0);
  const count = f.changes.length; f.visual.fire('resize'); f.observers[0].fire(); assert.equal(f.changes.length, count);
});

function source(path: string) { return ts.createSourceFile(path, readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); }
function nodes(root: ts.Node, predicate: (node: ts.Node) => boolean): ts.Node[] {
  const found: ts.Node[] = []; function visit(node: ts.Node) { if (predicate(node)) found.push(node); node.forEachChild(visit); } visit(root); return found;
}
function attribute(opening: ts.JsxOpeningElement | ts.JsxSelfClosingElement, name: string) {
  return opening.attributes.properties.find(prop => ts.isJsxAttribute(prop) && prop.name.getText() === name) as ts.JsxAttribute | undefined;
}

test('the actual page connects the fixed phone root and real canvas observer to a bounded advisor-only wrapper', () => {
  const palette = source('components/design/DesignPalette.tsx'), page = source('app/design/page.tsx');
  const phoneBranch = nodes(palette, node => ts.isIfStatement(node) && node.expression.getText() === 'isPhone')[0] as ts.IfStatement;
  assert.ok(phoneBranch, 'The fixed phone renderer must be identifiable');
  const root = nodes(phoneBranch.thenStatement, node => ts.isJsxOpeningElement(node) && node.tagName.getText() === 'div')[0] as ts.JsxOpeningElement;
  assert.equal(attribute(root, 'ref')?.initializer?.getText(), '{phoneSheetRef}', 'Measure the actual fixed root, not a zero-height normal-flow wrapper');
  const mountedPalette = nodes(page, node => ts.isJsxSelfClosingElement(node) && node.tagName.getText() === 'DesignPalette')[0] as ts.JsxSelfClosingElement;
  assert.equal(attribute(mountedPalette, 'phoneSheetRef')?.initializer?.getText(), '{setPhonePaletteElement}');
  const subscription = nodes(page, node => ts.isReturnStatement(node) && !!node.expression && ts.isCallExpression(node.expression)
    && node.expression.expression.getText() === 'observeDesignAdvisorLayout')[0] as ts.ReturnStatement;
  assert.ok(subscription, 'The page effect must return the actual observer cleanup');
  const subscriptionText = subscription.getText(); assert.match(subscriptionText, /canvas:\s*canvasWrapRef\.current/); assert.match(subscriptionText, /sheet:\s*phonePaletteElement/);
  const wrappers = nodes(page, node => ts.isJsxElement(node) && node.openingElement.tagName.getText() === 'div'
    && attribute(node.openingElement, 'style')?.initializer?.getText() === '{advisorRegionPresentation(isPhone, advisorVisibleRegion)}') as ts.JsxElement[];
  assert.equal(wrappers.length, 1); const wrapper = wrappers[0];
  assert.equal(attribute(wrapper.openingElement, 'className')?.initializer?.getText(), "{isPhone ? 'phone-advisor-region' : undefined}");
  assert.ok(nodes(wrapper, node => ts.isJsxSelfClosingElement(node) && node.tagName.getText() === 'DesignAdvisorLazy').length);
  const css = nodes(page, node => ts.isJsxElement(node) && node.openingElement.tagName.getText() === 'style').map(node => node.getText()).join('\n');
  assert.match(css, /\.phone-advisor-region > :global\(div\)/); assert.match(css, /position:\s*relative !important/);
  assert.match(css, /min-height:\s*0/); assert.match(css, /overflow-y:\s*auto/);
  const pageText = page.getText(); assert.match(pageText, /if \(!isPhone \|\| !canvasWrapRef\.current\)/);
  assert.match(pageText, /\[isPhone, phonePaletteElement, hasSite\]/);
});
