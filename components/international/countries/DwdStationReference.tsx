'use client';

import { useEffect, useRef, useState } from 'react';
import { checkDwdStationReference } from '@/app/international/dwd-mosmix-actions';
import { parseDwdStationRequest } from '@/lib/international/providers/dwd-mosmix-request';
import type { DwdMosmixImportResult, DwdMosmixImportFailure } from '@/lib/international/providers/dwd-mosmix-import';
import type { DwdMosmixIssue } from '@/lib/international/providers/dwd-mosmix-reference';

type SuccessResult = Extract<DwdMosmixImportResult, { status: 'available' | 'partial' }>;

type View =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'result'; result: DwdMosmixImportResult }
  | { status: 'error' };

const failureCopy: Record<DwdMosmixImportFailure['reason'], string> = {
  'invalid-station': 'Enter a station ID in the supported format; leading zeros and case matter.',
  'invalid-options': 'The public reference request could not be prepared.',
  timeout: 'The public reference request timed out within the software limit.',
  'network-error': 'The Deutscher Wetterdienst service could not be reached.',
  'rate-limited': 'The service rate-limited this request.',
  'http-error': 'The Deutscher Wetterdienst service returned an HTTP error.',
  'malformed-response': 'The server response did not match the expected forecast archive structure.',
  'response-too-large': 'The response exceeded the software size ceiling.',
  'invalid-provenance': 'The station reference provenance could not be validated.',
  'invalid-archive': 'The retrieved archive could not be verified or unpacked.',
  'software-bound': 'The station archive or decompressed content exceeded safety boundaries.',
  'unsupported-archive': 'The archive format or compression method is not supported.',
  aborted: 'The station reference request was aborted.',
  'invalid-byte-input': 'The extracted forecast document contained invalid byte data.',
  'unsupported-encoding': 'The forecast document encoding is not supported.',
  'invalid-byte-encoding': 'The forecast document could not be decoded with its declared encoding.',
  'invalid-xml-input': 'The forecast XML document is empty or invalid.',
  'unsafe-xml': 'The forecast XML document contained unsupported or unsafe constructs.',
  'malformed-xml': 'The forecast XML document could not be parsed.',
  'unsupported-profile': 'The forecast XML document did not match the MOSMIX_L schema profile.',
  'station-mismatch': 'The station data in the forecast document did not match the requested station ID.',
  'invalid-timestamps': 'The forecast time steps contained missing or invalid timestamps.',
  'invalid-values': 'The forecast series contained invalid or unparseable values.',
  'no-supported-series': 'No supported temperature or precipitation series were found in the forecast.',
};

const issueCopy: Record<DwdMosmixIssue, string> = {
  'missing-temperature-series': 'Temperature series is missing from the source forecast.',
  'missing-precipitation-series': 'Precipitation series is missing from the source forecast.',
  'temperature-values-missing': 'Some or all temperature values in the time steps are missing.',
  'precipitation-values-missing': 'Some or all precipitation values in the time steps are missing.',
};

/**
 * Public reference card for manual DWD station forecasts.
 *
 * Why:
 * 1. Mounting this component never triggers a network request.
 * 2. Starts with a blank station ID field and an explicit "Check station reference" button.
 * 3. Validates the station ID using parseDwdStationRequest, preserving leading zeros and letter casing.
 * 4. Bound to captured view and input refs: both input editing and checking verify that currentView
 *    and currentStationId match their respective captured states before processing.
 * 5. Every accepted edit increments the generation counter and publishes a NEW idle object.
 * 6. While pending, inputs and buttons are disabled and programmatic input events are ignored.
 * 7. Display shows native temperature in Kelvin (K) and precipitation in kg/m² without conversion.
 * 8. Strictly distinguishes null/missing ("Unknown") from explicit numerical zero ("0").
 * 9. Caps displayed source periods to the first 12, truthfully indicating the display limit.
 */
