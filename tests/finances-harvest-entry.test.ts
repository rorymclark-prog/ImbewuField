import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('Finances puts harvest logging one tap from the harvested-kilogram figure', () => {
  const source = readFileSync(new URL('../app/finances/page.tsx', import.meta.url), 'utf8');
  const recordsSource = readFileSync(new URL('../app/records/page.tsx', import.meta.url), 'utf8');
  const homeSource = readFileSync(new URL('../app/home/page.tsx', import.meta.url), 'utf8');
  const harvestLinks = source.match(/href="\/records"/g) ?? [];

  assert.equal(harvestLinks.length, 2, 'desktop and phone finance views must both link to the harvest form');
  assert.match(source, /<Sprout size=\{16\} \/>Log harvest/, 'the phone action must say what it records');
  assert.match(source, /<Sprout size=\{15\} \/>Log harvest/, 'the desktop action must say what it records');
  assert.match(homeSource, /href: '\/records'.*homeQuickMyRecords/, 'the home My Records action must use the same records screen');
  assert.match(recordsSource, /<MyRecords \/>/, 'the records screen must mount the real harvest and sales forms');
  assert.doesNotMatch(recordsSource, /DataPanel|MapView/, 'logging weights must not require or render the land map');
});
