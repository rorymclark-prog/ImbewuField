// Builds the full crop-plan PDF for the same farm at several South African sites, through the
// same pipeline the planner page uses (site climate -> ideal-year suggestion -> tasks -> PDF), so
// the printed document can be audited region by region instead of only for the one farm someone
// happened to export.
//
//   WATER=irrigated,rainfed node --import ./tests/register-alias.mjs scripts/crop-plan-pdf-regions.ts <out-dir> [climate-dir]
//
// [climate-dir] (default scripts/fixtures/crop-plan-regions) holds NASA POWER climatology
// responses named clim-<site>.json (T2M, PRECTOTCORR; the same parameters lib/nasa-power.ts
// reads). The script never fetches, so a regional PDF can always be rebuilt from the same climate.
// PLAN_NOW (ISO date, default 2026-09-29) sets the day the plan is made.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildCropPlanPdf } from '@/lib/crop-export-pdf';
import { buildPlanYieldBenchmark, buildYearReport, tasksForPlan, type PlanBed } from '@/lib/crop-plan';
import type { RainPattern } from '@/lib/crop-catalog';
import { suggestIdealYearPlan, type IdealYearPlan } from '@/lib/crop-plan-ideal';
import type { AutoSuggestAnswers } from '@/lib/crop-autosuggest';
import { siteClimateFromLocationData } from '@/lib/site-climate';

const SITES: { id: string; name: string; lat: number }[] = [
  { id: 'kzn-midlands', name: 'KZN Midlands (Pietermaritzburg)', lat: -29.6 },
  { id: 'durban-coast', name: 'KZN coast (Durban)', lat: -29.8 },
  { id: 'gauteng-highveld', name: 'Gauteng Highveld (Johannesburg)', lat: -26.2 },
  { id: 'western-cape', name: 'Western Cape (Stellenbosch)', lat: -33.93 },
  { id: 'limpopo-lowveld', name: 'Limpopo (Tzaneen area)', lat: -23.83 },
  { id: 'eastern-cape-mthatha', name: 'Eastern Cape (Mthatha)', lat: -31.59 },
  { id: 'free-state-bloem', name: 'Free State (Bloemfontein)', lat: -29.12 },
  { id: 'northern-cape-kimberley', name: 'Northern Cape (Kimberley)', lat: -28.74 },
];

const PATTERN_LABEL: Record<RainPattern, string> = {
  summer: 'Summer rainfall',
  winter: 'Winter rainfall',
  'all-year': 'All-year rainfall',
  'mild-frost': 'Summer rainfall · mild winter frost',
};

// The Ubhejane Creche layout from the audited export: nine 9 m² beds and four traced staple plots.
const BEDS: PlanBed[] = [
  ...Array.from({ length: 9 }, (_, i) => ({ id: `b${i + 1}`, label: `Bed ${i + 1}`, areaM2: 9, kind: 'bed' as const })),
  { id: 'p1', label: 'Plot 1', areaM2: 98.8, kind: 'plot' },
  { id: 'p2', label: 'Plot 2', areaM2: 123.1, kind: 'plot' },
  { id: 'p3', label: 'Plot 3', areaM2: 108.7, kind: 'plot' },
  { id: 'p4', label: 'Plot 4', areaM2: 96.7, kind: 'plot' },
];

const CROP_KEYS = ['maize', 'dry-beans', 'green-beans', 'butternut', 'pumpkin', 'swiss-chard', 'cabbage', 'carrots',
  'beetroot', 'onions', 'tomatoes', 'peppers', 'chilli', 'sweet-potato', 'potato', 'lettuce', 'amadumbe', 'groundnuts',
  'peas', 'broad-beans', 'broccoli', 'cucumber', 'watermelon', 'oats', 'true-spinach', 'turnip', 'amaranth', 'soybean',
  'brinjal', 'bambara-groundnut'];

