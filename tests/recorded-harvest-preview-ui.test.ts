import test, { after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { act, create, type ReactTestRenderer, type ReactTestRendererJSON } from 'react-test-renderer';
import ts from 'typescript';
import type { PreviewRecordedHarvestResult } from '@/lib/international/projects/sources';
import type { RecordedHarvestPreviewProps } from '../components/international/projects/RecordedHarvestPreview.tsx';

// Preserve original global act environment descriptor
const previousActEnv = Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

// Node 24 native type-stripping loader hook for TSX components matching existing panel test patterns
const componentUrl = new URL('../components/international/projects/RecordedHarvestPreview.tsx', import.meta.url).href;
const loaderHooks = registerHooks({
  load(url, context, next) {
    if (url === componentUrl) {
      return {
        shortCircuit: true,
        format: 'module',
        source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
          compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
        }).outputText,
      };
    }
    return next(url, context);
  },
});

const { default: RecordedHarvestPreview } = await import('../components/international/projects/RecordedHarvestPreview.tsx');

const renderers: ReactTestRenderer[] = [];
afterEach(() => {
  for (const r of renderers) {
    try {
      act(() => {
        r.unmount();
      });
    } catch {
      // Ignore cleanup on already unmounted renderers
    }
  }
  renderers.length = 0;
});

