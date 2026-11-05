'use client';

import { useState } from 'react';
import Link from 'next/link';
import MenuButton from '@/components/MenuButton';
import { useRegisterBackControl } from '@/components/BackControl';
import { COUNTRY_PROFILES, COUNTRY_RESEARCH_QUEUE, EUROPE_RESEARCH_NOTE } from '@/lib/international/countries/registry';
import { evaluateCountryReadiness, sourceEvidenceState } from '@/lib/international/countries/readiness';
import type { Known } from '@/lib/international/countries/types';
import { COUNTRY_CLIMATE_DEMOS, NASA_REFERENCE_PROVIDER, fetchCountryClimateReference, type ClimateReferenceResult, type ClimateDemoCode } from '@/lib/international/providers/nasa-reference';
import styles from './CountryReview.module.css';
import NwsForecastReference from './NwsForecastReference';

const metadata = (value: Known<string>) => value.status === 'known' ? value.value : `Unknown — ${value.reason}`;
const CATEGORY_NAMES = { biodiversity: 'Biodiversity & taxonomy', 'agricultural-extension': 'Agricultural extension', 'weather-frost': 'Weather & frost', soils: 'Soils', 'plant-legality': 'Plant legality' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FAILURE_COPY = {
  'unsupported-demo': 'There is no public demonstration place for this selection.',
  timeout: 'The reference request timed out. No replacement values were supplied.',
  'network-error': 'The reference service could not be reached. No replacement values were supplied.',
  'rate-limited': 'NASA rate-limited this request. Try later; there is no automatic retry.',
  'http-error': 'The reference service returned an error. No replacement values were supplied.',
  'malformed-response': 'The response did not match the verified data contract. No replacement values were supplied.',
  'wrong-units': 'The response did not supply the required Celsius unit metadata. Values were withheld.',
  'missing-measurement': 'The reference returned no usable monthly temperature measurements.',
  'response-too-large': 'The response exceeded this demonstration’s size limit and was stopped.',
};

export default function CountryReview() {
  // This page already has an in-flow return link; the floating Back covered it on phones.
  useRegisterBackControl();
  const [code, setCode] = useState('KE');
  const [region, setRegion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ClimateReferenceResult | null>(null);
  const asOf = new Date().toISOString().slice(0, 10);
  const readiness = evaluateCountryReadiness({ countryCode: code, agriculturalRegionId: region, interfaceLanguage: 'en' }, asOf);
  const demo = Object.hasOwn(COUNTRY_CLIMATE_DEMOS, code) ? COUNTRY_CLIMATE_DEMOS[code as ClimateDemoCode] : null;
  async function checkReference() {
    setLoading(true); setResult(null);
    try { setResult(await fetchCountryClimateReference(code)); }
    finally { setLoading(false); }
  }
  return <div className={styles.page}><main className={styles.main}>
    <header className={styles.header}>
      <div className="flex flex-wrap items-center gap-3"><MenuButton /><Link href="/home" className={styles.link}>← ImbewuField home</Link></div>
      <p className={styles.eyebrow}>International foundation · English review draft</p>
      <h1>Local evidence comes first.</h1>
      <p>Explore provisional country dossiers and try a public climate reference. Growers remain the primary users. These pilots do not enable locally reviewed crop recommendations.</p>
    </header>
    <nav className={styles.card} aria-label="International review workspaces">
      <h2>Review the foundations</h2>
      <p>Country evidence below, source-paired language drafts and fictional project examples are separate review tools.</p>
      <p><Link href="/international/locales" className={styles.link}>Review language drafts →</Link></p>
      <p><Link href="/international/projects" className={styles.link}>Review project workflows and evidence →</Link></p>
    </nav>
    <section className={styles.notice} aria-label="Readiness limits"><strong>Reference only. International production planning is unavailable.</strong>
      <p>A country, an agricultural region and a language are independent choices. This English review interface does not certify local agronomy. South African defaults are never applied by this foundation.</p>
    </section>
    <section className={styles.card} aria-labelledby="context-heading"><h2 id="context-heading">Review a country</h2>
      <div className={styles.fields}><label>Country<select value={code} disabled={loading} onChange={(event) => { setCode(event.target.value); setRegion(''); setResult(null); }}>
        {COUNTRY_PROFILES.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}
        <option value="OTHER">Other country · no dossier</option>
      </select></label>
      <label>Agricultural region reference<input value={region} onChange={(event) => setRegion(event.target.value)} placeholder="Not yet identified or reviewed" aria-describedby="region-help" /></label></div>
      <p id="region-help" className={styles.secondary}>No agricultural regions have passed local review in these pilot dossiers. Entering a name does not approve it. Interface language: English prototype.</p>
      <p className={styles.status}>{readiness.status === 'unsupported-country' ? 'No reviewed dossier' : 'Engineering pilot · reference evidence only'}</p>
      {readiness.country && <p>{readiness.country.jurisdictionNote}</p>}
      <h3>What still needs review</h3><ul>{readiness.gaps.map((gap) => <li key={gap}>{gap}</li>)}</ul>
    </section>
    <section aria-labelledby="evidence-heading"><h2 id="evidence-heading">Evidence by purpose</h2>
      <p className={styles.secondary}>A source page read is distinct from a dated dataset or approved farming guidance. Unknown publication dates remain undated evidence.</p>
      <div className={styles.evidenceGrid}>{readiness.evidence.map((entry) => <article key={entry.category} className={styles.card}>
        <h3>{CATEGORY_NAMES[entry.category]}</h3>
        {!entry.sources.length && <p>No source dossier recorded.</p>}
        {entry.sources.map((source) => <details key={source.id} className={styles.details}>
          <summary><span>{source.authority}</span><small>{source.verification === 'content-read' ? 'Full source page read' : 'Source unavailable in this review'} · {sourceEvidenceState(source, asOf)}</small></summary>
          <p><a href={source.url} target="_blank" rel="noreferrer" className={styles.link}>Open official source ↗</a></p>
          <p>{source.verifiedClaim}</p><p>{source.limitations}</p>
          <dl><dt>Coverage</dt><dd>{source.coverage}</dd><dt>Resolution</dt><dd>{metadata(source.resolution)}</dd>
            <dt>Units</dt><dd>{metadata(source.units)}</dd><dt>Update cadence</dt><dd>{metadata(source.updateCadence)}</dd>
            <dt>Licence</dt><dd>{metadata(source.licence)}</dd><dt>Attribution</dt><dd>{source.attribution}</dd>
            <dt>Access</dt><dd>{metadata(source.accessRequirements)}</dd><dt>Missing data</dt><dd>{source.missingDataBehavior}</dd>
            <dt>Accessed / published</dt><dd>{source.accessedOn ?? 'unknown'} / {source.publishedOn ?? 'unknown'}</dd>
            {source.lastModifiedOn && <><dt>Page last modified (not publication)</dt><dd>{source.lastModifiedOn}</dd></>}</dl>
        </details>)}
      </article>)}</div>
    </section>
    <section className={styles.card} aria-labelledby="provider-heading"><p className={styles.eyebrow}>Executable public reference</p>
      <h2 id="provider-heading">Try NASA POWER temperature data</h2><p>{NASA_REFERENCE_PROVIDER.limitations}</p>
      <p><strong>{demo?.label ?? 'No demo available'}</strong>{demo && ` · coarse point ${demo.latitude}°, ${demo.longitude}°`}</p>
      <button type="button" className={styles.button} disabled={!demo || loading} onClick={() => void checkReference()}>{loading ? 'Checking public reference…' : 'Check public reference'}</button>
      <div role="status" aria-live="polite" className={styles.result}>
        {loading && <p>One bounded public request is in progress.</p>}
        {result?.status === 'failed' && <p>{FAILURE_COPY[result.reason]}{result.reason === 'rate-limited' && result.retryAfterSeconds !== null && result.retryAfterSeconds !== undefined ? ` Retry-after: ${result.retryAfterSeconds} seconds.` : ''}</p>}
        {result && result.status !== 'failed' && <><h3>{result.status === 'partial' ? 'Partial reference · missing months stay unknown' : 'Public reference received'}</h3>
          <p>{result.period.description}. Monthly mean air temperature at 2 metres, °C. API {result.dataset.apiVersion ?? 'version unknown'} · {result.dataset.sources.join(', ') || 'source metadata unknown'}.</p>
          <div className={styles.tableScroll}><table><caption>Reference temperature; no frost or planting advice</caption><thead><tr>{MONTHS.map((month) => <th key={month} scope="col">{month}</th>)}</tr></thead>
            <tbody><tr>{result.monthly.map((month) => <td key={month.month}>{month.state === 'value' ? month.valueC : 'Unknown'}</td>)}</tr></tbody></table></div>
          <p className={styles.secondary}>{result.provenance.attribution} Retrieved {result.provenance.fetchedAt}. This result does not change readiness or the field calendar.</p></>}
      </div>
      <details className={styles.details}><summary>Provider capabilities and limits</summary><dl>
        {(['coverage', 'resolution', 'units', 'updateCadence', 'licence', 'attribution', 'authentication', 'limits'] as const).map((key) => <div key={key}><dt>{key}</dt><dd>{NASA_REFERENCE_PROVIDER[key]}</dd></div>)}
      </dl><a href={NASA_REFERENCE_PROVIDER.docsUrl} target="_blank" rel="noreferrer" className={styles.link}>Official API documentation ↗</a></details>
    </section>
    {code === 'US' && <NwsForecastReference key={code} />}
    <section className={styles.card} aria-labelledby="queue-heading"><h2 id="queue-heading">Research priorities, not launch approvals</h2>
      <p>Only the four engineering pilots above have source-discovery dossiers. Other entries are an unreviewed research queue; depth and availability differ between pilots.</p>
      {COUNTRY_RESEARCH_QUEUE.map((group) => <p key={group.group}><strong>{group.group}:</strong> {group.countries.join(', ')}.</p>)}
      <p>{EUROPE_RESEARCH_NOTE}</p>
    </section>
  </main></div>;
}
