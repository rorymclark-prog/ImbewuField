import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import * as Icons from 'lucide-react';
import { controlT, type ControlLanguage } from './control-icon-renderers.ts';

// Exercise the shipped component, hooks and handlers with isolated storage, never a user's consent.
const source = ts.createSourceFile('PopiaConsent.tsx', readFileSync(new URL('../components/PopiaConsent.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const code = ts.transpileModule(source.statements.filter(s => !ts.isImportDeclaration(s)).map(s => s.getText(source)).join('\n').replace('export default ', ''), { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2022 } }).outputText;
export function actualConsent(initialLanguage: ControlLanguage, initialStorage: Record<string,string> = { 'qa::permamap_onboarded': '1' }) {
  let lang = initialLanguage;
  const values = new Map(Object.entries(initialStorage));
  const writes: Array<{key:string;value:string}> = [];
  const removed: string[] = [];
  const scope = { React, ...Icons, ...React, window: {}, localStorage: {
    getItem: (key:string) => values.get(key) ?? null,
    setItem: (key:string,value:string) => { writes.push({key,value}); values.set(key,value); },
  }, activeAccountLocalStorageKey: (key:string) => 'qa::' + key,
  removeSignedInLegacyLocalStorageKey: (key:string) => removed.push(key),
  useLanguage: () => ({ lang, t:controlT(lang) }),
  translate: (language:ControlLanguage,key:string) => controlT(language)(key),
  };
  const Component = new Function('scope', `with(scope){${code};return PopiaConsent;}`)(scope);
  let renderer!: ReactTestRenderer;
  act(() => { renderer = create(React.createElement(Component)); });
  return {
    renderer, values, writes, removed,
    button(key:string) { return renderer.root.findByProps({ 'aria-label': controlT(lang)(key) }); },
    click(key:string) { act(() => { this.button(key).props.onClick(); }); },
    language(next:ControlLanguage) { lang=next; act(() => renderer.update(React.createElement(Component))); },
    text() { return JSON.stringify(renderer.toJSON()); },
    dispose() { act(() => renderer.unmount()); },
  };
}
export function consentRecord(harness: ReturnType<typeof actualConsent>) {
  assert.equal(harness.writes.length,1,'one record is written only on completion');
  assert.equal(harness.writes[0].key,'qa::imbewu_popia');
  return JSON.parse(harness.writes[0].value);
}