after(() => {
  // Restore preexisting act environment
  if (previousActEnv) {
    Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', previousActEnv);
  } else {
    delete (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT;
  }
  // Deregister TSX loader hook if supported by Node runtime
  if (loaderHooks && typeof (loaderHooks as unknown as { deregister?: () => void }).deregister === 'function') {
    (loaderHooks as unknown as { deregister: () => void }).deregister();
  }
});

const defaultProps: RecordedHarvestPreviewProps = {
  sites: [
    { id: 'site-a', label: 'Field Alpha' },
    { id: 'site-b', label: 'Plot Beta' },
  ],
  siteId: '',
  periodStart: '',
  periodEnd: '',
  review: null,
  busy: false,
  canLoad: false,
  sourceNotice: '',
  onSiteChange: () => {},
  onPeriodStartChange: () => {},
  onPeriodEndChange: () => {},
  onLoad: () => {},
};

function renderComponent(props: Partial<RecordedHarvestPreviewProps> = {}): ReactTestRenderer {
  let renderer: ReactTestRenderer | null = null;
  act(() => {
    renderer = create(React.createElement(RecordedHarvestPreview, { ...defaultProps, ...props }));
  });
  renderers.push(renderer!);
  return renderer!;
}

// React can split one visible inline phrase into several text nodes. Adding
// separators here would invent spaces that the real host span never renders.
function extractVisibleText(node: ReactTestRendererJSON | ReactTestRendererJSON[] | null | string): string {
  if (node === null) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(extractVisibleText).join('');
  if (!node.children) return '';
  return node.children.map(extractVisibleText).join('');
}

test('initial state renders with no auto-selection, clean guidance and disabled action', () => {
  const renderer = renderComponent();
  const root = renderer.root;

  const select = root.findByType('select');
  assert.equal(select.props.value, '');

  const dateInputs = root.findAllByType('input');
  assert.equal(dateInputs.length, 2);
  assert.equal(dateInputs[0].props.value, '');
  assert.equal(dateInputs[1].props.value, '');

  const button = root.findByType('button');
  assert.equal(button.props.disabled, true);

  assert.ok(root.findByProps({ children: 'No source review yet. Choose a saved site and reporting period to inspect eligible records.' }));
});

test('labels and heading IDs are unique across two mounted component instances', () => {
  const renderer1 = renderComponent();
  const renderer2 = renderComponent();

  const heading1 = renderer1.root.findByType('h2');
  const heading2 = renderer2.root.findByType('h2');
  assert.ok(heading1.props.id);
  assert.ok(heading2.props.id);
  assert.notEqual(heading1.props.id, heading2.props.id);

  const labels1 = renderer1.root.findAllByType('label');
  const labels2 = renderer2.root.findAllByType('label');
  assert.equal(labels1.length, 3);
  assert.equal(labels2.length, 3);

  const ids1 = labels1.map((l) => l.props.htmlFor);
  const ids2 = labels2.map((l) => l.props.htmlFor);
  assert.equal(new Set(ids1).size, 3);
  assert.equal(new Set([...ids1, ...ids2]).size, 6);

  const select = renderer1.root.findByType('select');
  assert.ok(select.props.className.includes('min-h-[44px]'));
});

test('parent callbacks fire upon site and date changes and submit triggers onLoad', () => {
  const calls: Record<string, string[]> = { site: [], start: [], end: [], load: [] };
  const renderer = renderComponent({
    siteId: 'site-a',
    periodStart: '2026-01-01',
    periodEnd: '2026-03-31',
    canLoad: true,
    busy: false,
    onSiteChange: (v) => calls.site.push(v),
    onPeriodStartChange: (v) => calls.start.push(v),
    onPeriodEndChange: (v) => calls.end.push(v),
    onLoad: () => calls.load.push('called'),
  });
  const root = renderer.root;

  act(() => {
    root.findByType('select').props.onChange({ target: { value: 'site-b' } });
    const inputs = root.findAllByType('input');
    inputs[0].props.onChange({ target: { value: '2026-02-01' } });
    inputs[1].props.onChange({ target: { value: '2026-04-30' } });
  });

  assert.deepEqual(calls.site, ['site-b']);
  assert.deepEqual(calls.start, ['2026-02-01']);
  assert.deepEqual(calls.end, ['2026-04-30']);

  const form = root.findByType('form');
  act(() => {
    form.props.onSubmit({ preventDefault: () => {} });
  });
  assert.deepEqual(calls.load, ['called']);
});

test('button is disabled when canLoad is false or busy is true', () => {
  const renderer = renderComponent({ canLoad: true, busy: true });
  const button = renderer.root.findByType('button');
  assert.equal(button.props.disabled, true);
  assert.equal(button.props.children, 'Checking records…');

  act(() => {
    renderer.update(React.createElement(RecordedHarvestPreview, { ...defaultProps, canLoad: false, busy: false }));
  });
  const button2 = renderer.root.findByType('button');
  assert.equal(button2.props.disabled, true);
  assert.equal(button2.props.children, 'Review recorded harvest');
});

test('held review displays human reason messages and never displays 0kg', () => {
  const heldReview: PreviewRecordedHarvestResult = {
    status: 'held',
    reasons: ['invalid-period-date', 'duplicate-scoped-id-in-source'],
    rows: [],
    excluded: [],
    knownSubtotalKg: null,
    projectReportAvailable: false,
  };

  const renderer = renderComponent({ review: heldReview });
  const visibleText = extractVisibleText(renderer.toJSON());
  assert.ok(visibleText.includes('Source unavailable'));
  assert.ok(visibleText.includes('Reporting dates are invalid.'));
  assert.ok(visibleText.includes('Duplicate records found for this site; review the source entries.'));
  assert.ok(!visibleText.includes('0 kg'));
  assert.ok(!visibleText.includes('0kg'));
});

test('ready review with empty source displays no eligible weights distinct from explicit zero', () => {
  const emptyReview: PreviewRecordedHarvestResult = {
    status: 'ready',
    reasons: [],
    rows: [],
    excluded: [],
    knownSubtotalKg: null,
    projectReportAvailable: false,
  };

  const renderer = renderComponent({ review: emptyReview });
  const visibleText = extractVisibleText(renderer.toJSON());
  assert.ok(visibleText.includes('Not known (no eligible recorded weights)'));
  assert.ok(!visibleText.includes('0 kg'));
});

test('ready review with explicit eligible zero displays 0 kg', () => {
  const zeroReview: PreviewRecordedHarvestResult = {
    status: 'ready',
    reasons: [],
    rows: [
      {
        reference: { authority: 'production-records', id: 'rec-0' },
        sourceRowIndex: 0,
        date: { year: 2026, month: 1 },
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
        quantityKg: 0,
      },
    ],
    excluded: [],
    knownSubtotalKg: 0,
    projectReportAvailable: false,
  };

  const renderer = renderComponent({ review: zeroReview });
  const visibleText = extractVisibleText(renderer.toJSON());
  assert.ok(visibleText.includes('0 kg'));
  assert.ok(visibleText.includes('Row #1'));
});

test('tiny positive observation 1e-7 is preserved and not rendered as 0 kg', () => {
  const tinyVal = 1e-7;
  const tinyReview: PreviewRecordedHarvestResult = {
    status: 'ready',
    reasons: [],
    rows: [
      {
        reference: { authority: 'production-records', id: 'rec-tiny' },
        sourceRowIndex: 0,
        date: { year: 2026, month: 1 },
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
        quantityKg: tinyVal,
      },
    ],
    excluded: [],
    knownSubtotalKg: tinyVal,
    projectReportAvailable: false,
  };

  const renderer = renderComponent({ review: tinyReview });
  const visibleText = extractVisibleText(renderer.toJSON());
  assert.ok(!visibleText.includes('0 kg'));
  assert.ok(!visibleText.includes('0kg'));
  assert.ok(visibleText.includes('1e-7 kg'));
});

test('ready review with decimal-sum-overflow shows unavailable subtotal with reasons and rows count', () => {
  const overflowReview: PreviewRecordedHarvestResult = {
    status: 'ready',
    reasons: ['decimal-sum-overflow'],
    rows: [
      {
        reference: { authority: 'production-records', id: 'rec-max' },
        sourceRowIndex: 0,
        date: { year: 2026, month: 1 },
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
        quantityKg: Number.MAX_VALUE,
      },
    ],
    excluded: [],
    knownSubtotalKg: null,
    projectReportAvailable: false,
  };

  const renderer = renderComponent({ review: overflowReview });
  const visibleText = extractVisibleText(renderer.toJSON());
  assert.ok(visibleText.includes('Unavailable (arithmetic limits exceeded)'));
  assert.ok(visibleText.includes('Total quantity exceeds arithmetic limits.'));
  assert.ok(visibleText.includes('Row #1'));
  assert.ok(!visibleText.includes('Not known (no eligible recorded weights)'));
});

test('partial review shows known subtotal, rows count, and human-readable exclusions without exposing raw IDs', () => {
  const partialReview: PreviewRecordedHarvestResult = {
    status: 'ready',
    reasons: [],
    rows: [
      {
        reference: { authority: 'production-records', id: 'sensitive-private-id-123' },
        sourceRowIndex: 0,
        date: { year: 2026, month: 1 },
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
        quantityKg: 12.5,
      },
    ],
    excluded: [
      {
        sourceRowIndex: 1,
        reference: { authority: 'production-records', id: 'sensitive-private-id-456' },
        reasons: ['not-actual-harvest', 'unit-not-kg'],
      },
    ],
    knownSubtotalKg: 12.5,
    projectReportAvailable: false,
  };

  const renderer = renderComponent({ review: partialReview });
  const visibleText = extractVisibleText(renderer.toJSON());
  assert.ok(visibleText.includes('12.5 kg'));
  assert.ok(visibleText.includes('Row #1'));
  assert.ok(visibleText.includes('Row #2'));
  assert.ok(visibleText.includes('Planned or estimated harvest is not an actual observation.'));
  assert.ok(visibleText.includes('Harvest unit is not kilograms (kg); no unit conversion is assumed.'));
  assert.ok(!visibleText.includes('sensitive-private-id-123'));
  assert.ok(!visibleText.includes('sensitive-private-id-456'));
});

test('escapes malicious script strings in parent sourceNotice safely as plain text', () => {
  const maliciousNotice = '<script>alert("xss")</script>';
  const renderer = renderComponent({ sourceNotice: maliciousNotice });
  const noticeBox = renderer.root.findByProps({ role: 'status' });
  assert.equal(noticeBox.props.children, maliciousNotice);
});
