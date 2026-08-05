import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('Finances puts harvest logging one tap from the harvested-kilogram figure', () => {
  const source = readFileSync(new URL('../app/finances/page.tsx', import.meta.url), 'utf8');
  const harvestLinks = source.match(/href="\/farmer\?panel=Farm"/g) ?? [];

  assert.equal(harvestLinks.length, 2, 'desktop and phone finance views must both link to the existing harvest form');
  assert.match(source, /<Sprout size=\{16\} \/>Log harvest/, 'the phone action must say what it records');
  assert.match(source, /<Sprout size=\{15\} \/>Log harvest/, 'the desktop action must say what it records');
});
