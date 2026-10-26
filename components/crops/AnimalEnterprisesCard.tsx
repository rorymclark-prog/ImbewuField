'use client';

// "Animals on your map" — what the coops, pens, hutches and hives on the Studio design give, and
// what they need, from the sourced animal table (lib/animal-enterprises.ts).
//
// Two things this card will not do, and says so. It does not multiply a per-hen figure by the
// number of coops (a coop is housing, not a head count), and it does not decide what a coop is
// for: layers, broilers and village chickens share a coop and nothing else, so the farmer picks.
// Every figure opens onto the sentence it came from; a figure no source states reads "not sourced".

import type { LucideIcon } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { productGuideText } from '@/lib/production-product-guidance';
import { isCropExportDraftLanguage } from '@/lib/crop-export-copy';
import { recordsMonthLong, recordsMonthShort } from '@/lib/records-months';
import { reportDocumentText } from '@/lib/report-localisation';
import { PawPrint, Egg, Milk, Hexagon, Drumstick, Fish, Scissors, Scale, ShieldCheck, HeartHandshake, ExternalLink } from 'lucide-react';
import {
  ANIMAL_ENTERPRISES, HOUSING_LABEL,
  PRODUCT_LABEL,
  enterprisesForHousing,
  formatAmountRange,
  animalReferenceQualifier,
  isFoodProduct,
  sourcedProductMonths,
  type AnimalEnterprise,
  type AnimalProduct,
  type HousingKind,
  type PlacedAnimalGroup,
  type AnimalSeasonChoices,
  type AnimalRangeField,
} from '@/lib/animal-enterprises';
import { MONTHS_SHORT } from '@/lib/crop-catalog';
import { animalArtUrl } from '@/lib/animal-art';
import { formatMonthSpan, formatRange, type HarvestCitation, type SourcedRange } from '@/lib/perennial-harvest';

export const PRODUCT_ICON: Readonly<Record<AnimalProduct, LucideIcon>> = {
  eggs: Egg,
  milk: Milk,
  honey: Hexagon,
  meat: Drumstick,
  fish: Fish,
  wool: Scissors,
};

const STRUCTURE_NOUN: Readonly<Record<HousingKind, [string, string]>> = {
  chicken: ['coop or tractor', 'coops and tractors'],
  goat: ['goat pen', 'goat pens'],
  bee: ['hive', 'hives'],
  rabbit: ['hutch', 'hutches'],
  duck: ['duck pond', 'duck ponds'],
  pig: ['pig pen', 'pig pens'],
  kraal: ['kraal', 'kraals'],
  pond: ['small pond', 'small ponds'],
};

/** The question each structure asks: a pond is often just water, so it asks whether, not what. */
const PURPOSE_QUESTION: Readonly<Partial<Record<HousingKind, string>>> = {
  kraal: 'What is the kraal for?',
  pond: 'Keeping fish in it?',
};

/** Weeks as a farmer says them: "18–20 weeks" up to half a year, months after that. */
export function formatWeeks([min, max]: [number, number], language = 'en'): string {
  if (max <= 26) return productGuideText('{range} weeks', language, { range: formatAmountRange([min, max]) });
  const months = (w: number) => Math.round(w / 4.35);
  return productGuideText('about {range} months', language, { range: formatRange([months(min), months(max)]) });
}

function SourceLink({ source, short = false }: { source: HarvestCitation; short?: boolean }) {
  const { lang } = useLanguage();
  const citation = `${source.doc}${source.page ? `, p. ${source.page}` : ''}`;
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      title={short ? `${citation}: ${source.quote}` : source.quote}
      aria-label={short ? productGuideText('Read source: {citation}', lang, { citation }) : undefined}
      className="inline-flex items-center gap-0.5"
      style={{ color: 'var(--blue)', fontSize: 11, textDecoration: 'underline', textUnderlineOffset: 2 }}
    >
      {short ? productGuideText('Read source', lang) : citation}
      <ExternalLink size={10} aria-hidden />
    </a>
  );
}

function OriginalReferenceNote({ source, translated, language }: { source?: string; translated?: string; language: string }) {
  if (!source || !isCropExportDraftLanguage(language) || translated === source) return null;
  return <details data-original-animal-reference="true" className="mt-1" style={{ fontSize: 11.5 }}>
    <summary style={{ cursor: 'pointer', minHeight: 44, padding: '10px 0', boxSizing: 'border-box' }}>{productGuideText('Original source note: {note}', language, { note: '' }).trim()}</summary>
    <p lang="en" className="mt-1" style={{ overflowWrap: 'anywhere' }}>{source}</p>
  </details>;
}

