'use client';

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import type { MonthlyRainfall } from '@/lib/types';

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MONTH_FULL = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface Props { rainfall: MonthlyRainfall }

export default function RainfallChart({ rainfall }: Props) {
  if (!rainfall?.monthly?.length) return null;
  const maxVal = Math.max(...rainfall.monthly, 10);
  const data = rainfall.monthly.map((v, i) => ({ month: MONTHS[i], full: MONTH_FULL[i], mm: Math.round(v) }));

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-mono text-text-muted uppercase tracking-wider">Monthly rainfall (mm)</span>
        <div className="flex gap-3 text-xs font-mono">
          <span className="text-accent-blue">{rainfall.annual}mm/yr</span>
          <span className="text-text-muted">{rainfall.pattern}</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: -20 }}>
          <XAxis
            dataKey="month"
            tick={{ fill: '#526a4c', fontSize: 12, fontFamily: 'monospace' }}
            axisLine={{ stroke: '#2d4528' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#526a4c', fontSize: 12, fontFamily: 'monospace' }}
            axisLine={false}
            tickLine={false}
            width={30}
          />
          <Tooltip
            cursor={{ fill: '#253523' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div className="bg-bg-3 border border-border px-2 py-1 rounded text-xs font-mono">
                  <span className="text-text-secondary">{d.full}: </span>
                  <span className="text-accent-blue">{d.mm}mm</span>
                </div>
              );
            }}
          />
          <ReferenceLine y={0} stroke="#2d4528" />
          <Bar dataKey="mm" radius={[2, 2, 0, 0]}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={d.mm > maxVal * 0.6 ? '#4a7db5' : d.mm > maxVal * 0.3 ? '#5a8db5' : '#3a5a7a'}
                opacity={d.mm < 5 ? 0.4 : 1}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="flex justify-between mt-2 text-xs font-mono text-text-muted">
        <span>Wet: <span className="text-text-secondary">{rainfall.wetSeason}</span></span>
        <span>Dry: <span className="text-text-secondary">{rainfall.drySeason}</span></span>
      </div>
    </div>
  );
}
