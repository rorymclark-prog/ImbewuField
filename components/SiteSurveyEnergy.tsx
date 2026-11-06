'use client';
import { useEffect, useRef, useState } from 'react';
import { numberLabel } from '@/lib/format-figures';
import { getFirebase } from '@/lib/firebase/init';
import { paidApiHeaders } from '@/lib/api-client-auth';
import { surveyDraftScopeIsActive } from '@/lib/site-survey';
import { energyCoordinatesMatch, normaliseSolarReference, surveyEnergyInputErrors, PVGIS_GUIDE, WIND_ATLAS_URL, type SiteEnergyEvidence, type WindEvidence, type SurveyEnergyInputs } from '@/lib/site-energy';
import styles from './SiteSurveyEnergy.module.css';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function SiteSurveyEnergy({ siteId, coords, scope, value, onChange, numericInputs, onNumericInputChange }: {
  siteId: string; coords: { lat: number; lon: number } | null; scope: string;
  value: SiteEnergyEvidence; onChange: (next: SiteEnergyEvidence) => void;
  numericInputs?: SurveyEnergyInputs; onNumericInputChange?: (key: keyof SurveyEnergyInputs, raw: string) => void;
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'success'>('idle');
  const [message, setMessage] = useState('');
  const request = useRef<AbortController | null>(null);
  const current = useRef({ siteId, scope, value, onChange });
  current.current = { siteId, scope, value, onChange };
  useEffect(() => { setStatus('idle'); setMessage(''); return () => { request.current?.abort(); }; }, [siteId, scope]);
  const solar = normaliseSolarReference(value.solar, siteId), wind = value.wind;
  const raw = numericInputs ?? { benchmarkElevation: '', windSpeed: wind?.meanSpeedMs?.toString() ?? '', windHeight: wind?.heightM?.toString() ?? '' };
  const errors = surveyEnergyInputErrors(raw, wind?.kind);
  const patchWind = (patch: Partial<WindEvidence>) => onChange({ ...value,
    wind: { kind: 'atlas', meanSpeedMs: null, heightM: null, source: 'Global Wind Atlas (DTU / World Bank / ESMAP)', period: '', ...wind, ...patch } });

  async function lookup() {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    const actor = getFirebase()?.auth.currentUser;
    const actorId = actor?.uid;
    const active = () => !controller.signal.aborted && current.current.siteId === siteId && current.current.scope === scope
      && surveyDraftScopeIsActive(scope, siteId) && getFirebase()?.auth.currentUser?.uid === actorId;
    if (!actor || !coords || !energyCoordinatesMatch(siteId, coords.lat, coords.lon) || !active()) {
      setStatus('error'); setMessage('Sign in and open a site with valid coordinates before fetching.'); return;
    }
    setStatus('loading'); setMessage('Fetching the reference from European Commission JRC PVGIS…');
    try {
      const headers = await paidApiHeaders(actor);
      if (!active()) return;
      const response = await fetch('/api/site-energy', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, lat: coords.lat, lon: coords.lon }), signal: controller.signal, cache: 'no-store' });
      const body = await response.json();
      if (!active()) return;
      if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : 'Solar lookup is unavailable.');
      const result = normaliseSolarReference(body.solar, siteId);
      if (!result || body.siteId !== siteId || body.actorId !== actorId) throw new Error('The returned reference did not match this account and site.');
      current.current.onChange({ ...current.current.value, solar: result });
      setStatus('success'); setMessage('Reference ready for review. Save the survey to keep it with this site.');
    } catch (error) {
      if (!active()) return;
      setStatus('error'); setMessage(error instanceof Error ? error.message : 'Solar lookup failed. Your previous reference is unchanged.');
    }
  }

  return <section lang="en" className={styles.card} aria-label="Energy potential">
    <h3>Energy potential <small>(optional)</small></h3>
    <p>Explore solar electricity and record wind evidence. These are screening references, separate from installed equipment and the Sector map.</p>
    <details open={!!solar}>
      <summary>Solar resource & reference PV electricity</summary>
      <p>Fetch sends this site's coordinates{coords ? ` (${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)})` : ''} to European Commission JRC PVGIS for a solar estimate. No lookup runs until you press the button.</p>
      <p>Assumptions: <strong>1 kWp</strong> crystalline-silicon panels, free-standing, 14% system losses, PVGIS-optimised tilt and orientation, terrain horizon included. This is a comparison system, not your installed capacity.</p>
      <button type="button" className={styles.button} disabled={status === 'loading' || !coords} onClick={lookup}>{status === 'loading' ? 'Fetching solar reference…' : solar ? 'Refresh solar reference from PVGIS' : 'Fetch solar reference from PVGIS'}</button>
      <p role={status === 'error' ? 'alert' : 'status'} className={status === 'error' ? styles.error : styles.note}>{message}</p>
      {solar && <div className={styles.result}>
        <strong>{numberLabel(solar.annualKwh)} kWh / year</strong>
        <p>Modelled electricity for the assumed 1 kWp system. Solar irradiation on that panel plane: {numberLabel(solar.annualIrradiationKwhM2)} kWh/m²/year.</p>
        <p>Tilt {solar.tiltDegrees}° · azimuth {solar.azimuthDegreesFromSouth}° from south (0° south, +90° west, −90° east). Free-standing c-Si · assumed losses 14% · terrain horizon included.</p>
        <div className={styles.months} role="img" aria-label={`Monthly reference electricity in kWh: ${solar.months.map(m => `${MONTHS[m.month - 1]} ${m.energyKwh}`).join(', ')}`}>
          {solar.months.map(m => <div className={styles.month} key={m.month} title={`${MONTHS[m.month - 1]}: ${m.energyKwh} kWh`}><div className={styles.bar} style={{ height: `${Math.max(2, 80 * m.energyKwh / Math.max(1, ...solar.months.map(row => row.energyKwh)))}px` }}/>{MONTHS[m.month - 1]}</div>)}
        </div>
        <details><summary>Monthly values (kWh)</summary><table><tbody>{solar.months.map(m => <tr key={m.month}><th scope="row">{MONTHS[m.month - 1]}</th><td>{m.energyKwh} kWh</td></tr>)}</tbody></table></details>
        <p className={styles.note}>JRC PVGIS {solar.version} · {solar.radiationDatabase} / {solar.meteorologicalDatabase} · climate period {solar.startYear}–{solar.endYear} · retrieved {solar.fetchedAt.slice(0, 10)} (UTC). <a href={PVGIS_GUIDE} target="_blank" rel="noreferrer">Source & method</a></p>
        <button type="button" className={`${styles.button} ${styles.secondary}`} onClick={() => { request.current?.abort(); request.current = null; setStatus('idle'); setMessage('Solar reference removed.'); onChange({ ...value, solar: undefined }); }}>Remove solar reference</button>
      </div>}
      <label className={styles.field}>Nearby shade / solar siting observations<textarea maxLength={500} value={value.solarShadeNotes ?? ''} onChange={e => onChange({ ...value, solarShadeNotes: e.target.value })}/></label>
      <p className={styles.note}>Nearby trees and buildings, usable roof area, structural and electrical suitability, storage, cost and grid connection still need checking. The terrain horizon does not resolve nearby shade.</p>
    </details>
    <details open={!!wind}>
      <summary>Wind resource & local exposure</summary>
      <p>Open the official atlas, select your exact point and height, then record its mean speed and dataset period here. Do not copy the “10% windiest areas” country statistic as your site's value.</p>
      {coords && <p>Site coordinates to locate: <strong>{coords.lat.toFixed(5)}, {coords.lon.toFixed(5)}</strong></p>}
      <a className={`${styles.button} ${styles.secondary}`} href={WIND_ATLAS_URL} target="_blank" rel="noreferrer">Open Global Wind Atlas</a>
      <p className={styles.note}>This link opens the provider; it does not send this site's coordinates automatically. Atlas downloads are offered on desktop. Automatic point import is not connected.</p>
      <div className={styles.fields}>
        <label className={styles.field}>Evidence type<select value={wind?.kind ?? 'atlas'} onChange={e => { onNumericInputChange?.('windSpeed', ''); onNumericInputChange?.('windHeight', ''); patchWind({ kind: e.target.value as WindEvidence['kind'], meanSpeedMs: null, heightM: null, period: '', source: e.target.value === 'atlas' ? 'Global Wind Atlas (DTU / World Bank / ESMAP)' : '' }); }}><option value="atlas">Global Wind Atlas, manually recorded</option><option value="measured">Local measurement record</option></select></label>
        <label className={styles.field}>Mean wind speed (m/s)<input type="number" min={0} max={100} step="any" aria-invalid={!!errors.windSpeed} value={raw.windSpeed} onChange={e => { onNumericInputChange?.('windSpeed', e.target.value); patchWind({ meanSpeedMs: e.target.value === '' ? null : Number(e.target.value) }); }}/>{errors.windSpeed && <small role="alert">{errors.windSpeed}</small>}</label>
        {(wind?.kind ?? 'atlas') === 'atlas' ? <label className={styles.field}>Atlas height above ground (m)<select aria-invalid={!!errors.windHeight} value={raw.windHeight} onChange={e => { onNumericInputChange?.('windHeight', e.target.value); patchWind({ heightM: e.target.value === '' ? null : Number(e.target.value) }); }}><option value="">Choose the atlas height</option>{[10,50,100,150,200].map(h => <option value={h} key={h}>{h} m</option>)}</select>{errors.windHeight && <small role="alert">{errors.windHeight}</small>}</label>
          : <label className={styles.field}>Measurement height above ground (m)<input type="number" min={0.1} max={1000} step="any" aria-invalid={!!errors.windHeight} value={raw.windHeight} onChange={e => { onNumericInputChange?.('windHeight', e.target.value); patchWind({ heightM: e.target.value === '' ? null : Number(e.target.value) }); }}/>{errors.windHeight && <small role="alert">{errors.windHeight}</small>}</label>}
        <label className={styles.field}>Averaging / dataset period<input maxLength={150} placeholder="Copy the actual period; leave unknown blank" value={wind?.period ?? ''} onChange={e => patchWind({ period: e.target.value })}/></label>
        <label className={styles.field}>Source / point reference<input maxLength={500} value={wind?.source ?? ''} onChange={e => patchWind({ source: e.target.value })}/></label>
        <label className={styles.field}>Date recorded<input type="date" value={wind?.recordedOn ?? ''} onChange={e => patchWind({ recordedOn: e.target.value })}/></label>
        <label className={styles.field}>Exposure<select value={wind?.exposure ?? 'unknown'} onChange={e => patchWind({ exposure: e.target.value as WindEvidence['exposure'] })}><option value="unknown">Not known</option><option value="open">Open</option><option value="sheltered">Sheltered</option><option value="mixed">Mixed</option></select></label>
      </div>
      <label className={styles.field}>Nearby trees, buildings, ridges or turbulence<textarea maxLength={500} value={wind?.obstacles ?? ''} onChange={e => patchWind({ obstacles: e.target.value })}/></label>
      {wind && <><p>{errors.windSpeed || errors.windHeight ? 'Correct the wind numbers before saving this reference.' : wind.meanSpeedMs === null || wind.heightM === null || !wind.period.trim() || !wind.source.trim() ? 'Incomplete wind reference: add speed, height, source and averaging period before comparing resources.' : 'Wind reference recorded. This is not a turbine generation estimate.'}</p><button type="button" className={`${styles.button} ${styles.secondary}`} onClick={() => { onNumericInputChange?.('windSpeed', ''); onNumericInputChange?.('windHeight', ''); onChange({ ...value, wind: undefined }); }}>Remove wind reference</button></>}
      <p className={styles.note}>Global Wind Atlas · DTU Wind and Energy Systems / World Bank / ESMAP · <a href="https://globalwindatlas.info/en/about/TermsOfUse" target="_blank" rel="noreferrer">CC BY 4.0 & attribution</a>. Regional model, approximately 250 m grid. A turbine needs its own power curve, hub height, speed distribution, local monitoring and siting assessment; mean speed alone cannot give kWh.</p>
    </details>
  </section>;
}