function Fact({ label, value, source, qualifier, note, originalNote }: { label: string; value: string | null; source?: HarvestCitation; qualifier?: string; note?: string; originalNote?: string }) {
  const { lang } = useLanguage();
  return (
    <div style={{ minWidth: 0 }}>
      <div className="font-sans uppercase" style={{ fontSize: 9.5, letterSpacing: '0.08em', color: 'var(--text-muted)' }}>{label}</div>
      <div className="font-display" style={{ fontSize: 'clamp(14px, 1.1vw, 16px)', color: value ? 'var(--text-primary)' : 'var(--text-muted)', lineHeight: 1.3, overflowWrap: isCropExportDraftLanguage(lang) ? 'anywhere' : undefined }}>
        {value ?? productGuideText('Not sourced', lang)}
      </div>
      {value && qualifier && <p className="font-sans mt-1" style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>{qualifier}</p>}
      {value && source && <SourceLink source={source} short />}
      {value && (note || source) && <details className="font-sans mt-1" style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
        <summary style={{ cursor: 'pointer', minHeight: 44, padding: '10px 0', boxSizing: 'border-box' }}>{productGuideText('Where this number comes from', lang)}</summary>
        {note && <p className="mt-1" style={isCropExportDraftLanguage(lang) ? { overflowWrap: 'anywhere' } : undefined}>{note}</p>}
        <OriginalReferenceNote source={originalNote} translated={note} language={lang} />
        {source && <p className="mt-1"><SourceLink source={source} /></p>}
      </details>}
    </div>
  );
}

const rangeText = (r: SourcedRange | null, unit: string) => (r ? `${formatAmountRange(r.value)} ${unit}` : null);

/** A private edited note can equal a common UI word. Bind it to this exact catalogue field. */
function enterpriseSourceText(e: AnimalEnterprise, field: 'name' | 'outputUnit' | 'seasonalPattern' | 'region' | AnimalRangeField, source: string | undefined, language: string): string | undefined {
  if (source === undefined) return source;
  const original = ANIMAL_ENTERPRISES[e.enterpriseId];
  const expected = field === 'name' || field === 'outputUnit' ? original?.[field] : field === 'seasonalPattern' ? original?.seasonalPattern?.text : field === 'region' ? original?.windows[0]?.region : original?.[field]?.note;
  return source === expected ? productGuideText(source, language) : source;
}

function enterpriseReferenceText(e: AnimalEnterprise, field: 'productionReferences' | 'legal' | 'welfare', index: number, source: string, language: string): string {
  return ANIMAL_ENTERPRISES[e.enterpriseId]?.[field]?.[index]?.point === source ? productGuideText(source, language) : source;
}

