import test from 'node:test';
import { controlT, type ControlLanguage } from './control-icon-renderers.ts';
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
  productTourLocalizationIsComplete, productTourStepCopy, productTourUi, productTourError, tourDraftDisclosureEnglish,
} from '../lib/sample-tour-localization';
import { XH_INLINE_SOURCE } from '../lib/locales/xh-inline/index';
import { AF_INLINE_SOURCE } from '../lib/locales/af-inline/index';
import { INLINE_DRAFT_LANGS, isInlineDraftLang, registerInlineDrafts, registerXhInline } from '../lib/xh-inline';

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
  assert.equal(productTourUi('tipAria', 'zu', { current: 2, total: 3, title: 'Isihloko' }), 'Ithiphu 2 kwezingu-3: Isihloko',
    'feature progress keeps its index, total and translated title in the accessible isiZulu label');
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
      // w14: /tour's header is components/layout/AppHeader now (MenuButton · BackButton · BrandLogo ·
      // title in one place); it is page chrome, not tour behaviour, so it is stubbed like the rest.
      if (['@/components/MenuButton', '@/components/BackButton', '@/components/SettingsButton', '@/components/BrandLogo', '@/components/TabBar', '@/components/layout/AppHeader'].includes(specifier)) return { url: emptyComponent, shortCircuit: true };
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
  const context: LangCtx = { lang: pageHarness.lang, setLang: () => {}, t: controlT((['zu','st','ts','ve'].includes(pageHarness.lang)?pageHarness.lang:'en') as ControlLanguage), onboarded: true, completeOnboarding: () => {} };
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

