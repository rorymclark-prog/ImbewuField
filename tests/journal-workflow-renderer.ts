import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { act, create, type ReactTestRenderer, type ReactTestInstance } from 'react-test-renderer';
import ts from 'typescript';
import * as journal from '../lib/field-journal.ts';
import * as view from '../lib/journal-view.ts';
import * as taskLinks from '../lib/task-record-link.ts';
import * as copy from '../lib/farm-memory-copy.ts';
import * as xhInline from '../lib/xh-inline.ts';

const require = createRequire(import.meta.url);
const css = new Proxy({}, { get: (_target, key) => key === '__esModule' ? false : String(key) });

// Exercise the shipped component handlers and effects. Only browser/framework
// boundaries are replaced; parsing, filtering and journal entry creation stay real.
function component(path: string, dependencies: Record<string, unknown>): React.ComponentType<any> {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  const javascript = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const module = { exports: {} as any };
  new Function('require', 'module', 'exports', javascript)((name: string) => {
    if (name in dependencies) return dependencies[name];
    if (name.endsWith('.module.css')) return css;
    return require(name);
  }, module, module.exports);
  return module.exports.default;
}

export async function mountJournal(options: { url?: string; entries?: journal.JournalEntry[]; simple?: boolean; failSave?: boolean; beds?: Array<{ id: string; label: string }>; lang?: string; delivery?: 'downloaded' | 'shared' | 'cancelled'; exportError?: boolean } = {}) {
  let stored = options.entries ?? [];
  const writes: journal.JournalEntry[][] = [];
  const exports: Array<{ format: string; entries: journal.JournalEntry[]; options: Record<string, unknown> }> = [];
  const historyScrolls: ScrollIntoViewOptions[] = [];
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  let url = new URL(options.url ?? 'https://farm.example/journal');
  const location = { get href() { return url.href; } };
  const router = { replace: (target: string) => { url = new URL(target, url); } };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    location, addEventListener: () => {}, removeEventListener: () => {},
    history: { state: {}, replaceState: (_state: unknown, _title: string, target: string) => { url = new URL(target, url); } },
  } });
  const dependencies: Record<string, unknown> = {
    'next/navigation': { useRouter: () => router },
    '@/lib/i18n': { useLanguage: () => ({ lang: options.lang ?? 'en', t: (key: string) => key }) },
    '@/lib/app-level': { useAppLevel: () => options.simple ? 'simple' : 'full' },
    '@/lib/field-journal': { ...journal, loadJournal: () => stored, saveJournal: (entries: journal.JournalEntry[]) => {
      writes.push(entries);
      if (!options.failSave) stored = entries;
      return { ok: !options.failSave, entries, trimmed: false };
    } },
    '@/lib/site-evidence': { resizeForStorage: async () => '' },
    '@/lib/design-beds-bridge': { bedsFromDesignCanvas: () => options.beds ?? [] },
    '@/lib/design-canvas': { loadCanvasState: () => null },
    '@/lib/saved-places': { loadPlaces: () => [], resolveMainSite: () => options.beds ? { lat: -28, lon: 30 } : null },
    '@/lib/crop-plan': { loadCropPlan: () => ({ plantings: [] }) },
    '@/lib/crop-catalog': { cropByKey: () => undefined },
    '@/lib/element-art-2': { getElementArt2: () => undefined },
    '@/lib/journal-view': view,
    '@/lib/farm-memory-copy': copy,
    // The isiXhosa layer (lib/xh-inline) is real: with no locale chunk registered it returns the English.
    '@/lib/xh-inline': xhInline,
    '@/components/LanguageDraftNote': { __esModule: true, default: ({ lang }: { lang: string }) => lang === 'zu' ? React.createElement('p', { role: 'note', lang }, copy.farmMemoryText(lang, 'draftNotice')) : null },
    '@/lib/task-record-link': taskLinks,
    '@/lib/sample-mode': { isSampleMode: () => false },
    '@/lib/journal-export': {
      downloadJournalCsv: async (entries: journal.JournalEntry[], exportOptions: Record<string, unknown>) => { if (options.exportError) throw Error('File unavailable'); exports.push({ format: 'csv', entries, options: exportOptions }); return options.delivery ?? 'downloaded'; },
      downloadJournalHtml: async (entries: journal.JournalEntry[], exportOptions: Record<string, unknown>) => { if (options.exportError) throw Error('File unavailable'); exports.push({ format: 'html', entries, options: exportOptions }); return options.delivery ?? 'downloaded'; },
    },
    '@/lib/use-escape-close': { useEscapeClose: () => {} },
    '@/lib/use-dialog-focus': { useDialogFocus: () => {} },
    './journal-labels': { formatZuluJournalDate: journal.formatJournalDate, formatZuluMonth: journal.monthLabelOf, formatXhosaJournalDate: journal.formatJournalDate, formatXhosaMonth: journal.monthLabelOf, journalCategoryLabel: (key: string) => key },
    './JournalPhotoReview': { __esModule: true, default: () => null },
    'next/link': { __esModule: true, default: ({ children, ...props }: any) => React.createElement('a', props, children) },
  };
  const Sheet = component('components/journal/JournalEntrySheet.tsx', dependencies);
  dependencies['./JournalEntrySheet'] = { __esModule: true, default: Sheet };
  const FieldJournal = component('components/journal/FieldJournal.tsx', dependencies);
  let renderer!: ReactTestRenderer;
  try {
    await act(async () => { renderer = create(React.createElement(FieldJournal), {
      createNodeMock: element => element.type === 'div' && element.props.className === 'resultBar'
        ? { scrollIntoView: (options: ScrollIntoViewOptions) => historyScrolls.push(options) }
        : null,
    }); });
  } catch (error) {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    throw error;
  }
  return {
    renderer, Sheet, writes, exports, historyScrolls,
    get url() { return url; },
    get stored() { return stored; },
    async close() {
      await act(async () => renderer.unmount());
      if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
      else Reflect.deleteProperty(globalThis, 'window');
    },
  };
}

export function renderedText(node: ReactTestInstance): string {
  return node.children.map(child => typeof child === 'string' ? child : renderedText(child)).join('');
}
export function renderedButton(renderer: ReactTestRenderer, label: string): ReactTestInstance {
  return renderer.root.findAllByType('button').find(node => renderedText(node) === label)!;
}
export function journalFixture(id: string, title: string, date: string, cropName: string): journal.JournalEntry {
  return { id, title, date, cropName, notes: '', category: 'planting', createdAt: 1, updatedAt: 1 };
}
