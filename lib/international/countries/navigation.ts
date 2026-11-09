import { countryProfile } from './registry';
import type { SiteContextResolution } from '../site-context';

export interface CountryEvidenceSelection {
  readonly kind: 'default' | 'pilot' | 'unsupported' | 'invalid';
  readonly code: string;
  readonly requestedCountryCode: string | null;
}

function freezeSelection(
  kind: 'default' | 'pilot' | 'unsupported' | 'invalid',
  code: string,
  requestedCountryCode: string | null
): CountryEvidenceSelection {
  return Object.freeze({
    kind,
    code,
    requestedCountryCode,
  });
}

export function readCountryEvidenceSelection(raw: unknown): CountryEvidenceSelection {
  if (raw === undefined) {
    return freezeSelection('default', 'KE', null);
  }

  if (typeof raw !== 'string' || !/^[A-Z]{2}$/.test(raw)) {
    return freezeSelection('invalid', 'OTHER', null);
  }

  const profile = countryProfile(raw);
  if (profile) {
    return freezeSelection('pilot', raw, raw);
  }

  return freezeSelection('unsupported', 'OTHER', raw);
}

export function savedCountryEvidenceHref(resolution: SiteContextResolution): string | null {
  if (
    resolution.status === 'confirmed' &&
    resolution.context !== null &&
    resolution.context.siteId !== null &&
    resolution.context.siteId === resolution.siteId &&
    typeof resolution.context.countryCode === 'string' &&
    /^[A-Z]{2}$/.test(resolution.context.countryCode)
  ) {
    return '/international?country=' + encodeURIComponent(resolution.context.countryCode);
  }
  return null;
}
