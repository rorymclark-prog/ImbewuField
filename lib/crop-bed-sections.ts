/**
 * A physical raised bed is divided once for a plan layout. These named
 * sections replace V1's anonymous fractions: a farmer can mark A–D on the
 * actual bed, and every later planner layer can refer to the same place.
 */
export const BED_DIVISIONS = [1, 2, 3, 4] as const;
export type BedDivision = (typeof BED_DIVISIONS)[number];

export const BED_SECTION_LABELS = ['A', 'B', 'C', 'D'] as const;
export type BedSectionLabel = (typeof BED_SECTION_LABELS)[number];

export interface BedSection {
  /** Stable, canonical identity; it includes the layout revision on purpose. */
  id: string;
  bedId: string;
  layoutRevision: string;
  /** The field label a farmer can put on the bed. */
  label: BedSectionLabel;
  /** Every section in one bed layout declares the same discrete division. */
  division: BedDivision;
  /** Derived geometry only: 1, 1/2, 1/3 or 1/4. Never copied from a V1 row. */
  share: number;
}

export interface BedSectionLayoutInput {
  bedId: string;
  layoutRevision: string;
  division: BedDivision;
}

function isStableIdPart(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value === value.trim();
}

export function isBedDivision(value: unknown): value is BedDivision {
  return (BED_DIVISIONS as readonly number[]).includes(value as number);
}

export function isBedSectionLabel(value: unknown): value is BedSectionLabel {
  return (BED_SECTION_LABELS as readonly string[]).includes(value as string);
}

export function labelsForBedDivision(division: BedDivision): readonly BedSectionLabel[] {
  return BED_SECTION_LABELS.slice(0, division);
}

export function shareForBedDivision(division: BedDivision): number {
  return 1 / division;
}

/**
 * Encoded id parts keep different saved bed or revision ids from colliding
 * with the resource namespace. The human-facing identity remains A–D.
 */
export function bedSectionId(
  bedId: string,
  layoutRevision: string,
  label: BedSectionLabel,
): string | null {
  if (!isStableIdPart(bedId) || !isStableIdPart(layoutRevision) || !isBedSectionLabel(label)) return null;
  return `raised-bed:${encodeURIComponent(bedId)}:layout:${encodeURIComponent(layoutRevision)}:section:${label}`;
}

/** Returns null instead of inventing a section for an invalid physical layout. */
export function buildBedSections(input: BedSectionLayoutInput): BedSection[] | null {
  if (!isStableIdPart(input.bedId)
    || !isStableIdPart(input.layoutRevision)
    || !isBedDivision(input.division)) return null;
  const share = shareForBedDivision(input.division);
  return labelsForBedDivision(input.division).map((label) => ({
    id: bedSectionId(input.bedId, input.layoutRevision, label)!,
    bedId: input.bedId,
    layoutRevision: input.layoutRevision,
    label,
    division: input.division,
    share,
  }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function compareText(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function compareBedSections(a: BedSection, b: BedSection): number {
  const byBed = compareText(a.bedId, b.bedId);
  if (byBed !== 0) return byBed;
  const byRevision = compareText(a.layoutRevision, b.layoutRevision);
  if (byRevision !== 0) return byRevision;
  return BED_SECTION_LABELS.indexOf(a.label) - BED_SECTION_LABELS.indexOf(b.label);
}

/**
 * Accept only sections that were made by `buildBedSections`. This keeps a V2
 * plan from regressing to unlabeled fractions or a hand-written partial split.
 */
export function normaliseBedSection(value: unknown): BedSection | null {
  if (!isRecord(value)
    || !isStableIdPart(value.id)
    || !isStableIdPart(value.bedId)
    || !isStableIdPart(value.layoutRevision)
    || !isBedSectionLabel(value.label)
    || !isBedDivision(value.division)
    || typeof value.share !== 'number') return null;
  const expectedId = bedSectionId(value.bedId, value.layoutRevision, value.label);
  if (!expectedId || value.id !== expectedId || value.share !== shareForBedDivision(value.division)) return null;
  return {
    id: value.id,
    bedId: value.bedId,
    layoutRevision: value.layoutRevision,
    label: value.label,
    division: value.division,
    share: value.share,
  };
}

/**
 * One bed may have one complete section scheme in a V2 planning layout. A
 * partial A/B split would tell the farmer to use a shape that does not exist.
 */
export function normaliseBedSections(value: unknown): BedSection[] | null {
  if (!Array.isArray(value)) return null;
  const sections = value.map(normaliseBedSection);
  if (sections.some((section) => !section)) return null;
  const validSections = sections as BedSection[];
  if (new Set(validSections.map((section) => section.id)).size !== validSections.length) return null;

  const revisionByBed = new Map<string, string>();
  const byLayout = new Map<string, BedSection[]>();
  for (const section of validSections) {
    const priorRevision = revisionByBed.get(section.bedId);
    if (priorRevision && priorRevision !== section.layoutRevision) return null;
    revisionByBed.set(section.bedId, section.layoutRevision);

    // JSON keeps arbitrary identifier characters from making two bed/revision
    // pairs share a grouping key.
    const key = JSON.stringify([section.bedId, section.layoutRevision]);
    const grouped = byLayout.get(key) ?? [];
    grouped.push(section);
    byLayout.set(key, grouped);
  }

  for (const sectionsForBed of byLayout.values()) {
    const division = sectionsForBed[0]?.division;
    if (!division || sectionsForBed.length !== division) return null;
    if (sectionsForBed.some((section) => section.division !== division)) return null;
    const labels = new Set(sectionsForBed.map((section) => section.label));
    const expected = labelsForBedDivision(division);
    if (labels.size !== expected.length || expected.some((label) => !labels.has(label))) return null;
  }
  // A and B carry physical meaning; returning storage order would make a
  // shuffled JSON row become a different visual/solver iteration order.
  return validSections.map((section) => ({ ...section })).sort(compareBedSections);
}

/**
 * The canonical capacity key for the optimiser. A nursery phase deliberately
 * has no such claim; field occupancy begins only at direct sow or plant-out.
 */
export function sectionWeekResource(sectionId: string, week: number): string | null {
  if (!isStableIdPart(sectionId) || !Number.isSafeInteger(week) || week < 0) return null;
  return `raised-bed-section:${encodeURIComponent(sectionId)}:week:${week}`;
}
