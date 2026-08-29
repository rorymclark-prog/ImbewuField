/*
 * A CONCURRENCY-BOUNDED, ORDER-PRESERVING MAP — for exactly one reason: a per-item async job
 * (app/api/network/farmers/route.ts's per-farmer read, today; likely others as orgs grow) that
 * is safe to run alongside a handful of its siblings but not safe to run ALL AT ONCE across
 * however large a collection has grown to. See tests/batch.test.ts for what this pins.
 *
 * Deliberately NOT a general task queue or a dependency — it is nine lines because the property
 * it guarantees is small: results come back in `items` order regardless of which one finishes
 * first, and no more than `batchSize` calls to `fn` are ever in flight at once.
 */
export async function runInBatches<T, R>(
  items: readonly T[], batchSize: number, fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const results = await Promise.all(batch.map((item, j) => fn(item, i + j)));
    out.push(...results);
  }
  return out;
}
