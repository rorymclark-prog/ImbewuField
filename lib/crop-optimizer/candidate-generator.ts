/**
 * Legal cohorts first, selection second.
 *
 * The rebuild spec's rule is that the solver "never invents dates; it chooses
 * among source-backed candidates". Everything in this file therefore either
 * comes out of the crop catalog and the V2 phase calendar, or is reported as
 * unknown. Nothing here estimates, interpolates or fills a gap.
 *
 * A candidate is emitted only when `buildCropPhaseCalendar` — the V2 authority
 * on nursery → field → harvest — returns it with no warnings at all. That is
 * how hard constraint 2 (declared timing basis) is enforced: not by a check
 * here, but by refusing to schedule anything the foundation would not draw.
 */

import {
  addCalendarDays,
  buildCropPhaseCalendar,
} from '@/lib/crop-phase-calendar';
import type {
  CalendarDate,
  CropTimingEvidenceV2,
  DurationEvidence,
  PlacementExplanation,
  PlannedCohort,
  TimingWindowEvidence,
} from '@/lib/crop-plan-v2';
import { formatCalendarDate } from '@/lib/crop-plan-v2';
import {
  buildBedSections,
  sectionWeekResource,
  type BedSection,
} from '@/lib/crop-bed-sections';
import {
  CROPS,
  cropByKey,
  type CropDef,
  type RainPattern,
} from '@/lib/crop-catalog';
import { foodGroupOf, rotationFamilyOf, type RotationFamily } from '@/lib/crop-groups';
import {
  nurseryWeekResource,
  rotationCooldownResource,
  sectionWeekKey,
  weekIndexForDate,
  type CandidateGenerationResult,
  type CropJobKind,
  type ExactRequirement,
  type ExactResourceCapacity,
  type ExactResourceClaim,
  type HarvestWeekEntry,
  type LabourWeekEntry,
  type OptimizerCandidate,
  type RaisedBedInput,
  type RaisedBedSolverInput,
} from './types';

/**
 * KZN DARD's published figure: most vegetable transplants are ready 4–6 weeks
 * after nursery sowing in warm conditions, and the period can double in cold
 * conditions. It is the same authority the legacy engine's
 * `TRANSPLANT_ENTRY_*` constants rest on (lib/crop-plan.ts).
 *
 * It is GENERIC across vegetables, not per crop. That is a real weakness of
 * the evidence, not of the code: when per-crop nursery durations are sourced
 * they should replace this constant, and until then every transplanted
 * candidate carries this source id so the weakness stays visible.
 */
export const KZN_DARD_TRANSPLANT_READINESS: DurationEvidence = {
  days: [28, 42],
  basis: 'from-nursery-sow',
  precision: 'week-derived',
  sourceIds: ['kzn-dard:vegetable-transplant-readiness-4-6-weeks'],
};

/**
 * This repository's established month conversion (see `planningMaturityMonths`
 * in lib/crop-plan.ts, which rounds days up in 30s). Stated once so a reader
 * can see it is a convention, not a measurement.
 */
const PLANNING_DAYS_PER_MONTH = 30;

export interface CatalogTimingOptions {
  /** Replaces the generic DARD readiness figure when a per-crop one exists. */
  nurseryReadiness?: DurationEvidence;
}

function harvestWindowEvidence(
  crop: CropDef,
  maturity: DurationEvidence,
): DurationEvidence | undefined {
  // The harvest window is expressed on the SAME basis as maturity: from first
  // possible pick to last plausible pick, both measured from direct sowing or
  // plant-out. Anything else would need a basis the foundation does not have.
  const sourceIds = [`crop-catalog:${crop.key}`];
  if (crop.harvestPeriodRangeWeeks) {
    return {
      days: [maturity.days[0], maturity.days[1] + crop.harvestPeriodRangeWeeks[1] * 7],
      basis: maturity.basis,
      precision: 'week-derived',
      sourceIds,
    };
  }
  if (crop.harvestPeriodRangeMonths) {
    return {
      days: [maturity.days[0], maturity.days[1] + crop.harvestPeriodRangeMonths[1] * PLANNING_DAYS_PER_MONTH],
      basis: maturity.basis,
      precision: 'month-derived',
      sourceIds,
    };
  }
  if (crop.harvestWindowMonths !== undefined && crop.harvestWindowMonths > 0) {
    return {
      days: [maturity.days[0], maturity.days[1] + crop.harvestWindowMonths * PLANNING_DAYS_PER_MONTH],
      basis: maturity.basis,
      precision: 'month-derived',
      sourceIds,
    };
  }
  // No published picking period. The maturity range's upper end already holds
  // the bed conservatively; extending it further would be an invented number.
  return undefined;
}

