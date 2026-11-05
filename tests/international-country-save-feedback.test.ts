import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test, { after } from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import type { CountrySaveNotice } from '../components/international/countries/SiteCountryPanel.tsx';

type Report = { placeId: string; outcome: string };
const probe = { callback: null as ((report: Report) => void) | null, saves: 0 };
Object.assign(globalThis, { __countrySaveFeedbackProbe: probe });
const url = (source: string) => 'data:text/javascript,' + encodeURIComponent(source);
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.endsWith('/components/international/countries/SiteCountryPanel.tsx')) {
      if (specifier === '@/lib/saved-places') return { shortCircuit: true, url: url(`export function updateSiteCountryContext(siteId, value, callback) {
        const probe = globalThis.__countrySaveFeedbackProbe; probe.saves++; probe.callback = callback;
        return { status: 'local-saved', places: [] };
      }`) };
      if (specifier === '@/lib/sample-mode') return { shortCircuit: true, url: url('export const isSampleMode = () => false;') };
      if (specifier === 'next/link') return { shortCircuit: true, url: url('export default function Link() { return null; }') };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith('/components/international/countries/SiteCountryPanel.tsx')) return { shortCircuit: true, format: 'module',
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText };
    return nextLoad(url, context);
  },
});
const { default: SiteCountryPanel } = await import('../components/international/countries/SiteCountryPanel.tsx');
after(() => { hooks.deregister(); Reflect.deleteProperty(globalThis, '__countrySaveFeedbackProbe'); });

test('local country save is not reported as cloud confirmed until every saved-site alias acknowledges it', () => {
  const notices: CountrySaveNotice[] = []; let refreshed = 0;
  probe.callback = null; probe.saves = 0;
  let view!: ReactTestRenderer;
  act(() => { view = create(React.createElement(SiteCountryPanel, {
    resolution: { siteId: 'site:0.00000,0.00000', status: 'unknown', context: null, placeIds: ['alias-a', 'alias-b'] },
    onSaved: () => { refreshed++; }, onDelivery: notice => { notices.push(notice); },
  })); });
  try {
    act(() => { view.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
    assert.equal(probe.saves, 0, 'the handler also requires deliberate confirmation');
    act(() => { view.root.findByType('select').props.onChange({ target: { value: 'ZA' } }); });
    act(() => { view.root.findAllByType('input').find(node => node.props.type === 'checkbox')!.props.onChange({ target: { checked: true } }); });
    act(() => { view.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
    assert.equal(refreshed, 1); assert.equal(probe.saves, 1);
    assert.equal(notices.at(-1)?.phase, 'local'); assert.match(notices.at(-1)!.message, /Account confirmation is separate/);
    act(() => { probe.callback?.({ placeId: 'alias-a', outcome: 'applied' }); });
    assert.doesNotMatch(notices.at(-1)!.message, /account confirmed/i);
    act(() => { probe.callback?.({ placeId: 'alias-b', outcome: 'unavailable' }); });
    assert.equal(notices.at(-1)?.rejected, false); assert.match(notices.at(-1)!.message, /pending or unavailable/);
    for (const outcome of ['missing-remote', 'remote-behind']) {
      act(() => { probe.callback?.({ placeId: 'alias-b', outcome }); });
      assert.equal(notices.at(-1)?.rejected, false, 'an unsynced base is pending rather than a rejected confirmation');
      assert.match(notices.at(-1)!.message, /pending or unavailable/);
    }
    act(() => { probe.callback?.({ placeId: 'alias-b', outcome: 'unchanged' }); });
    assert.match(notices.at(-1)!.message, /account confirmed/i);
    act(() => { probe.callback?.({ placeId: 'alias-b', outcome: 'base-changed' }); });
    assert.equal(notices.at(-1)?.rejected, true); assert.match(notices.at(-1)!.message, /did not accept/);
    assert.equal(new Set(notices.map(notice => notice.attempt)).size, 1, 'late outcomes identify their original save attempt');
  } finally { act(() => { view.unmount(); }); }
});
