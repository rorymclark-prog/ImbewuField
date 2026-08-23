// The guide price used to be printed beside an empty price box and deliberately never written
// into it, on the reasoning that a researched guide is not an agreed price. That reasoning is
// sound and the outcome was not: the number the farmer needed was already on the screen, and
// the app made them retype it into the field directly beneath it, on a phone, for every line.
//
// So it is filled in — and the whole point of these tests is that filling it in does not turn a
// guide into a claim. A suggested price stays labelled as a suggestion, a price the farmer types
// is never touched again, and the suggestion follows the buyer because farm-gate and bulk are
// different prices for the same crate.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PAGE = readFileSync(fileURLToPath(new URL('../app/invoice/page.tsx', import.meta.url)), 'utf8');

test('choosing a crop fills the guide price in, rather than leaving the box empty', () => {
  assert.match(
    PAGE,
    /const guide = unit === 'kg' \? guidePriceFor\(crop, wholesaleBuyer\) : null;/,
    'chooseCrop no longer looks up a guide price for the chosen crop',
  );
  assert.match(
    PAGE,
    /price: guide, priceFromGuide: true/,
    'the looked-up guide price is not written into the line',
  );
});

test('a remembered product price beats the published guide', () => {
  // What this farmer actually charged this buyer last time is better evidence than any
  // national figure, so the guide must never overwrite it.
  const chooseCrop = PAGE.slice(PAGE.indexOf('function chooseCrop'), PAGE.indexOf('function selectBuyer'));
  const rememberedAt = chooseCrop.indexOf('remembered.price');
  const guideAt = chooseCrop.indexOf('guidePriceFor');
  assert.ok(rememberedAt >= 0 && guideAt >= 0, 'chooseCrop lost either the remembered price or the guide');
  assert.ok(rememberedAt < guideAt, 'the guide is consulted before the remembered price');
});

test('a suggested price says it is a suggestion', () => {
  // A number that appeared by itself in a price box, with nothing marking it as ours, is
  // exactly the "plausible value standing in for a real one" failure this repo keeps hitting.
  assert.match(
    PAGE,
    /Suggested price filled in — change it if you agreed something else\./,
    'nothing on the line tells the farmer the price was filled in for them',
  );
  assert.match(PAGE, /\{it\.priceFromGuide && \(/, 'the suggestion label is not conditional on the flag');
});

test('typing a price clears the flag, so the app never re-prices that line again', () => {
  assert.match(
    PAGE,
    /price: Math\.max\(0, parseFloat\(e\.target\.value\) \|\| 0\), priceFromGuide: false/,
    'editing the price field leaves the line still marked as a suggestion',
  );
  assert.match(
    PAGE,
    /\{ price: 0, priceFromGuide: false \}/,
    'switching away from kg leaves a per-kg suggestion flagged on a non-kg line',
  );
});

test('the suggestion follows the buyer, but only while it is still a suggestion', () => {
  const effect = PAGE.slice(PAGE.indexOf('A suggested price follows the buyer'));
  assert.ok(effect.length > 0, 'the buyer-change re-price effect is gone');
  const body = effect.slice(0, effect.indexOf('}, [wholesaleBuyer'));
  assert.match(
    body,
    /if \(!item\.priceFromGuide \|\| item\.unit !== 'kg'\) return item;/,
    'the re-price pass does not skip lines the farmer has priced themselves',
  );
  assert.match(effect, /\}, \[wholesaleBuyer, priceOverrides\]\);/, 'the effect no longer runs when the buyer changes');
});

test('the buyer type picks which side of the guide is suggested', () => {
  // Selling at the farm gate and selling into a spaza shop are different prices, and the
  // guide publishes both. Suggesting the retail figure to a bulk buyer would overstate it.
  assert.match(
    PAGE,
    /const value = wholesale \? guide\.wholesalePerKg : guide\.retailPerKg;/,
    'guidePriceFor ignores whether the buyer is a bulk buyer',
  );
  assert.match(
    PAGE,
    /const wholesaleBuyer = WHOLESALE_BUYERS\.includes\(billTo\.trim\(\)\.toLocaleLowerCase\('en-ZA'\)\);/,
    'the wholesale-buyer test is gone',
  );
});

test('an unpriced crop leaves the box empty rather than suggesting zero', () => {
  // coriander and true-spinach are deliberately unpriced (see lib/crop-prices.ts). A zero
  // suggestion on an invoice line is a price, and a wrong one.
  assert.match(
    PAGE,
    /return Number\.isFinite\(value\) && value > 0 \? value : null;/,
    'guidePriceFor can return a zero or non-finite price',
  );
  assert.match(
    PAGE,
    /: \{ \.\.\.item, desc: crop, unit, price: 0, priceFromGuide: false \}/,
    'a crop with no guide is not left honestly unpriced',
  );
});
