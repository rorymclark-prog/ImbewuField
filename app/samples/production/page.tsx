'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowDown, Leaf, Wheat, Trees, Egg, Droplets, CalendarDays, Printer } from 'lucide-react';
import CropPlanExportCard from '@/components/crops/CropPlanExportCard';
import MenuButton from '@/components/MenuButton';
import { useLanguage } from '@/lib/i18n';
import { inlineText, inlineTemplate } from '@/lib/xh-inline';
import ProductionAvailabilityGraphs from '@/components/crops/ProductionAvailabilityGraphs';
import ProductArtworkGallery from '@/components/crops/ProductArtworkGallery';
import ProductionRecordsEditor from '@/components/crops/ProductionRecordsEditor';
import { buildCompleteProductionExample } from '@/lib/sample-production-plan';
import { resolveAvailability, type ResolvedAvailability } from '@/lib/crop-export-pdf';
import { pdfIconUrl } from '@/lib/pdf-icons';
import { MONTHS_SHORT } from '@/lib/crop-catalog';
import { projectedKgLabel, projectionText } from '@/lib/production-projection';
import { productionGuideText } from '@/lib/crop-export-schedule';
import { numberLabel } from '@/lib/format-figures';
import { availabilityLabelText, buildProductionAvailabilityGraphs } from '@/lib/crop-export-availability';
import type { DatedProductionRecord, PreservedFoodRecord } from '@/lib/production-records';
import { totalGrowingAreaM2 } from '@/lib/crop-plan';
import styles from './ProductionExample.module.css';

type Band = ResolvedAvailability['bands'][number];
type Entry = Band['cells'][number][number];
type Filter = 'all' | 'veg' | 'staples' | 'forest' | 'animals';

function Art({ iconKey, size = 44 }: { iconKey: string; size?: number }) {
  const url = pdfIconUrl(iconKey);
  return url ? <img src={url} alt="" width={size} height={size} className={styles.art} /> : <Leaf size={size} aria-hidden="true" />;
}

function bandRows(band: Band): Entry[] {
  const entries = [...band.cells.flat(), ...(band.planningCells?.flat() ?? []), ...(band.undated ?? [])];
  const rows = new Map<string, Entry>();
  // The inventory also lists reference-only trees; it must not erase their cultivar qualifier.
  for (const entry of entries) if (!rows.has(entry.iconKey)) rows.set(entry.iconKey, entry);
  return [...rows.values()];
}

const filterLabels: Record<Filter, string> = { all: 'Everything', veg: 'Vegetables', staples: 'Staples', forest: 'Fruit, nuts & berries', animals: 'Animal products' };
function bandVisible(key: Band['key'], filter: Filter) {
  return filter === 'all' || (filter === 'veg' && (key === 'fresh' || key === 'stored'))
    || (filter === 'staples' && (key === 'staples' || key === 'staples-stored')) || key === filter;
}

