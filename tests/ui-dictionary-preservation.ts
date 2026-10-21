import assert from 'node:assert/strict';

interface DictionaryPacket {
  entries: Array<{ key: string; [field: string]: unknown }>;
  supplementalEntries?: Array<{ key: string; [field: string]: unknown }>;
  notices?: Record<string, Record<string, string>>;
  beforeValues?: Record<string, Record<string, string | null>>;
}

/** Historical object checks need the same bounded UI exception as source-byte checks. */
export function beforeUiDictionary(actual: unknown, locale: string, packet: DictionaryPacket): unknown {
  if (!actual || typeof actual !== 'object' || Array.isArray(actual)) return actual;
  const expected: Record<string, string> = {};
  for (const entry of [...packet.entries, ...(packet.supplementalEntries ?? [])]) {
    if (typeof entry[locale] === 'string') expected[entry.key] = entry[locale];
  }
  Object.assign(expected, packet.notices?.[locale] ?? {});
  assert.ok(Object.keys(expected).length, `${locale}: a declared dictionary batch cannot be empty`);
  const beforeValues = packet.beforeValues?.[locale];
  assert.ok(beforeValues, `${locale}: exact prior UI values must be recorded`);
  assert.deepEqual(Object.keys(beforeValues).sort(), Object.keys(expected).sort(), `${locale}: record only and every declared change`);
  const dict = actual as Record<string, unknown>;
  // Older snapshots and altered callers must remain visible to the original full-object guard.
  // Project only the complete exact draft layer, never a partial or corrupted approximation.
  if (!Object.entries(expected).every(([key, value]) => Object.hasOwn(dict, key) && dict[key] === value)) return actual;
  const before = { ...dict };
  for (const key of Object.keys(expected)) {
    if (beforeValues[key] === null) delete before[key];
    else before[key] = beforeValues[key];
  }
  return before;
}
