import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';

const componentUrl = new URL('../components/VenueLocation.tsx', import.meta.url).href;
const hooks = registerHooks({ load(url, context, nextLoad) {
  if (url === componentUrl) return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
    fileName: 'VenueLocation.tsx', compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText };
  return nextLoad(url, context);
} });
const { default: VenueLocation } = await import('../components/VenueLocation.tsx');
hooks.deregister();

// Exercise the real React control with a device boundary stub. This does not
// substitute for iPhone/Safari permission handling or an outdoor GPS accuracy test.
test('location capture preserves draft data and rejects stale device callbacks', async t => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const requests: { success: PositionCallback; error?: PositionErrorCallback | null; options?: PositionOptions }[] = [];
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { geolocation: {
    getCurrentPosition(success: PositionCallback, error?: PositionErrorCallback | null, options?: PositionOptions) { requests.push({ success, error, options }); },
  } } });
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'navigator', previous); else Reflect.deleteProperty(globalThis, 'navigator'); });
  const point = { coords: { latitude: -29.5, longitude: 31.1, accuracy: 12 }, timestamp: Date.now() } as GeolocationPosition;
  const failure = (code: number) => ({ code } as GeolocationPositionError);
  function mount(sample = false, existing = false) {
    requests.length = 0;
    const changes: { latitude: number | null; longitude: number | null }[] = [];
    let view!: ReactTestRenderer;
    act(() => { view = create(createElement(VenueLocation, { sample, recordKind: 'visit', venue: 'Garden meeting point', latitude: existing ? -28 : null, longitude: existing ? 30 : null, onChange: p => changes.push(p) })); });
    const button = (text: string) => view.root.findAllByType('button').find(b => b.children.join('') === text)!;
    const status = () => view.root.findByProps({ role: 'status' }).children.join('');
    return { view, changes, button, status };
  }
  await t.test('a live visit requests fresh GPS only after a tap and reports accuracy', () => {
    const h = mount();
    assert.equal(requests.length, 0);
    act(() => h.button('Use my GPS location').props.onClick());
    assert.equal(requests.length, 1);
    assert.equal(requests[0].options?.maximumAge, 0);
    assert.equal(requests[0].options?.enableHighAccuracy, true);
    assert.equal(h.button('Finding location…').props.disabled, true);
    act(() => requests[0].success(point));
    assert.deepEqual(h.changes, [{ latitude: -29.5, longitude: 31.1 }]);
    assert.match(h.status(), /12 m accuracy/);
    assert.match(h.status(), /Save the visit/);
    act(() => h.view.unmount());
  });
  await t.test('permission denial and timeout keep the draft location and permit retry', () => {
    const h = mount(false, true);
    act(() => h.button('Update GPS location').props.onClick());
    act(() => requests[0].error?.(failure(1)));
    assert.deepEqual(h.changes, []);
    assert.match(h.status(), /permission was declined/);
    assert.equal(h.button('Update GPS location').props.disabled, false);
    act(() => h.button('Update GPS location').props.onClick());
    act(() => requests[1].error?.(failure(3)));
    assert.deepEqual(h.changes, []);
    assert.match(h.status(), /Your entry is still here/);
    act(() => h.view.unmount());
  });
  await t.test('an invalid device position cannot overwrite a saved point', () => {
    const h = mount(false, true);
    act(() => h.button('Update GPS location').props.onClick());
    act(() => requests[0].success({ ...point, coords: { ...point.coords, latitude: NaN } }));
    assert.deepEqual(h.changes, []);
    assert.match(h.status(), /No usable location/);
    act(() => h.view.unmount());
  });
  await t.test('removing a point or leaving the record invalidates an outstanding request', () => {
    const h = mount(false, true);
    act(() => h.button('Update GPS location').props.onClick());
    act(() => h.button('Remove location').props.onClick());
    act(() => requests[0].success(point));
    assert.deepEqual(h.changes, [{ latitude: null, longitude: null }]);
    act(() => h.button('Update GPS location').props.onClick());
    act(() => h.view.unmount());
    act(() => requests[1].success(point));
    assert.equal(h.changes.length, 1);
  });
  await t.test('tour location uses its venue without requesting the user’s real position', () => {
    const h = mount(true);
    act(() => h.button('Use venue location').props.onClick());
    assert.equal(requests.length, 0);
    assert.equal(h.changes.length, 1);
    assert.ok(Number.isFinite(h.changes[0].latitude) && Number.isFinite(h.changes[0].longitude));
    act(() => h.view.unmount());
  });
});
