// TEST-ONLY. Extracts named seams VERBATIM from components/Map.tsx and binds them to injected
// values, so a node:test can execute the component's real handler/paint/banner code against the
// production controller, adapter and user-sync bootstrap without React, Next or Mapbox.
//
// What this is: SOURCE EXTRACTION. Each seam is the exact text of one Map.tsx function, effect body or
// JSX expression, with types stripped by the TypeScript compiler. What it is not: the integrated Map
// component in a browser. Hooks are modelled (useCallback → the function, effects run in Map's
// definition order) and Draw/Firebase are fakes. MAP_TSX selects the file, so the same tests run as a
// red control against the unpatched baseline.
import { readFileSync } from 'node:fs';
import ts from 'typescript';

export const MAP_PATH = process.env.MAP_TSX ?? new URL('../components/Map.tsx', import.meta.url).pathname;
export const MAP_SOURCE = readFileSync(MAP_PATH, 'utf8');

/** Index just past the bracket that closes the one at `open`. Skips strings, templates and comments. */
function closeOf(src: string, open: number): number {
  const pairs: Record<string, string> = { '(': ')', '{': '}', '[': ']' };
  const stack: string[] = [];
  for (let i = open; i < src.length; i++) {
    const c = src[i], n = src[i + 1];
    if (c === '/' && n === '/') { i = src.indexOf('\n', i); if (i < 0) break; continue; }
    if (c === '/' && n === '*') { i = src.indexOf('*/', i + 2) + 1; continue; }
    if (c === '"' || c === "'") { for (i++; i < src.length && src[i] !== c; i++) if (src[i] === '\\') i++; continue; }
    if (c === '`') {
      for (i++; i < src.length && src[i] !== '`'; i++) {
        if (src[i] === '\\') { i++; continue; }
        if (src[i] === '$' && src[i + 1] === '{') { i = closeOf(src, i + 1) - 1; }
      }
      continue;
    }
    if (pairs[c]) stack.push(pairs[c]);
    else if (c === ')' || c === '}' || c === ']') {
      if (stack.pop() !== c) throw new Error(`seam extraction: unbalanced ${c} at ${i}`);
      if (stack.length === 0) return i + 1;
    }
  }
  throw new Error('seam extraction: no closing bracket');
}

function at(anchor: string, from = 0): number {
  const i = MAP_SOURCE.indexOf(anchor, from);
  if (i < 0) throw new Error(`source fit: anchor not found in ${MAP_PATH}: ${anchor.slice(0, 80)}`);
  if (MAP_SOURCE.indexOf(anchor, i + 1) >= 0) throw new Error(`source fit: anchor not unique: ${anchor.slice(0, 80)}`);
  return i;
}
/** `() => { … }` whose body contains `inner`, introduced by the nearest preceding `opener`. */
function arrowAround(inner: string, opener: string): string {
  const start = MAP_SOURCE.lastIndexOf(opener, at(inner)) + opener.length - '() => {'.length;
  return MAP_SOURCE.slice(start, closeOf(MAP_SOURCE, MAP_SOURCE.indexOf('{', start)));
}
/** Arrow-function text that starts right after `prefix`. */
function arrowAfter(prefix: string): string {
  const start = at(prefix) + prefix.length;
  const body = MAP_SOURCE.indexOf('{', MAP_SOURCE.indexOf('=>', start));
  return MAP_SOURCE.slice(start, closeOf(MAP_SOURCE, body));
}

export const SEAMS = {
  farmKey: () => { const m = /^const FARM_KEY = '([^']+)';$/m.exec(MAP_SOURCE); if (!m) throw new Error('source fit: FARM_KEY'); return JSON.stringify(m[1]); },
  newSyncId: () => { const p = at('function newSyncId(): string {'); return MAP_SOURCE.slice(p, closeOf(MAP_SOURCE, MAP_SOURCE.indexOf('{', p))); },
  readPaintCollection: () => arrowAfter('const readPaintCollection = '),
  restoreShapes: () => arrowAfter('const restoreShapes = useCallback('),
  redrawShapesFromStorage: () => arrowAfter('const redrawShapesFromStorage = useCallback('),
  endNativeEditEffect: () => arrowAround('if (!editingFeatureId) shapeAdapterRef.current?.endNativeEdit();', 'useEffect(() => {'),
  deferredRedrawEffect: () => arrowAround('if (!editingFeatureId && !pinDraw && !editPin && pendingRemoteRedrawRef.current) {', 'useEffect(() => {'),
  controllerEffect: () => arrowAround('const synced = !!uid && !sample;', 'useEffect(() => {'),
  accountResetEffect: () => arrowAround('// Draft sessions belong to the previous owner: dropped, never recorded as ops.', 'useEffect(() => {'),
  adapterOptions: () => { const p = at('shapeAdapterRef.current = createDrawShapeAdapter(') + 'shapeAdapterRef.current = createDrawShapeAdapter('.length; return MAP_SOURCE.slice(p, closeOf(MAP_SOURCE, p)); },
  shapeConflictText: () => { const p = MAP_SOURCE.indexOf('{', at('const SHAPE_CONFLICT_TEXT')); return MAP_SOURCE.slice(p, closeOf(MAP_SOURCE, p)); },
  syncBanner: () => {
    const open = MAP_SOURCE.indexOf('{!pinDraw && !editPin && (shapeConflicts.length > 0', at('{/* ── Shape sync v2: durability + preserved conflicts.'));
    return MAP_SOURCE.slice(open + 1, closeOf(MAP_SOURCE, open) - 1);
  },
} as const;

/** Strip types (and compile JSX to React.createElement) and evaluate `expr` with `scope` in view. */
// Transpiled once per (seam, scope names); a fresh closure per call, like a React render.
const compiled = new Map<string, (...values: unknown[]) => unknown>();
export function bind<T>(expr: string, scope: Record<string, unknown>): T {
  const names = Object.keys(scope);
  const key = `${names.join(',')}\u0000${expr}`;
  let factory = compiled.get(key);
  if (!factory) {
    const js = ts.transpileModule(`const __seam = (${expr});`, { compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None, jsx: ts.JsxEmit.React,
    }, reportDiagnostics: false }).outputText;
    factory = new Function(...names, `${js}\nreturn __seam;`) as (...values: unknown[]) => unknown;
    compiled.set(key, factory);
  }
  return factory(...names.map((n) => scope[n])) as T;
}
