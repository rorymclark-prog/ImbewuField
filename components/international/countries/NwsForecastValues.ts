import { createElement as h } from 'react';
import type { NwsPublicDemoResult } from '@/lib/international/providers/nws-public-demo';

type Forecast = Extract<NwsPublicDemoResult, { status: 'available' | 'partial' }>;
interface Props { metadata: Forecast['metadata']; periods: Forecast['periods']; fetchedAt: string }

// Both request paths use the same value/timestamp presentation. Source prose
// never supplies a missing numeric measurement, and a real zero stays visible.
export default function NwsForecastValues({ metadata, periods, fetchedAt }: Props) {
  const row = (label: string, value: string, key = label) => h('div', { key },
    h('dt', { className: 'font-semibold' }, label), h('dd', null, value));
  return h('div', { className: 'min-w-0 space-y-3' },
    h('dl', { className: 'space-y-1 text-sm' },
      row('Source generatedAt', metadata.generatedAt),
      row('Underlying source updateTime', metadata.updateTime),
      row('Source validTimes interval', metadata.validTimes),
      row('Response retrieved at', fetchedAt)),
    h('p', { className: 'text-sm' }, 'Source date-time offsets are shown unchanged. Retrieval time does not establish forecast freshness.'),
    h('ol', { className: 'grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2' }, periods.map(period =>
      h('li', { key: period.number, className: 'min-w-0 space-y-2 rounded-xl border border-[var(--border)] p-3' },
        h('h4', { className: 'font-semibold' }, `Period ${period.number}: ${period.name ?? 'Unknown'}`),
        h('dl', { className: 'space-y-1 text-sm' },
          row('Source start', period.startTime), row('Source end', period.endTime),
          row('Temperature (°C)', period.temperatureC === null ? 'Unknown' : `${period.temperatureC} °C`),
          row('Precipitation probability (%)', period.precipitationPercent === null ? 'Unknown' : `${period.precipitationPercent}%`)),
        h('div', null, h('p', { className: 'text-sm font-semibold' }, 'NWS source summary'), h('p', null, period.shortForecast ?? 'Unknown')),
        h('div', null, h('p', { className: 'text-sm font-semibold' }, 'NWS source detail'), h('p', null, period.detailedForecast ?? 'Unknown'))))));
}
