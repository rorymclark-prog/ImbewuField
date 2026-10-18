import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// ux-11/nav-08/ux-21 (2026-10-16 visual/UX audit): header styles disagreed across secondary
// pages, /samples named its header link and its own heading three different ways, and
// /samples/gardens nested an unstyled native <button> (its own default border/background/
// padding reading as a second card) inside each garden's .card article.
//
// w14 (desk-02/desk-04): the hand-built MenuButton · BackButton · BrandLogo · title headers these
// tests pinned were replaced by components/layout/AppHeader, which renders that exact order once
// for every page. The guarantees stay the same — title beside the logo, one back control, the
// /samples back link named by where it goes — they are now AppHeader's, so the pins follow it.

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const contact = source('../app/contact/page.tsx');
const tour = source('../app/tour/page.tsx');
const tips = source('../app/tips/page.tsx');
const feedback = source('../app/feedback/page.tsx');
const samples = source('../app/samples/page.tsx');
const samplesFarm = source('../app/samples/farm/page.tsx');
const samplesGardens = source('../app/samples/gardens/page.tsx');

test('ux-11: /contact\'s title sits next to the logo, not after the flex spacer', () => {
  assert.match(contact, /import AppHeader from '@\/components\/layout\/AppHeader';/, '/contact must use the shared header');
  const headerAt = contact.indexOf('<AppHeader');
  assert.ok(headerAt > 0);
  const header = contact.slice(headerAt, contact.indexOf('/>', headerAt));
  assert.match(header, /title=\{ui\('Contact', 'Xhumana'\)\}/, 'the page title is AppHeader\'s title, which sits right after BrandLogo');
  assert.match(header, /right=\{<LessonLink id="contact:overview"/, 'the Learn link stays at the right-hand end');
  assert.doesNotMatch(contact, /<MenuButton \/>|<BackButton |<BrandLogo \/>/, 'no second hand-built header may remain beside AppHeader');
  // AppHeader itself keeps the order this test was written to guarantee.
  const appHeader = source('../components/layout/AppHeader.tsx');
  const brandAt = appHeader.indexOf('<BrandLogo />');
  const titleAt = appHeader.indexOf('{title}', brandAt);
  const spacerAt = appHeader.indexOf('flex: 1', brandAt);
  assert.ok(brandAt > 0 && titleAt > brandAt, 'the title must come right after the logo');
  assert.ok(spacerAt < 0 || spacerAt > titleAt, 'the flex spacer must come after the title, not before it');
});

test('ux-11: tour/tips/feedback secondary pages gained a BrandLogo + title in their own header', () => {
  assert.match(source('../components/layout/AppHeader.tsx'), /<BrandLogo \/>/, 'AppHeader must render BrandLogo, or the pages below lose it');
  for (const [label, src] of [['tour', tour], ['tips', tips], ['feedback', feedback]] as const) {
    assert.match(src, /import AppHeader from '@\/components\/layout\/AppHeader';/, `${label} must import AppHeader`);
    assert.match(src, /<AppHeader[^>]*\btitle=\{/, `${label} must render AppHeader with a title`);
    assert.doesNotMatch(src, /import BrandLogo from/, `${label} must not render a second logo beside AppHeader's`);
  }
});

test('nav-08: the /samples header link no longer says "Account" while the heading says something else', () => {
  assert.doesNotMatch(samples, /<Link href="\/account">\{ui\('Account', 'I-akhawunti'\)\}<\/Link>/);
  // The header's back control is AppHeader's BackButton, falling back to /account — named by
  // where it goes — and the header title now says the same thing as the page's own heading.
  assert.match(samples, /<AppHeader backFallback="\/account" title=\{ui\('Choose a view', 'Khetha indawo yokusebenza'\)\} \/>/);
  assert.doesNotMatch(samples, /<Link href="\/account">/, 'no second, differently-worded account link may sit in the header');
});

test('nav-08: the duplicate "Choose your workspace" heading is no longer an <h2>, and the View-index chip row is gone', () => {
  assert.doesNotMatch(samples, /<h2>\{lang === 'st' \? <PairedDraft lang=\{lang\} pair=\{SESOTHO_SAMPLE_CHOOSER_DRAFT\.sectionHeading\}/, 'must not still be a second <h2>');
  // The regional-draft wiring these translation tests pin must still render and pair correctly —
  // only the *tag* changed, not the field.
  assert.match(samples, /<PairedDraft lang=\{lang\} pair=\{SESOTHO_SAMPLE_CHOOSER_DRAFT\.sectionHeading\}/, 'the Sesotho draft wiring must still be rendered somewhere');
  assert.match(samples, /<PairedDraft lang=\{lang\} pair=\{TSHIVENDA_SAMPLE_CHOOSER_DRAFT\.sectionHeading\}/, 'the Tshivenda draft wiring must still be rendered somewhere');
  assert.doesNotMatch(samples, /View index/, 'the chip row duplicating the role cards below must be gone');
});

test('ux-21/nav-10: samples/farm hides the native file input behind a styled button', () => {
  assert.match(samplesFarm, /onClick=\{\(\)=>photoInputRef\.current\?\.click\(\)\}/);
  assert.match(samplesFarm, /ref=\{photoInputRef\}[^>]*className="hidden"/);
});

test('ux-21/nav-11: samples/gardens no longer gives each card button its own default border/background', () => {
  const cardAt = samplesGardens.indexOf('{visible.map(g=>');
  assert.ok(cardAt > 0);
  const cardBlock = samplesGardens.slice(cardAt, cardAt + 1800);
  assert.match(cardBlock, /border:'none',background:'none'/, 'the inner button must not render with native button chrome');
  assert.match(cardBlock, /Open completed report \(PDF\)/, 'the report link must still exist, now inside the same actions row as the garden link');
});
