import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import * as jsxRuntime from 'react/jsx-runtime';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

// Follow-up to tests/map-control-overlap.test.ts's 12 August collisions. Flagged this time on the
// funder dashboard, and /partners was already excluded for a related reason (see ChatWidget.tsx's
// class comment). This file covers the three routes that investigation added: /funder and /ngo
// (excluded — no fixed position is safe on either), and /invoice (repositioned — one specific
// button row at the bottom of that page's form, not a whole-page problem).

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

test('Studies and task guides keep Lima available without covering the reading', () => {
  const widget = source('../components/ChatWidget.tsx');
  const studies = source('../app/student/page.tsx');
  assert.match(widget, /if \(\s*\/\/[^\n]*\n\s*pathname === '\/student' \|\|[\s\S]*?\) return null;/);
  assert.match(studies, /import LimaBar from '@\/components\/LimaBar';/);
  assert.match(studies, /<LimaBar \/>/, 'help remains in the document flow instead of vanishing');
  const guide = source('../components/studies/AppGuidePage.tsx');
  assert.match(widget, /pathname\.startsWith\('\/student\/guides\/'\)/);
  assert.match(guide, /<LimaBar \/>/, 'guide readers still need an in-flow route to help');
  assert.match(guide, /useRegisterBackControl\(\)/, 'the My Studies link must suppress the duplicate floating Back');
});

test('/funder and /ngo are excluded — same class as /partners, not a farmer route', () => {
  const widget = source('../components/ChatWidget.tsx');

  const skipAt = widget.indexOf("pathname.startsWith('/login')");
  assert.ok(skipAt > 0, 'the exclusion block moved; this test needs rewriting rather than deleting');
  // Sliced to the real end of the condition, not a fixed 400 characters: the exclusion list grew
  // past that window when the five measured-collision routes were added, and a length guess
  // failing as the list grows reads as "/ngo stopped being excluded", which was not true.
  const skipBlock = widget.slice(skipAt, widget.indexOf(') return null;', skipAt) + ') return null;'.length);

  assert.match(skipBlock, /pathname\.startsWith\('\/funder'\)/, '/funder must be excluded');
  assert.match(skipBlock, /pathname\.startsWith\('\/ngo'\)/, '/ngo must be excluded');

  // Both must actually feed the same `return null`, not just appear somewhere nearby in a
  // sibling condition that never reaches it.
  assert.match(
    skipBlock,
    /pathname\.startsWith\('\/partners'\)\s*\|\|\s*pathname\.startsWith\('\/funder'\)\s*\|\|[\s\S]*?pathname\.startsWith\('\/ngo'\)[\s\S]*?\)\s*return null;/,
    '/funder and /ngo must be OR-ed into the same return-null condition as the other exclusions',
  );

  // /farmer solved the same class of complaint by moving, not vanishing, and still does: the map
  // is exactly where a farmer wants Lima, and its 188px offset clears the "+ Add" pill.
  assert.doesNotMatch(skipBlock, /'\/farmer'/, 'the map is exactly where a farmer wants Lima — it must not be excluded');

  // /facilitator/crops USED to be pinned here as "fixed by moving the FAB". It is not: measured on
  // 24 September the right-docked FAB still covered a Gantt bar button, because that plan scrolls
  // sideways underneath it. It is excluded now and mounts LimaBar instead, so this assertion is
  // inverted rather than deleted — the fact it protects is still a fact, just the opposite one.
  assert.match(skipBlock, /pathname\.startsWith\('\/facilitator\/crops'\)/, 'the crop plan must be excluded — moving the FAB was measured to be not enough');
});

test('/funder and /ngo do NOT get a FAB_DEFAULT_POS entry — an excluded route returns before reading it', () => {
  const widget = source('../components/ChatWidget.tsx');
  const posAt = widget.indexOf('const FAB_DEFAULT_POS');
  assert.ok(posAt > 0);
  const posBlock = widget.slice(posAt, posAt + 700);
  // If a route is excluded above, giving it a branch here is dead code that hides the real
  // shape of the ternary — and the next person to read it would reasonably assume it does
  // something.
  assert.doesNotMatch(posBlock, /\/funder/, '/funder is excluded above; it should not also appear in the position ternary');
  assert.doesNotMatch(posBlock, /\/ngo/, '/ngo is excluded above; it should not also appear in the position ternary');
});

