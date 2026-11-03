'use client';

import { useState } from 'react';
import styles from './CountryReview.module.css';

const STATION_ID = 'yeovilton';
const DIRECTORY_URL = 'https://www.metoffice.gov.uk/research/climate/maps-and-data/historic-station-data';
const STATION_URL = 'https://www.metoffice.gov.uk/pub/data/weather/uk/climate/stationdata/yeoviltondata.txt';

export default function UkStationReference({ countryCode }: { countryCode: string }) {
  // Leaving GB unmounts the selector so a returning grower makes a fresh choice.
  return countryCode === 'GB' ? <StationSelector /> : null;
}

function StationSelector() {
  const [station, setStation] = useState('');
  return <section className={styles.card} aria-labelledby="uk-station-heading">
    <p className={styles.eyebrow}>Official historical reference</p>
    <h2 id="uk-station-heading">UK climate station data</h2>
    <p>Choose a station to open its past monthly weather records from the Met Office.</p>
    <div className={styles.fields}><label>Historical weather station
      <select value={station} onChange={event => setStation(event.target.value === STATION_ID ? STATION_ID : '')}>
        <option value="">Choose a station</option>
        <option value={STATION_ID}>Yeovilton</option>
      </select>
    </label></div>
    {station === STATION_ID ? <article aria-label="Yeovilton historical weather reference">
      <h3>Yeovilton · Met Office</h3>
      <p>These past monthly records describe one station. Use a local forecast and check conditions at your own site before making planting decisions.</p>
      <p className={styles.secondary}>Monthly frost day counts cannot tell you the first or last frost date.</p>
      <p><a href={DIRECTORY_URL} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className={styles.link}>Open the Met Office station directory ↗</a></p>
      <p><a href={STATION_URL} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className={styles.link}>Open Yeovilton monthly records (text file) ↗</a></p>
    </article> : <p className={styles.secondary} role="status">No station selected.</p>}
  </section>;
}
