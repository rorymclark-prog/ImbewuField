import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const reportRoute = readFileSync(new URL('../app/api/generate-report/route.ts', import.meta.url), 'utf8');
const reportView = readFileSync(new URL('../components/ReportView.tsx', import.meta.url), 'utf8');

function quotedValues(source: string, expression: RegExp): string[] {
  const match = source.match(expression);
  assert.ok(match, `could not find ${expression}`);
  return [...match[1].matchAll(/'([^']+)'/g)].map((item) => item[1]);
}

test('report route, report selector, and prompt template advertise the same sections', () => {
  const known = quotedValues(reportRoute, /const KNOWN_SECTIONS = new Set\(\[([\s\S]*?)\]\);/);
  const all = quotedValues(reportView, /const ALL_SECTIONS = \[([\s\S]*?)\] as const;/);
  const template = [...reportRoute.matchAll(/sections\.includes\('([^']+)'\)/g)].map((match) => match[1]);

  assert.deepEqual(new Set(known), new Set(all), 'API allow-list and report selector have drifted');
  assert.deepEqual(new Set(template), new Set(all), 'prompt template sections have drifted from the selector');
});
