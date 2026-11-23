'use client';

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import { useLanguage } from '@/lib/i18n';
import { annualRainfallMm, hasRainfallVariation, rainfallSourceName, sourcedMonthlyRainfall } from '@/lib/climate-temperature';
import type { MonthlyRainfall } from '@/lib/types';

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MONTH_FULL = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ZU_MONTH_FULL = [
  'uMasingana', 'uNhlolanja', 'uNdasa', 'uMbasa', 'uNhlaba', 'uNhlangulana',
  'uNtulikazi', 'uNcwaba', 'uMandulo', 'uMfumfu', 'uLwezi', 'uZibandlela',
];

interface Props { rainfall: MonthlyRainfall }

export default function RainfallChart({ rainfall }: Props) {
  const { lang, t } = useLanguage();
  const isZulu = lang === 'zu';
  const text = (en: string, zu: string) => isZulu ? zu : en;
  const monthly = sourcedMonthlyRainfall(rainfall);
  if (!monthly) return <p lang="en" className="text-xs text-[var(--text-secondary)]">Monthly rainfall is unavailable.</p>;
  const annual = annualRainfallMm(rainfall);
  const maxVal = Math.max(...monthly, 10);
  const data = monthly.map((v, i) => ({
    month: isZulu ? String(i + 1) : MONTHS[i],
    full: isZulu ? `${ZU_MONTH_FULL[i]} · ${MONTH_FULL[i]}` : MONTH_FULL[i],
    mm: Math.round(v),
  }));
  // Source pairs: winter / Winter rainfall; summer / Summer rainfall; year-round / Year-round rain.
  // lib/nasa-power.ts supplies only Oct–Mar / May–Aug, May–Sep / Nov–Mar, or year-round / none.
  const pattern = isZulu
    ? rainfall.pattern === 'winter' ? `${t('climatePatternWinter')} · Winter rainfall`
      : rainfall.pattern === 'summer' ? `${t('climatePatternSummer')} · Summer rainfall`
        : `${t('climatePatternYearRound')} · Year-round rain`
    : rainfall.pattern;
  // w21-07: the text classes here used muted/secondary/blue utility names Tailwind never defined,
  // so every label inherited the panel colour; they now read the theme tokens directly.
  return (
    <div>
      <div className={`mb-3 ${isZulu ? 'flex flex-col items-start gap-1' : 'flex items-center justify-between'}`}>
        <div>
          <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
            {text('Monthly rainfall (mm)', 'Imvula yenyanga (mm) · Monthly rainfall (mm)')}
          </span>
          {isZulu && <div className="text-xs text-[var(--text-muted)]">Uhlaka lwesiZulu olungakabuyekezwa · Unreviewed isiZulu draft</div>}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {annual !== null && <span className="text-[var(--blue)]">{isZulu ? `${annual} mm/ngonyaka · mm/yr` : `${annual}mm/yr`}</span>}
          {hasRainfallVariation(monthly) && <span className="text-[var(--text-muted)]">{pattern}</span>}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: -20 }}>
          <XAxis
            dataKey="month"
            tick={{ fill: '#526a4c', fontSize: 12, fontFamily: 'var(--font-sans)' }}
            axisLine={{ stroke: '#2d4528' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#526a4c', fontSize: 12, fontFamily: 'var(--font-sans)' }}
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
                <div className="bg-bg-3 border border-border px-2 py-1 rounded text-xs font-display tabular-nums">
                  <span className="text-[var(--text-secondary)]">{d.full}: </span>
                  <span className="text-[var(--blue)]">{d.mm}mm</span>
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

      <p className="mt-2 text-xs text-[var(--text-secondary)]">
        {text('Rainfall source', 'Umthombo wemininingwane yemvula')} · {rainfallSourceName(rainfall.rainfallSource)}
      </p>
    </div>
  );
}
