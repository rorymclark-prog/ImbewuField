import { writeFileSync } from 'node:fs';
import { buildDemoCropPlan, buildDemoFacilitatorState, buildDemoSavedPlace } from '@/lib/demo-farm';
const design = buildDemoFacilitatorState();
// An "old saved plan": the sample plan's sowings, dated before the 10 November correction, with no calendar choice field.
const plan = { version: 1, plantings: buildDemoCropPlan().plantings, updatedAt: Date.UTC(2026, 8, 1) };
writeFileSync(process.argv[2], JSON.stringify({ design: JSON.stringify(design), plan: JSON.stringify(plan), places: JSON.stringify([buildDemoSavedPlace()]) }));
console.log('design bytes', JSON.stringify(design).length, '| plantings', plan.plantings.length, '| has bgSite', !!(design as any).bgSite);
