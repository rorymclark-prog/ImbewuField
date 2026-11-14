import { writeFileSync } from 'node:fs';
import { DEMO_LOCATION } from '../../../../../lib/demo-site.ts';
const location = structuredClone(DEMO_LOCATION);
location.rainfall.rainfallSource = 'open-meteo';
writeFileSync(process.argv[2], JSON.stringify(location));
console.log('lat', location.lat, 'source', location.rainfall.rainfallSource, 'coverage', JSON.stringify(location.climate.monthlyTempCoverage));