/**
 * Turns a catalog entry into V2 timing evidence, or says why it cannot.
 *
 * `sourceIds` are provenance pointers (`crop-catalog:<key>`), not citations
 * invented here: each catalog entry carries its own sourced comment, and this
 * id is what lets a reviewer find it. The adapter is opt-in for exactly the
 * reason the foundation kept `CropTimingEvidenceV2` separate — a caller that
 * has better per-crop evidence should pass it instead.
 */
export function cropTimingEvidenceFromCatalog(
  crop: CropDef,
  options: CatalogTimingOptions = {},
): CropTimingEvidenceV2 {
  if (crop.timingVerified === false) {
    return {
      eligibility: 'insufficient-evidence',
      reason: `${crop.name} has no verified duration, so it cannot drive automatic scheduling.`,
    };
  }
  const range = crop.daysToHarvestRange ?? [crop.daysToHarvest, crop.daysToHarvest];
  if (!Number.isInteger(range[0]) || !Number.isInteger(range[1]) || range[0] <= 0 || range[1] < range[0]) {
    return {
      eligibility: 'insufficient-evidence',
      reason: `${crop.name} has no usable days-to-harvest range in the catalog.`,
    };
  }
  const sourceIds = [`crop-catalog:${crop.key}`];
  const maturity: DurationEvidence = {
    days: [range[0], range[1]],
    // SA production guides state a transplanted crop's growing period from
    // plant-out; a direct-sown crop's from sowing. The catalog's own
    // `transplant` flag is what distinguishes the two.
    basis: crop.transplant ? 'from-transplant' : 'from-direct-sow',
    // The sow date itself comes from a month-sized catalog window, so no
    // derived date can be more precise than the month it was chosen in.
    precision: 'month-derived',
    sourceIds,
  };
  const sowWindows: Partial<Record<RainPattern, TimingWindowEvidence>> = {};
  for (const pattern of ['summer', 'winter', 'all-year', 'mild-frost'] as const) {
    const months = crop.sowMonths[pattern];
    if (months && months.length > 0) {
      sowWindows[pattern] = { months: [...months], precision: 'month-derived', sourceIds };
    }
  }
  const nursery = crop.transplant ? options.nurseryReadiness ?? KZN_DARD_TRANSPLANT_READINESS : undefined;
  const harvest = harvestWindowEvidence(crop, maturity);
  return {
    eligibility: 'verified',
    sowWindows,
    maturity,
    ...(nursery ? { nursery } : {}),
    ...(harvest ? { harvest } : {}),
  };
}

// ---------------------------------------------------------------------------

interface PlacementUnit {
  bed: RaisedBedInput;
  sections: BedSection[];
  /** Stable, human-traceable part of the candidate id, e.g. `bed-1:AB`. */
  label: string;
  areaSqm: number | null;
  irrigated: boolean;
}

function placementUnitsForBed(bed: RaisedBedInput): PlacementUnit[] | null {
  const sections = buildBedSections({
    bedId: bed.bedId,
    layoutRevision: bed.layoutRevision,
    division: bed.division,
  });
  if (!sections) return null;
  const irrigated = bed.irrigationConfirmed === true;
  const bedArea = bed.areaSqm !== undefined && Number.isFinite(bed.areaSqm) && bed.areaSqm > 0
    ? bed.areaSqm
    : null;
  if (bed.plantWholeBed) {
    return [{
      bed,
      sections,
      label: `${bed.bedId}:${sections.map((section) => section.label).join('')}`,
      areaSqm: bedArea,
      irrigated,
    }];
  }
  return sections.map((section) => ({
    bed,
    sections: [section],
    label: `${bed.bedId}:${section.label}`,
    areaSqm: bedArea === null ? null : bedArea * section.share,
    irrigated,
  }));
}

function dateForWeekStart(anchor: CalendarDate, week: number): CalendarDate {
  return addCalendarDays(anchor, week * 7);
}

