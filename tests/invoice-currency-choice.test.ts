import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createElement, type ComponentType, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import {
  INVOICE_PILOT_CURRENCIES,
  type InvoiceCurrencyBasis,
  type InvoicePilotCurrency,
} from '../lib/invoice-currency.ts';
import type { InvoiceCurrencyChoiceProps } from '../components/invoice/InvoiceCurrencyChoice.tsx';

// Anchor createRequire directly at the actual component file URL
// so transpiled relative imports (e.g. '../../lib/invoice-currency.ts') resolve faithfully.
const componentUrl = new URL(
  '../components/invoice/InvoiceCurrencyChoice.tsx',
  import.meta.url,
);
const componentRequire = createRequire(componentUrl);

let Component: ComponentType<InvoiceCurrencyChoiceProps> | undefined;

function getComponent(): ComponentType<InvoiceCurrencyChoiceProps> {
  if (!Component) {
    const source = readFileSync(componentUrl, 'utf8');
    const code = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    const module = { exports: {} as { default: ComponentType<InvoiceCurrencyChoiceProps> } };
    new Function('require', 'module', 'exports', code)(
      componentRequire,
      module,
      module.exports,
    );
    Component = module.exports.default;
  }
  return Component;
}

test('new mode renders select with disabled blank option, lang=en, existing CSS vars, and all six pilot currencies in exact order', () => {
  const Comp = getComponent();
  const html = renderToStaticMarkup(
    createElement(Comp, {
      mode: 'new',
      value: '',
      onChange: () => {},
      id: 'custom-choice-id',
    }),
  );

  assert.ok(html.includes('lang="en"'), 'Outer container must have lang="en"');
  assert.ok(html.includes('<label for="custom-choice-id"'), 'Label must link to select id');
  assert.ok(html.includes('Currency for this invoice'), 'Accessible label text present');
  assert.ok(html.includes('<select id="custom-choice-id"'), 'Select element rendered');
  assert.ok(
    html.includes('aria-describedby="custom-choice-id-help"'),
    'Help text linked via aria-describedby',
  );
  assert.ok(
    html.includes(
      'Choose the currency agreed with the buyer. Changing this choice does not convert amounts.',
    ),
    'Help text rendered',
  );

  // Existing CSS variables used, no invented palette variables
  assert.ok(html.includes('var(--bg-1)'), 'Must use existing var(--bg-1)');
  assert.ok(html.includes('var(--border)'), 'Must use existing var(--border)');
  assert.ok(html.includes('var(--text-primary)'), 'Must use existing var(--text-primary)');
  assert.ok(!html.includes('--surface-subtle'), 'Must not contain invented --surface-subtle');
  assert.ok(!html.includes('--border-subtle'), 'Must not contain invented --border-subtle');

  // Blank placeholder option must be disabled
  // React adds selected="" for the controlled blank value. Attribute ordering
  // and that truthful selection must not weaken the disabled-placeholder rule.
  assert.match(html, /<option\b(?=[^>]*\bvalue="")(?=[^>]*\bdisabled(?:="")?)(?=[^>]*\bselected(?:="")?)[^>]*>Choose invoice currency<\/option>/,
    'the blank placeholder stays selected and disabled, without choosing a currency');

  // All 6 options in order
  const expectedLabels = [
    'ZAR — Rand',
    'KES — Kenyan Shilling',
    'GBP — Pound Sterling',
    'USD — US Dollar',
    'EUR — Euro',
    'BRL — Brazilian Real',
  ];

  let lastIndex = 0;
  for (let i = 0; i < INVOICE_PILOT_CURRENCIES.length; i++) {
    const code = INVOICE_PILOT_CURRENCIES[i];
    const label = expectedLabels[i];
    const optSnippet = `<option value="${code}">${label}</option>`;
    const idx = html.indexOf(optSnippet);
    assert.ok(idx > -1, `Option snippet missing: ${optSnippet}`);
    assert.ok(idx > lastIndex, `Option ${code} out of expected order`);
    lastIndex = idx;
  }
});

test('new mode invokes onChange callback strictly for recorded pilot values via actual element onChange', () => {
  const Comp = getComponent();

  for (const code of INVOICE_PILOT_CURRENCIES) {
    let calledWith: InvoicePilotCurrency | null = null;
    const el = createElement(Comp, {
      mode: 'new',
      value: '',
      onChange: (selected) => {
        calledWith = selected;
      },
    }) as ReactElement;

    // Call actual rendered component function directly to get VDOM and invoke onChange
    const vdom = (Comp as (props: InvoiceCurrencyChoiceProps) => ReactElement)(el.props);
    const selectEl = vdom.props.children[1];
    assert.equal(selectEl.type, 'select');

    selectEl.props.onChange({ target: { value: code } });
    assert.equal(calledWith, code, `onChange should have been invoked with ${code}`);
  }
});

