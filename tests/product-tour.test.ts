import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import {
  FARM_TOUR, PRODUCT_TOUR, PRODUCT_TOUR_FEATURES, cleanTourProgress, cleanProductTourProgress,
  nextProductTourStep, sampleChoicesForAccount,
} from '../lib/sample-tour';
import { Ctx, type LangCtx } from '../lib/i18n-context';
import {
  PRODUCT_TOUR_FEATURES_ZU, PRODUCT_TOUR_ZU, productTourFeatureCopy,
  productTourLocalizationIsComplete, productTourStepCopy, productTourUi,
} from '../lib/sample-tour-localization';

test('isiZulu tour copy covers every source stop and tip while preserving the English destinations', () => {
  assert.equal(productTourLocalizationIsComplete(), true);
  assert.deepEqual(Object.keys(PRODUCT_TOUR_ZU).sort(), PRODUCT_TOUR.map(step => step.id).sort());
  assert.deepEqual(Object.keys(PRODUCT_TOUR_FEATURES_ZU).sort(), Object.keys(PRODUCT_TOUR_FEATURES).sort());
  for (const step of PRODUCT_TOUR) {
    const translated = productTourStepCopy(step, 'zu');
    assert.ok(translated.title && translated.task, step.id);
    assert.deepEqual(productTourStepCopy(step, 'en'), step, `English copy remains the source for ${step.id}`);
    assert.equal(step.href, PRODUCT_TOUR.find(source => source.id === step.id)?.href, `route stays fixed for ${step.id}`);
    const sourceTips = PRODUCT_TOUR_FEATURES[step.id] ?? [];
    for (let index = 0; index < sourceTips.length; index += 1) {
      assert.ok(productTourFeatureCopy(step.id, index, 'zu', sourceTips[index])?.text, `${step.id} tip ${index + 1}`);
    }
  }
  assert.match(productTourUi('draftDisclosure', 'zu') ?? '', /Uhlaka lwesiZulu olungakabuyekezwa/);
});

test('the short product tour includes grower tools, support and both partner views', () => {
  assert.equal(PRODUCT_TOUR.reduce((minutes, step) => minutes + step.minutes, 0), 15);
  assert.equal(new Set(PRODUCT_TOUR.map(step => step.id)).size, PRODUCT_TOUR.length);
  assert.ok(PRODUCT_TOUR.every(step => Number.isInteger(step.minutes) && step.minutes > 0));
  const destinations = new Set(PRODUCT_TOUR.flatMap(step => [step.href, step.secondaryHref].filter(Boolean)));
  for (const required of ['/student', '/farmer?panel=Ask', '/invoice', '/mentor', '/ngo', '/funder', '/feedback']) {
    assert.ok(destinations.has(required), `The tour must demonstrate ${required}`);
  }
  assert.ok(destinations.has('/records?tab=charts'), 'The money step must open the figures it asks visitors to compare');
  assert.ok(destinations.has('/reports'), 'The saved-site report workspace must be reachable beyond the separate evidence pack');
  assert.equal(PRODUCT_TOUR.find(step => step.id === 'report')?.href, '/samples/farm#report',
    'The timed report stop needs the ready evidence export, not an empty saved-report library or a paid AI request');
});

test('the opening is visual and the planning action opens an editable step', () => {
  assert.equal(PRODUCT_TOUR[0].href, '/samples/gardens', 'Visitors should see garden examples before depending on live map tiles');
  const map = new URL(PRODUCT_TOUR[0].secondaryHref!, 'https://imbewufield.vercel.app');
  assert.equal(map.pathname, '/farmer');
  assert.equal(map.searchParams.get('site'), 'demo-place-ubhejane', 'The optional map must focus the saved example');
  const planning = PRODUCT_TOUR.find(step => step.id === 'planning')!;
  assert.equal(new URL(planning.href, 'https://imbewufield.vercel.app').searchParams.get('simple'), '1',
    'Move and Undo must open Planting rather than the read-only Review step');
});

test('every tour action leads to an existing app page without an external redirect', () => {
  for (const step of PRODUCT_TOUR) {
    assert.equal(!!step.secondaryHref, !!step.secondaryLabel, `${step.id} secondary action needs a destination and label`);
    for (const href of [step.href, step.secondaryHref].filter((value): value is string => !!value)) {
      assert.match(href, /^\/(?!\/)/);
      const url = new URL(href, 'https://imbewufield.vercel.app');
      assert.equal(url.origin, 'https://imbewufield.vercel.app');
      assert.ok(existsSync(new URL(`../app${url.pathname}/page.tsx`, import.meta.url)), `Missing page: ${href}`);
    }
  }
});