function EnterpriseFacts({ e }: { e: AnimalEnterprise }) {
  const { lang } = useLanguage();
  const nativeCare = isCropExportDraftLanguage(lang);
  const months = sourcedProductMonths(e);
  const firstWindow = e.windows[0];
  // Every quote the card rests on, in one place: a phone never shows a link's hover text.
  const sources: HarvestCitation[] = [
    e.outputPerAnimal?.source, ...e.windows.map((w) => w.source), e.seasonalPattern?.source,
    e.weeksToFirstProduct?.source, e.productiveLifeYears?.source, e.feedKgPerDay?.source,
    e.waterLPerDay?.source, e.spaceM2?.source, ...(e.productionReferences ?? []).map(p => p.source), ...e.welfare.map((p) => p.source), ...e.legal.map((p) => p.source),
  ].filter((c): c is HarvestCitation => !!c);
  const art = animalArtUrl(e.enterpriseId);
  const factLabel = (kind: 'Feed' | 'Water' | 'Space') => {
    const source = `${kind} per ${e.animalUnit}`;
    return ANIMAL_ENTERPRISES[e.enterpriseId]?.animalUnit === e.animalUnit ? productGuideText(source, lang) : source;
  };
  return (
    <div className="mt-3">
      {art && (
        <img className="produce-art" src={art} alt={enterpriseSourceText(e, 'name', e.name, lang)} width={72} height={72} loading="lazy" style={{ width: 'clamp(56px, 5vw, 72px)', height: 'auto', objectFit: 'contain', marginBottom: 8 }} />
      )}
      <p className="font-sans mb-3" style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{productGuideText("These are research references per animal. Check the age, system and units before using a figure for your farm.", lang)}</p>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <Fact label={productGuideText('Production reference', lang)} value={rangeText(e.outputPerAnimal, enterpriseSourceText(e, 'outputUnit', e.outputUnit, lang) ?? e.outputUnit)} source={e.outputPerAnimal?.source} qualifier={productGuideText(animalReferenceQualifier(e, 'outputPerAnimal') ?? '', lang) || undefined} note={enterpriseSourceText(e, 'outputPerAnimal', e.outputPerAnimal?.note, lang)} originalNote={e.outputPerAnimal?.note} />
        <Fact label={productGuideText('When', lang)} value={months.length ? e.windows.length === 1 ? `${formatMonthSpan(months, lang)} · ${enterpriseSourceText(e, 'region', firstWindow.region, lang)}` : productGuideText('{months} across SA sources', lang, { months: formatMonthSpan(months, lang) }) : null} source={firstWindow?.source} />
        <Fact label={productGuideText('First product', lang)} value={e.weeksToFirstProduct ? formatWeeks(e.weeksToFirstProduct.value, lang) : null} source={e.weeksToFirstProduct?.source} qualifier={productGuideText(animalReferenceQualifier(e, 'weeksToFirstProduct') ?? '', lang) || undefined} note={enterpriseSourceText(e, 'weeksToFirstProduct', e.weeksToFirstProduct?.note, lang)} originalNote={e.weeksToFirstProduct?.note} />
        <Fact label={productGuideText('Productive life', lang)} value={rangeText(e.productiveLifeYears, productGuideText('years', lang))} source={e.productiveLifeYears?.source} qualifier={productGuideText(animalReferenceQualifier(e, 'productiveLifeYears') ?? '', lang) || undefined} note={enterpriseSourceText(e, 'productiveLifeYears', e.productiveLifeYears?.note, lang)} originalNote={e.productiveLifeYears?.note} />
        <Fact label={factLabel('Feed')} value={rangeText(e.feedKgPerDay, productGuideText('kg a day', lang))} source={e.feedKgPerDay?.source} qualifier={productGuideText(animalReferenceQualifier(e, 'feedKgPerDay') ?? '', lang) || undefined} note={enterpriseSourceText(e, 'feedKgPerDay', e.feedKgPerDay?.note, lang)} originalNote={e.feedKgPerDay?.note} />
        <Fact label={factLabel('Water')} value={rangeText(e.waterLPerDay, productGuideText('L a day', lang))} source={e.waterLPerDay?.source} qualifier={productGuideText(animalReferenceQualifier(e, 'waterLPerDay') ?? '', lang) || undefined} note={enterpriseSourceText(e, 'waterLPerDay', e.waterLPerDay?.note, lang)} originalNote={e.waterLPerDay?.note} />
        <Fact label={factLabel('Space')} value={rangeText(e.spaceM2, 'm²')} source={e.spaceM2?.source} qualifier={productGuideText(animalReferenceQualifier(e, 'spaceM2') ?? '', lang) || undefined} note={enterpriseSourceText(e, 'spaceM2', e.spaceM2?.note, lang)} originalNote={e.spaceM2?.note} />
      </div>
      {!isFoodProduct(e.product) && (
        <p className="font-sans mt-3" style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>
          {productGuideText('{product} is not food, so it stays off the availability chart and the year of food.', lang, { product: productGuideText(PRODUCT_LABEL[e.product], lang) })}
        </p>
      )}
      {e.seasonalPattern && (
        <p className="font-sans mt-3" style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
          {enterpriseSourceText(e, 'seasonalPattern', e.seasonalPattern.text, lang)} <SourceLink source={e.seasonalPattern.source} />
        </p>
      )}
      {!!e.productionReferences?.length && <details className="mt-3 p-3 rounded-xl font-sans" style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)', background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
        <summary style={{ cursor: 'pointer', minHeight: 44, paddingTop: 10, color: 'var(--text-primary)', fontWeight: 600 }}>{productGuideText('Production by age & system', lang)}</summary>
        <p className="mt-2">{productGuideText("Match breed, stage and units to your stock. Enter your farm's expected or actual output separately.", lang)}</p>
        <ul className="mt-2 flex flex-col gap-2" style={{ listStyle: 'disc', paddingInlineStart: 20 }}>{e.productionReferences.map((reference, index) => <li key={index}>{enterpriseReferenceText(e, 'productionReferences', index, reference.point, lang)} <SourceLink source={reference.source} /><OriginalReferenceNote source={reference.point} translated={enterpriseReferenceText(e, 'productionReferences', index, reference.point, lang)} language={lang} /></li>)}</ul>
      </details>}
      {e.welfare.length > 0 && (
        <div className="mt-3">
          <div className="font-sans font-semibold inline-flex items-center gap-1.5 mb-1" style={{ fontSize: 12, color: 'var(--text-primary)' }}>
            <HeartHandshake size={13} aria-hidden style={{ color: 'var(--emerald)' }} /> {productGuideText('What they need', lang)}
          </div>
          {nativeCare && <p className="font-sans mb-2" style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>{productGuideText("Animal care translations are unreviewed drafts. English care notes are available below. Other animal details may still be in English.", lang)}</p>}
          <ul className="font-sans flex flex-col gap-1" style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45, listStyle: 'disc', paddingInlineStart: 20 }}>
            {e.welfare.map((p, i) => <li key={i}>{enterpriseReferenceText(e, 'welfare', i, p.point, lang)}{nativeCare && enterpriseReferenceText(e, 'welfare', i, p.point, lang) !== p.point && <details className="mt-1" style={{ fontSize: 11.5 }}><summary style={{ cursor: 'pointer', minHeight: 44, padding: '10px 0', boxSizing: 'border-box' }}>{productGuideText('Original animal care note', lang)}</summary><p lang="en" className="mt-1">{p.point}</p></details>}</li>)}
          </ul>
        </div>
      )}
      {e.legal.length > 0 && (
        <div className="mt-3">
          <div className="font-sans font-semibold inline-flex items-center gap-1.5 mb-1" style={{ fontSize: 12, color: 'var(--text-primary)' }}>
            <Scale size={13} aria-hidden style={{ color: 'var(--gold-dim)' }} /> {productGuideText('The law', lang)}
          </div>
          <ul className="font-sans flex flex-col gap-1" style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45, listStyle: 'disc', paddingInlineStart: 20 }}>
            {e.legal.map((p, i) => <li key={i}>{enterpriseReferenceText(e, 'legal', i, p.point, lang)}</li>)}
          </ul>
        </div>
      )}
      {sources.length > 0 && (
        <details className="mt-2 font-sans" style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
          <summary style={{ cursor: 'pointer' }}>{productGuideText('What the sources say ({count})', lang, { count: sources.length })}</summary>
          <ul className="flex flex-col gap-2 pt-2">
            {sources.map((c, i) => (
              <li key={i} style={{ lineHeight: 1.45 }}>
                <span style={{ color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>&ldquo;{c.quote}&rdquo;</span>{' '}
                <SourceLink source={c} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export default function AnimalEnterprisesCard({ groups, choices, onChoose, seasons = {}, onSeasonsChange, compact = false }: {
  groups: PlacedAnimalGroup[];
  choices: Partial<Record<HousingKind, string>>;
  onChoose: (housing: HousingKind, enterpriseId: string | null) => void;
  seasons?: AnimalSeasonChoices;
  onSeasonsChange?: (housing: HousingKind, enterpriseId: string, months: number[]) => void;
  compact?: boolean;
}) {
  const { lang } = useLanguage();
  const native = isCropExportDraftLanguage(lang);
  if (groups.length === 0) return null;
  return (
    <div className="rounded-2xl p-4 mt-4" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)' }} data-animal-enterprises>
      <div className="font-display font-semibold mb-1 inline-flex items-center gap-1.5" style={{ fontSize: 'clamp(15px, 1.15vw, 17px)', color: 'var(--text-primary)' }}>
        <PawPrint size={14} aria-hidden /> {productGuideText('Animals on your map', lang)}
      </div>
      <p className="font-sans mb-3" style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>
        {productGuideText("The map shows housing, not animal numbers. Choose what you keep, then confirm the months it gives food here. Housing stays on the printed plan even when dates are unknown.", lang)}
      </p>
      <p className="font-sans mb-3" style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>{productGuideText("These confirmations are kept on this device for this design.", lang)}</p>
      {native && <p className="font-sans mb-3" style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>{reportDocumentText('Draft translation: not yet reviewed by a fluent speaker. Check the English source before acting.', lang)}{' '}{productGuideText('Some animal source notes and quotations remain in English.', lang)}</p>}
      <div className="flex flex-col gap-4">
        {groups.map((g) => {
          const options = enterprisesForHousing(g.housing);
          const chosen = options.find((e) => e.enterpriseId === choices[g.housing]) ?? null;
          const total = g.existing + g.proposed;
          const [one, many] = STRUCTURE_NOUN[g.housing];
          return (
            <section key={g.housing} style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }} data-animal-housing={g.housing}>
              <div className="font-sans font-semibold" style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>
                {productGuideText(HOUSING_LABEL[g.housing], lang)}
                <span className="font-normal" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  {native ? <>{' '}· {productGuideText(g.proposed > 0 ? '{count} {structures} on the map ({proposed} proposed)' : '{count} {structures} on the map', lang, { count: total, structures: productGuideText(total === 1 ? one : many, lang), proposed: g.proposed })}</> : <>{' '}· {total} {total === 1 ? one : many} on the map{g.proposed > 0 ? ` (${g.proposed} proposed)` : ''}</>}
                </span>
              </div>
              <div className="font-sans mt-2 mb-1" style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{productGuideText(PURPOSE_QUESTION[g.housing] ?? 'What are they for?', lang)}</div>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={PURPOSE_QUESTION[g.housing] ? productGuideText(PURPOSE_QUESTION[g.housing]!, lang) : productGuideText('What the {housing} are for', lang, { housing: productGuideText(HOUSING_LABEL[g.housing], lang).toLowerCase() })}>
                {options.map((e) => {
                  const on = chosen?.enterpriseId === e.enterpriseId;
                  const Icon = PRODUCT_ICON[e.product];
                  const chipArt = animalArtUrl(e.enterpriseId);
                  return (
                    <button
                      key={e.enterpriseId}
                      type="button"
                      aria-pressed={on}
                      onClick={() => onChoose(g.housing, on ? null : e.enterpriseId)}
                      className="font-sans rounded-full inline-flex items-center gap-1"
                      style={{ fontSize: 12, fontWeight: on ? 600 : 400, padding: '4px 10px', minHeight: 40, maxWidth: native ? '100%' : undefined, textAlign: native ? 'left' : undefined, cursor: 'pointer', border: `1px solid ${on ? 'var(--emerald)' : 'var(--border)'}`, background: on ? 'var(--bg-2)' : 'transparent', color: on ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                    >
                      {chipArt
                        ? <img className="produce-art" src={chipArt} alt="" aria-hidden width={16} height={16} style={{ width: 16, height: 16, objectFit: 'contain' }} />
                        : <Icon size={12} aria-hidden />} {native ? <span style={{ minWidth: 0 }}>{enterpriseSourceText(e, 'name', e.name, lang)}<span lang="en" style={{ display: 'block', fontSize: 10, fontWeight: 400 }}>{e.name}</span></span> : e.name}
                    </button>
                  );
                })}
              </div>
              {chosen && isFoodProduct(chosen.product) && onSeasonsChange && <>
                <p className="font-sans mt-3 mb-2" style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{productGuideText('Tap months when your animals already give {product} here. A reference season is not a promise for this farm.', lang, { product: productGuideText(PRODUCT_LABEL[chosen.product], lang).toLowerCase() })}{chosen.enterpriseId === 'chicken-layer' ? ' ' + productGuideText('The all-year source is for commercial layers with managed feeding and lighting.', lang) : ''}</p>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label={productGuideText('{housing} local production months', lang, { housing: productGuideText(HOUSING_LABEL[g.housing], lang) })}>
                  {MONTHS_SHORT.map((name, i) => {
                    const months = seasons[g.housing]?.enterpriseId === chosen.enterpriseId ? seasons[g.housing]?.months ?? [] : [];
                    const on = months.includes(i + 1);
                    return <button key={name} type="button" aria-label={native ? recordsMonthLong(lang, i + 1) : undefined} aria-pressed={on} disabled={g.existing === 0} onClick={() => onSeasonsChange(g.housing, chosen.enterpriseId, on ? months.filter((m) => m !== i + 1) : [...months, i + 1].sort((a, b) => a - b))} className="font-sans rounded-lg" style={{ minWidth: 44, minHeight: 44, fontSize: 12, cursor: 'pointer', color: 'var(--text-primary)', border: `1px solid ${on ? 'var(--emerald)' : 'var(--border)'}`, background: on ? 'var(--bg-2)' : 'transparent' }}>{native ? recordsMonthShort(lang, i + 1) : name}</button>;
                  })}
                </div>
                {g.existing === 0 && <p className="font-sans mt-2" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{productGuideText('Only proposed housing: no animals giving food yet.', lang)}</p>}
              </>}
              {chosen ? compact ? <details className="mt-3 font-sans" style={{ fontSize: 12 }}><summary style={{ cursor: 'pointer', color: 'var(--text-primary)' }}>{productGuideText('Reference seasons, care and sources', lang)}</summary><EnterpriseFacts e={chosen} /></details> : <EnterpriseFacts e={chosen} /> : (
                <p className="font-sans mt-2 inline-flex items-center gap-1.5" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                  <ShieldCheck size={12} aria-hidden /> {productGuideText('Choose what they are kept for. Production months need local confirmation.', lang)}
                </p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
