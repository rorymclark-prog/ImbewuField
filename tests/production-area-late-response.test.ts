import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import { productionAreaSummary, type ProductionSite } from '../lib/production-sites.ts';

const fixtureModules: Record<string, string> = {
  '@/lib/field-api': 'export const fieldApi = (url) => globalThis.__testProductionAreaRequest(url);',
  '@/lib/auth': "const manager = { user: { uid: 'manager' }, role: 'ngo', profile: { org_id: 'org-a' } }; export const useAuth = () => manager;",
  '@/lib/i18n': 'export const useLanguage = () => ({ lang: "en" }); export const translate = (_lang, key) => key;',
  '@/lib/account-local-storage': 'export const readAccountLocalSampleState = () => false;',
  '@/lib/use-field-sync': 'export const useFieldSync = () => {};',
  './FieldDraft': 'export default () => null; export const clearFieldDraft = async () => {};',
  './FieldDataStatus': 'export default () => null;',
  './ReportComposer': 'export default () => null;',
  './SampleProgramme': 'export const readSampleProgramme = () => { throw new Error("Unexpected sample read"); };',
  './MelDashboard.module.css': 'export default {};',
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

function response(code: string, name: string) {
  const sites: ProductionSite[] = [{
    code, name, observedOn: '2026-11-01', vegetableM2: 5, stapleM2: 0,
    boundaryM2: null, evidence: 'Synthetic test observation', published: false,
    updatedAt: '2026-11-01T12:00:00.000Z', updatedBy: 'manager',
  }];
  return { sites, summary: productionAreaSummary(sites), canManage: true };
}

test('a late production-area response leaves the newly selected organisation visible', async t => {
  const hooks = registerHooks({
    load(url, context, next) {
      if (!url.endsWith('/components/ProductionAreas.tsx')) return next(url, context);
      return {
        format: 'module', shortCircuit: true,
        source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
          compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ESNext,
            jsx: ts.JsxEmit.ReactJSX,
          },
        }).outputText,
      };
    },
    resolve(specifier, context, next) {
      const source = context.parentURL?.endsWith('/components/ProductionAreas.tsx') && fixtureModules[specifier];
      if (!source) return next(specifier, context);
      return { url: 'data:text/javascript,' + encodeURIComponent(source), shortCircuit: true };
    },
  });
  const first = deferred<ReturnType<typeof response>>();
  const second = deferred<ReturnType<typeof response>>();
  const firstRow = 'Garden from organisation A';
  const secondRow = 'Garden from organisation B';
  const firstResponse = response('site-a', firstRow);
  const secondResponse = response('site-b', secondRow);
  const requests: string[] = [];
  const globals = {
    window: new EventTarget(),
    IS_REACT_ACT_ENVIRONMENT: true,
    __testProductionAreaRequest: (url: string) => {
      requests.push(url);
      if (url === '/api/network/orgs') return Promise.resolve({
        orgs: [{ id: 'org-a', name: 'Organisation A' }, { id: 'org-b', name: 'Organisation B' }],
      });
      if (url === '/api/production-sites?org=org-a') return first.promise;
      if (url === '/api/production-sites?org=org-b') return second.promise;
      throw new Error('Unexpected request: ' + url);
    },
  };
  const original = Object.getOwnPropertyDescriptors(globalThis);
  let renderer: ReactTestRenderer | undefined;
  t.after(async () => {
    try {
      await act(async () => {
        renderer?.unmount();
        first.resolve(firstResponse);
        second.resolve(secondResponse);
      });
    } finally {
      hooks.deregister();
      for (const key of Object.keys(globals)) {
        if (original[key]) Object.defineProperty(globalThis, key, original[key]);
        else Reflect.deleteProperty(globalThis, key);
      }
    }
  });
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }

  const { default: ProductionAreas } = await import('../components/ProductionAreas.tsx');
  await act(async () => { renderer = create(React.createElement(ProductionAreas)); });
  assert.ok(renderer);
  const view = renderer;
  const select = () => view.root.findByType('select');
  const text = () => JSON.stringify(view.toJSON());

  assert.deepEqual(requests, ['/api/network/orgs', '/api/production-sites?org=org-a']);
  assert.equal(select().props.value, 'org-a');
  assert.ok(text().includes('Loading production areas…'));
  assert.ok(!text().includes(firstRow) && !text().includes(secondRow));

  await act(async () => select().props.onChange({ target: { value: 'org-b' } }));
  assert.equal(select().props.value, 'org-b');
  assert.deepEqual(requests, [
    '/api/network/orgs', '/api/production-sites?org=org-a', '/api/production-sites?org=org-b',
  ]);
  await act(async () => second.resolve(secondResponse));
  assert.ok(text().includes(secondRow), 'The newer organisation row must render before the older response settles.');

  await act(async () => first.resolve(firstResponse));
  assert.ok(text().includes(secondRow), 'The newer organisation row must survive the late response.');
  assert.ok(!text().includes(firstRow));
});