const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const KEYS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function climateFor(dir: string, id: string, lat: number) {
  const raw = JSON.parse(readFileSync(join(dir, `clim-${id}.json`), 'utf8'));
  const p = raw.properties.parameter;
  // PRECTOTCORR is an average DAILY rate per month (lib/nasa-power.ts); monthly total = rate × days.
  const monthly = KEYS.map((k, i) => Math.round(p.PRECTOTCORR[k] * DAYS[i] * 10) / 10);
  const monthlyTemp = KEYS.map((k) => p.T2M[k]);
  return siteClimateFromLocationData({ rainfall: { rainfallSource: 'nasa-power', monthly }, climate: { monthlyTemp } }, lat);
}

async function main() {
  const [outDir, climateDir = join('scripts', 'fixtures', 'crop-plan-regions')] = process.argv.slice(2);
  if (!outDir) throw new Error('usage: crop-plan-pdf-regions.ts <out-dir> [climate-dir]');
  mkdirSync(outDir, { recursive: true });
  const now = new Date(process.env.PLAN_NOW ?? '2026-09-29T08:00:00.000Z');
  const nowMonth = now.getUTCMonth() + 1;
  const irrigatedModes = (process.env.WATER ?? 'irrigated').split(',');
  const summary: string[] = [];

  for (const site of SITES) {
    const climate = climateFor(climateDir, site.id, site.lat);
    if (!climate) { summary.push(`${site.id}: climate did not resolve`); continue; }
    for (const water of irrigatedModes) {
      const answers: AutoSuggestAnswers = {
        goal: 'family',
        groups: [],
        cropKeys: CROP_KEYS,
        rhythm: 'steady',
        rotateCrops: true,
        allowVinesInBeds: false,
        allowMixedCropsInBed: true,
        reliableIrrigation: water === 'irrigated',
        siteMonthlyTempC: climate.monthlyTempC,
        siteMonthlyRainMm: climate.monthlyRainMm,
        siteLatitude: site.lat,
      };
      const ideal: IdealYearPlan = suggestIdealYearPlan(answers, climate.pattern, BEDS, [], nowMonth, now.getUTCFullYear());
      const planNotes = [
        { kind: 'basis' as const, text: `Climate derived from satellite climate records for this site: ${PATTERN_LABEL[climate.pattern]}.` },
        ...ideal.best.result.notes,
      ];
      const plantings = ideal.best.result.plantings;
      const tasks = tasksForPlan(plantings, BEDS, nowMonth);
      const benchmark = buildPlanYieldBenchmark(plantings, BEDS, nowMonth);
      const blob = await buildCropPlanPdf({
        plantings,
        beds: BEDS,
        tasks,
        yearReport: buildYearReport(plantings, BEDS),
        planNotes,
        planNotesAt: now.getTime(),
        now,
        meta: {
          planTitle: `Ubhejane Creche - ${site.name}`,
          siteLine: `This site (satellite climate records) · ${PATTERN_LABEL[climate.pattern]}`,
          locationLine: 'This site (satellite climate records)',
          climateLine: PATTERN_LABEL[climate.pattern],
          rainPattern: climate.pattern,
          bedsSummary: `9 beds · 4 staple plots · ${BEDS.reduce((s, b) => s + b.areaM2, 0).toFixed(1)} m² of growing space`,
          dateLabel: now.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
          estimatedKgPerYear: benchmark.knownKg,
          lossPercent: 10,
          lossAllowanceConfirmed: true,
        },
      });
      const file = join(outDir, `${site.id}-${water}.pdf`);
      writeFileSync(file, Buffer.from(await blob.arrayBuffer()));
      summary.push(`${site.id}-${water}: ${climate.pattern} (${climate.koppen}, ${climate.annualMm} mm) · ${plantings.length} plantings · ${(blob.size / 1024).toFixed(0)} KB`);
    }
  }
  console.log(summary.join('\n'));
}

main().catch((error) => { console.error(error); process.exit(1); });
