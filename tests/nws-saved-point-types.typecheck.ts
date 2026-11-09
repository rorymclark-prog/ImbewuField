import { checkNwsPointReference, checkNwsPublicDemo } from '../app/international/nws-actions';
import { fetchCountryNwsPublicDemo, fetchNwsPointReference,
  type NwsPointResult, type NwsPublicDemoResult } from '../lib/international/providers/nws-public-demo';
import { decodeNwsPointReference, decodeNwsReference, parseNwsPointRequest,
  type NwsPointRequest, type NwsPointReferenceProvenance, type NwsPointReferenceResult,
  type NwsReferenceProvenance, type NwsReferenceResult } from '../lib/international/providers/nws-reference';

// Compile-only contracts. No reference request or decoder runs from this file.
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
type _LegacyTransport = Assert<Equal<Awaited<ReturnType<typeof fetchCountryNwsPublicDemo>>, NwsPublicDemoResult>>;
type _LegacyAction = Assert<Equal<Awaited<ReturnType<typeof checkNwsPublicDemo>>, NwsPublicDemoResult>>;
type _LegacyDecoder = Assert<Equal<ReturnType<typeof decodeNwsReference>, NwsReferenceResult>>;
type _LegacyDemoPlace = Assert<Equal<Awaited<ReturnType<typeof fetchCountryNwsPublicDemo>>['provenance']['demoPlace'], string>>;
type _LegacyActionDemoPlace = Assert<Equal<Awaited<ReturnType<typeof checkNwsPublicDemo>>['provenance']['demoPlace'], string>>;
type _LegacyReceipt = Assert<Equal<keyof NwsReferenceProvenance, 'providerId' | 'fetchedAt' | 'endpoint' | 'demoPlace' | 'referenceOnly'>>;
type _PointTransport = Assert<Equal<Awaited<ReturnType<typeof fetchNwsPointReference>>, NwsPointResult>>;
type _PointAction = Assert<Equal<Awaited<ReturnType<typeof checkNwsPointReference>>, NwsPointResult>>;
type _PointDecoder = Assert<Equal<ReturnType<typeof decodeNwsPointReference>, NwsPointReferenceResult>>;
type _PointKind = Assert<Equal<NwsPointResult['provenance']['kind'], 'requested-point'>>;
type _PointPair = Assert<Equal<NwsPointResult['provenance']['requestedPoint'], NwsPointRequest>>;
type _PointReceipt = Assert<Equal<keyof NwsPointReferenceProvenance, 'providerId' | 'fetchedAt' | 'endpoint' | 'referenceOnly' | 'kind' | 'requestedPoint'>>;
type _PointParser = Assert<Equal<ReturnType<typeof parseNwsPointRequest>, Readonly<NwsPointRequest> | null>>;
type _PointActionInput = Assert<Equal<Parameters<typeof checkNwsPointReference>[0], unknown>>;
type _PointTransportInput = Assert<Equal<Parameters<typeof fetchNwsPointReference>[0], unknown>>;

function receiptBoundaries(point: NwsPointReferenceProvenance, demo: NwsReferenceProvenance, payload: unknown) {
  const pointOutput = decodeNwsPointReference(payload, point);
  const demoOutput = decodeNwsReference(payload, demo);
  const label: string = demoOutput.provenance.demoPlace;
  const kind: 'requested-point' = pointOutput.provenance.kind;
  // @ts-expect-error A point receipt must not acquire demo presentation authority.
  pointOutput.provenance.demoPlace;
  // @ts-expect-error The legacy API remains a separate demo receipt.
  demoOutput.provenance.requestedPoint;
  // @ts-expect-error A legacy receipt is not a point receipt.
  decodeNwsPointReference(payload, demo);
  // @ts-expect-error A point receipt is not a legacy demo receipt.
  decodeNwsReference(payload, point);
  return { label, kind };
}
void receiptBoundaries;
