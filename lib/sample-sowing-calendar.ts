// The sample farm's own, fixed sowing calendar.
//
// WHY THIS IS ITS OWN FILE. The sample's data normally reaches the app through
// lib/sample-mode.ts, and this accessor belongs beside the others there. But the exact
// bytes of lib/sample-mode.ts are pinned: tests/fixtures/shape-sync-old-client-5c/
// manifest.json and two translation packets record its SHA-256, and
// tests/shape-sync-v2-old-client.test.ts and tests/tour-practice-localization.test.ts
// fail if the file changes at all. Adding one function there broke both. So the accessor
// lives here and reads sample mode through that file's own isSampleMode().
//
// WHAT IT IS FOR (Rory, 10 November 2026: "go ahead with the fixed calendar for the
// sample farm"). See DEMO_SOWING_CALENDAR in lib/demo-farm.ts for the reasoning.

import type { RainPattern } from './crop-catalog';
import { DEMO_SOWING_CALENDAR, demoSowingCalendarScopeId } from './demo-farm';
import { isSampleMode } from './sample-mode';

/**
 * The sample farm's declared calendar for a plan scope, or null outside sample mode and
 * for any other site. A real farm at the very same coordinates is not the sample, and
 * another site opened inside the sample is read the ordinary way.
 */
export function sampleSowingCalendarFor(scopeId: string | null | undefined): RainPattern | null {
  return isSampleMode() && typeof scopeId === 'string' && scopeId === demoSowingCalendarScopeId() ? DEMO_SOWING_CALENDAR : null;
}
