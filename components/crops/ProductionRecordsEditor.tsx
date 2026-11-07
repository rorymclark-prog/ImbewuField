'use client';

import { useId, useRef, useState, type FormEvent } from 'react';
import { Package } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { inlineText, inlineTemplate } from '@/lib/xh-inline';
import { MONTHS_SHORT } from '@/lib/crop-catalog';
import { numberLabel } from '@/lib/format-figures';
import { pdfIconUrl } from '@/lib/pdf-icons';
import { preservedFoodArtUrl } from '@/lib/preserved-food-art';
import { availabilityLabelText, isVisibleProductionFoodSource } from '@/lib/crop-export-availability';
import {
  isProductionDate, sanitiseProductionRecords, sanitisePreservedFoodRecords,
  type DatedProductionRecord, type PreservedFoodMethod, type PreservedFoodRecord,
  type ProductionDate, type ProductionUnit,
} from '@/lib/production-records';
import styles from './ProductionRecordsEditor.module.css';

export interface ProductionRecordsEditorProps {
  products: { iconKey: string; label: string }[];
  dates: ProductionDate[];
  productionRecords?: DatedProductionRecord[];
  preservedProducts?: PreservedFoodRecord[];
  onProductionRecordsChange: (records: DatedProductionRecord[]) => void;
  onPreservedProductsChange: (records: PreservedFoodRecord[]) => void;
}

