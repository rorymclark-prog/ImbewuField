import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import type { MonthlyProductionPreview } from '../lib/international/projects/monthly-production-preview.ts';

const hooks = registerHooks({
  load(url, context, next) {
    if (url.endsWith('/components/crops/ProjectMonthlyProductionPreview.tsx')) {
      return {
        format: 'module',
        shortCircuit: true,
        source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
          compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ESNext,
            jsx: ts.JsxEmit.ReactJSX,
          },
        }).outputText,
      };
    }
    return next(url, context);
  },
});

const { default: ProjectMonthlyProductionPreview } = await import('../components/crops/ProjectMonthlyProductionPreview.tsx');
after(() => hooks.deregister());

function text(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join('');
}

test('monthly records are read on open, cleared on close and hidden when the scope changes', t => {
  let readCount = 0;
  let nextResult: MonthlyProductionPreview = {
    status: 'ready',
    rows: [
      { month: '2026-10', label: 'Actual fixture', quantity: 0, unit: 'kg', status: 'actual' },
      { month: '2026-09', label: 'Estimate fixture', quantity: 15, unit: 'items', status: 'expected' },
    ],
  };

  const readPreview = () => {
    readCount++;
    return nextResult;
  };

  let renderer!: ReactTestRenderer;
  const mount = (key = 'initial') => {
    act(() => {
      renderer = create(React.createElement(ProjectMonthlyProductionPreview, { key, readPreview }));
    });
  };

  mount();
  t.after(() => act(() => renderer.unmount()));

  // 1. Initial render shows trigger button, reader not called
  assert.equal(readCount, 0);
  const openBtn = renderer.root.findAllByType('button').find(b => text(b) === 'Preview saved monthly records');
  assert.ok(openBtn);

  // 2. Click open -> reader invoked once
  act(() => {
    openBtn.props.onClick();
  });
  assert.equal(readCount, 1);

  const rows = renderer.root.findAllByType('li').map(text);
  assert.equal(rows.length, 2);
  assert.match(rows[0], /Actual fixture2026-100 kgActual record/);
  assert.match(rows[1], /Estimate fixture2026-0915 itemsEstimate/);

  // 3. Click close -> closes preview
  const closeBtn = renderer.root.findAllByType('button').find(b => text(b) === 'Close preview');
  assert.ok(closeBtn);
  act(() => {
    closeBtn.props.onClick();
  });

  assert.equal(readCount, 1);
  assert.ok(renderer.root.findAllByType('button').some(b => text(b) === 'Preview saved monthly records'));
  assert.equal(renderer.root.findAllByType('section').length, 0);

  // 4. Next open invokes the fresh reader with updated result
  nextResult = { status: 'ready', rows: [] };
  const reOpenBtn = renderer.root.findAllByType('button').find(b => text(b) === 'Preview saved monthly records')!;
  act(() => {
    reOpenBtn.props.onClick();
  });
  assert.equal(readCount, 2);
  assert.ok(text(renderer.root).includes('No monthly records are available for this site’s private preview.'));

  // 5. Keyed remount resets the open preview back to initial closed trigger
  act(() => renderer.update(React.createElement(ProjectMonthlyProductionPreview, { key: 'remounted-scope', readPreview })));
  assert.equal(readCount, 2);
  assert.equal(renderer.root.findAllByType('section').length, 0);
  assert.ok(renderer.root.findAllByType('button').some(b => text(b) === 'Preview saved monthly records'));
});

test('held saved records show a status distinct from an empty result', t => {
  let readCount = 0;
  const readPreview = (): MonthlyProductionPreview => {
    readCount++;
    return { status: 'held' };
  };

  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(React.createElement(ProjectMonthlyProductionPreview, { readPreview }));
  });

  t.after(() => act(() => renderer.unmount()));
  const openBtn = renderer.root.findAllByType('button').find(b => text(b) === 'Preview saved monthly records')!;
  act(() => {
    openBtn.props.onClick();
  });

  assert.equal(readCount, 1);
  const content = text(renderer.root.findByProps({ role: 'status' }));
  assert.ok(content.includes('Monthly records could not be verified from the saved plan.'));
  assert.ok(!content.includes('No monthly records are available for this site’s private preview.'));
});