export default function DwdStationReference() {
  const [stationIdInput, setStationIdInput] = useState<string>('');
  const [view, setView] = useState<View>({ status: 'idle' });

  const currentView = useRef(view);
  currentView.current = view;

  const currentStationId = useRef(stationIdInput);
  currentStationId.current = stationIdInput;

  const mounted = useRef(true);
  const pending = useRef(false);
  const generation = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current++;
      pending.current = false;
    };
  }, []);

  function publish(next: View) {
    currentView.current = next;
    setView(next);
  }

  function handleInputChange(value: string) {
    if (
      !mounted.current ||
      pending.current ||
      currentView.current !== view ||
      currentStationId.current !== stationIdInput
    ) {
      return;
    }
    currentStationId.current = value;
    setStationIdInput(value);
    generation.current++;
    publish({ status: 'idle' });
  }

  async function handleCheck() {
    if (
      !mounted.current ||
      pending.current ||
      currentView.current !== view ||
      currentStationId.current !== stationIdInput
    ) {
      return;
    }

    const uncoercedInput = stationIdInput;
    const validated = parseDwdStationRequest({ stationId: uncoercedInput });
    if (!validated) {
      publish({
        status: 'result',
        result: Object.freeze({
          status: 'failed',
          reason: 'invalid-station',
          endpoint: null,
          stationId: uncoercedInput || null,
          provenance: null,
        }),
      });
      return;
    }

    const selectedStationId = validated.stationId;
    const turn = ++generation.current;
    pending.current = true;
    publish({ status: 'loading' });

    try {
      const result = await checkDwdStationReference({ stationId: selectedStationId });
      if (
        mounted.current &&
        generation.current === turn &&
        currentStationId.current === selectedStationId
      ) {
        publish({ status: 'result', result });
      }
    } catch {
      if (mounted.current && generation.current === turn) {
        publish({ status: 'error' });
      }
    } finally {
      if (generation.current === turn) {
        pending.current = false;
      }
    }
  }

  const result = view.status === 'result' ? view.result : null;
  const failure = result?.status === 'failed' ? (result as DwdMosmixImportFailure) : null;
  const success: SuccessResult | null =
    result && (result.status === 'available' || result.status === 'partial') ? (result as SuccessResult) : null;

  return (
    <section
      lang="en"
      aria-label="DWD public station forecast reference"
      className="min-w-0 space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-1)] p-4 [overflow-wrap:anywhere]"
    >
      <h2 className="font-display text-lg font-semibold">Check a public station forecast</h2>
      <p>
        This is an explicit public-station reference, not farm observations, a weather-alert service, country readiness,
        or planting advice. No relationship with any reviewed country is inferred.
      </p>

      <div className="space-y-2">
        <label htmlFor="dwd-station-id-input" className="block text-sm font-semibold">
          Station ID
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id="dwd-station-id-input"
            type="text"
            value={stationIdInput}
            disabled={view.status === 'loading'}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Station ID from DWD station files"
            className="min-h-11 min-w-[12rem] rounded-lg border border-[var(--border)] bg-[var(--bg-0)] px-3 py-2 text-sm disabled:opacity-50"
          />
          <button
            type="button"
            disabled={view.status === 'loading'}
            onClick={() => void handleCheck()}
            className="min-h-11 max-w-full whitespace-normal rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {view.status === 'loading' ? 'Checking station reference…' : 'Check station reference'}
          </button>
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          Leading zeros and exact letter casing are part of station ID identity.{' '}
          <a
            className="inline-flex min-h-11 items-center underline"
            href="https://opendata.dwd.de/weather/local_forecasts/mos/MOSMIX_L/single_stations/"
            target="_blank"
            rel="noreferrer"
          >
            Browse official DWD station directories
          </a>
        </p>
      </div>

      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-busy={view.status === 'loading'}
        className="space-y-3"
      >
        {view.status === 'idle' && <p>No station forecast has been requested.</p>}
        {view.status === 'loading' && <p>Checking public station reference… No automatic retry.</p>}
        {view.status === 'error' && (
          <p>The reference check could not be completed. No replacement values were supplied. You may check again explicitly.</p>
        )}

        {failure && (
          <div className="space-y-2 rounded-xl border border-[var(--border)] p-3 text-sm">
            <p className="font-semibold text-[var(--text-danger)]">
              {failureCopy[failure.reason] ?? 'The station forecast reference could not be retrieved.'}
            </p>
            <p>No automatic retry.</p>
            {'httpStatus' in failure && failure.httpStatus !== undefined && (
              <p>HTTP status: {failure.httpStatus}</p>
            )}
            {'retryAfterSeconds' in failure && failure.retryAfterSeconds !== undefined && (
              <p>
                Reported Retry-After:{' '}
                {failure.retryAfterSeconds === null ? 'Unknown' : `${failure.retryAfterSeconds} seconds`}
              </p>
            )}
            {failure.provenance && (
              <dl className="space-y-1 text-xs">
                <div>
                  <dt className="inline font-semibold">Endpoint: </dt>
                  <dd className="inline break-all">{failure.provenance.endpoint}</dd>
                </div>
                <div>
                  <dt className="inline font-semibold">Retrieved at (UTC): </dt>
                  <dd className="inline">{failure.provenance.fetchedAt}</dd>
                </div>
              </dl>
            )}
          </div>
        )}

        {success && (
          <div className="min-w-0 space-y-3">
            <div className="rounded-xl border border-[var(--border)] p-3">
              <h3 className="font-semibold">
                {success.status === 'partial'
                  ? 'Partial public reference · missing fields remain Unknown'
                  : 'Public forecast reference received'}
              </h3>
              <dl className="mt-2 space-y-1 text-sm">
                <div>
                  <dt className="inline font-semibold">Station ID: </dt>
                  <dd className="inline">{success.station.id}</dd>
                </div>
                <div>
                  <dt className="inline font-semibold">Station Description: </dt>
                  <dd className="inline">{success.station.description ?? 'Unknown'}</dd>
                </div>
                <div>
                  <dt className="inline font-semibold">Issued at (UTC): </dt>
                  <dd className="inline">{success.issuedAt}</dd>
                </div>
                <div>
                  <dt className="inline font-semibold">Retrieved at (UTC): </dt>
                  <dd className="inline">{success.provenance.fetchedAt}</dd>
                </div>
              </dl>

              {success.issues.length > 0 && (
                <div className="mt-3 space-y-1 border-t border-[var(--border)] pt-2 text-xs">
                  <p className="font-semibold">Noted source issues:</p>
                  <ul className="list-disc pl-5">
                    {success.issues.map((issue) => (
                      <li key={issue}>{issueCopy[issue]}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <h4 className="font-semibold">Forecast Periods</h4>
                <p className="text-xs text-[var(--text-muted)]">
                  Showing first {Math.min(12, success.periods.length)} of {success.periods.length} source periods
                </p>
              </div>

              <ol className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                {success.periods.slice(0, 12).map((period, index) => (
                  <li
                    key={period.validAt || index}
                    className="min-w-0 space-y-1 rounded-xl border border-[var(--border)] p-3 text-sm"
                  >
                    <p className="font-semibold">Valid at (UTC): {period.validAt}</p>
                    <dl className="space-y-1 text-xs">
                      <div>
                        <dt className="inline font-semibold">Temperature: </dt>
                        <dd className="inline">
                          {period.temperatureK === null ? 'Unknown' : `${period.temperatureK} K`}
                        </dd>
                      </div>
                      <div>
                        <dt className="inline font-semibold">Precipitation: </dt>
                        <dd className="inline">
                          {period.precipitationKgM2 === null ? 'Unknown' : `${period.precipitationKgM2} kg/m²`}
                        </dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </div>

      <footer className="border-t border-[var(--border)] pt-3 text-xs text-[var(--text-muted)]">
          <p>Source: Deutscher Wetterdienst (DWD), MOSMIX. Selected source values extracted and displayed by ImbewuField.</p>
        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          <a
            className="inline-flex min-h-11 items-center underline"
            href="https://opendata.dwd.de/weather/local_forecasts/mos/MOSMIX_L/single_stations/"
            target="_blank"
            rel="noreferrer"
          >
            DWD Station Files
          </a>
          <a
            className="inline-flex min-h-11 items-center underline"
            href="https://www.dwd.de/copyright"
            target="_blank"
            rel="noreferrer"
          >
            DWD Copyright & Terms
          </a>
            <a className="inline-flex min-h-11 items-center underline" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
              Data licence: CC BY 4.0
            </a>
        </p>
      </footer>
    </section>
  );
}