export default function CompleteProductionExamplePage() {
  const { lang } = useLanguage();
  const ui = (english: string) => inlineText(lang, english);
  const farm = useMemo(() => buildCompleteProductionExample(), []);
  const resolved = useMemo(() => resolveAvailability(farm.input, farm.now.getMonth() + 1), [farm]);
  const [productionRecords, setProductionRecords] = useState<DatedProductionRecord[] | undefined>();
  const [preservedProducts, setPreservedProducts] = useState<PreservedFoodRecord[]>(farm.preservedProducts);
  const graphInput = useMemo(() => ({ availability: resolved, dates: farm.dates,
    growingAreaM2: totalGrowingAreaM2(farm.input.beds), preservedProducts, productionRecords,
    now: farm.now, plantings: farm.input.plantings, beds: farm.input.beds, treeGroups: farm.trees, treeSeasons: farm.input.treeSeasons }), [farm, resolved, preservedProducts, productionRecords]);
  const graphs = useMemo(() => buildProductionAvailabilityGraphs(graphInput), [graphInput]);
  const recordProducts = useMemo(() => [...new Map(resolved.bands.flatMap(bandRows).map(entry => [entry.iconKey, { iconKey: entry.iconKey, label: entry.label }])).values()], [resolved]);
  const [filter, setFilter] = useState<Filter>('all');
  const [monthIndex, setMonthIndex] = useState(0);
  const [projectionIndex, setProjectionIndex] = useState(0);
  const bands = resolved.bands.filter(band => bandVisible(band.key, filter));
  const projection = farm.input.productionProjection;
  const future = projection?.years[projectionIndex];
  const selectedDate = farm.dates[monthIndex];
  const selectedMonth = `${MONTHS_SHORT[selectedDate.month - 1]} ${selectedDate.year}`;
  const animalRows = bandRows(resolved.bands.find(band => band.key === 'animals')!);
  const forestRows = bandRows(resolved.bands.find(band => band.key === 'forest')!);
  const matureCount = farm.trees.reduce((count, tree) => count + tree.existing, 0);
  const newCount = farm.trees.reduce((count, tree) => count + tree.proposed, 0);
  const vegArt = bandRows(resolved.bands.find(band => band.key === 'fresh')!).slice(0, 4);
  const stapleArt = bandRows(resolved.bands.find(band => band.key === 'staples')!).slice(0, 4);

  return <main className={styles.page}><div className={styles.wrap}>
    <nav className={styles.nav} aria-label={ui('Example navigation')}><div className={styles.navControls}><MenuButton /><Link href="/samples"><ArrowLeft size={18} /> {ui('More examples')}</Link></div><span>Imbewu<span className={styles.brandField}>Field</span></span><a href="#print" className="relative before:absolute before:-inset-y-[13px] before:inset-x-0 before:content-['']" aria-label={ui('Print this plan')}><Printer size={18} /> <span className={styles.printLabel}>{ui('Print this plan')}</span></a></nav>
    <header className={styles.hero}>
      <div><span className={styles.eyebrow}>{ui('FICTIONAL FARM · WARM KWAZULU-NATAL')}</span><h1>{ui('A whole farm.')}<br />{' '}{ui('A year of food.')}</h1><p>{ui('Vegetables and staples from the beds. Fruit, nuts and berries from the food forest. Eggs, milk, meat, honey and fish alongside them.')}</p><div className={styles.heroActions}><a className={styles.primary} href="#calendar">{ui('See the production calendar')} <ArrowDown size={18} /></a><a href="#food-graphs">{ui('Food and space graphs')} <ArrowDown size={16} /></a><span><CalendarDays size={17} /> November 2026 – October 2027</span></div></div>
      <div className={styles.heroProduce} aria-label={ui('Example foods')}><Art iconKey="crop:maize" size={94} /><Art iconKey="tree:persea-americana" size={94} /><Art iconKey="crop:swiss-chard" size={94} /><Art iconKey="animal:chicken-layer" size={94} /><Art iconKey="tree:macadamia-integrifolia" size={94} /><Art iconKey="animal:bees" size={94} /></div>
    </header>
    <p className={styles.notice}><strong>{ui('This is a made-up farm.')}</strong> {ui('Layout, plant ages, banana dates, animal production and preserved-stock months are examples. Fruit and nut reference seasons use the existing South African research. Quantities that are not known stay unknown.')}</p>
    <p className={styles.small}>{ui('This example plan runs from November 2026. Your own plan starts from the current month; the climate and saved sowings decide when food is ready.')}</p>

    <section className={styles.overview} aria-labelledby="farm-title">
      <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>{ui('THE EXAMPLE SITE')}</span><h2 id="farm-title">{ui('Everything has a place')}</h2></div><span className={styles.small}>{ui('Illustrated layout · not a measured map')}</span></div>
      <div className={styles.farmLayout}>
        <article className={`${styles.zone} ${styles.vegZone}`}><Leaf size={20} /><h3>{ui('Vegetable beds')}</h3><p>{ui('Greens, roots and fresh vegetables')}</p><div className={styles.zoneProduce}>{[...new Map(vegArt.map(entry => [entry.iconKey, entry])).values()].map(entry => <Art key={entry.iconKey} iconKey={entry.iconKey} size={58} />)}</div></article>
        <article className={`${styles.zone} ${styles.stapleZone}`}><Wheat size={20} /><h3>{ui('Staple plots')}</h3><p>{ui('Maize, beans, tubers and squash')}</p><div className={styles.zoneProduce}>{stapleArt.map(entry => <Art key={entry.iconKey} iconKey={entry.iconKey} size={58} />)}</div></article>
        <article className={`${styles.zone} ${styles.forestZone}`}><Trees size={20} /><h3>{ui('Food forest')}</h3><p>{inlineTemplate(lang, '{existing} existing plants · {planned} planned plants', null, { existing: matureCount, planned: newCount })}</p><div className={styles.zoneProduce}>{forestRows.slice(0, 5).map(entry => <Art key={entry.iconKey} iconKey={entry.iconKey} size={58} />)}</div></article>
        <article className={`${styles.zone} ${styles.animalZone}`}><Egg size={20} /><h3>{ui('Animal area')}</h3><p>{ui('Hens, dairy goats, rabbits, ducks and hives')}</p><div className={styles.zoneProduce}>{animalRows.filter(entry => entry.iconKey !== 'animal:fish-tilapia').map(entry => <Art key={entry.iconKey} iconKey={entry.iconKey} size={58} />)}</div></article>
        <article className={`${styles.zone} ${styles.waterZone}`}><Droplets size={20} /><h3>{ui('Water & fish')}</h3><p>{ui('Tilapia pond and reliable dry-season water assumed')}</p><div className={styles.zoneProduce}><Art iconKey="animal:fish-tilapia" size={74} /></div></article>
      </div>
      <div className={styles.conditions}><span>{ui('No frost assumed')}</span><span>{ui('Full sun')}</span><span>{ui('Well-drained crop ground')}</span><span>{ui('Warm KZN scenario')}</span></div>
    </section>

    <section id="calendar" className={styles.calendarSection} aria-labelledby="calendar-title">
      <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>{ui('MONTH BY MONTH')}</span><h2 id="calendar-title">{ui('What is ready, and when?')}</h2><p>{ui('Select a month to see its food and work. The printed calendar uses the same plan.')}</p></div></div>
      <div className={styles.filters} aria-label={ui('Show products')}>{(Object.keys(filterLabels) as Filter[]).map(value => <button key={value} type="button" aria-pressed={filter === value} className={filter === value ? styles.selectedFilter : ''} onClick={() => setFilter(value)}>{ui(filterLabels[value])}</button>)}</div>
      <div className={styles.legend}><span><i className={styles.freshKey} /> {ui('Harvest window')}</span><span><i className={styles.storedKey} /> {ui('From store')}</span><span><i className={styles.referenceKey} /> {ui('Regional reference')}</span><span>{ui('Banana & animal marks = fictional local records')}</span></div>
      <p className={styles.swipeHint}>{ui('Swipe the calendar sideways to see all months.')}</p>
      <div className={styles.calendarScroll} tabIndex={0} role="region" aria-label={ui('Scrollable twelve-month production calendar')}>
        <table className={styles.calendar}><caption className={styles.srOnly}>{ui('Fictional farm production calendar. Filled marks show the example plan, gold shows stored food, outlined marks show regional references.')}</caption><thead><tr><th scope="col">{ui('CROP / PRODUCT')}</th>{farm.dates.map((date, index) => <th key={`${date.year}-${date.month}`} scope="col" className={monthIndex === index ? styles.selectedMonth : ''}><button type="button" aria-pressed={monthIndex === index} aria-label={inlineTemplate(lang, 'Show {month}', null, { month: `${MONTHS_SHORT[date.month - 1]} ${date.year}` })} onClick={() => setMonthIndex(index)}>{MONTHS_SHORT[date.month - 1]}<small>{date.year}</small></button></th>)}</tr></thead>
          {bands.map(band => <tbody key={band.key}><tr className={styles.bandHeading}><th colSpan={13} scope="colgroup">{band.title}<span>{band.key === 'forest' ? ui('Regional references plus example banana records') : band.key === 'animals' ? ui('Fictional local production records') : band.sub}</span></th></tr>{bandRows(band).map(entry => {
            const marks = farm.months.map((_, index) => band.cells[index]?.some(cell => cell.iconKey === entry.iconKey) ? 'local' : band.planningCells?.[index]?.some(cell => cell.iconKey === entry.iconKey) ? 'reference' : '');
            return <tr key={entry.iconKey}>
              <th scope="row"><div className={styles.productLabel}><Art iconKey={entry.iconKey} size={37} /><div>{availabilityLabelText(lang, entry.label)}<small>{entry.ageNote ? projectionText(lang, entry.ageNote) : (entry.planning ? entry.planning.label : band.key === 'animals' ? ui('Example months · quantity unknown') : entry.iconKey === 'tree:musa-acuminata-aaa-group' ? ui('3 plants per banana circle') : '')}</small></div></div></th>
              {marks.map((mark, index) => <td key={index} className={monthIndex === index ? styles.selectedCell : ''}>
                {mark ? <span className={`${styles.mark} ${mark === 'reference' ? styles.referenceMark : band.key.includes('stored') ? styles.storedMark : styles.harvestMark} ${marks[index - 1] !== mark ? styles.startMark : ''} ${marks[index + 1] !== mark ? styles.endMark : ''}`} title={`${availabilityLabelText(lang, entry.label)}: ${MONTHS_SHORT[farm.months[index] - 1]} ${mark === 'reference' ? ui('regional reference') : ui('example plan')}`}>
                  <span className={styles.srOnly}>{mark === 'reference' ? ui('Regional reference') : band.key.includes('stored') ? ui('Stored food') : ui('Example harvest / production')}</span>
                  <Art iconKey={entry.iconKey} size={27} />
                </span> : <span className={styles.emptyCell} aria-label={ui('No production window marked')}>·</span>}
              </td>)}
            </tr>;
          })}</tbody>)}
          <tfoot><tr><th scope="row">{ui('Growing space used')}</th>{resolved.utilization.map((value, index) => <td key={index}><span>{Math.round(value * 100)}%</span><meter min={0} max={1} value={value} aria-label={inlineTemplate(lang, '{month} growing space used', null, { month: MONTHS_SHORT[farm.months[index] - 1] })} /></td>)}</tr></tfoot>
        </table>
      </div>
      <section className={styles.monthDetail} aria-labelledby="selected-month-title"><div className={styles.monthTitle}><CalendarDays size={25} /><h3 id="selected-month-title">{selectedMonth}</h3></div><div className={styles.monthGrid}>{resolved.bands.filter(band => band.cells[monthIndex]?.length || band.planningCells?.[monthIndex]?.length).map(band => <div key={band.key}><h4>{band.title}</h4><div className={styles.monthProducts}>{[...new Map([...(band.cells[monthIndex] ?? []), ...(band.planningCells?.[monthIndex] ?? [])].map(entry => [entry.iconKey, entry])).values()].map(entry => <div key={entry.iconKey} className={styles.monthProduct}><Art iconKey={entry.iconKey} size={34} /><span>{availabilityLabelText(lang, entry.label)}{entry.planning && <small>{ui('Reference — confirm locally')}</small>}</span></div>)}</div></div>)}</div><details className={styles.monthJobs}><summary>{ui('Vegetable and staple jobs this month')}</summary>{farm.input.tasks.filter(task => task.month === selectedDate.month).map(task => <p key={task.id}>{task.bedLabel}: {task.cropName} · {task.action.replaceAll('-', ' ')}</p>)}</details></section>
    </section>

    <div id="food-graphs" className={styles.futureSection}><ProductionAvailabilityGraphs series={graphs} input={graphInput} preservedProducts={preservedProducts} selectedMonthIndex={monthIndex} onMonthSelect={setMonthIndex} /><p className={styles.small}>{ui('Try your own figures below. They change this fictional example only and reset when you refresh.')}</p><ProductionRecordsEditor products={recordProducts} dates={farm.dates} productionRecords={productionRecords} preservedProducts={preservedProducts} onProductionRecordsChange={records => setProductionRecords(records.map(record => ({ ...record, provenance: 'fictional-example' })))} onPreservedProductsChange={records => setPreservedProducts(records.map(record => ({ ...record, provenance: 'fictional-example' })))} /></div>

    <section className={styles.futureSection} aria-labelledby="future-title"><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>{ui('AS THE FARM GROWS')}</span><h2 id="future-title">{ui('Young plants need time')}</h2><p>{ui('The example includes established plants and new plantings. Age changes the expected stage; it does not tell us their kilograms.')}</p></div></div>{projection && <><label className={styles.yearSelect}>{ui('Look ahead')} <select aria-label={ui('Projection year')} value={projectionIndex} onChange={event => setProjectionIndex(Number(event.target.value))}>{projection.years.map((year, index) => <option key={year.label} value={index}>{year.label}</option>)}</select></label>{future && <><div className={styles.benchmark}><Wheat size={23} /><div><strong>{future.vegetableKg === null ? ui('Vegetable benchmark needs checking') : inlineTemplate(lang, future.vegetableMissing.length ? '{kg} kg known annual crop subtotal' : '{kg} kg annual crop benchmark', null, { kg: numberLabel(future.vegetableKg, 0) })}</strong><p>{ui('Vegetables and staples only. Based on the beds and sourced crop-cycle figures; it is not a monthly harvest promise. Fruit, nuts and animal quantities are not added as guessed kilograms.')}</p>{future.vegetableMissing.length > 0 && <p><strong>{ui('Not included:')}</strong> {inlineTemplate(lang, '{items} — yield not sourced or not calculable.', null, { items: future.vegetableMissing.map(item => projectionText(lang, item)).join(', ') })}</p>}</div></div><div className={styles.ageGrid}>{future.trees.map(tree => {
      const group = farm.trees.find(item => item.harvest.speciesId === tree.speciesId);
      return <article key={tree.speciesId} className={styles.ageCard}><Art iconKey={`tree:${tree.speciesId}`} size={51} /><div><h3>{tree.name}</h3><p>{inlineTemplate(lang, '{existing} existing · {planned} planned plants', null, { existing: group?.existing ?? '', planned: group?.proposed ?? '' })}<br />{projectionText(lang, tree.ages)}</p><strong>{projectionText(lang, tree.stage)}</strong><small>{projectedKgLabel(tree.kg)}</small></div></article>;
    })}</div></>}</>}</section>

    <section className={styles.referenceSection} aria-labelledby="checks-title"><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>{ui('BEFORE PLANTING OR BUYING')}</span><h2 id="checks-title">{ui('Check the details for your own farm')}</h2><p>{ui('This warm KZN example does not transfer unchanged to a cold, dry or winter-rainfall site.')}</p></div></div><div className={styles.guideGrid}>{[...(farm.input.productionGuide?.foodForest ?? []).map(guide => ({ guide, named: true })), ...(farm.input.productionGuide?.animalProducts ?? []).map(guide => ({ guide, named: false }))].map(({ guide, named }, index) => <details key={`${guide.title}:${index}`} className={styles.guide}><summary>{named ? guide.title : productionGuideText(lang, guide.title)}</summary>{guide.lines.map((line, index) => <p key={index}>{productionGuideText(lang, line)}</p>)}{guide.sources?.map(source => source.url ? <a key={`${source.url}:${source.label}`} href={source.url} target="_blank" rel="noreferrer" className="relative before:absolute before:-inset-y-[13px] before:inset-x-0 before:content-['']">{source.label} ↗</a> : <span key={source.label}>{source.label}</span>)}</details>)}</div></section>

    <section id="print" className={styles.printSection} aria-labelledby="print-title"><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>{ui('TAKE IT TO THE FARM')}</span><h2 id="print-title">{ui('The same plan on paper')}</h2><p>{ui('Download the concise booklet, or choose A2 under Calendar & jobs for a wall print. The detailed reference includes the planting guidance and sources.')}</p></div></div><CropPlanExportCard {...farm.input} productionRecords={productionRecords} preservedProducts={preservedProducts} sections={['calendar', 'availability', 'availabilityGraphs', 'projection', 'taskSummary']} availabilityDetails={false} /></section>
    <ProductArtworkGallery />
    <footer className={styles.footer}>{ui('ImbewuField · Complete production example · Fictional site and records')}</footer>
  </div></main>;
}
