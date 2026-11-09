/** Pure planning arithmetic from three explicit grower-supplied counts.
 * Does not observe stock, purchase seeds, or alter crop requirements. */

export type SeedPurchaseCountsStatus = 'complete' | 'unknown' | 'invalid' | 'overflow';

export interface SeedPurchaseCountsReview {
  readonly status: SeedPurchaseCountsStatus;
  readonly neededSeeds: number | null;
  readonly packsNeeded: number | null;
  readonly plannedPackSeeds: number | null;
}

function isUnknown(value: unknown): boolean {
  return value === null || value === undefined;
}

function isValidCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isValidPackCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function freezeReview(
  status: SeedPurchaseCountsStatus,
  neededSeeds: number | null,
  packsNeeded: number | null,
  plannedPackSeeds: number | null
): SeedPurchaseCountsReview {
  return Object.freeze({
    status,
    neededSeeds,
    packsNeeded,
    plannedPackSeeds,
  });
}

export function reviewSeedPurchaseCounts(
  requiredSeeds: unknown,
  allocatedToPlanSeeds: unknown,
  seedsPerPack: unknown
): SeedPurchaseCountsReview {
  // Precedence 1: Check for invalid types/values on non-unknown arguments first.
  // Any invalid argument immediately yields status: 'invalid' and all nulls.
  const reqUnknown = isUnknown(requiredSeeds);
  if (!reqUnknown && !isValidCount(requiredSeeds)) {
    return freezeReview('invalid', null, null, null);
  }

  const allocUnknown = isUnknown(allocatedToPlanSeeds);
  if (!allocUnknown && !isValidCount(allocatedToPlanSeeds)) {
    return freezeReview('invalid', null, null, null);
  }

  const packUnknown = isUnknown(seedsPerPack);
  if (!packUnknown && !isValidPackCount(seedsPerPack)) {
    return freezeReview('invalid', null, null, null);
  }

  // Precedence 2: If required or allocated count is unknown, review is unknown with all nulls.
  if (reqUnknown || allocUnknown) {
    return freezeReview('unknown', null, null, null);
  }

  // Both required and allocated counts are valid safe integers >= 0.
  // Compute neededSeeds = max(required - allocated, 0) using BigInt constructor (ES2017 compatible).
  const reqBig = BigInt(requiredSeeds as number);
  const allocBig = BigInt(allocatedToPlanSeeds as number);
  const diffBig = reqBig - allocBig;
  const neededBig = diffBig > BigInt(0) ? diffBig : BigInt(0);
  const neededSeeds = Number(neededBig);

  // Precedence 3: If pack count is unknown, retain computed neededSeeds while pack calculations remain null.
  if (packUnknown) {
    return freezeReview('unknown', neededSeeds, null, null);
  }

  // All three counts are known and valid.
  const packBig = BigInt(seedsPerPack as number);

  if (neededBig === BigInt(0)) {
    return freezeReview('complete', 0, 0, 0);
  }

  // Exact ceiling division: (needed + pack - 1) / pack using BigInt constructor
  const packsNeededBig = (neededBig + packBig - BigInt(1)) / packBig;
  const packsNeeded = Number(packsNeededBig);

  // Planned pack seeds: packsNeeded * seedsPerPack
  const plannedBig = packsNeededBig * packBig;
  const maxSafeBig = BigInt(Number.MAX_SAFE_INTEGER);

  if (plannedBig > maxSafeBig) {
    return freezeReview('overflow', neededSeeds, packsNeeded, null);
  }

  return freezeReview('complete', neededSeeds, packsNeeded, Number(plannedBig));
}
