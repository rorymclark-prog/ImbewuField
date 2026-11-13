// Synthetic metric/shape fixtures, not a measured site or agricultural validation.
import { powerMonthlyTemperatureReceipt } from '../../lib/climate-temperature.ts';
import { createPowerTemperatureSnapshot } from '../../lib/power-temperature-evidence.ts';
import { TOMATO_MONTHLY_CRITERION, type ProvisionalTemperatureInput,
  type ProvisionalTemperatureEvidence } from '../../lib/international/provisional-temperature.ts';

export function syntheticTemperatureEvidence(options: {
  months?: readonly unknown[]; latitude?: number; longitude?: number; receivedAt?: string; countryCode?: string;
} = {}): ProvisionalTemperatureEvidence {
  const point = { latitude: options.latitude ?? 0, longitude: options.longitude ?? 0 };
  const keys = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const months = options.months ?? [18, 25, 17.999, 25.001, 0, -5, 20, 21, 22, 23, 24, 19];
  const queryPoint = { latitude: Number(point.latitude.toFixed(4)), longitude: Number(point.longitude.toFixed(4)) };
  const raw = { type: 'Feature', geometry: { type: 'Point', coordinates: [queryPoint.longitude, queryPoint.latitude] },
    parameters: { T2M: { units: 'C', longname: 'Temperature at 2 Meters' } },
    header: { range: 'Synthetic monthly climatologies (January 2001 - December 2025)',
      fill_value: -999, api: { version: 'synthetic-test' }, sources: ['MERRA2'], time_standard: 'LST' },
    properties: { parameter: { T2M: Object.fromEntries(keys.flatMap((key, i) => months[i] === undefined ? [] : [[key, months[i]]])) } } };
  const endpoint = `https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=T2M&community=AG&latitude=${point.latitude.toFixed(4)}&longitude=${point.longitude.toFixed(4)}&format=JSON`;
  const receipt = powerMonthlyTemperatureReceipt(raw, queryPoint, options.receivedAt ?? '2026-11-13T11:00:00.000Z')!;
  const snapshot = createPowerTemperatureSnapshot(raw, endpoint)!;
  if (!receipt || !snapshot) throw Error('Invalid synthetic temperature fixture');
  return { version: 1, scopeKey: `mapped-site:site:${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}`,
    countryCode: options.countryCode ?? 'KE', sitePoint: point, receipt, snapshot };
}
export function syntheticTemperatureInput(evidence = syntheticTemperatureEvidence()): ProvisionalTemperatureInput {
  return { version: 1, criterion: TOMATO_MONTHLY_CRITERION.id, purpose: 'irrigated-field-cropping',
    criterionSnapshot: TOMATO_MONTHLY_CRITERION,
    transfer: 'explicit-historical-methodology', policyFingerprint: 'synthetic-policy', evidence };
}