// English source now lives in labelled, collapsed details. The contract is native primary
// instructions plus exact source backing, rather than absence of English anywhere in the tree.
function tourNodeText(node:any,skipEnglish=false):string {
  if(typeof node==='string'||typeof node==='number')return String(node);
  if(skipEnglish&&node.props?.lang==='en')return '';
  return (node.children??[]).map((child:any)=>tourNodeText(child,skipEnglish)).join('');
}
test('draft-language stop cards visibly carry disclosure and native primary instructions with exact English source backing', () => {
 for(const lang of ['zu','st','ts','ve']){
  const renderer=renderTour(tourState(),lang);
  try{
   const notes=renderer.root.findAllByProps({role:'note'}).map(n=>tourNodeText(n)).join('\n');
   assert.ok(notes.includes(productTourUi('draftDisclosure',lang)!));
   const primary=PRODUCT_TOUR.map(step=>{const p=renderer.root.findByProps({id:`tour-${step.id}-description`});assert.equal(tourNodeText(p),productTourStepCopy(step,lang).task);return tourNodeText(p);}).join('\n');
   if(lang==='zu'){assert.match(notes,/Uhlaka lwesiZulu olungakabuyekezwa/);assert.match(primary,/Buka izithombe zengadi/);}
   assert.doesNotMatch(primary,/Browse garden photos, layouts and grower profiles/);
   for(const step of PRODUCT_TOUR){const details=renderer.root.findAllByType('details').find(n=>tourNodeText(n).includes(step.task));assert.ok(details,step.id+' source is available');assert.notEqual(details.props.open,true,'English source starts collapsed');assert.ok(details.findAllByProps({lang:'en'}).some(n=>tourNodeText(n).includes(step.task)));}
  }finally{act(()=>renderer.unmount());}
 }
});
test('isiXhosa /tour shows its own drafted disclosure and a collapsed English source on every stop, chosen by the draft-language check not a literal list', () => {
  registerXhInline(XH_INLINE_SOURCE);
  assert.deepEqual([...INLINE_DRAFT_LANGS], ['xh', 'af']);
  assert.equal(isInlineDraftLang('xh'), true);
  assert.equal(isInlineDraftLang('af'), true);
  for (const other of ['en', 'zu', 'st', 'ts', 've']) assert.equal(isInlineDraftLang(other), false, `${other} is not an inline-draft language`);
  // The notice is bound to the English sentence carrying the language's own name, so a second draft language gets its own.
  assert.equal(tourDraftDisclosureEnglish('xh'), 'Unreviewed isiXhosa draft: titles, tasks and tips are translated to match the English text. They need review by a good isiXhosa speaker who knows how this app is used.');
  assert.match(tourDraftDisclosureEnglish('af'), /^Unreviewed Afrikaans draft: titles, tasks and tips .* a good Afrikaans speaker /);
  const disclosure = productTourUi('draftDisclosure', 'xh');
  assert.ok(disclosure && disclosure !== tourDraftDisclosureEnglish('xh') && disclosure.startsWith('Idrafti yesiXhosa'), 'the isiXhosa disclosure is the draft, not the English');
  const renderer = renderTour(tourState(), 'xh');
  try {
    const notes = renderer.root.findAllByProps({ role: 'note' }).map((n) => tourNodeText(n)).join('\n');
    assert.ok(notes.includes(disclosure!), 'the disclosure note is on the page');
    const details = renderer.root.findAllByType('details');
    assert.equal(details.length, PRODUCT_TOUR.length, 'every stop keeps its exact English source');
    for (const step of PRODUCT_TOUR) {
      const own = details.find((n) => tourNodeText(n).includes(step.task));
      assert.ok(own && own.props.open !== true, `${step.id}: English source starts collapsed`);
    }
  } finally { act(() => renderer.unmount()); }
  const english = renderTour(tourState(), 'en');
  try { assert.equal(english.root.findAllByType('details').length, 0, 'English shows no draft source'); } finally { act(() => english.unmount()); }
  // The in-flow guide dialog and the page share one condition; the dialog used to leave isiXhosa out.
  const provider = readFileSync(new URL('../components/ProductTourProvider.tsx', import.meta.url), 'utf8');
  assert.match(provider, /const draftLang = \['zu','st','ts','ve'\]\.includes\(lang\) \|\| isInlineDraftLang\(lang\)/);
  assert.equal((provider.match(/\{draftLang&&</g) ?? []).length, 2, 'the dialog notice and its English source (the error line shares the condition too)');
  assert.match(provider, /\{draftLang&&<p className=\{styles\.notice\} role="note">\{tourUi\('draftDisclosure', ''\)\}<\/p>\}/);
  const page = readFileSync(new URL('../app/tour/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /const draftLang = \['zu','st','ts','ve'\]\.includes\(lang\) \|\| isInlineDraftLang\(lang\)/);
  assert.doesNotMatch(page, /lang\s*===\s*'xh'/, 'no literal isiXhosa comparison left on /tour');
});

test('Afrikaans /tour shows its own drafted disclosure and a collapsed English source on every stop, with isiXhosa unchanged', () => {
  registerXhInline(XH_INLINE_SOURCE);
  registerInlineDrafts('af', AF_INLINE_SOURCE);
  const english = tourDraftDisclosureEnglish('af');
  assert.equal(english, 'Unreviewed Afrikaans draft: titles, tasks and tips are translated to match the English text. They need review by a good Afrikaans speaker who knows how this app is used.');
  const disclosure = productTourUi('draftDisclosure', 'af');
  assert.ok(disclosure && disclosure !== english && disclosure.startsWith('Onhersiene Afrikaanse konsep'), 'the Afrikaans disclosure is the draft, not the English');
  // isiXhosa keeps its own sentence.
  assert.ok(productTourUi('draftDisclosure', 'xh')!.startsWith('Idrafti yesiXhosa'));
  // The minutes line reads the Afrikaans minutes, not the isiZulu duration the provider hands over.
  assert.equal(productTourUi('aboutMinutes', 'af', { duration: 'imizuzu engu-5' }), 'Ongeveer 5 minute');
  const renderer = renderTour(tourState(), 'af');
  try {
    const notes = renderer.root.findAllByProps({ role: 'note' }).map((n) => tourNodeText(n)).join('\n');
    assert.ok(notes.includes(disclosure!), 'the disclosure note is on the page');
    const details = renderer.root.findAllByType('details');
    assert.equal(details.length, PRODUCT_TOUR.length, 'every stop keeps its exact English source');
    for (const step of PRODUCT_TOUR) {
      const own = details.find((n) => tourNodeText(n).includes(step.task));
      assert.ok(own && own.props.open !== true, `${step.id}: English source starts collapsed`);
    }
  } finally { act(() => renderer.unmount()); }
});

test('tour setup errors stay native while their exact English source is separately labelled', () => {
 const source='The example farm could not load. Please try again.';
 for(const lang of ['zu','st','ts','ve']){
  const renderer=renderTour(tourState({error:source}),lang);
  try{const alert=renderer.root.findByProps({role:'alert'});assert.equal(tourNodeText(alert,true),productTourError(source,lang));if(lang==='zu')assert.equal(tourNodeText(alert,true),'Ipulazi lesibonelo alikwazanga ukuvuleka. Sicela uzame futhi.');const english=alert.findByType('small');assert.equal(english.props.lang,'en');assert.equal(english.children.at(-1),source);}finally{act(()=>renderer.unmount());}
 }
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
