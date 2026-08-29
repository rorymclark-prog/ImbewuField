/**
 * The /pitch projector deck — source-shape pins.
 *
 * The deck's whole pitch is "this is the live app, not a mockup": two slides
 * embed the real product as same-origin iframes in sample mode. These tests pin
 * the load-bearing wiring — the things that, if silently lost, turn the deck
 * into a broken frame in front of a funder:
 *
 *   1. Sample mode is entered on mount, BEFORE any live slide can render, so
 *      the iframes' same-origin sessionStorage read finds the flag set.
 *   2. The iframes stay same-origin relative paths — an absolute URL would pin
 *      the deck to production even when presented from a preview deploy, and
 *      would break the sessionStorage sharing that makes sample mode work.
 *   3. The app chrome stays off the deck: /pitch is in NO_FLOATING_BACK and
 *      ChatWidget's skip list (a chat FAB floating over a slide — and over the
 *      live app already embedded in it — is two apps fighting one screen).
 *   4. The print stylesheet exists (P = the email-ahead PDF) and live frames
 *      print as labelled pointers, never as blank iframe boxes.
 *   5. The numbers a funder will read aloud match the concept note's verified
 *      set. If one of these changes for real, change it here and there together.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NO_FLOATING_BACK } from '../lib/back-routes.ts';

const page = readFileSync(new URL('../app/pitch/page.tsx', import.meta.url), 'utf8');
const chatWidget = readFileSync(new URL('../components/ChatWidget.tsx', import.meta.url), 'utf8');
const sampleBanner = readFileSync(new URL('../components/SampleModeBanner.tsx', import.meta.url), 'utf8');

test('sample mode is entered on mount, and live iframes mount only after a visit', () => {
  assert.match(
    page,
    /enterSampleMode/,
    'the deck must enter sample mode itself — the iframes cannot; they only read the flag'
  );
  // The mount effect calls it; the iframes are gated behind the visited set so
  // the flag is always set before the first live frame asks for the app.
  assert.match(page, /setSampleOk\(enterSampleMode\(\)\)/, 'entry happens in the mount effect');
  assert.match(page, /visited\.has\(/, 'live frames are gated on the visited-slide set');
});

test('live frames are same-origin relative paths, never absolute URLs', () => {
  assert.match(page, /src="\/farmer\?panel=Overview"/, 'the phone slide embeds /farmer');
  assert.match(page, /src="\/funder"/, 'the funder slide embeds /funder');
  assert.doesNotMatch(
    page,
    /src="https?:\/\//,
    'an absolute iframe src would break preview presenting and sessionStorage sharing'
  );
});

test('the deck owns its screen: no floating back, no chat FAB, no sample banner', () => {
  assert.ok(NO_FLOATING_BACK.has('/pitch'), '/pitch must opt out of the floating back button');
  assert.match(
    chatWidget,
    /pathname\.startsWith\('\/pitch'\)/,
    'ChatWidget must skip /pitch — the FAB would float over the slides'
  );
  // Found live on the preview: the global sample banner floated over every slide with an
  // "Exit sample" button — a control that would break the live slides mid-presentation.
  // The banner still shows INSIDE the embedded app frames, where it is true and useful.
  assert.match(
    sampleBanner,
    /pathname\.startsWith\('\/pitch'\)/,
    'SampleModeBanner must skip /pitch — Exit sample over a projected slide kills the demo'
  );
});

test('print gives the email-ahead PDF: page rule, and pointers where live frames sat', () => {
  assert.match(page, /@media print/, 'the print stylesheet is the PDF path');
  assert.match(page, /size:\s*A4 landscape/, 'slides print as landscape pages');
  assert.match(page, /print-fallback/, 'live slides print as labelled pointers');
  const printBlock = page.slice(page.indexOf('@media print'));
  assert.ok(
    printBlock.includes('.live-embed') && printBlock.includes('display: none !important'),
    'iframes must not print as blank boxes'
  );
});

test('the numbers a funder reads aloud match the concept note', () => {
  for (const fact of [
    '197 species',
    '33-lesson course in 10 modules',
    'R150',
    'R18.75',
    'R75,000',
    'R145,000',
    'R45,000',
    'R112,500',
    'Ubhejane Cr',
  ]) {
    assert.ok(page.includes(fact), `deck lost a verified fact: ${fact}`);
  }
});
