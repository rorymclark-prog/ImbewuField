import { detachJsonData } from '@/lib/lossless-json';

export const EA_RAINFALL_REFERENCE_PROVIDER = Object.freeze({
  id: 'ea-rainfall-public-reference',
  name: 'Environment Agency public rainfall network sample',
  endpoint: 'https://environment.data.gov.uk/flood-monitoring/data/readings?parameter=rainfall&latest&_view=full&_sorted&_limit=1',
  docsUrl: 'https://environment.data.gov.uk/flood-monitoring/doc/rainfall',
  referenceUrl: 'https://environment.data.gov.uk/flood-monitoring/doc/reference',
  licenceUrl: 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
  attribution: 'this uses Environment Agency rainfall data from the real-time data API (Beta)',
  access: 'Product documentation states open data without registration. Exact fetched public endpoint returned HTTP200; no authenticated capability implied.',
  licence: 'Product-specific Open Government Licence link; OGLv3 permits commercial/noncommercial reuse subject to attribution and exclusions, without endorsement or continued-supply guarantee.',
  cadence: 'Accumulated precipitation per 15-minute period; commonly transferred once or twice daily. Latest means latest available per measure, not necessarily current.',
  coverage: 'Rainfall-specific national boundaries not established by inspected documents. No England-only, UK-wide, farm-nearest or complete network coverage claim.',
  inspectedOn: '2026-11-05',
});

export interface EaRainfallReferenceProvenance {
  readonly providerId: 'ea-rainfall-public-reference';
  readonly endpoint: string;
  readonly fetchedAt: string | null;
  readonly referenceOnly: true;
}

export interface EaRainfallReferenceSample {
  readonly scope: 'bounded-public-network-sample';
  readonly itemLimit: 1;
  readonly completeCoverage: false;
  readonly currentness: 'not-assessed';
  readonly quality: 'unknown';
  readonly timeBoundary: 'unknown';
}

export interface EaRainfallReferenceReading {
  readonly reportedAt: string | null;
  readonly rainfallMm: number | null;
  readonly periodSeconds: 900;
  readonly units: 'mm';
  readonly valueType: 'total';
}

export interface EaRainfallReferenceAvailable {
  readonly status: 'available';
  readonly provenance: EaRainfallReferenceProvenance;
  readonly sample: EaRainfallReferenceSample;
  readonly reading: EaRainfallReferenceReading;
}

export interface EaRainfallReferencePartial {
  readonly status: 'partial';
  readonly provenance: EaRainfallReferenceProvenance;
  readonly sample: EaRainfallReferenceSample;
  readonly reading: EaRainfallReferenceReading;
}

export interface EaRainfallReferenceUnavailable {
  readonly status: 'unavailable';
  readonly reason: 'no-reading';
  readonly provenance: EaRainfallReferenceProvenance;
  readonly sample: EaRainfallReferenceSample;
}

export interface EaRainfallReferenceFailed {
  readonly status: 'failed';
  readonly reason: 'invalid-provenance' | 'malformed-response' | 'unsupported-measurement';
  readonly provenance: EaRainfallReferenceProvenance;
  readonly sample: EaRainfallReferenceSample;
}

export type EaRainfallReferenceResult =
  | EaRainfallReferenceAvailable
  | EaRainfallReferencePartial
  | EaRainfallReferenceUnavailable
  | EaRainfallReferenceFailed;

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function makeSample(): EaRainfallReferenceSample {
  return {
    scope: 'bounded-public-network-sample',
    itemLimit: 1,
    completeCoverage: false,
    currentness: 'not-assessed',
    quality: 'unknown',
    timeBoundary: 'unknown',
  };
}

export function decodeEaRainfallReference(
  value: unknown,
  fetchedAt: unknown
): EaRainfallReferenceResult {
  const validFetchedAt =
    typeof fetchedAt === 'string' &&
    fetchedAt.length > 0 &&
    fetchedAt.length <= 100 &&
    fetchedAt.trim() === fetchedAt;

  const provenanceFetchedAt: string | null = validFetchedAt ? fetchedAt : null;

  const provenance: EaRainfallReferenceProvenance = {
    providerId: 'ea-rainfall-public-reference',
    endpoint: EA_RAINFALL_REFERENCE_PROVIDER.endpoint,
    fetchedAt: provenanceFetchedAt,
    referenceOnly: true,
  };

  const sample = makeSample();

  if (!validFetchedAt) {
    return {
      status: 'failed',
      reason: 'invalid-provenance',
      provenance,
      sample,
    };
  }

  let detached: unknown;
  try {
    detached = detachJsonData(value);
  } catch {
    return {
      status: 'failed',
      reason: 'malformed-response',
      provenance,
      sample,
    };
  }

  if (!isObject(detached)) {
    return {
      status: 'failed',
      reason: 'malformed-response',
      provenance,
      sample,
    };
  }

  const meta = detached['meta'];
  if (!isObject(meta) || meta['limit'] !== 1) {
    return {
      status: 'failed',
      reason: 'malformed-response',
      provenance,
      sample,
    };
  }

  const items = detached['items'];
  if (!Array.isArray(items)) {
    return {
      status: 'failed',
      reason: 'malformed-response',
      provenance,
      sample,
    };
  }

  if (items.length === 0) {
    return {
      status: 'unavailable',
      reason: 'no-reading',
      provenance,
      sample,
    };
  }

  if (items.length !== 1) {
    return {
      status: 'failed',
      reason: 'malformed-response',
      provenance,
      sample,
    };
  }

  const row = items[0];
  if (!isObject(row)) {
    return {
      status: 'failed',
      reason: 'malformed-response',
      provenance,
      sample,
    };
  }

  const measure = row['measure'];
  if (!isObject(measure)) {
    return {
      status: 'failed',
      reason: 'unsupported-measurement',
      provenance,
      sample,
    };
  }

  if (
    measure['parameter'] !== 'rainfall' ||
    measure['unitName'] !== 'mm' ||
    measure['period'] !== 900 ||
    measure['valueType'] !== 'total'
  ) {
    return {
      status: 'failed',
      reason: 'unsupported-measurement',
      provenance,
      sample,
    };
  }

  let rainfallMm: number | null = null;
  if (!Object.hasOwn(row, 'value')) {
    rainfallMm = null;
  } else {
    const val = row['value'];
    if (typeof val !== 'number' || !Number.isFinite(val) || val < 0) {
      return {
        status: 'failed',
        reason: 'malformed-response',
        provenance,
        sample,
      };
    }
    rainfallMm = val;
  }

  let reportedAt: string | null = null;
  if (!Object.hasOwn(row, 'dateTime')) {
    reportedAt = null;
  } else {
    const dt = row['dateTime'];
    if (
      typeof dt !== 'string' ||
      dt.length === 0 ||
      dt.length > 100 ||
      dt.trim() !== dt
    ) {
      return {
        status: 'failed',
        reason: 'malformed-response',
        provenance,
        sample,
      };
    }
    reportedAt = dt;
  }

  const reading: EaRainfallReferenceReading = {
    reportedAt,
    rainfallMm,
    periodSeconds: 900,
    units: 'mm',
    valueType: 'total',
  };

  if (rainfallMm !== null && reportedAt !== null) {
    return {
      status: 'available',
      provenance,
      sample,
      reading,
    };
  }

  return {
    status: 'partial',
    provenance,
    sample,
    reading,
  };
}
