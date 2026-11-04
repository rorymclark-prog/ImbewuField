'use client';

import { useEffect, useRef, useState } from 'react';
import { paidApiHeaders } from '@/lib/api-client-auth';
import { NWS_OBSERVATION_PROVIDER, SONOMA_NWS_REFERENCE, parseNwsObservationResult, type NwsMeasurement, type NwsObservationResult } from '@/lib/international/providers/nws-observation';
import styles from './CountryReview.module.css';

const MEASUREMENTS = [
  ['temperature', 'Air temperature'], ['dewpoint', 'Dewpoint'], ['relativeHumidity', 'Relative humidity'],
  ['windSpeed', 'Wind speed'], ['windGust', 'Wind gust'], ['windDirection', 'Wind direction'],
  ['precipitationLastHour', 'Precipitation in the last hour'], ['precipitationLast3Hours', 'Precipitation in the last three hours'],
  ['precipitationLast6Hours', 'Precipitation in the last six hours'],
  ['minTemperatureLast24Hours', 'Minimum temperature in the last 24 hours'], ['maxTemperatureLast24Hours', 'Maximum temperature in the last 24 hours'],
] as const;
const UNITS: Record<string, string> = { 'wmoUnit:degC': '°C', 'wmoUnit:percent': '%', 'wmoUnit:km_h-1': 'km/h', 'wmoUnit:degree_(angle)': '°', 'wmoUnit:mm': 'mm' };
function reading(value: NwsMeasurement): string {
  if (value.state !== 'value' || typeof value.value !== 'number' || !Number.isFinite(value.value)) return 'Unknown';
  const unit = value.unitCode && UNITS[value.unitCode];
  return unit ? `${value.value} ${unit}` : 'Unknown';
}

/** Only mounted for the US pilot. No request is made until the grower chooses it;
 * unmounting on a country switch withdraws pending authentication and responses. */
export default function NwsStationReference() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<NwsObservationResult | null>(null);
  const [message, setMessage] = useState('');
  const generation = useRef(0), active = useRef<AbortController | null>(null);
  const deadline = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { generation.current++; active.current?.abort(); if (deadline.current) clearTimeout(deadline.current); }, []);
  async function check() {
    const turn = ++generation.current;
    active.current?.abort();
    if (deadline.current) clearTimeout(deadline.current);
    const controller = new AbortController(); active.current = controller;
    setBusy(true); setResult(null); setMessage('');
    // Authentication can stall before fetch exists. Withdraw that generation as
    // well as aborting I/O so a late token cannot start a request after timeout.
    deadline.current = setTimeout(() => {
      if (turn !== generation.current) return;
      generation.current++; controller.abort(); active.current = null; deadline.current = null;
      setBusy(false); setMessage('Loading the station reference timed out. No replacement readings were supplied.');
    }, 20_000);
    try {
      const headers = await paidApiHeaders();
      if (turn !== generation.current) return;
      const response = await fetch('/api/international/weather-reference?reference=sonoma-ksts', {
        headers, signal: controller.signal, cache: 'no-store',
      });
      if (turn !== generation.current) return;
      if (!response.ok) {
        setMessage(response.status === 401 ? 'Sign in to load this public station reference.'
          : response.status === 429 ? 'This request was rate-limited. Try later; no automatic retry is made.'
            : 'The station reference could not be loaded. No replacement readings were supplied.');
        return;
      }
      const value = parseNwsObservationResult(await response.json());
      if (turn !== generation.current) return;
      if (!value) throw Error('Invalid station response');
      setResult(value);
    } catch { if (turn === generation.current) setMessage('The station reference could not be loaded. No replacement readings were supplied.'); }
    finally { if (turn === generation.current) { if (deadline.current) clearTimeout(deadline.current); deadline.current = null; setBusy(false); active.current = null; } }
  }
  return <section className={styles.card} aria-labelledby="nws-reference-heading">
    <p className={styles.eyebrow}>US public station reference</p>
    <h2 id="nws-reference-heading">Observe a public weather station</h2>
    <p>{SONOMA_NWS_REFERENCE.label}. This is a fixed public example, not your farm or a station selected from your location.</p>
    <p>Load its latest published observations. These are separate from monthly climate averages; they do not change the crop planner or approve local growing guidance.</p>
    <button type="button" className={styles.button} disabled={busy} onClick={() => void check()}>{busy ? 'Loading station observations…' : 'Load public station observations'}</button>
    <div role="status" aria-live="polite" className={styles.result}>
      {message && <p>{message}</p>}
      {result?.status === 'failed' && <p>The provider supplied no usable station reference. No replacement readings were supplied.</p>}
      {result && result.status !== 'failed' && <>
        <h3>{result.status === 'partial' ? 'Partial station observations' : 'Station observations received'}</h3>
        <p>{result.stationName} · {result.stationId}</p>
        <p>Observation time, as published: {result.observedAt}. Retrieved: {result.provenance.fetchedAt}.</p>
        <p>Freshness has not been assessed. A successful request does not establish current conditions on your farm.</p>
        {result.timing === 'after-retrieval' && <p>The published observation time is after the retrieval time. Check the source before relying on it.</p>}
        <dl>{MEASUREMENTS.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{reading(result.measurements[key])}</dd></div>)}</dl>
        <p className={styles.secondary}>Missing, invalid or unsupported measurements remain unknown. Zero is shown only when the source supplies zero.</p>
        <details className={styles.details}><summary>Published source metadata</summary>
          <p>{result.provenance.attribution} Station provider: {result.stationProvider ?? 'Unknown'}.</p>
          <p>The station and observation publish separate points. Both are retained; neither is moved onto your farm.</p>
          <dl><dt>Station point (longitude, latitude)</dt><dd>{result.stationPoint.coordinates.join(', ')}</dd>
            <dt>Observation point (longitude, latitude)</dt><dd>{result.observationPoint.coordinates.join(', ')}</dd>
            {MEASUREMENTS.map(([key, label]) => <div key={key}><dt>{label}: original unit / source QC flag</dt>
              <dd>{result.measurements[key].unitCode ?? 'Unknown'} / {result.measurements[key].qualityControl ?? 'Unknown'}</dd></div>)}</dl>
          <p>Source QC flags are retained without treating them as independent field verification.</p>
        </details>
      </>}
    </div>
    <details className={styles.details}><summary>Provider scope and access</summary>
      <p>{NWS_OBSERVATION_PROVIDER.coverage}</p><p>{NWS_OBSERVATION_PROVIDER.licence}</p>
      <p>{NWS_OBSERVATION_PROVIDER.cadence}</p><p>{NWS_OBSERVATION_PROVIDER.limitations}</p>
      <a href={NWS_OBSERVATION_PROVIDER.docsUrl} target="_blank" rel="noreferrer" className={styles.link}>Official NWS API documentation ↗</a>
    </details>
  </section>;
}