test('tour progress discards malformed and stale values without marking unseen stops complete', () => {
  for (const invalid of [undefined, null, '', 42, { garden: true }]) {
    assert.deepEqual(cleanProductTourProgress(invalid), []);
  }
  assert.deepEqual(cleanProductTourProgress(['garden', 'garden', 'planning', 'map', null, {}, 'missing']), ['garden', 'planning']);
  assert.equal(nextProductTourStep(undefined)?.id, 'garden');
  assert.equal(nextProductTourStep(['garden', 'planning', 'funder'])?.id, 'learning');
  assert.equal(nextProductTourStep(PRODUCT_TOUR.map(step => step.id)), undefined);
});

test('the broader tour preserves existing farm progress and account sample restrictions', () => {
  assert.equal(FARM_TOUR.reduce((minutes, step) => minutes + step.minutes, 0), 15);
  assert.deepEqual(cleanTourProgress(['map', 'map', 'design', 'organisation']), ['map', 'design']);
  for (const role of ['farmer', 'mentor', 'student', 'funder'] as const) {
    assert.deepEqual(sampleChoicesForAccount(role, true, true), [role]);
  }
  assert.deepEqual(sampleChoicesForAccount(null, true, true), []);
  assert.deepEqual(sampleChoicesForAccount('ngo', true, false), []);
  assert.ok(PRODUCT_TOUR.every(step => step.role !== 'admin'), 'No tour destination can grant administrator access');
});

// Mount the actual landing page: the original bug left every card inert until a tour
// had already started. Mock only its provider boundary so activation can be delayed or
// refused, as it can while an account or the sample workspace is being prepared.
type TourTestState = {
  active: boolean; ready: boolean; current: number; done: string[]; error: string;
  allowed: (index: number) => boolean; start: () => void; open: () => void; go: (index: number) => void;
};
const pageHarness = {
  value: null as TourTestState | null,
  starts: 0,
  jumps: [] as number[],
  lang: 'en' as string,
  createElement,
};
function tourState(overrides: { active?: boolean; ready?: boolean; error?: string; blocked?: number[] } = {}): TourTestState {
  return {
    active: overrides.active ?? false, ready: overrides.ready ?? true,
    current: 0, done: [] as string[], error: overrides.error ?? '',
    allowed: (index: number) => !overrides.blocked?.includes(index),
    start: () => { pageHarness.starts += 1; }, open: () => {},
    go: (index: number) => { pageHarness.jumps.push(index); },
  };
}
Object.assign(globalThis, { __imbewuTourPageHarness: pageHarness });
const moduleUrl = (source: string) => `data:text/javascript,${encodeURIComponent(source)}`;
const pageUrl = new URL('../app/tour/page.tsx', import.meta.url).href;
const providerModule = moduleUrl('export const useProductTour = () => globalThis.__imbewuTourPageHarness.value;');
const emptyComponent = moduleUrl('export default function Component() { return null; }');
const linkModule = moduleUrl('export default function Link({children, ...props}) { return globalThis.__imbewuTourPageHarness.createElement("a", props, children); }');
const cssModule = moduleUrl('export default {};');
const pageHooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === pageUrl) {
      if (specifier === '@/components/ProductTourProvider') return { url: providerModule, shortCircuit: true };
      if (specifier === 'next/link') return { url: linkModule, shortCircuit: true };
      if (specifier.endsWith('.module.css')) return { url: cssModule, shortCircuit: true };
      if (['@/components/MenuButton', '@/components/BackButton', '@/components/SettingsButton'].includes(specifier)) return { url: emptyComponent, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === pageUrl) return {
      format: 'module', shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
        fileName: 'page.tsx', compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      }).outputText,
    };
    return nextLoad(url, context);
  },
});
const { default: TourPage } = await import('../app/tour/page.tsx');
pageHooks.deregister();

function tourPageTree() {
  const context: LangCtx = { lang: pageHarness.lang, setLang: () => {}, t: key => key, onboarded: true, completeOnboarding: () => {} };
  return createElement(Ctx.Provider, { value: context }, createElement(TourPage));
}
function renderTour(value = tourState(), lang: LangCtx['lang'] = 'en') {
  pageHarness.value = value; pageHarness.starts = 0; pageHarness.jumps = []; pageHarness.lang = lang;
  let renderer!: ReactTestRenderer;
  act(() => { renderer = create(tourPageTree()); });
  return renderer;
}
function stopButtons(renderer: ReactTestRenderer) {
  return renderer.root.findAllByType('button').filter(button => button.props['data-tour-stop']);
}