const unitNames: Record<ProductionUnit, string> = { kg: 'kg', litres: 'litres', eggs: 'eggs', items: 'items' };
const methodNames: Record<PreservedFoodMethod, string> = {
  stored: 'In store', frozen: 'Frozen', dried: 'Dried', fermented: 'Fermented', processed: 'Other processing',
};
const dateKey = (date: ProductionDate) => `${date.year}-${String(date.month).padStart(2, '0')}`;
const dateLabel = (date: ProductionDate) => `${MONTHS_SHORT[date.month - 1]} ${date.year}`;
const optionalNumber = (value: string) => value.trim() === '' ? undefined : Number(value);
const validNumber = (value: number | undefined): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const newId = (kind: string) => `${kind}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
const distinctDates = (dates: ProductionDate[]) => [...new Map(dates.filter(isProductionDate)
  .map(date => [dateKey(date), { year: date.year, month: date.month }])).values()]
  .sort((a, b) => a.year - b.year || a.month - b.month);

function RecordArt({ src }: { src: string | null }) {
  return src ? <img src={src} alt="" width={36} height={36} className={styles.art} />
    : <Package size={28} aria-hidden className={styles.art} />;
}

/** Parent callbacks own saving and undo. A quantity exists only after an explicit entry,
 * and a stock observation never turns into an automatically repeated harvest or expiry. */
export function ProductionRecordsEditor({ products, dates, productionRecords = [], preservedProducts = [],
  onProductionRecordsChange, onPreservedProductsChange }: ProductionRecordsEditorProps) {
  const id = useId();
  const { lang } = useLanguage();
  const ui = (english: string) => inlineText(lang, english);
  const productionRef = useRef<HTMLDetailsElement>(null);
  const stockRef = useRef<HTMLDetailsElement>(null);
  const records = sanitiseProductionRecords(productionRecords);
  const stockRecords = sanitisePreservedFoodRecords(preservedProducts);
  // A newly verified food-use hold must not erase older farmer records or invite new food entries.
  const eligibleProducts = products.filter(product => isVisibleProductionFoodSource(product.iconKey, {}));
  const [productionOpen, setProductionOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [productKey, setProductKey] = useState('');
  const [monthKey, setMonthKey] = useState('');
  const [status, setStatus] = useState<DatedProductionRecord['status']>('expected');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<ProductionUnit | ''>('');
  const [price, setPrice] = useState('');
  const [note, setNote] = useState('');
  const [editingProductionId, setEditingProductionId] = useState<string | null>(null);
  const [productionError, setProductionError] = useState('');
  const [stockProductKey, setStockProductKey] = useState('');
  const [stockLabel, setStockLabel] = useState('');
  const [stockMethod, setStockMethod] = useState<PreservedFoodMethod>('stored');
  const [stockMonths, setStockMonths] = useState<string[]>([]);
  const [stockKg, setStockKg] = useState<Record<string, string>>({});
  const [stockNote, setStockNote] = useState('');
  const [editingStockId, setEditingStockId] = useState<string | null>(null);
  const [stockError, setStockError] = useState('');
  const editedProduction = records.find(record => record.id === editingProductionId);
  const editedStock = stockRecords.find(record => record.id === editingStockId);
  // Editing an older record must retain dates outside the currently displayed year.
  const productionDates = distinctDates([...dates, ...(editedProduction ? [editedProduction.date] : [])]);
  const stockDates = distinctDates([...dates, ...(editedStock?.dates ?? [])]);
  const canRecord = eligibleProducts.length > 0 && distinctDates(dates).length > 0;

  function submitProduction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const product = eligibleProducts.find(option => option.iconKey === productKey);
    const date = productionDates.find(option => dateKey(option) === monthKey);
    const amount = optionalNumber(quantity), ownPrice = optionalNumber(price);
    if (!product || !date || !unit) { setProductionError(ui('Choose the product, month and unit.')); return; }
    if (!validNumber(amount)) { setProductionError(ui('Enter the amount. Use 0 only when you mean zero; leave unknown production unrecorded.')); return; }
    if (ownPrice !== undefined && !validNumber(ownPrice)) { setProductionError(ui('Enter a price of zero or more, or leave it blank.')); return; }
    const matching = records.find(record => record.sourceIconKey === productKey && dateKey(record.date) === monthKey && record.status === status);
    const candidate: DatedProductionRecord = {
      id: editingProductionId ?? matching?.id ?? newId('production'), label: product.label,
      sourceIconKey: productKey, date, quantity: amount, unit, status,
      provenance: editedProduction?.provenance ?? 'farm-record',
      ...(ownPrice === undefined ? {} : { pricePerUnit: ownPrice }), ...(note.trim() ? { note: note.trim() } : {}),
    };
    const next = sanitiseProductionRecords([...records, candidate]);
    if (!next.some(record => record.id === candidate.id)) { setProductionError(ui('Check the product, date and amount before adding this record.')); return; }
    onProductionRecordsChange(next);
    setProductionError(''); setEditingProductionId(null); setQuantity(''); setPrice(''); setNote('');
  }

  function submitStock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!eligibleProducts.some(product => product.iconKey === stockProductKey)) { setStockError(ui('Choose the original food from this plan.')); return; }
    if (!stockLabel.trim()) { setStockError(ui('Name the food you are keeping, for example Dried mango.')); return; }
    const selectedDates = stockDates.filter(date => stockMonths.includes(dateKey(date)));
    if (!selectedDates.length) { setStockError(ui('Choose at least one month when this food is in store.')); return; }
    const quantities: NonNullable<PreservedFoodRecord['quantities']> = [];
    for (const date of selectedDates) {
      const amount = optionalNumber(stockKg[dateKey(date)] ?? '');
      if (amount === undefined) continue;
      if (!validNumber(amount)) { setStockError(inlineTemplate(lang, '{date}: enter kg of zero or more, or leave the amount blank.', null, { date: dateLabel(date) })); return; }
      quantities.push({ ...date, kg: amount });
    }
    const candidate: PreservedFoodRecord = {
      id: editingStockId ?? newId('stock'), label: stockLabel.trim(), sourceIconKey: stockProductKey,
      method: stockMethod, dates: selectedDates, provenance: editedStock?.provenance ?? 'farm-record', note: stockNote.trim(),
      ...(quantities.length ? { quantities } : {}),
    };
    const next = sanitisePreservedFoodRecords([...stockRecords, candidate]);
    if (!next.some(record => record.id === candidate.id)) { setStockError(ui('Check the food and its stock months before adding this record.')); return; }
    onPreservedProductsChange(next);
    setStockError(''); setEditingStockId(null); setStockLabel(''); setStockMonths([]); setStockKg({}); setStockNote('');
  }

  function editProduction(record: DatedProductionRecord) {
    setEditingProductionId(record.id); setProductKey(record.sourceIconKey); setMonthKey(dateKey(record.date));
    setStatus(record.status); setQuantity(String(record.quantity)); setUnit(record.unit);
    setPrice(record.pricePerUnit === undefined ? '' : String(record.pricePerUnit)); setNote(record.note ?? '');
    setProductionError(''); setProductionOpen(true); productionRef.current?.scrollIntoView({ block: 'nearest' });
  }

  function editStock(record: PreservedFoodRecord) {
    setEditingStockId(record.id); setStockProductKey(record.sourceIconKey); setStockLabel(record.label);
    setStockMethod(record.method); setStockMonths(record.dates.map(dateKey));
    setStockKg(Object.fromEntries((record.quantities ?? []).map(amount => [dateKey(amount), String(amount.kg)])));
    setStockNote(record.note); setStockError(''); setStockOpen(true); stockRef.current?.scrollIntoView({ block: 'nearest' });
  }

  return <section className={styles.editor} aria-label={ui('Production and food stock records')} data-production-records-editor>
    <p className={styles.intro}>{ui('Use your own records or a locally checked estimate. Missing amounts stay unknown. Eggs, litres and kg are kept separate.')}</p>
    {!canRecord && <p className={styles.empty}>{ui('Add products to the plan to record their production and food in store.')}</p>}
    <details ref={productionRef} open={productionOpen} onToggle={event => setProductionOpen(event.currentTarget.open)} className={styles.section}>
      <summary>{ui('Record expected or actual production')} <span>{inlineTemplate(lang, records.length === 1 ? '{n} record' : '{n} records', null, { n: records.length })}</span></summary>
      <div className={styles.body}>
        <p className={styles.help}>{ui('Choose one product and one month. Expected means your estimate; actual means what was produced. Adding the same product, month and status replaces its previous figure.')}</p>
        <form onSubmit={submitProduction} noValidate className={styles.form}>
          <div className={styles.fields}>
            <label>{ui('Product')}<select value={productKey} onChange={event => setProductKey(event.target.value)} disabled={!canRecord}><option value="">{ui('Choose product')}</option>{eligibleProducts.map(product => <option key={product.iconKey} value={product.iconKey}>{availabilityLabelText(lang, product.label)}</option>)}</select></label>
            <label>{ui('Month')}<select value={monthKey} onChange={event => setMonthKey(event.target.value)} disabled={!canRecord}><option value="">{ui('Choose month')}</option>{productionDates.map(date => <option key={dateKey(date)} value={dateKey(date)}>{dateLabel(date)}</option>)}</select></label>
            <label>{ui('Which figure?')}<select value={status} onChange={event => setStatus(event.target.value as DatedProductionRecord['status'])}><option value="expected">{ui('Expected — my estimate')}</option><option value="actual">{ui('Actual — produced')}</option></select></label>
            <label>{ui('Amount')}<input type="number" min={0} step="any" inputMode="decimal" value={quantity} onChange={event => setQuantity(event.target.value)} placeholder={ui('Enter amount')} /></label>
            <label>{ui('Unit')}<select value={unit} onChange={event => setUnit(event.target.value as ProductionUnit)}><option value="">{ui('Choose unit')}</option>{Object.entries(unitNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <label>{ui('My price per unit (R)')}<span className={styles.optional}>{ui('Optional · your own price')}</span><input type="number" min={0} step="any" inputMode="decimal" value={price} onChange={event => setPrice(event.target.value)} placeholder={ui('Leave blank if unknown')} /></label>
          </div>
          <label>{ui('Note')} <span className={styles.optional}>{ui('Optional')}</span><textarea maxLength={2000} rows={2} value={note} onChange={event => setNote(event.target.value)} placeholder={ui('Where did this figure come from?')} /></label>
          <p className={styles.help}>{ui('This price is your record, not a live market price or a profit calculation.')}</p>
          {productionError && <p className={styles.error} role="alert">{productionError}</p>}
          <div className={styles.actions}><button type="submit" disabled={!canRecord} className={styles.primary}>{editingProductionId ? ui('Update production record') : ui('Add production record')}</button>{editingProductionId && <button type="button" onClick={() => { setEditingProductionId(null); setQuantity(''); setPrice(''); setNote(''); setProductionError(''); }}>{ui('Cancel edit')}</button>}</div>
        </form>
        {records.length ? <ul className={styles.list}>{records.map(record => {
          const ownValue = record.pricePerUnit === undefined ? undefined : record.quantity * record.pricePerUnit;
          return <li key={record.id}>
          <RecordArt src={pdfIconUrl(record.sourceIconKey)} />
          <div className={styles.recordText}><strong>{availabilityLabelText(lang, record.label)}</strong><span>{dateLabel(record.date)} · {record.status === 'expected' ? ui('Expected') : ui('Actual')} · {numberLabel(record.quantity)} {unitNames[record.unit]}</span>
            {!isVisibleProductionFoodSource(record.sourceIconKey, {}) && <small>{ui('Saved record kept for reference. This source is excluded from household food and production totals. Check its food-use guidance.')}</small>}
            {record.pricePerUnit !== undefined && <span>{inlineTemplate(lang, 'Own price: R{price} / {unit}', null, { price: numberLabel(record.pricePerUnit), unit: unitNames[record.unit] })}</span>}
            {ownValue !== undefined && <span>{Number.isFinite(ownValue)
              ? inlineTemplate(lang, 'Quantity × own price: R{value} before costs', null, { value: numberLabel(ownValue, Math.abs(ownValue) > Number.MAX_VALUE / 100 ? 0 : 2) })
              : ui('Quantity × own price needs checking.')}</span>}
            {record.provenance === 'fictional-example' && <small>{ui('Made-up example record')}</small>}{record.note && <small>{ui(record.note)}</small>}
          </div>
          <div className={styles.recordActions}>{eligibleProducts.some(product => product.iconKey === record.sourceIconKey) && <button type="button" onClick={() => editProduction(record)} aria-label={inlineTemplate(lang, 'Edit {label} {date} {status}', null, { label: availabilityLabelText(lang, record.label), date: dateLabel(record.date), status: record.status === 'expected' ? ui('expected') : ui('actual') })}>{ui('Edit')}</button>}<button type="button" onClick={() => onProductionRecordsChange(records.filter(row => row.id !== record.id))} aria-label={inlineTemplate(lang, 'Remove {label} {date} {status}', null, { label: availabilityLabelText(lang, record.label), date: dateLabel(record.date), status: record.status === 'expected' ? ui('expected') : ui('actual') })}>{ui('Remove')}</button></div>
        </li>; })}</ul> : <p className={styles.empty}>{ui('No monthly production amounts recorded. Unknown does not mean zero.')}</p>}
      </div>
    </details>
    <details ref={stockRef} open={stockOpen} onToggle={event => setStockOpen(event.currentTarget.open)} className={styles.section}>
      <summary>{ui('Record food kept in store')} <span>{inlineTemplate(lang, stockRecords.length === 1 ? '{n} record' : '{n} records', null, { n: stockRecords.length })}</span></summary>
      <div className={styles.body}>
        <p className={styles.help}>{ui('Record food you have kept, bought or carried from an earlier harvest. Choose its months yourself. The plan does not work out a safe shelf life or a preservation recipe.')}</p>
        <form onSubmit={submitStock} noValidate className={styles.form}>
          <div className={styles.fields}>
            <label>{ui('Original food')}<select value={stockProductKey} onChange={event => setStockProductKey(event.target.value)} disabled={!canRecord}><option value="">{ui('Choose product')}</option>{eligibleProducts.map(product => <option key={product.iconKey} value={product.iconKey}>{availabilityLabelText(lang, product.label)}</option>)}</select></label>
            <label>{ui('Name of food in store')}<input maxLength={200} value={stockLabel} onChange={event => setStockLabel(event.target.value)} placeholder={ui('e.g. Dried mango')} /></label>
            <label>{ui('How is it kept?')}<select value={stockMethod} onChange={event => setStockMethod(event.target.value as PreservedFoodMethod)}>{Object.entries(methodNames).map(([key, label]) => <option key={key} value={key}>{ui(label)}</option>)}</select></label>
          </div>
          <fieldset className={styles.months}><legend>{ui('Months with food in store')}</legend><p className={styles.help} id={`${id}-stock-help`}>{ui('Tick each month. Add kg held in that month only if you know it. Blank kg stays unknown; nothing carries forward automatically.')}</p>
            <div className={styles.monthGrid}>{stockDates.map(date => {
              const key = dateKey(date), selected = stockMonths.includes(key);
              return <div key={key} className={`${styles.month} ${selected ? styles.selectedMonth : ''}`}>
                <label className={styles.check}><input type="checkbox" checked={selected} onChange={event => setStockMonths(current => event.target.checked ? [...new Set([...current, key])] : current.filter(month => month !== key))} aria-describedby={`${id}-stock-help`} /><span>{dateLabel(date)}</span></label>
                {selected && <label className={styles.monthAmount}>{ui('kg held · optional')}<input type="number" min={0} step="any" inputMode="decimal" aria-label={inlineTemplate(lang, '{date} stock kg, optional', null, { date: dateLabel(date) })} value={stockKg[key] ?? ''} onChange={event => setStockKg(current => ({ ...current, [key]: event.target.value }))} placeholder={ui('Unknown')} /></label>}
              </div>;
            })}</div>
          </fieldset>
          <label>{ui('Stock note')} <span className={styles.optional}>{ui('Optional')}</span><textarea maxLength={2000} rows={2} value={stockNote} onChange={event => setStockNote(event.target.value)} placeholder={ui('Bought, carried stock, or kept from which harvest?')} /></label>
          {stockError && <p className={styles.error} role="alert">{stockError}</p>}
          <div className={styles.actions}><button type="submit" disabled={!canRecord} className={styles.primary}>{editingStockId ? ui('Update stock record') : ui('Add stock record')}</button>{editingStockId && <button type="button" onClick={() => { setEditingStockId(null); setStockLabel(''); setStockMonths([]); setStockKg({}); setStockNote(''); setStockError(''); }}>{ui('Cancel edit')}</button>}</div>
        </form>
        {stockRecords.length ? <ul className={styles.list}>{stockRecords.map(record => <li key={record.id}>
          <RecordArt src={preservedFoodArtUrl(record) ?? pdfIconUrl(record.sourceIconKey)} />
          <div className={styles.recordText}><strong>{availabilityLabelText(lang, record.label)}</strong><span>{ui(methodNames[record.method])} · {record.provenance === 'fictional-example' ? ui('Made-up example stock') : ui('Farm stock record')}</span>
            {!isVisibleProductionFoodSource(record.sourceIconKey, {}) && <small>{ui('Saved stock record kept for reference. This source is excluded from household food and stock totals. Check its food-use guidance.')}</small>}
            {record.dates.map(date => { const amount = record.quantities?.find(quantity => dateKey(quantity) === dateKey(date)); return <span key={dateKey(date)}>{dateLabel(date)} · {amount ? inlineTemplate(lang, '{kg} kg held', null, { kg: numberLabel(amount.kg) }) : ui('kg unknown')}</span>; })}
            {record.note && <small>{ui(record.note)}</small>}
          </div>
          <div className={styles.recordActions}>{eligibleProducts.some(product => product.iconKey === record.sourceIconKey) && <button type="button" onClick={() => editStock(record)} aria-label={inlineTemplate(lang, 'Edit {label} stock', null, { label: availabilityLabelText(lang, record.label) })}>{ui('Edit')}</button>}<button type="button" onClick={() => onPreservedProductsChange(stockRecords.filter(row => row.id !== record.id))} aria-label={inlineTemplate(lang, 'Remove {label} stock', null, { label: availabilityLabelText(lang, record.label) })}>{ui('Remove')}</button></div>
        </li>)}</ul> : <p className={styles.empty}>{ui('No kept-food records yet. A harvest does not automatically create stored or processed food.')}</p>}
      </div>
    </details>
  </section>;
}

export default ProductionRecordsEditor;