function paddedWeek(week: number): string {
  return `w${String(week).padStart(4, '0')}`;
}

function uniqueSorted(values: Iterable<number>): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

interface CropRejection {
  cropKey: string;
  code: string;
  message: string;
}

/**
 * Candidate ids sort into the same canonical order the exact oracle uses, so
 * a solver result and an oracle result can be compared directly.
 */
function candidateId(cropKey: string, unitLabel: string, startWeek: number): string {
  return `cand:${cropKey}:${unitLabel}:${paddedWeek(startWeek)}`;
}

export interface CandidateGenerationOptions {
  /** Upper bound on emitted candidates. Trimming is reported, never silent. */
  maxCandidates?: number;
  timing?: CatalogTimingOptions;
}

const DEFAULT_MAX_CANDIDATES = 3000;

/* eslint-disable-next-line complexity -- one linear generation pass; splitting it
   would move the ordered "why was this crop refused" reasons away from the
   refusal itself, which is the part that must stay readable. */
export function generateRaisedBedCandidates(
  input: RaisedBedSolverInput,
  options: CandidateGenerationOptions = {},
): CandidateGenerationResult {
  const maxCandidates = options.maxCandidates ?? DEFAULT_MAX_CANDIDATES;
  const explanations: PlacementExplanation[] = [];
  const rejections: CropRejection[] = [];
  const horizonWeeks = input.horizonWeeks;
  const cooldownWeeks = input.rotationCooldownWeeks ?? 1;
  const plotOnly = new Set(input.plotOnlyCropKeys ?? []);
  const requested = new Set(input.requestedCropKeys ?? []);
  const required = new Set(input.requiredCropKeys ?? []);

  const units: PlacementUnit[] = [];
  const sections: BedSection[] = [];
  for (const bed of input.beds) {
    const bedUnits = placementUnitsForBed(bed);
    if (!bedUnits) {
      explanations.push({
        code: 'bed-layout-invalid',
        message: `Bed "${bed.bedId}" does not describe a whole, half, third or quarter split, so nothing can be placed on it.`,
      });
      continue;
    }
    units.push(...bedUnits);
    for (const unit of bedUnits) {
      for (const section of unit.sections) {
        if (!sections.some((existing) => existing.id === section.id)) sections.push(section);
      }
    }
    if (bed.areaSqm === undefined) {
      explanations.push({
        code: 'bed-area-unknown',
        message: `Bed "${bed.bedId}" has no recorded area, so every harvest weight on it stays unknown rather than estimated.`,
      });
    }
  }

  const irrigatedSectionIds = units
    .filter((unit) => unit.irrigated)
    .flatMap((unit) => unit.sections.map((section) => section.id));

  // ---- fixed cohorts: hard constraint 9 -----------------------------------
  const fixedUse = new Map<string, number>();
  const fixedOccupiedSectionWeeks = new Set<string>();
  const fixedHarvestWeeks = new Set<number>();
  let fixedOverlap = false;
  for (const fixed of input.fixedCohorts ?? []) {
    const family = rotationFamilyForKey(fixed.cohort.cropKey);
    for (let week = fixed.fieldStartWeek; week < fixed.fieldReleaseWeek; week++) {
      if (week < 0) continue;
      for (const sectionId of fixed.cohort.location.sectionIds) {
        const resource = sectionWeekResource(sectionId, week);
        if (!resource) continue;
        const next = (fixedUse.get(resource) ?? 0) + 1;
        if (next > 1) fixedOverlap = true;
        fixedUse.set(resource, next);
        fixedOccupiedSectionWeeks.add(sectionWeekKey(sectionId, week));
      }
    }
    if (family && cooldownWeeks > 0) {
      for (let week = fixed.fieldStartWeek; week < fixed.fieldReleaseWeek + cooldownWeeks; week++) {
        if (week < 0) continue;
        for (const sectionId of fixed.cohort.location.sectionIds) {
          const resource = rotationCooldownResource(sectionId, family, week);
          if (resource) fixedUse.set(resource, Math.max(fixedUse.get(resource) ?? 0, 1));
        }
      }
    }
    for (const week of fixed.harvestWeeks ?? []) fixedHarvestWeeks.add(week);
  }
  if (fixedOverlap) {
    explanations.push({
      code: 'fixed-cohorts-overlap',
      message: 'Two crops the farmer has already recorded claim the same bed section in the same week; that layout has to be corrected before a plan can be built on it.',
    });
  }

  // ---- candidates ---------------------------------------------------------
  const byGroup = new Map<string, OptimizerCandidate[]>();
  let generated = 0;

  for (const crop of CROPS) {
    if (requested.size > 0 && !requested.has(crop.key) && !required.has(crop.key)) continue;
    if (plotOnly.has(crop.key)) {
      rejections.push({
        cropKey: crop.key,
        code: 'plot-only-crop',
        message: `${crop.name} is a staple-plot crop; the raised-bed solver does not place it. The staple-plot solver is a separate, later step.`,
      });
      continue;
    }
    const timing = cropTimingEvidenceFromCatalog(crop, options.timing);
    if (timing.eligibility !== 'verified') {
      rejections.push({ cropKey: crop.key, code: 'timing-not-verified', message: timing.reason });
      continue;
    }
    const window = timing.sowWindows[input.rainPattern];
    if (!window || window.months.length === 0) {
      rejections.push({
        cropKey: crop.key,
        code: 'no-sow-window-for-climate',
        message: `${crop.name} has no sowing window in this site's ${input.rainPattern} rainfall pattern.`,
      });
      continue;
    }
    const family = rotationFamilyForKey(crop.key);
    if (!family) {
      rejections.push({
        cropKey: crop.key,
        code: 'rotation-family-unknown',
        message: `${crop.name} has no botanical family recorded, so its rotation cannot be checked.`,
      });
      continue;
    }
    const sowMonths = new Set(window.months);
    const foodGroups = [foodGroupOf(crop)];
    const harvestUpperDays = timing.harvest?.days[1] ?? timing.maturity.days[1];
    let anyPlacement = false;
    let refusedForHorizon = false;

    for (let startWeek = 0; startWeek < horizonWeeks; startWeek++) {
      const startsOn = dateForWeekStart(input.anchorDate, startWeek);
      if (!sowMonths.has(startsOn.month)) continue;
      const transplantOn = crop.transplant && timing.nursery
        ? addCalendarDays(startsOn, timing.nursery.days[1])
        : undefined;

      for (const unit of units) {
        const cohort: PlannedCohort = {
          id: `cohort:${crop.key}:${unit.label}:${paddedWeek(startWeek)}`,
          cropKey: crop.key,
          location: {
            bedId: unit.bed.bedId,
            sectionIds: unit.sections.map((section) => section.id),
            layoutRevision: unit.bed.layoutRevision,
          },
          sowing: {
            method: crop.transplant ? 'nursery-transplant' : 'direct-sow',
            startsOn,
            ...(transplantOn ? { transplantOn } : {}),
            precision: 'month-derived',
          },
          state: 'proposed',
        };
        const calendar = buildCropPhaseCalendar({
          cohort,
          timing,
          rainPattern: input.rainPattern,
          cropName: crop.name,
        });
        if (calendar.warnings.length > 0) {
          rejections.push({
            cropKey: crop.key,
            code: 'phase-calendar-refused',
            message: calendar.warnings[0].message,
          });
          break;
        }
        const fieldPhase = calendar.phases.find((phase) => phase.kind === 'field-grow');
        const harvestPhase = calendar.phases.find((phase) => phase.kind === 'harvest-window');
        if (!fieldPhase || !harvestPhase) break;

        const fieldStartWeek = weekIndexForDate(input.anchorDate, fieldPhase.startsOn);
        const firstHarvestWeek = weekIndexForDate(input.anchorDate, harvestPhase.startsOn);
        const lastHarvestWeek = weekIndexForDate(
          input.anchorDate,
          addCalendarDays(fieldPhase.startsOn, harvestUpperDays),
        );
        if (fieldStartWeek === null || firstHarvestWeek === null || lastHarvestWeek === null) break;
        const fieldReleaseWeek = lastHarvestWeek + 1;
        if (fieldReleaseWeek > horizonWeeks) {
          refusedForHorizon = true;
          continue;
        }

        const claims: ExactResourceClaim[] = [];
        const irrigatedSectionWeekKeys: string[] = [];
        let claimsUsable = true;
        for (let week = fieldStartWeek; week < fieldReleaseWeek; week++) {
          for (const section of unit.sections) {
            const resource = sectionWeekResource(section.id, week);
            if (!resource) {
              claimsUsable = false;
              break;
            }
            claims.push({ resource, units: 1 });
            if (unit.irrigated) irrigatedSectionWeekKeys.push(sectionWeekKey(section.id, week));
          }
          if (!claimsUsable) break;
        }
        if (!claimsUsable) continue;

        if (cooldownWeeks > 0) {
          for (let week = fieldStartWeek; week < fieldReleaseWeek + cooldownWeeks; week++) {
            for (const section of unit.sections) {
              const resource = rotationCooldownResource(section.id, family, week);
              if (resource) claims.push({ resource, units: 1 });
            }
          }
        }

        const nurseryStartWeek = crop.transplant ? startWeek : undefined;
        if (input.nursery && nurseryStartWeek !== undefined) {
          for (let week = nurseryStartWeek; week < fieldStartWeek; week++) {
            const resource = nurseryWeekResource(input.nursery.nurseryId, week);
            if (resource) claims.push({ resource, units: 1 });
          }
        }

        const harvestWeeks = uniqueSorted(
          Array.from({ length: lastHarvestWeek - firstHarvestWeek + 1 }, (_, offset) => firstHarvestWeek + offset),
        ).filter((week) => week >= 0 && week < horizonWeeks);
        const expectedKgRange = expectedKgForUnit(crop, unit.areaSqm);
        const singleWeekPick = harvestWeeks.length === 1;
        const harvestProfileByWeek: HarvestWeekEntry[] = harvestWeeks.map((week) => ({
          week,
          kgLow: singleWeekPick && expectedKgRange ? expectedKgRange[0] : null,
          kgHigh: singleWeekPick && expectedKgRange ? expectedKgRange[1] : null,
        }));

        const jobs = new Map<number, CropJobKind[]>();
        const addJob = (week: number, kind: CropJobKind) => {
          if (week < 0 || week >= horizonWeeks) return;
          jobs.set(week, [...(jobs.get(week) ?? []), kind]);
        };
        if (crop.transplant) {
          addJob(startWeek, 'nursery-sow');
          addJob(fieldStartWeek, 'transplant');
        } else {
          addJob(fieldStartWeek, 'direct-sow');
        }
        addJob(firstHarvestWeek, 'harvest-start');
        const labourByWeek: LabourWeekEntry[] = [...jobs.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([week, kinds]) => ({ week, jobs: kinds }));

        const candidate: OptimizerCandidate = {
          id: candidateId(crop.key, unit.label, startWeek),
          cropKey: crop.key,
          areaId: unit.bed.bedId,
          sectionIds: cohort.location.sectionIds,
          layoutRevision: unit.bed.layoutRevision,
          ...(nurseryStartWeek !== undefined ? { nurseryStartWeek } : {}),
          fieldStartWeek,
          fieldReleaseWeek,
          harvestProfileByWeek,
          foodGroups,
          rotationFamily: family,
          expectedKgRange,
          labourByWeek,
          // The catalog carries no per-crop water requirement. Resolving this
          // to anything else would be exactly the invented placeholder the
          // rebuild spec forbids.
          waterClass: 'unknown',
          cohort,
          claims,
          irrigatedSectionWeekKeys,
        };
        const groupKey = `${crop.key}::${unit.label}`;
        byGroup.set(groupKey, [...(byGroup.get(groupKey) ?? []), candidate]);
        generated++;
        anyPlacement = true;
      }
    }

    if (!anyPlacement) {
      rejections.push({
        cropKey: crop.key,
        code: refusedForHorizon ? 'does-not-finish-in-horizon' : 'no-legal-placement',
        message: refusedForHorizon
          ? `${crop.name} cannot finish inside the ${horizonWeeks}-week horizon from any of its sowing weeks.`
          : `${crop.name} has no legal placement on these beds within the horizon.`,
      });
    }
  }

  // ---- deterministic trim -------------------------------------------------
  const groupKeys = [...byGroup.keys()].sort();
  let candidates: OptimizerCandidate[] = [];
  let trimmed = false;
  if (generated <= maxCandidates) {
    candidates = groupKeys.flatMap((key) => byGroup.get(key) ?? []);
  } else {
    // Round-robin across crop/bed groups so a cap costs later sowing weeks,
    // never a whole crop or a whole bed. The loss is reported below.
    trimmed = true;
    const cursors = groupKeys.map((key) => ({ key, index: 0 }));
    let added = true;
    while (candidates.length < maxCandidates && added) {
      added = false;
      for (const cursor of cursors) {
        const group = byGroup.get(cursor.key) ?? [];
        if (cursor.index >= group.length) continue;
        candidates.push(group[cursor.index++]);
        added = true;
        if (candidates.length >= maxCandidates) break;
      }
    }
    explanations.push({
      code: 'candidate-cap-reached',
      message: `${generated} legal placements were found and ${candidates.length} were kept. The cap drops later sowing weeks first, so every crop and bed still has candidates; raise maxCandidates to consider the rest.`,
    });
  }
  candidates.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  // ---- capacities ---------------------------------------------------------
  const capacityByResource = new Map<string, ExactResourceCapacity>();
  const declare = (resource: string, capacity: number) => {
    const existing = capacityByResource.get(resource);
    if (existing) return existing;
    const created: ExactResourceCapacity = { resource, capacity };
    capacityByResource.set(resource, created);
    return created;
  };
  const nurseryCapacity = input.nursery?.concurrentCohorts ?? 0;
  for (const candidate of candidates) {
    for (const claim of candidate.claims) {
      declare(claim.resource, claim.resource.startsWith('nursery:') ? nurseryCapacity : 1);
    }
  }
  for (const [resource, used] of fixedUse) {
    const capacity = declare(resource, resource.startsWith('nursery:') ? nurseryCapacity : 1);
    capacity.fixedUse = Math.min(used, capacity.capacity);
  }
  if (!input.nursery) {
    explanations.push({
      code: 'nursery-capacity-unknown',
      message: 'No nursery capacity was supplied, so the plan does not limit how many trays run at once. Record the nursery to have that checked.',
    });
  }

  // ---- requirements -------------------------------------------------------
  const requirements: ExactRequirement[] = [];
  for (const cropKey of required) {
    const candidateIds = candidates.filter((candidate) => candidate.cropKey === cropKey).map((c) => c.id);
    if (candidateIds.length === 0) {
      explanations.push({
        code: 'required-crop-has-no-legal-placement',
        message: `"${cropByKey(cropKey)?.name ?? cropKey}" is required, but no legal placement for it exists on these beds in this horizon.`,
      });
      continue;
    }
    requirements.push({ id: `require-crop:${cropKey}`, candidateIds, minSelected: 1 });
  }

  // One line per crop and reason, not one per refused week.
  const seenRejection = new Set<string>();
  for (const rejection of rejections) {
    const key = `${rejection.cropKey}::${rejection.code}`;
    if (seenRejection.has(key)) continue;
    seenRejection.add(key);
    explanations.push({ code: rejection.code, message: rejection.message });
  }

  return {
    candidates,
    capacities: [...capacityByResource.values()],
    requirements,
    sections,
    explanations,
    fixedOccupiedSectionWeeks: [...fixedOccupiedSectionWeeks],
    fixedHarvestWeeks: [...fixedHarvestWeeks].sort((a, b) => a - b),
    irrigatedSectionIds,
    trimmed,
  };
}

function rotationFamilyForKey(cropKey: string): RotationFamily | null {
  const crop = cropByKey(cropKey);
  if (!crop) return null;
  try {
    return rotationFamilyOf(crop);
  } catch {
    return null;
  }
}

/**
 * Whole-cohort kilogram bounds, or null. Both inputs must be real: an unpriced
 * crop or an unmeasured bed produces `null`, never a stand-in figure.
 */
function expectedKgForUnit(crop: CropDef, areaSqm: number | null): readonly [number, number] | null {
  if (areaSqm === null || crop.yieldKgPerM2 === null) return null;
  const range = crop.yieldRangeKgPerM2 ?? [crop.yieldKgPerM2, crop.yieldKgPerM2];
  return [range[0] * areaSqm, range[1] * areaSqm];
}

/** Exposed for explanations and tests: the first day of a plan week. */
export function planWeekStartDate(anchor: CalendarDate, week: number): CalendarDate {
  return dateForWeekStart(anchor, week);
}

/** Human-readable week label, e.g. `week 6 (2026-09-12)`. */
export function planWeekLabel(anchor: CalendarDate, week: number): string {
  return `week ${week} (${formatCalendarDate(dateForWeekStart(anchor, week))})`;
}