test('/invoice raises the FAB clear of the Share PDF / Print row at the bottom of the form', () => {
  const widget = source('../components/ChatWidget.tsx');

  // Measured on the live site at 375px (sample mode, invoice with a buyer + item so the row
  // enables): the Share/Print row is the last thing in that page's scroll container, at rest
  // (scrolled to the bottom — which sending an invoice requires) it sits at viewport y:[644,689].
  // The unmodified default FAB band is y:[626,682] (bottom-130px, 56px tall) — 38 of the button's
  // 45px height, and the left third of its width, is exactly where "Share PDF" sits.
  const invoiceDefault = widget.match(/pathname\.startsWith\('\/invoice'\)\s*\n?\s*\?\s*'bottom-\[(\d+)px\] (left|right)-4/);
  assert.ok(invoiceDefault, 'ChatWidget no longer gives /invoice its own default position');
  const [, bottomPxStr, side] = invoiceDefault;
  const bottomPx = Number(bottomPxStr);

  // The button's top edge sits at viewport y:644, i.e. (812 - 644) = 168px above the bottom edge.
  // The FAB must clear that with the same kind of margin the /farmer fix used ("a thumb's width
  // to spare" — map-control-overlap.test.ts), not shave it to the exact pixel.
  const BUTTON_TOP_FROM_BOTTOM = 168;
  assert.ok(
    bottomPx >= BUTTON_TOP_FROM_BOTTOM + 4,
    `/invoice's FAB offset is ${bottomPx}px, which does not clear the Share/Print row (needs >= ${BUTTON_TOP_FROM_BOTTOM + 4}px)`,
  );
  // Horizontal position is not the fix here — the row is two flex-1 buttons spanning nearly the
  // full width (16 to 356 of 375), so moving right just trades Share PDF's collision for Print's.
  // Only a raised offset clears the row; pin that the branch did not instead (or also) flip sides.
  assert.equal(side, 'left', 'moving to the right does not clear this row — it is two buttons spanning nearly the full width');

  // w19-13 (deliberate change): /invoice IS now in the exclusion list. The raised FAB landed on
  // the "Note on the invoice" textarea on phone and on the Save row on desktop, so Lima moves into
  // the page flow (LimaBar, paired in FLOW_HELP_ROUTES below) instead of floating. The position
  // branch above stays only because tests/lima-fab-clearance.test.ts pins its shape.
  const skipAt = widget.indexOf("pathname.startsWith('/login')");
  // Sliced to the real end of the condition, not a fixed 400 characters: the exclusion list grew
  // past that window when the five measured-collision routes were added, and a length guess
  // failing as the list grows reads as "/ngo stopped being excluded", which was not true.
  const skipBlock = widget.slice(skipAt, widget.indexOf(') return null;', skipAt) + ') return null;'.length);
  assert.match(skipBlock, /\/invoice/, 'the invoice builder gets Lima in the page flow, not a floating FAB over the form');
});

// ── 24 September: the five routes where the FAB was measured on top of content ────────────────
//
// Boxes measured against the rendered pages at 390x844, sample mode on, not inferred from source.
// The FAB is fixed 56x56 at bottom:130px, z-60, and the per-page offset table above had grown one
// page at a time while these kept overlapping:
//
//   /cropplan            a task row's 20x20 "Mark done" checkbox at (33,705) — a TAP TARGET
//   /facilitator/crops   a "Green beans (69%)" Gantt bar button, even with the right-dock offset
//   /records             the "1169.6 kg" headline and its label
//   /journal             an entry's body text
//   /calendar            the Lima seasonal-advice card the FAB itself belongs to
//
// A sixth offset would have moved each problem rather than ended it: the content under the FAB is
// mid-scroll, so there is no resting position that clears it. All five (plus /finances, which
// redirects onto /records) are excluded and mount <LimaBar /> in the document flow instead — the
// swap /student and /home had already made.
//
// The pairing is the point, and it is what this test enforces: excluded WITHOUT a LimaBar is a
// page with no route to help at all, and a LimaBar WITHOUT the exclusion is both at once.
const FLOW_HELP_ROUTES: { route: string; page: string }[] = [
  { route: '/journal', page: '../app/journal/page.tsx' },
  { route: '/invoice', page: '../app/invoice/page.tsx' },
  { route: '/calendar', page: '../app/calendar/page.tsx' },
  { route: '/cropplan', page: '../app/cropplan/page.tsx' },
  { route: '/records', page: '../app/records/page.tsx' },
  { route: '/facilitator/crops', page: '../app/facilitator/crops/page.tsx' },
];

test('every route that drops the floating FAB mounts LimaBar in its place', () => {
  const widget = source('../components/ChatWidget.tsx');

  const skipAt = widget.indexOf("pathname.startsWith('/login')");
  assert.ok(skipAt > 0, 'the exclusion block moved; this test needs rewriting rather than deleting');
  const skipBlock = widget.slice(skipAt, widget.indexOf(') return null;', skipAt) + ') return null;'.length);

  for (const { route, page } of FLOW_HELP_ROUTES) {
    assert.match(
      skipBlock,
      new RegExp(`pathname\\.startsWith\\('${route}'\\)`),
      `${route} must stay excluded from the floating FAB — it was measured covering content there`,
    );
    const src = source(page);
    assert.match(src, /import LimaBar from '@\/components\/LimaBar';/, `${route} must import LimaBar`);
    assert.match(src, /<LimaBar \/>/, `${route} drops the FAB, so it owes the farmer an in-flow route to help`);
  }
});

test('/finances rides on /records rather than being forgotten', () => {
  // /finances is a server-side redirect onto /records, but it is still a route a farmer reaches
  // from an installed PWA's old tab. If the FAB ever rendered there it would render over the
  // redirect, so it is excluded with the rest.
  const widget = source('../components/ChatWidget.tsx');
  assert.match(widget, /pathname\.startsWith\('\/finances'\)/);
});

test('the /facilitator/crops right-dock offset is gone, not just overridden', () => {
  // Leaving a dead branch in the offset table is how the next person concludes the page still
  // takes a FAB and re-tunes the number instead of reading the exclusion list.
  const widget = source('../components/ChatWidget.tsx');
  const posAt = widget.indexOf('const FAB_DEFAULT_POS');
  assert.ok(posAt > 0, 'FAB_DEFAULT_POS moved');
  const table = widget.slice(posAt, widget.indexOf(';', posAt));
  assert.doesNotMatch(table, /facilitator\/crops/, 'the offset branch for an excluded route is dead code');
});

test('language worksheets replace the overlapping launcher without hiding it on other international pages', () => {
  // Reproduced at 390x844 on the final nursery preview: the launcher covers the Bengali
  // heading and first line at the bottom of the page. Evaluate the real route conditions,
  // including the clearance helper, rather than accepting a comment containing the route.
  const widget = source('../components/ChatWidget.tsx');
  const tree = ts.createSourceFile('ChatWidget.tsx', widget, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let renderCondition: ts.Expression | undefined;
  let clearanceCondition: ts.Expression | undefined;
  function visit(node: ts.Node) {
    if (ts.isIfStatement(node) && ts.isReturnStatement(node.thenStatement)
      && node.thenStatement.expression?.kind === ts.SyntaxKind.NullKeyword
      && node.expression.getText(tree).includes("pathname.startsWith('/login')")) renderCondition = node.expression;
    if (ts.isFunctionDeclaration(node) && node.name?.text === 'isLimaFabHiddenRoute') {
      const returned = node.body?.statements.find(ts.isReturnStatement);
      clearanceCondition = returned?.expression;
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.ok(renderCondition, 'the actual launcher return-null route guard must exist');
  assert.ok(clearanceCondition, 'the actual clearance route guard must exist');
  for (const expression of [renderCondition, clearanceCondition]) {
    const hidden = new Function('pathname', `return (${expression.getText(tree)});`) as (pathname: string) => boolean;
    for (const path of ['/international/locales', '/international/locales/', '/international/locales/nursery-field-planting']) {
      assert.equal(hidden(path), true, `${path} must never have a floating launcher over review text`);
    }
    for (const path of ['/international', '/international/sources', '/international/locales-archive', '/farmer']) {
      assert.equal(hidden(path), false, `${path} must retain its existing floating-help behavior`);
    }
  }
});

test('both language worksheets retain one in-flow help strip after their unchanged children', () => {
  const layout = source('../app/international/locales/layout.tsx');
  const compiled = ts.transpileModule(layout, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const inlineHelp = () => null;
  const output: { exports: { default?: (props: { children: unknown }) => unknown } } = { exports: {} };
  const requireModule = (name: string) => {
    if (name === 'react/jsx-runtime') return jsxRuntime;
    if (name === '@/components/LimaBar') return { default: inlineHelp };
    throw Error(`The review layout unexpectedly loads ${name}`);
  };
  new Function('require', 'exports', 'module', compiled)(requireModule, output.exports, output);
  assert.ok(output.exports.default);
  const worksheet = { type: 'synthetic-review-children', props: {} };
  const rendered = output.exports.default({ children: worksheet }) as {
    type: unknown;
    props: { children: unknown[]; className?: string; tabIndex?: number; role?: string; 'aria-label'?: string; 'data-language-draft-review'?: boolean };
  };
  // The app body clips a viewport-height shell. Appending help after min-h-screen children
  // without a scroll owner hides it below the viewport instead of making it available.
  assert.equal(rendered.type, 'div');
  assert.match(rendered.props.className ?? '', /(?:^|\s)h-dvh(?:\s|$)/, 'the review workspace must fit the visible viewport');
  assert.match(rendered.props.className ?? '', /(?:^|\s)overflow-y-auto(?:\s|$)/, 'long worksheets and help must share a reachable scroll area');
  assert.equal(rendered.props.tabIndex, 0, 'keyboard readers must be able to focus the scroll area');
  assert.equal(rendered.props.role, 'region');
  assert.equal(rendered.props['aria-label'], 'Language draft review');
  assert.match(rendered.props.className ?? '', /(?:^|\s)print:h-auto(?:\s|$)/, 'printing must not constrain the review region to a viewport');
  assert.match(rendered.props.className ?? '', /(?:^|\s)print:overflow-visible(?:\s|$)/, 'printing must not clip the review scroll area');
  // Child-only print classes cannot release the root body's screen-height clip. Keep this
  // escape local to the mounted worksheet, with no screen or unrelated-route override.
  const [printStyle, actualChildren, helpContainer] = rendered.props.children as [
    { type: unknown; props: { children: string } },
    unknown,
    { props: { className?: string; children: { type: unknown; props: { inPlace?: boolean } } } },
  ];
  assert.equal(rendered.props['data-language-draft-review'], true);
  assert.equal(printStyle.type, 'style');
  assert.match(printStyle.props.children, /^\s*@media print\s*\{/);
  assert.match(printStyle.props.children, /body:has\(\[data-language-draft-review\]\)\s*\{\s*height:\s*auto\s*!important;\s*overflow:\s*visible\s*!important;/);
  assert.match(printStyle.props.children, /\[data-language-draft-review\]\s+\[data-nursery-draft-comparison\]\s*\{\s*break-inside:\s*avoid;\s*page-break-inside:\s*avoid;\s*\}/,
    'the whole marked comparison stays together in print when it fits, without a global article rule');
  assert.equal(actualChildren, worksheet, 'the source/draft worksheet must be retained, not replaced by help');
  assert.equal(helpContainer.props.children.type, inlineHelp, 'use the established LimaBar so help remains available');
  assert.equal(helpContainer.props.children.props.inPlace, true, 'help must preserve the current worksheet instead of navigating away');
  assert.match(helpContainer.props.className ?? '', /(?:^|\s)print:hidden(?:\s|$)/, 'help must not add a printed worksheet page');
  assert.doesNotMatch(helpContainer.props.className ?? '', /(?:fixed|absolute|sticky)/, 'the replacement must be in flow, not another overlay');
});

test('inline help loads the photo composer only when opened and preserves the selected file and picker gesture', async () => {
  const compiled = ts.transpileModule(source('../components/LimaBar.tsx'), { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const state = { chatImports: 0, pickerClicks: 0, dialogOpens: 0, sample: true, lang: 'en' };
  const photoProps: Array<{ initialFile: unknown; appLang: string; locationData: unknown }> = [];
  const icon = () => null;
  const output: { exports: { default?: React.ComponentType<{ inPlace?: boolean }> } } = { exports: {} };
  const originalActFlag = Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true });
  const requireModule = (name: string): unknown => {
    if (name === 'react') return React;
    if (name === 'react/jsx-runtime') return jsxRuntime;
    if (name === 'lucide-react') return { Camera: icon, Loader2: icon, MessageCircleQuestion: icon, X: icon };
    if (name === '@/lib/i18n') return { useLanguage: () => ({ t: (key: string) => key, lang: state.lang }) };
    if (name === '@/lib/use-role-navigation') return { useSampleRole: () => state.sample };
    if (name === 'next/link') return { default: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => React.createElement('a', props, children) };
    if (name === 'next/dynamic') return { default: (load: () => Promise<{ default: React.ComponentType }>, options: { loading: React.ComponentType }) => {
      const Deferred = React.lazy(load);
      return (props: Record<string, unknown>) => React.createElement(React.Suspense, { fallback: React.createElement(options.loading) }, React.createElement(Deferred, props));
    } };
    if (name === './ChatPanel') {
      state.chatImports++;
      return { default: (props: typeof photoProps[number]) => { photoProps.push(props); return React.createElement('div', { 'data-photo-composer': true }); } };
    }
    throw Error(`Unexpected inline-help dependency ${name}`);
  };
  let renderer: ReactTestRenderer | undefined;
  try {
    new Function('require', 'exports', 'module', compiled)(requireModule, output.exports, output);
    assert.ok(output.exports.default);
    const Help = output.exports.default;
    const mount = (inPlace = false) => act(() => {
      renderer = create(React.createElement(Help, { inPlace }), { createNodeMock: element => {
        if (element.type === 'input') return { click: () => { state.pickerClicks++; } };
        if (element.type === 'dialog') return { showModal: () => { state.dialogOpens++; }, close: () => renderer!.root.findByType('dialog').props.onClose() };
        return null;
      } });
    });
    const photoButton = () => renderer!.root.findAllByType('button').find(button => button.children.includes('limaPhotoButton'))!;
    mount();
    assert.equal(renderer!.root.findByType('a').props.href, '/farmer?chat=1', 'existing callers keep their navigation link');
    assert.equal(state.chatImports, 0, 'reading the page must not import the full composer');
    assert.equal(photoProps.length, 0, 'reading the page must not render a composer');
    act(() => photoButton().props.onClick());
    assert.equal(state.dialogOpens, 1);
    const pending = renderer!.root.findByProps({ role: 'status' });
    assert.equal(pending.props['aria-busy'], 'true');
    assert.equal(pending.props['aria-label'], 'limaWhoIs', 'pending photo help retains an existing translated accessible name');
    await act(async () => { await Promise.resolve(); });
    assert.equal(state.chatImports, 1, 'only opening photo help imports the panel');
    assert.equal(photoProps.at(-1)?.initialFile, null);
    assert.equal(photoProps.at(-1)?.appLang, 'en');
    assert.equal(photoProps.at(-1)?.locationData, null);
    act(() => renderer!.root.findByProps({ 'aria-label': 'limaClosePhotoDialog' }).props.onClick());
    assert.equal(renderer!.root.findAllByProps({ 'data-photo-composer': true }).length, 0);
    act(() => renderer!.unmount()); renderer = undefined;

    state.sample = false;
    mount();
    act(() => photoButton().props.onClick());
    assert.equal(state.pickerClicks, 1, 'ordinary photo help must open the native picker in the tap handler');
    assert.equal(state.dialogOpens, 1, 'an unopened/cancelled picker must not open a composer');
    const chosen = new File(['synthetic image bytes'], 'synthetic-help.jpg', { type: 'image/jpeg' });
    const target = { files: [chosen], value: 'synthetic-selection' };
    await act(async () => renderer!.root.findByType('input').props.onChange({ target }));
    assert.equal(target.value, '', 'the same photo must remain selectable again');
    assert.equal(state.dialogOpens, 2);
    assert.equal(photoProps.at(-1)?.initialFile, chosen, 'deferred loading must retain the exact selected file');
    assert.equal(state.chatImports, 1, 'reopening retains normal module caching');
    act(() => renderer!.unmount()); renderer = undefined;

    state.lang = 'zu';
    mount(true);
    assert.equal(renderer!.root.findAllByType('div')[0].props.lang, 'zu', 'localized help must not inherit the English review workspace language');
    assert.equal(renderer!.root.findAllByType('a').length, 0, 'worksheet help must not navigate away');
    const ask = renderer!.root.findAllByType('button').find(button => button.findAll(node => node.children.includes('limaAskButton')).length > 0);
    assert.ok(ask, 'the worksheet retains a labelled help button');
    act(() => ask.props.onClick());
    assert.equal(state.dialogOpens, 3, 'asking from the worksheet opens the existing help dialog in place');
    assert.equal(photoProps.at(-1)?.appLang, 'zu', 'in-place help retains the chosen app language');
    assert.equal(photoProps.at(-1)?.initialFile, null);
    assert.equal(state.pickerClicks, 1, 'asking without a photo must not open a picker');
    assert.equal(state.chatImports, 1);
  } finally {
    if (renderer) act(() => renderer!.unmount());
    if (originalActFlag) Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', originalActFlag);
    else Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
  }
});
