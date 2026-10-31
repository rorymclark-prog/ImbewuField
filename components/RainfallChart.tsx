'use client';

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import { useLanguage } from '@/lib/i18n';
import type { MonthlyRainfall } from '@/lib/types';
import { inlineText, inlineTemplate } from '@/lib/xh-inline';

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MONTH_FULL = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ZU_MONTH_FULL = [
  'uMasingana', 'uNhlolanja', 'uNdasa', 'uMbasa', 'uNhlaba', 'uNhlangulana',
  'uNtulikazi', 'uNcwaba', 'uMandulo', 'uMfumfu', 'uLwezi', 'uZibandlela',
];

// isiXhosa month names come from the dictionary (waterBalanceMonth*), so they track the reviewed wording.
const XH_MONTH_KEYS = [
  'waterBalanceMonthJan', 'waterBalanceMonthFeb', 'waterBalanceMonthMar', 'waterBalanceMonthApr',
  'waterBalanceMonthMay', 'waterBalanceMonthJun', 'waterBalanceMonthJul', 'waterBalanceMonthAug',
  'waterBalanceMonthSep', 'waterBalanceMonthOct', 'waterBalanceMonthNov', 'waterBalanceMonthDec',
] as const;

interface Props { rainfall: MonthlyRainfall }

export default function RainfallChart({ rainfall }: Props) {
  const { lang, t } = useLanguage();
  const isZulu = lang === 'zu';
  const isXhosa = lang === 'xh';
  // Both unreviewed drafts are shown beside their English source, so a reader can check the figures.
  const bilingual = isZulu || isXhosa;
  const text = (en: string, zu: string) => inlineText(lang, en, zu);
  if (!rainfall?.monthly?.length) return null;
  const maxVal = Math.max(...rainfall.monthly, 10);
  const data = rainfall.monthly.map((v, i) => ({
    month: bilingual ? String(i + 1) : MONTHS[i],
    full: isZulu ? `${ZU_MONTH_FULL[i]} · ${MONTH_FULL[i]}` : isXhosa ? `${t(XH_MONTH_KEYS[i])} · ${MONTH_FULL[i]}` : MONTH_FULL[i],
    mm: Math.round(v),
  }));
  // Source pairs: winter / Winter rainfall; summer / Summer rainfall; year-round / Year-round rain.
  // lib/nasa-power.ts supplies only Oct–Mar / May–Aug, May–Sep / Nov–Mar, or year-round / none.
  const pattern = bilingual
    ? rainfall.pattern === 'winter' ? `${t('climatePatternWinter')} · Winter rainfall`
      : rainfall.pattern === 'summer' ? `${t('climatePatternSummer')} · Summer rainfall`
        : `${t('climatePatternYearRound')} · Year-round rain`
    : rainfall.pattern;
  const seasonValue = (value: string) => {
    if (isXhosa) {
      if (value === 'year-round') return `${t('reportSeasonYearRound')} · year-round`;
      if (value === 'none') return `${t('reportSeasonNone')} · none`;
      const [from, to] = value.split('–');
      const fromKey = XH_MONTH_KEYS[MONTH_FULL.indexOf(from)], toKey = XH_MONTH_KEYS[MONTH_FULL.indexOf(to)];
      return fromKey && toKey ? `${t(fromKey)}–${t(toKey)} · ${value}` : value;
    }
    if (!isZulu) return value;
    const translated: Record<string, string> = {
      'Oct–Mar': 'uMfumfu–uNdasa · Oct–Mar',
      'May–Aug': 'uNhlaba–uNcwaba · May–Aug',
      'May–Sep': 'uNhlaba–uMandulo · May–Sep',
      'Nov–Mar': 'uLwezi–uNdasa · Nov–Mar',
      'year-round': 'unyaka wonke · year-round',
      none: 'akukho · none',
    };
    return translated[value] ?? value;
  };

  // w21-07: the text classes here used muted/secondary/blue utility names Tailwind never defined,
  // so every label inherited the panel colour; they now read the theme tokens directly.
  return (
    <div>
      <div className={`mb-3 ${bilingual ? 'flex flex-col items-start gap-1' : 'flex items-center justify-between'}`}>
        <div>
          <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
            {text('Monthly rainfall (mm)', 'Imvula yenyanga (mm) · Monthly rainfall (mm)')}
          </span>
          {isZulu && <div className="text-xs text-[var(--text-muted)]">Uhlaka lwesiZulu olungakabuyekezwa · Unreviewed isiZulu draft</div>}
          {isXhosa && <div className="text-xs text-[var(--text-muted)]">{inlineText(lang, 'Unreviewed isiXhosa draft')}</div>}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
          <span className="text-[var(--blue)]">{inlineTemplate(lang, '{annual}mm/yr', '{annual} mm/ngonyaka · mm/yr', { annual: rainfall.annual })}</span>
          <span className="text-[var(--text-muted)]">{pattern}</span>
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

      <div className={`${bilingual ? 'flex flex-col gap-1' : 'flex flex-wrap justify-between gap-x-3 gap-y-1'} mt-2 text-xs text-[var(--text-muted)]`}>
        <span>{text('Wet season:', 'Isikhathi semvula · Wet season:')} <span className="text-[var(--text-secondary)]">{seasonValue(rainfall.wetSeason)}</span></span>
        <span>{text('Dry season:', 'Isikhathi esomile · Dry season:')} <span className="text-[var(--text-secondary)]">{seasonValue(rainfall.drySeason)}</span></span>
      </div>
    </div>
  );
}
