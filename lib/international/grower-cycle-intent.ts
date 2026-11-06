import { growerCycleQuantityEntryView, normaliseGrowerCycleOrigin, type GrowerCycleOriginView } from './grower-cycle';
import { growerEnteredDemandId } from './grower-entered-demand';
import type { MassQuantityEntry } from '../mass-units';

export type GrowerCyclePublicIntent = Readonly<{
  status: 'recorded' | 'not-recorded' | 'proposed' | 'held';
  purpose: 'buyer-target' | 'household' | 'trial' | 'not-recorded' | 'proposed' | 'held';
  requestedGrossKg: number | null;
  /** Validated authored spelling/unit, kept separate from canonical kilograms. */
  originalQuantityEntry: MassQuantityEntry | null;
  harvestStart: string | null;
  harvestEndExclusive: string | null;
  lines: readonly string[];
}>;
export type GrowerCycleIntentView = GrowerCycleOriginView | { readonly status: 'proposed' | 'held' } | undefined;

function field(value: unknown, key: string): unknown {
  if (!value || typeof value !== 'object') return undefined;
  const property = Object.getOwnPropertyDescriptor(value, key);
  return property?.enumerable && 'value' in property ? property.value : undefined;
}
const noRequest = { requestedGrossKg: null, harvestStart: null, harvestEndExclusive: null };
function result(status: GrowerCyclePublicIntent['status'], purpose: GrowerCyclePublicIntent['purpose'], lines: string[], request: Pick<GrowerCyclePublicIntent, 'requestedGrossKg' | 'harvestStart' | 'harvestEndExclusive'> = noRequest, originalQuantityEntry: MassQuantityEntry | null = null): GrowerCyclePublicIntent {
  return Object.freeze({ status, purpose, ...request, originalQuantityEntry: originalQuantityEntry ? Object.freeze({ ...originalQuantityEntry }) : null, lines: Object.freeze(lines) });
}
/** Shared exact authored readback; PDF writers must not normalize this line. */
export function originalQuantityEntryLine(entry: MassQuantityEntry): string {
  return `Original entered weight for this whole demand: ${entry.text} ${entry.unit}.`;
}
const held = () => result('held', 'held', ['Planning purpose and original request need review. No purpose or requested quantity has been inferred.']);

/** A public readback of accepted intent, not a second demand ledger or source
 * permission. No private IDs, provenance notes or coordinates leave this view.
 * The whole request repeats per cycle/member and must never be summed. */
export function readGrowerCycleIntent(view: GrowerCycleIntentView): GrowerCyclePublicIntent {
  try {
    const status = field(view, 'status');
    if (view !== undefined) {
      const descriptors = Object.getOwnPropertyDescriptors(view);
      const keys = Reflect.ownKeys(descriptors);
      if (keys.some(key => typeof key !== 'string' || !['status', ...(status === 'recorded' ? ['origin'] : [])].includes(key)
        || !descriptors[key].enumerable || !('value' in descriptors[key]))) return held();
    }
    if (view === undefined || status === 'not-recorded') return result('not-recorded', 'not-recorded', [
      'Planning purpose not recorded. Original requested weight and harvest window are not recorded.',
    ]);
    if (status === 'proposed') return result('proposed', 'proposed', ['Planning purpose is not yet accepted on a saved cycle. No accepted original request is recorded.']);
    if (status !== 'recorded') return held();
    const raw = field(view, 'origin'), kind = field(raw, 'kind');
    const id = kind === 'buyer-target' ? field(raw, 'harvestTargetId') : field(raw, 'entryId');
    if (typeof id !== 'string') return held();
    const origin = normaliseGrowerCycleOrigin(raw, kind === 'buyer-target' ? id : growerEnteredDemandId(id));
    if (!origin) return held();
    if (origin.kind === 'buyer-target') return result('recorded', 'buyer-target', ['Planning purpose: buyer target.']);
    const lines = [`Planning purpose: ${origin.purpose === 'trial' ? 'trial growing' : 'household food'}.`];
    const quantity = growerCycleQuantityEntryView({ origin });
    const entry = quantity.status === 'recorded' ? quantity.entry : null;
    lines.push(entry ? originalQuantityEntryLine(entry)
      : 'Original entered unit and text are not recorded. They have not been reconstructed from kilograms or cycle capacity.');
    const demand = origin.demandSnapshot;
    if (!demand || demand.totalKg.state !== 'provided' || demand.harvestWindow.state !== 'provided') {
      lines.push('Original requested weight and harvest window are not recorded. They have not been inferred from this cycle.');
      return result('recorded', origin.purpose, lines);
    }
    const requestedGrossKg = demand.totalKg.value, { start: harvestStart, endExclusive: harvestEndExclusive } = demand.harvestWindow.value;
    // This validated canonical equivalent is separate from authored text/unit
    // above. String preserves its numeric value instead of rounding it.
    lines.push(`Original request for all cycles in this demand: ${String(requestedGrossKg)} kg gross across ${harvestStart} to before ${harvestEndExclusive} (UTC).`,
      'Kilograms are the canonical planning equivalent for this whole request.',
      'This is the grower-entered planning estimate, not this batch’s output or an observed harvest. Repeated whole-demand request weights must not be added together.');
    return result('recorded', origin.purpose, lines, { requestedGrossKg, harvestStart, harvestEndExclusive }, entry);
  } catch { return held(); }
}

/** A missing historical DTO field is unknown; present unreadable intent never
 * executes a getter or disappears as an apparently absent historical field. */
export function readGrowerCycleIntentField(owner: object): GrowerCyclePublicIntent {
  const property = Object.getOwnPropertyDescriptor(owner, 'origin');
  if (!property) return 'origin' in owner ? held() : readGrowerCycleIntent(undefined);
  if (!property.enumerable || !('value' in property) || property.value == null) return held();
  return readGrowerCycleIntent(property.value as GrowerCycleIntentView);
}

export const GROWER_INTENT_EXPORT_COLUMNS = ['planning_intent_status', 'planning_purpose', 'original_requested_gross_kg',
  'original_request_weight_unit', 'original_request_harvest_start_utc', 'original_request_harvest_end_exclusive_utc', 'original_request_note', 'original_entered_weight_text', 'original_entered_weight_unit'] as const;
export function growerCycleIntentColumns(intent: GrowerCyclePublicIntent): Record<typeof GROWER_INTENT_EXPORT_COLUMNS[number], string | number> {
  const missing = intent.status === 'held' ? 'needs-review' : 'not-recorded';
  return { planning_intent_status: intent.status, planning_purpose: intent.purpose,
    original_requested_gross_kg: intent.requestedGrossKg ?? missing,
    original_request_weight_unit: intent.requestedGrossKg === null ? missing : 'kg',
    original_request_harvest_start_utc: intent.harvestStart ?? missing,
    original_request_harvest_end_exclusive_utc: intent.harvestEndExclusive ?? missing,
    original_request_note: intent.lines.join(' '),
    original_entered_weight_text: intent.originalQuantityEntry?.text ?? missing,
    original_entered_weight_unit: intent.originalQuantityEntry?.unit ?? missing };
}
