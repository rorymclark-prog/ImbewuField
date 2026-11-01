import assert from 'node:assert/strict';
import test from 'node:test';
import { buildNurseryForecast } from '@/lib/crop-export-schedule';
import { buildNurseryCsv } from '@/lib/nursery-export';
import type { PlanBed, Planting } from '@/lib/crop-plan';
import type { NurserySettings } from '@/lib/nursery-settings';

const beds: PlanBed[] = [{ id: 'bed', label: 'Measured bed', areaM2: 0.4 }];
const rows: Planting[] = [{ id: 'crop', bedId: 'bed', cropKey: 'cabbage', sowMonth: 11, once: '2026-11', variety: 'Recorded cultivar' }];
const settings: NurserySettings = { version: 1,
  containers: [{ id: 'tray', siteId: 'farm', name: 'Own tray', cells: 3, widthCm: 50, lengthCm: 40, owned: 0 }],
  spaces: [{ id: 'bench', siteId: 'farm', name: 'Own net surface', usableM2: 0 }],
  profiles: [{ id: 'profile', siteId: 'farm', cropKey: 'cabbage', model: 'seed-cell', germinationPercent: 50,
    nurserySurvivalPercent: 50, fieldSurvivalPercent: 50, nurseryWeeks: 20, containerId: 'tray', spaceId: 'bench' }],
};

