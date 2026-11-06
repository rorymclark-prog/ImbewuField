import type { SourceLiteralSelector } from './source-reader';
import type { SourceMessage } from './types';

const field = 'components/crops/GrowerEnteredMassField.ts';
const readback = 'components/crops/GrowerCycleIntent.ts';
const presenter = 'lib/international/grower-cycle-intent.ts';
const release = 'lib/release-notes.ts';
const fieldCall = (callee: string, textArgument: number, expectedCount: number, ordinal: number): Extract<SourceLiteralSelector, { kind: 'function-call' }> =>
  ({ kind: 'function-call', functionName: 'GrowerEnteredMassField', callee, textArgument, expectedCount, ordinal,
    ...(callee === 'createElement' ? { returned: true } : {}) });
const present = (role: Omit<Extract<SourceLiteralSelector, { kind: 'function-message' }>, 'kind' | 'functionName'>): SourceLiteralSelector =>
  ({ kind: 'function-message', functionName: 'readGrowerCycleIntent', ...role });
const absentDemand = "!demand || demand.totalKg.state !== 'provided' || demand.harvestWindow.state !== 'provided'";
const canonicalRequest = { index: 0, expressions: ['String(requestedGrossKg)', 'harvestStart', 'harvestEndExclusive'] } as const;

export const MASS_ENTRY_REVIEW_SOURCE = Object.freeze({
  sourceSha256: 'd04df52e04b97ea0f72bea9c45b33081152c9ea293dd0dedd4f49e9e27f0edc5',
  sourceCommit: 'cc353537848c8b773a8abb2e6327a37020bec684',
  capturedOn: '2026-11-06',
  files: Object.freeze([
    Object.freeze({ path: field, sha256: '4a7afd3813372238b49c2aa813dcbd588b2bd49d47ad64d73d59908253a1de4f' }),
    Object.freeze({ path: readback, sha256: '88b4f0fe56d8f0d494d26a2a7f8dfbb045ee1abac825880cbac4f765d4da835f' }),
    // Current wording moved to the shared presenter after capture. Its bytes
    // are read now; the old component fingerprint remains historical evidence.
    Object.freeze({ path: presenter, sha256: null }),
    // A release note's own metadata changes as later releases are announced.
    // Its unique owning change/tour binds this literal, without a hash cycle.
    Object.freeze({ path: release, sha256: null }),
  ]),
  delegation: Object.freeze({ sourceFile: readback, targetFile: presenter, functionName: 'GrowerCycleIntent',
    module: '@/lib/international/grower-cycle-intent', importedName: 'readGrowerCycleIntent',
    resultName: 'intent', argumentName: 'view', arrayProperty: 'lines' }),
  messages: Object.freeze([
    { key: 'massEntry.field.unit.kg', sourceFile: field, selector: { ...fieldCall('createElement', 2, 1, 0),
      firstArgument: 'option', objectArgument: { index: 1, property: 'value', value: 'kg' } } },
    { key: 'massEntry.field.unit.lb', sourceFile: field, selector: { ...fieldCall('createElement', 2, 1, 0),
      firstArgument: 'option', objectArgument: { index: 1, property: 'value', value: 'lb' } } },
    { key: 'massEntry.field.switchHeld', sourceFile: field, selector: { ...fieldCall('setMessage', 0, 1, 0), nestedFunction: 'changeUnit', nonEmpty: true } },
    { key: 'massEntry.field.decimalPoint', sourceFile: field, selector: { ...fieldCall('createElement', 2, 2, 0), firstArgument: 'p' } },
    { key: 'massEntry.field.convertedDisplay', sourceFile: field, selector: { ...fieldCall('createElement', 2, 2, 1), firstArgument: 'p' } },
    { key: 'massEntry.readback.purposeUnknown', sourceFile: presenter, selector: present({ callee: 'result', argumentCount: 3,
      literalArguments: [{ index: 0, value: 'not-recorded' }, { index: 1, value: 'not-recorded' }],
      withinIf: "view === undefined || status === 'not-recorded'", returned: true, text: { argument: 2, arrayElement: 0 } }) },
    { key: 'massEntry.readback.buyerPurpose', sourceFile: presenter, selector: present({ callee: 'result', argumentCount: 3,
      literalArguments: [{ index: 0, value: 'recorded' }, { index: 1, value: 'buyer-target' }],
      withinIf: "origin.kind === 'buyer-target'", returned: true, text: { argument: 2, arrayElement: 0 } }) },
    { key: 'massEntry.readback.originalEntryUnknown', sourceFile: presenter, selector: present({ receiver: 'lines', callee: 'push',
      argumentCount: 1, text: { argument: 0, conditionalFalse: 'entry' } }) },
    { key: 'massEntry.readback.canonicalEquivalent', sourceFile: presenter, selector: present({ receiver: 'lines', callee: 'push',
      argumentCount: 3, templateArgument: canonicalRequest, text: { argument: 1 } }) },
    { key: 'massEntry.readback.planningEstimate', sourceFile: presenter, selector: present({ receiver: 'lines', callee: 'push',
      argumentCount: 3, templateArgument: canonicalRequest, text: { argument: 2 } }) },
    { key: 'massEntry.readback.originalRequestUnknown', sourceFile: presenter, selector: present({ receiver: 'lines', callee: 'push',
      argumentCount: 1, withinIf: absentDemand, text: { argument: 0 } }) },
    { key: 'massEntry.release.03', sourceFile: release, selector: { kind: 'release-tour', variableName: 'RELEASE_NOTES',
      owningChange: 'Enter household or trial harvest requests in kilograms or pounds.',
      title: 'Choose harvest weight units', href: '/facilitator/crops' } },
  ] satisfies readonly { key: string; sourceFile: SourceMessage['sourceFile']; selector: SourceLiteralSelector }[]),
});
