'use client';

import { useId, useMemo, useState } from 'react';
import { MONTHS_SHORT } from '@/lib/crop-catalog';
import { numberLabel } from '@/lib/format-figures';
import { pdfIconUrl } from '@/lib/pdf-icons';
import { buildProductionAvailabilityGraphs, buildProductionKgGraphs, isVisibleProductionFoodSource, type PreservedFoodMethod, type ProductionKgGraphInput, type PreservedFoodRecord, type ProductionAvailabilityGraphs as GraphSeries } from '@/lib/crop-export-availability';
import { preservedFoodArtUrl } from '@/lib/preserved-food-art';
import styles from './ProductionAvailabilityGraphs.module.css';

const W = 600, H = 250, LEFT = 40, TOP = 24, BASE = 192, PLOT = BASE - TOP;
const methodNames: Record<PreservedFoodMethod, string> = { stored: 'Stored', frozen: 'Frozen', dried: 'Dried', fermented: 'Fermented', processed: 'Processed' };

export default function ProductionAvailabilityGraphs({ series: baseSeries, input, preservedProducts, selectedMonthIndex, onMonthSelect }: {
  series: GraphSeries;
  input?: ProductionKgGraphInput;
  preservedProducts?: PreservedFoodRecord[];
  selectedMonthIndex?: number;
  onMonthSelect?: (index: number) => void;
}) {
  const id = useId();
  const [methods, setMethods] = useState<PreservedFoodMethod[]>(['stored', 'frozen', 'dried', 'fermented', 'processed']);
  const [kgMode, setKgMode] = useState<'records' | 'cycles' | 'stock'>('cycles');
  const series = useMemo(() => input ? buildProductionAvailabilityGraphs({ ...input, preservedMethods: methods }) : baseSeries, [baseSeries, input, methods]);
  const kg = useMemo(() => input ? buildProductionKgGraphs({ ...input, preservedMethods: methods }) : undefined, [input, methods]);
  const shownStocks = (preservedProducts ?? []).filter(record => methods.includes(record.method) && (!input || isVisibleProductionFoodSource(record.sourceIconKey, input)));
  const maxFood = Math.max(1, ...series.months.map(month => month.totalCount));
  const step = (W - LEFT - 12) / Math.max(1, series.months.length);
  const select = (index: number) => onMonthSelect?.(index);

  function foodChart(includeKept: boolean) {
    const title = includeKept ? 'Fresh + kept food' : 'Fresh food';
    return <article className={styles.card} aria-labelledby={`${id}-${includeKept ? 'kept' : 'fresh'}`}>
      <h3 id={`${id}-${includeKept ? 'kept' : 'fresh'}`}>{title}</h3>
      <p>{includeKept ? 'Fresh harvest, food in store and recorded preserved food.' : 'Harvested or produced this month, including staple crops.'}</p>
      <div className={styles.scroll} tabIndex={0} role="region" aria-label={`${title} graph; scroll sideways on a phone`}>
        <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={`${title}: different food types by month`}>
          {[0, Math.ceil(maxFood / 2), maxFood].filter((value, index, all) => all.indexOf(value) === index).map(value => {
            const y = BASE - value / maxFood * PLOT;
            return <g key={value}><line x1={LEFT} x2={W - 12} y1={y} y2={y} className={styles.grid} /><text x={LEFT - 8} y={y + 4} textAnchor="end" className={styles.axis}>{value}</text></g>;
          })}
          {series.months.map((month, index) => {
            const x = LEFT + index * step + step / 2;
            const value = includeKept ? month.totalCount : month.freshCount;
            const freshHeight = month.freshCount / maxFood * PLOT;
            const storedHeight = (includeKept ? month.storedCount : 0) / maxFood * PLOT;
            const preservedHeight = (includeKept ? month.preservedCount : 0) / maxFood * PLOT;
            const keptHeight = storedHeight + preservedHeight;
            const names = [...month.fresh.map(item => item.label), ...(includeKept ? month.stored.map(item => item.label) : []), ...(includeKept ? month.preserved.map(item => item.label) : [])];
            const label = `${MONTHS_SHORT[month.month - 1]} ${month.year}: ${value} food types${names.length ? ' — ' + names.join(', ') : ' with marked windows'}`;
            return <g key={`${month.year}-${month.month}`} role={onMonthSelect ? 'button' : undefined} tabIndex={onMonthSelect ? 0 : undefined}
              aria-label={label} className={onMonthSelect ? styles.monthButton : undefined}
              onClick={() => select(index)} onKeyDown={event => { if (onMonthSelect && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); select(index); } }}>
              <title>{label}</title>
              {selectedMonthIndex === index && <rect x={x - step / 2 + 2} y={TOP - 8} width={step - 4} height={H - TOP - 4} rx={7} className={styles.selected} />}
              <rect x={x - 14} y={BASE - freshHeight} width={28} height={freshHeight} rx={3} className={styles.fresh} />
              {storedHeight > 0 && <rect x={x - 14} y={BASE - freshHeight - storedHeight} width={28} height={storedHeight} rx={3} className={styles.kept} />}
              {preservedHeight > 0 && <rect x={x - 14} y={BASE - freshHeight - keptHeight} width={28} height={preservedHeight} rx={3} className={styles.preserved} />}
              <text x={x} y={BASE - freshHeight - keptHeight - 8} textAnchor="middle" className={styles.value}>{value}</text>
              <text x={x} y={BASE + 20} textAnchor="middle" className={styles.axis}>{MONTHS_SHORT[month.month - 1]}</text>
              <text x={x} y={BASE + 35} textAnchor="middle" className={styles.year}>{month.year}</text>
              {onMonthSelect && <rect x={x - step / 2} y={TOP - 8} width={step} height={H - TOP} fill="transparent" pointerEvents="all" />}
            </g>;
          })}
        </svg>
      </div>
      <div className={styles.key}><span><i className={styles.fresh} /> Fresh</span>{includeKept && <><span><i className={styles.kept} /> Planned pantry food</span><span><i className={styles.preserved} /> Recorded kept food</span></>}<span>Number of food types</span></div>
    </article>;
  }

  return <section className={styles.graphs} aria-label="Food availability and growing space graphs">
    <h2 className={styles.heading}>Food and growing space</h2>
    {input && <fieldset className={styles.options}><legend>Include kept food</legend>{(Object.keys(methodNames) as PreservedFoodMethod[]).map(method => <label key={method}><input type="checkbox" checked={methods.includes(method)} onChange={event => setMethods(previous => event.target.checked ? [...previous, method] : previous.filter(value => value !== method))} />{methodNames[method]}</label>)}</fieldset>}
    <div className={styles.foodGrid}>{foodChart(false)}{foodChart(true)}</div>
    <p className={styles.note}>One food counts once, even if it is both fresh and frozen. These are planned or recorded windows, not kilograms or meals. Regional reference seasons and undated plants or housing stay outside these totals.</p>
    <details className={styles.records}><summary>What is included in kept food?</summary>
      <p>Food in store follows each crop’s sourced storage conditions. Freezing, drying, fermentation and other processing enter only through dated stock records. A harvest does not automatically create preserved food.</p>
      {shownStocks.length ? <ul>{shownStocks.map(record => {
        const art = preservedFoodArtUrl(record) ?? pdfIconUrl(record.sourceIconKey);
        return <li key={record.id}>{art && <img src={art} alt="" width={30} height={30} />}<div><strong>{methodNames[record.method]} · {record.label}</strong><span>{record.dates.map(date => `${MONTHS_SHORT[date.month - 1]} ${date.year}`).join(', ')}{record.provenance === 'fictional-example' ? ' · made-up stock record' : ' · farm stock record'}</span><small>{record.note}</small></div></li>;
      })}</ul> : <p>{preservedProducts?.length ? 'None of the kept-food records match the selected graph options.' : 'No kept-food records are supplied. Their availability is unknown. This graph uses only the marked harvest and sourced crop-storage windows.'}</p>}
    </details>
    {kg && <article className={styles.card} aria-labelledby={`${id}-kg`}>
      <h3 id={`${id}-kg`}>Production in kilograms</h3>
      <div className={styles.viewButtons} aria-label="Kilogram graph view">{([['cycles', 'Crop-cycle estimates'], ['records', 'Monthly production'], ['stock', 'Food in store']] as const).map(([mode, label]) => <button key={mode} type="button" aria-pressed={kgMode === mode} onClick={() => setKgMode(mode)}>{label}</button>)}</div>
      <p>{kgMode === 'cycles' ? 'Whole crop-cycle benchmarks, grouped by the month picking starts. A bar is the full cycle, not kilograms harvested in that month.' : kgMode === 'records' ? 'Expected and actual monthly quantities you enter. An actual record replaces the expectation for that food and month. Missing weights stay unknown.' : 'Weights recorded as present in each month. Stored, dried, frozen, fermented and processed foods are stocks; they are not a second harvest.'}</p>
      <div className={styles.scroll} tabIndex={0} role="region" aria-label="Production weight graph; scroll sideways on a phone"><svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={`${kgMode === 'cycles' ? 'Whole crop-cycle' : kgMode === 'stock' ? 'Recorded stock' : 'Entered monthly production'} kilograms by month`}>
        {(() => {
          const values = kg.months.map(month => kgMode === 'cycles' ? month.cropCycleKgStartingHarvest : kgMode === 'stock' ? month.stockKg : month.recordedKg);
          const max = Math.max(1, ...values.map(value => value ?? 0));
          return <>{[0, max / 2, max].map(value => <g key={value}><line x1={LEFT} x2={W - 12} y1={BASE - value / max * PLOT} y2={BASE - value / max * PLOT} className={styles.grid} /><text x={LEFT - 8} y={BASE - value / max * PLOT + 4} textAnchor="end" className={styles.axis}>{numberLabel(value, max < 10 ? 1 : 0)}</text></g>)}{kg.months.map((month, index) => {
            const value = values[index];
            const x = LEFT + index * step + step / 2;
            const height = (value ?? 0) / max * PLOT;
            const missing = kgMode === 'cycles' ? month.cropCycleMissingSources : kgMode === 'stock' ? month.stockKgMissingSources : month.recordedKgMissingSources;
            const noCycle = kgMode === 'cycles' && month.cropCycles.length === 0;
            const label = `${MONTHS_SHORT[month.month - 1]} ${month.year}: ${noCycle ? 'no new crop cycle starts picking' : value === null ? 'quantity unknown' : numberLabel(value, 1) + ' kg'}${missing.length ? '; incomplete, missing ' + missing.map(source => source.label).join(', ') : ''}`;
            const actualHeight = value === null ? 0 : (month.actualKg ?? 0) / max * PLOT;
            const expectedHeight = value === null ? 0 : (month.expectedKg ?? 0) / max * PLOT;
            return <g key={`${month.year}-${month.month}`}><title>{label}</title>{kgMode === 'records' ? <><rect x={x - 14} y={BASE - actualHeight} width={28} height={actualHeight} rx={3} className={styles.fresh} /><rect x={x - 14} y={BASE - actualHeight - expectedHeight} width={28} height={expectedHeight} rx={3} className={styles.kept} /></> : <rect x={x - 14} y={BASE - height} width={28} height={height} rx={3} className={kgMode === 'stock' ? styles.preserved : styles.fresh} />}<text x={x} y={BASE - height - 8} textAnchor="middle" className={styles.value}>{noCycle ? '–' : value === null ? '?' : `${numberLabel(value, 1)}${missing.length ? '*' : ''}`}</text><text x={x} y={BASE + 20} textAnchor="middle" className={styles.axis}>{MONTHS_SHORT[month.month - 1]}</text><text x={x} y={BASE + 35} textAnchor="middle" className={styles.year}>{month.year}</text></g>;
          })}</>;
        })()}
      </svg></div>
      {kgMode === 'records' && <div className={styles.key}><span><i className={styles.fresh} /> Actual kg</span><span><i className={styles.kept} /> Expected kg</span></div>}
      <p className={styles.note}>kg · * = known subtotal with missing weights. ? = quantity unknown. – = no new crop cycle starts picking. Litres, eggs and items retain their own units. Tree kg by age remain in the yearly projection; they are not spread across months.</p>
      <details className={styles.quantities}><summary>See weights and information still needed</summary>{kg.months.map(month => <div key={`${month.year}-${month.month}`} className={styles.quantityMonth}><strong>{MONTHS_SHORT[month.month - 1]} {month.year}</strong><span>{kgMode === 'cycles' ? month.cropCycles.map(cycle => `${cycle.label}: ${cycle.kg === null ? cycle.missingReason ?? 'kg unknown' : numberLabel(cycle.kg, 1) + ' kg for its full cycle'}`).join(' · ') || 'No new crop cycle starts picking' : kgMode === 'stock' ? month.stockRecords.map(record => `${record.label}: ${record.quantities?.find(date => date.year === month.year && date.month === month.month)?.kg ?? '?'} kg in store`).join(' · ') || 'Stock weights not entered' : month.records.map(record => `${record.label}: ${numberLabel(record.quantity)} ${record.unit} (${record.status})`).join(' · ') || 'Monthly quantities not entered'}</span>{kgMode === 'records' && month.unrecordedSources.length > 0 && <small>Still needed: {month.unrecordedSources.map(source => source.label).join(', ')}</small>}</div>)}</details>
    </article>}
    <article className={`${styles.card} ${styles.space}`} aria-labelledby={`${id}-space`}>
      <h3 id={`${id}-space`}>Crop growing space</h3>
      <p>{numberLabel(series.growingAreaM2)} m² of mapped beds and staple plots. Stored food does not keep a bed occupied.</p>
      {series.growingAreaM2 > 0 ? <div className={styles.scroll} tabIndex={0} role="region" aria-label="Growing space graph; scroll sideways on a phone">
        <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Used and free crop growing space by month">
          {[0, 50, 100].map(value => {
            const y = BASE - value / 100 * PLOT;
            return <g key={value}><line x1={LEFT} x2={W - 12} y1={y} y2={y} className={styles.grid} /><text x={LEFT - 8} y={y + 4} textAnchor="end" className={styles.axis}>{value}%</text></g>;
          })}
          {series.months.map((month, index) => {
            const x = LEFT + index * step + step / 2;
            const usedHeight = month.utilization * PLOT;
            const label = `${MONTHS_SHORT[month.month - 1]} ${month.year}: ${numberLabel(month.growingUsedM2, 0)} m² occupied, ${numberLabel(month.growingFreeM2, 0)} m² free`;
            return <g key={`${month.year}-${month.month}`}><title>{label}</title>
              <rect x={x - 14} y={TOP} width={28} height={PLOT} rx={3} className={styles.free} />
              <rect x={x - 14} y={BASE - usedHeight} width={28} height={usedHeight} rx={3} className={styles.fresh} />
              <text x={x} y={BASE - usedHeight - 8} textAnchor="middle" className={styles.value}>{Math.round(month.utilization * 100)}%</text>
              <text x={x} y={BASE + 20} textAnchor="middle" className={styles.axis}>{MONTHS_SHORT[month.month - 1]}</text>
              <text x={x} y={BASE + 35} textAnchor="middle" className={styles.year}>{month.year}</text>
            </g>;
          })}
        </svg>
      </div> : <p>Map the beds and staple plots to see their occupied and free space. No crop ground is measured here yet.</p>}
      <div className={styles.key}><span><i className={styles.fresh} /> Occupied</span><span><i className={styles.free} /> Free between crops</span></div>
      <p className={styles.note}>Crop ground only: food forest, animal areas and ponds are not measured here. The graph caps occupation at each bed’s size; it does not prove that overlapping plantings fit. Keep the plan’s space checks.</p>
    </article>
  </section>;
}