test('new mode never invokes onChange for blank, lowercase, whitespace, or unsupported codes', () => {
  const Comp = getComponent();

  const invalidValues = [
    '',
    '   ',
    'zar',
    'ZAR ',
    ' ZAR',
    'CAD',
    'AUD',
    'XYZ',
    'null',
    'undefined',
  ];

  for (const val of invalidValues) {
    let callCount = 0;
    const el = createElement(Comp, {
      mode: 'new',
      value: '',
      onChange: () => {
        callCount++;
      },
    }) as ReactElement;

    const vdom = (Comp as (props: InvoiceCurrencyChoiceProps) => ReactElement)(el.props);
    const selectEl = vdom.props.children[1];

    selectEl.props.onChange({ target: { value: val } });
    assert.equal(callCount, 0, `onChange must NOT be invoked for ${JSON.stringify(val)}`);
  }
});

test('locked mode renders legacy-rand basis with historical rand text, lang=en, and no select', () => {
  const Comp = getComponent();
  const html = renderToStaticMarkup(
    createElement(Comp, {
      mode: 'locked',
      basis: { status: 'legacy-rand', currency: 'ZAR' },
    }),
  );

  assert.ok(html.includes('lang="en"'), 'Outer container must have lang="en"');
  assert.ok(!html.includes('<select'), 'Locked mode must not render select');
  assert.ok(html.includes('Historical rand invoice — currency unchanged'));
  assert.ok(html.includes('Currency for this invoice'));
  assert.ok(html.includes('var(--bg-1)'), 'Must use existing var(--bg-1)');
  assert.ok(html.includes('var(--border)'), 'Must use existing var(--border)');
});

test('locked mode renders recorded pilot basis with code, name, and immutability notice', () => {
  const Comp = getComponent();

  const expectedNames: Record<InvoicePilotCurrency, string> = {
    ZAR: 'Rand',
    KES: 'Kenyan Shilling',
    GBP: 'Pound Sterling',
    USD: 'US Dollar',
    EUR: 'Euro',
    BRL: 'Brazilian Real',
  };

  for (const code of INVOICE_PILOT_CURRENCIES) {
    const html = renderToStaticMarkup(
      createElement(Comp, {
        mode: 'locked',
        basis: { status: 'recorded', currency: code },
      }),
    );

    assert.ok(!html.includes('<select'), 'Locked mode must not render select');
    assert.ok(html.includes(`${code} — ${expectedNames[code]}`));
    assert.ok(html.includes('Currency cannot be changed on this saved record.'));
  }
});

test('locked mode renders held basis with review notice, existing warning border variable, and no fallback', () => {
  const Comp = getComponent();

  const heldBases: InvoiceCurrencyBasis[] = [
    { status: 'held', reason: 'currency-outside-pilot' },
    { status: 'held', reason: 'currency-property-unreadable' },
    { status: 'held', reason: 'invoice-shape-unreadable' },
  ];

  for (const basis of heldBases) {
    const html = renderToStaticMarkup(
      createElement(Comp, {
        mode: 'locked',
        basis,
      }),
    );

    assert.ok(!html.includes('<select'), 'Locked mode must not render select');
    assert.ok(html.includes('Currency needs review'));
    assert.ok(html.includes('var(--gold, var(--border))'), 'Must use existing gold warning border');
    assert.ok(!html.includes('Historical rand invoice'));
  }
});

test('locked mode with malformed recorded basis outside pilot falls back to currency needs review', () => {
  const Comp = getComponent();
  // Simulated runtime mismatch where basis claims recorded status for unverified currency
  const html = renderToStaticMarkup(
    createElement(Comp, {
      mode: 'locked',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      basis: { status: 'recorded', currency: 'CAD' as any },
    }),
  );

  assert.ok(!html.includes('<select'), 'Locked mode must not render select');
  assert.ok(html.includes('Currency needs review'));
  assert.ok(!html.includes('CAD —'));
});

test('locked mode with conflicting legacy-rand basis (currency !== ZAR) renders currency needs review', () => {
  const Comp = getComponent();
  // Malformed runtime legacy-rand basis claiming a non-ZAR currency
  const html = renderToStaticMarkup(
    createElement(Comp, {
      mode: 'locked',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      basis: { status: 'legacy-rand', currency: 'USD' as any },
    }),
  );

  assert.ok(!html.includes('<select'), 'Locked mode must not render select');
  assert.ok(html.includes('Currency needs review'), 'Conflicting legacy-rand basis must be held as needs review');
  assert.ok(!html.includes('Historical rand invoice'), 'Must never claim historical rand for non-ZAR legacy basis');
});
