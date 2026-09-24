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


import { reportSectionsForGeneration, PLANTING_SUITABILITY_PROMPT } from '../lib/report-planting-guide.ts';
import { listedPlantMentions, reportPlantingCandidates } from '../lib/report-planting-safety.ts';
test('legacy planting section selections become one suitability request without mutating saved choices', () => {
  const saved = ['Natural Vegetation & Biome', 'Fruit, Nut & Berry Trees', 'Indigenous Trees', 'Agroecosystem Planting Guide', 'Planting Calendar'];
  const before = [...saved];
  assert.deepEqual(reportSectionsForGeneration(saved), ['Natural Vegetation & Biome', 'Suitable Plants for This Site', 'Planting Calendar']);
  assert.deepEqual(saved, before);
  for (const heading of ['Vegetables, staples and herbs', 'Fruit, nuts and berries', 'Useful indigenous plants']) assert.ok(PLANTING_SUITABILITY_PROMPT.includes(heading));
});

test('site report candidates cannot put listed invasive plants back into the planting advice', () => {
  for (const [biome, minimum] of [['SAVANNA', 5.4], ['SAVANNA', -1.9], ['IOCB', 12.6], ['FYNBOS', 9.2]] as const) {
    const candidates = reportPlantingCandidates(biome, minimum);
    assert.ok(candidates.length > 0, `${biome} must still have planting choices`);
    assert.deepEqual(listedPlantMentions(candidates), [], `${biome} includes a listed plant`);
  }
  assert.match(reportPlantingCandidates('SAVANNA', 5.4), /Mango/);
  assert.doesNotMatch(reportPlantingCandidates('SAVANNA', -1.9), /Mango/);
  assert.doesNotMatch(reportPlantingCandidates('SAVANNA', 5.4), /Guava/);
  assert.ok(listedPlantMentions('| Guava | grows well |').includes('guava'));
  assert.ok(listedPlantMentions('Plant Passiflora edulis on the fence').includes('passiflora edulis'));
  assert.deepEqual(listedPlantMentions('Black mulberry and Cape silver willow are choices'), []);
  assert.match(reportRoute, /if \(listedPlantMentions\(text\)\.length > 0\) continue/);
});