test('every tour card opens its chosen stop on first entry after workspace activation succeeds', () => {
  for (let index = 0; index < PRODUCT_TOUR.length; index += 1) {
    const renderer = renderTour();
    const buttons = stopButtons(renderer);
    assert.equal(buttons.length, PRODUCT_TOUR.length, 'all stops must be actionable before Start is pressed');
    assert.equal(buttons[index].props.disabled, false);
    assert.equal(buttons[index].props['aria-label'], `Open stop ${index + 1}: ${PRODUCT_TOUR[index].title}`);
    act(() => { buttons[index].props.onClick(); });
    assert.equal(pageHarness.starts, 1);
    assert.deepEqual(pageHarness.jumps, [], 'a card must not jump before the isolated workspace is active');
    act(() => {
      pageHarness.value = { ...pageHarness.value!, active: true };
      renderer.update(tourPageTree());
    });
    assert.deepEqual(pageHarness.jumps, [index], 'first entry must jump once to the chosen stop, not stop zero');
    act(() => { renderer.unmount(); });
  }
});

test('isiZulu stop cards visibly carry the unreviewed disclosure and localized stop instructions', () => {
  const renderer = renderTour(tourState(), 'zu');
  const renderedText = renderer.root.findAllByType('p').map(node => String(node.children.join(''))).join('\n');
  assert.match(renderedText, /Uhlaka lwesiZulu olungakabuyekezwa/);
  assert.match(renderedText, /Buka izithombe zengadi/);
  assert.doesNotMatch(renderedText, /Browse garden photos, layouts and grower profiles/);
  act(() => { renderer.unmount(); });
});

test('tour setup errors are also shown in isiZulu', () => {
  const renderer = renderTour(tourState({ error: 'The example farm could not load. Please try again.' }), 'zu');
  const alert = renderer.root.findByProps({ role: 'alert' });
  assert.equal(alert.children.join(''), 'Ipulazi lesibonelo alikwazanga ukuvuleka. Sicela uzame futhi.');
  act(() => { renderer.unmount(); });
});

test('an active tour card jumps directly without restarting the existing checklist', () => {
  const renderer = renderTour({ ...tourState({ active: true }), done: ['garden', 'planning'] });
  act(() => { stopButtons(renderer)[6].props.onClick(); });
  assert.equal(pageHarness.starts, 0);
  assert.deepEqual(pageHarness.jumps, [6]);
  assert.deepEqual(pageHarness.value?.done, ['garden', 'planning']);
  act(() => { renderer.unmount(); });
});

test('tour cards preserve account restrictions and a failed start cannot later jump unexpectedly', () => {
  const blocked = renderTour(tourState({ blocked: [6] }));
  assert.equal(stopButtons(blocked)[6].props.disabled, true);
  act(() => { stopButtons(blocked)[6].props.onClick(); });
  assert.equal(pageHarness.starts, 0);
  assert.deepEqual(pageHarness.jumps, []);
  act(() => { blocked.unmount(); });

  const loading = renderTour(tourState({ ready: false }));
  assert.ok(stopButtons(loading).every(button => button.props.disabled));
  act(() => { stopButtons(loading)[0].props.onClick(); });
  assert.equal(pageHarness.starts, 0);
  act(() => { loading.unmount(); });

  const failed = renderTour();
  act(() => { stopButtons(failed)[7].props.onClick(); });
  act(() => {
    pageHarness.value = { ...pageHarness.value!, error: 'Workspace could not be prepared.' };
    failed.update(tourPageTree());
  });
  assert.deepEqual(pageHarness.jumps, []);
  act(() => {
    pageHarness.value = { ...pageHarness.value!, active: true, error: '' };
    failed.update(tourPageTree());
  });
  assert.deepEqual(pageHarness.jumps, [], 'a failed card request must not reappear during a later successful start');
  act(() => { failed.unmount(); });
});

const { recordTourOpening, dismissTourMenuTip } = await import('../lib/tour-discovery');
test('tour menu tip counts app openings once and appears after opening 30', () => {
  const rows = new Map<string,string>();
  const storage = { getItem: (k:string) => rows.get(k) ?? null, setItem: (k:string,v:string) => { rows.set(k,v); } };
  rows.set('opening-30', JSON.stringify({ openings:29 }));
  const last = recordTourOpening(storage, 'opening-30');
  assert.equal(last.openings, 30);
  assert.equal(last.menuTipDismissed, false);
  assert.equal(recordTourOpening(storage, 'opening-30').openings, 30, 'routing and repeated effects must not count as openings');
  assert.equal(dismissTourMenuTip(storage,'opening-30',last).menuTipDismissed,true);
  rows.set('opening-31', rows.get('opening-30')!);
  assert.deepEqual(recordTourOpening(storage,'opening-31'), { openings:31, menuTipDismissed:true });
  assert.equal(recordTourOpening(storage,'different-account').openings,1);
});
