/**
 * Prints the code-authored half of the site report for the REAL demo farm, so it can be READ.
 *
 * Not a test — a look. Every defect the report has shipped with was visible in its output and
 * invisible in a green suite, so this renders the cover, the bill of quantities, the monitoring
 * plan and the risk register from Ubhejane Crèche's actual saved plan and prints them.
 *
 *   node --import ./tests/register-alias.mjs tests/report-document-probe.ts
 */

import { buildDemoDesignCanvasState } from '../lib/demo-farm';
import { summariseDesignStudio } from '../lib/design-studio-report';
import { bedsFromDesignCanvas } from '../lib/design-beds-bridge';
import { buildBillOfQuantities, billOfQuantitiesMarkdown } from '../lib/report-boq';
import { buildMonitoringPlan, monitoringMarkdown } from '../lib/report-monitoring';
import { buildRiskRegister, riskRegisterMarkdown } from '../lib/report-risk';
import { buildCoverMarkdown } from '../lib/report-cover';
import { assembleReportDocument } from '../lib/report-assemble';
import type { ReportSiteFacts } from '../lib/report-site-facts';

const canvas = buildDemoDesignCanvasState();
const summary = summariseDesignStudio(canvas);
const planBeds = bedsFromDesignCanvas(canvas);

const beds = planBeds.map((b) => ({
  label: b.label,
  areaM2: b.areaM2,
  kind: b.kind === 'plot' ? ('plot' as const) : ('bed' as const),
}));
const bedAreaM2 = beds.filter((b) => b.kind === 'bed').reduce((s, b) => s + b.areaM2, 0);
const plotAreaM2 = beds.filter((b) => b.kind === 'plot').reduce((s, b) => s + b.areaM2, 0);

const facts: ReportSiteFacts = {
  farmName: 'Ubhejane Creche',
  design: {
    beds,
    bedCount: beds.filter((b) => b.kind === 'bed').length,
    bedAreaM2,
    plotCount: beds.filter((b) => b.kind === 'plot').length,
    plotAreaM2,
    growingAreaM2: bedAreaM2 + plotAreaM2,
    elements: summary.elements.map((g) => ({
      name: g.name, category: g.category, count: g.count, status: g.status, defId: g.defId,
    })),
    routes: summary.routes.map((r) => ({
      label: r.label, count: r.count, totalLengthM: r.totalLengthM, kind: r.kind,
    })),
    zones: [],
  },
};

const boq = buildBillOfQuantities(facts);
const risks = buildRiskRegister({
  facts,
  rainfallMm: 628,
  slopeDeg: 3,
  minTempC: 9,
  soilSource: 'estimate',
  unpricedBoqLines: boq.unpricedCount,
});

const doc = assembleReportDocument({
  cover: buildCoverMarkdown({
    farmName: 'Ubhejane Creche',
    bioregion: 'Zululand Lowveld (Savanna)',
    adminLabel: 'Mkhuze, uMkhanyakude, KwaZulu-Natal',
    lat: -27.726231,
    lon: 31.963044,
    dateLabel: '5 August 2026',
    isoDate: '2026-08-05',
    sectionCount: 14,
    lengthLabel: 'Comprehensive',
    // The probe's fixture farm has all three, which is what makes it a useful worked example.
    sources: { map: true, survey: true, cropPlan: true },
  }),
  glance: '## Site at a Glance\n\n(built elsewhere — see buildReportHeaderMarkdown)',
  body: ['## Executive Summary\n\n(generated)', '## Water Harvesting Design\n\n(generated)'],
  backMatter: [
    billOfQuantitiesMarkdown(boq),
    monitoringMarkdown(buildMonitoringPlan(facts)),
    riskRegisterMarkdown(risks),
  ],
});

console.log(doc.markdown);
console.log('\n──────────────────────────────────────────────────────────');
console.log(`sections: ${doc.sectionCount}   figures: ${doc.figureCount}`);
console.log(`BOQ: ${boq.lines.length} lines, ${boq.unpricedCount} unpriced, ${boq.existingCount} existing, subtotal R${boq.subtotalZar}`);