// Parse quoted newlines and doubled quotes so a malformed escape cannot hide
// a second spreadsheet row behind a test that only searches the raw string.
function readCsv(csv: string): Record<string, string>[] {
  const table: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false;
  const content = csv.replace(/^\uFEFF/, '');
  for (let i = 0; i < content.length; i++) {
    const character = content[i];
    if (character === '"') {
      if (quoted && content[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && character === ',') { row.push(cell); cell = ''; }
    else if (!quoted && character === '\r' && content[i + 1] === '\n') {
      row.push(cell); table.push(row); row = []; cell = ''; i++;
    } else cell += character;
  }
  assert.equal(quoted, false, 'all quoted fields close');
  const headers = table.shift()!;
  return table.map((values) => {
    assert.equal(values.length, headers.length, 'user text cannot create extra columns');
    return Object.fromEntries(headers.map((header, i) => [header, values[i]]));
  });
}

const forecast = () => buildNurseryForecast(rows, beds, 'farm', settings, { year: 2026, month: 11 });

test('nursery CSV carries the same dated cohort ranges, readiness conflict and grower basis as the reviewed forecast', () => {
  const calculation = forecast(); const before = JSON.stringify(calculation);
  const csv = buildNurseryCsv(calculation, beds, { siteName: 'Grower farm' });
  assert.ok(csv.startsWith('\uFEFF'));
  const entries = readCsv(csv); const cohort = entries.find((row) => row.record_type === 'cohort')!;
  assert.equal(cohort.sow_month, '2026-11'); assert.equal(cohort.working_field_month, '2027-01');
  assert.equal(cohort.bed_ids, 'bed'); assert.equal(cohort.bed_labels, 'Measured bed');
  assert.equal(cohort.variety, 'Recorded cultivar'); assert.equal(cohort.phase, 'planned');
  assert.equal(cohort.field_positions_min, '1'); assert.equal(cohort.field_positions_max, '3');
  assert.equal(cohort.starts_min, '2'); assert.equal(cohort.starts_max, '6');
  assert.equal(cohort.seeds_min, '8'); assert.equal(cohort.seeds_max, '24');
  assert.equal(cohort.trays_min, '3'); assert.equal(cohort.trays_max, '8');
  assert.ok(Math.abs(Number(cohort.area_m2_min) - 0.6) < 1e-10); assert.equal(cohort.area_m2_max, '1.6');
  assert.equal(cohort.tray_footprint_m2, '0.2'); assert.equal(cohort.readiness_conflict, 'yes');
  assert.equal(cohort.nursery_model, 'seed-cell'); assert.match(cohort.assumptions, /germination: 50%/);
  assert.match(cohort.assumptions, /nursery survival: 50%/); assert.match(cohort.assumptions, /field survival: 50%/);
  assert.match(cohort.assumptions, /20 weeks/); assert.match(cohort.issues, /field dates have not moved/);
  assert.equal(cohort.end_date_exclusive, calculation.cohorts[0].endDateExclusive);
  assert.equal(JSON.stringify(calculation), before, 'export formats the forecast without changing it');
});

test('material, space and stock shortages export with actual weekly dates and separate seasonal uses', () => {
  const calculation = forecast(); const entries = readCsv(buildNurseryCsv(calculation, beds));
  const container = entries.find((row) => row.record_type === 'resource_simultaneous_peak' && row.resource_type === 'container_stock_trays')!;
  assert.equal(container.capacity, '0'); assert.equal(container.shortage_upper_end, '8');
  assert.equal(container.trays_max, String(calculation.containers[0].peak![1]));
  const space = entries.find((row) => row.record_type === 'resource_simultaneous_peak' && row.resource_type === 'net_usable_space_m2')!;
  assert.equal(space.capacity, '0'); assert.equal(space.shortage_upper_end, '1.6');
  const week = entries.find((row) => row.record_type === 'resource_week')!;
  assert.equal(week.start_date, '2026-11-01'); assert.equal(week.end_date_exclusive, '2026-11-08');
  assert.equal(entries.filter((row) => row.record_type === 'overall_week').length, calculation.weeks.length);
  assert.equal(entries.filter((row) => row.record_type === 'cumulative_tray_uses').length, 1);
  assert.match(entries[0].assumptions, /not exact sowing dates/);
});

test('unknown values remain explicit unknown markers while known zero seed measurements stay zero', () => {
  const config = structuredClone(settings);
  config.profiles[0] = { ...config.profiles[0], model: 'measured-tray', usableStartsPerTray: 10, seedsPerTray: 0 };
  delete config.containers[0].lengthCm; delete config.containers[0].owned;
  const calculation = buildNurseryForecast(rows, beds, 'farm', config, { year: 2026, month: 11 });
  const entries = readCsv(buildNurseryCsv(calculation, beds, { sample: true }));
  const cohort = entries.find((row) => row.record_type === 'cohort')!;
  assert.equal(cohort.seeds_min, '0'); assert.equal(cohort.seeds_max, '0');
  assert.equal(cohort.area_m2_min, 'unknown'); assert.equal(cohort.tray_footprint_m2, 'unknown');
  assert.equal(cohort.nursery_model, 'measured-tray'); assert.match(cohort.assumptions, /seeds per tray: 0/);
  assert.equal(cohort.incomplete, 'yes'); assert.match(cohort.plan_basis, /DEMO/);
  const resource = entries.find((row) => row.record_type === 'resource_simultaneous_peak' && row.resource_type === 'container_stock_trays')!;
  assert.equal(resource.capacity, 'unknown'); assert.equal(resource.shortage_upper_end, 'unknown');
});

test('farmer labels cannot execute spreadsheet formulas or split CSV rows and columns', () => {
  const config = structuredClone(settings); config.containers[0].name = '  =1+1'; config.spaces[0].name = '@SUM(1,2)';
  const dangerousBeds = [{ ...beds[0], label: '\t+SUM(1,2)\n"Bed"' }];
  const dangerousRows = [{ ...rows[0], variety: '-1+2' }];
  const calculation = buildNurseryForecast(dangerousRows, dangerousBeds, 'farm', config, { year: 2026, month: 11 });
  const original = JSON.stringify({ calculation, dangerousBeds });
  const entries = readCsv(buildNurseryCsv(calculation, dangerousBeds, { siteName: '\n =HYPERLINK("x")' }));
  const cohort = entries.find((row) => row.record_type === 'cohort')!;
  assert.equal(cohort.site_name, '\'\n =HYPERLINK("x")');
  assert.equal(cohort.variety, '\'-1+2');
  assert.equal(cohort.bed_labels, '\'\t+SUM(1,2)\n"Bed"');
  // Saved resource names are trimmed by the nursery settings authority.
  assert.equal(cohort.container_name, '\'=1+1'); assert.equal(cohort.space_name, '\'@SUM(1,2)');
  assert.equal(entries.filter((row) => row.record_type === 'cohort').length, 1);
  assert.equal(JSON.stringify({ calculation, dangerousBeds }), original);
});
