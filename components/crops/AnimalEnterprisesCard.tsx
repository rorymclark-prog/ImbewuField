'use client';

// "Animals on your map" — what the coops, pens, hutches and hives on the Studio design give, and
// what they need, from the sourced animal table (lib/animal-enterprises.ts).
//
// Two things this card will not do, and says so. It does not multiply a per-hen figure by the
// number of coops (a coop is housing, not a head count), and it does not decide what a coop is
// for: layers, broilers and village chickens share a coop and nothing else, so the farmer picks.
// Every figure opens onto the sentence it came from; a figure no source states reads "not sourced".

import type { LucideIcon } from 'lucide-react';
import { PawPrint, Egg, Milk, Hexagon, Drumstick, Fish, Scissors, Scale, ShieldCheck, HeartHandshake, ExternalLink } from 'lucide-react';
import {
  HOUSING_LABEL,
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
} from '@/lib/animal-enterprises';
import { MONTHS_SHORT } from '@/lib/crop-catalog';
import { useLanguage } from '@/lib/i18n';
import { inlineText, inlineTemplate } from '@/lib/xh-inline';
import { animalArtUrl } from '@/lib/animal-art';
import { formatRange, monthSpanText, type HarvestCitation, type SourcedRange } from '@/lib/perennial-harvest';

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
export function formatWeeks([min, max]: [number, number], lang = 'en'): string {
  if (max <= 26) return inlineTemplate(lang, '{n} weeks', null, { n: formatAmountRange([min, max]) });
  const months = (w: number) => Math.round(w / 4.35);
  return inlineTemplate(lang, 'about {n} months', null, { n: formatRange([months(min), months(max)]) });
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
      aria-label={short ? inlineTemplate(lang, 'Read source: {citation}', null, { citation }) : undefined}
      className="inline-flex items-center gap-0.5"
      style={{ color: 'var(--blue)', fontSize: 11, textDecoration: 'underline', textUnderlineOffset: 2 }}
    >
      {short ? inlineText(lang, 'Read source') : citation}
      <ExternalLink size={10} aria-hidden />
    </a>
  );
}

function Fact({ label, value, source, qualifier, note }: { label: string; value: string | null; source?: HarvestCitation; qualifier?: string; note?: string }) {
  const { lang } = useLanguage();
  return (
    <div style={{ minWidth: 0 }}>
      <div className="font-sans uppercase" style={{ fontSize: 9.5, letterSpacing: '0.08em', color: 'var(--text-muted)' }}>{label}</div>
      <div className="font-display" style={{ fontSize: 'clamp(14px, 1.1vw, 16px)', color: value ? 'var(--text-primary)' : 'var(--text-muted)', lineHeight: 1.3 }}>
        {value ?? inlineText(lang, 'Not sourced')}
      </div>
      {value && qualifier && <p className="font-sans mt-1" style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>{inlineText(lang, qualifier)}</p>}
      {value && source && <SourceLink source={source} short />}
      {value && (note || source) && <details className="font-sans mt-1" style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
        <summary style={{ cursor: 'pointer', minHeight: 44, padding: '10px 0', boxSizing: 'border-box' }}>{inlineText(lang, 'Where this number comes from')}</summary>
        {note && <p className="mt-1">{inlineText(lang, note)}</p>}
        {source && <p className="mt-1"><SourceLink source={source} /></p>}
      </details>}
    </div>
  );
}

const rangeText = (r: SourcedRange | null, unit: string) => (r ? `${formatAmountRange(r.value)} ${unit}` : null);

function EnterpriseFacts({ e }: { e: AnimalEnterprise }) {
  const { lang } = useLanguage();
  const ui = (english: string) => inlineText(lang, english);
  // 'sow' on its own is the verb elsewhere in the app, so the pig keeps a fuller key.
  const unitText = (unit: string) => (unit === 'sow' ? ui('sow (female pig)') : ui(unit));
  const months = sourcedProductMonths(e);
  const firstWindow = e.windows[0];
  // Every quote the card rests on, in one place: a phone never shows a link's hover text.
  const sources: HarvestCitation[] = [
    e.outputPerAnimal?.source, ...e.windows.map((w) => w.source), e.seasonalPattern?.source,
    e.weeksToFirstProduct?.source, e.productiveLifeYears?.source, e.feedKgPerDay?.source,
    e.waterLPerDay?.source, e.spaceM2?.source, ...(e.productionReferences ?? []).map(p => p.source), ...e.welfare.map((p) => p.source), ...e.legal.map((p) => p.source),
  ].filter((c): c is HarvestCitation => !!c);
  const art = animalArtUrl(e.enterpriseId);
  return (
    <div className="mt-3">
      {art && (
        <img className="produce-art" src={art} alt={e.name} width={72} height={72} loading="lazy" style={{ width: 'clamp(56px, 5vw, 72px)', height: 'auto', objectFit: 'contain', marginBottom: 8 }} />
      )}
      <p className="font-sans mb-3" style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{ui('These are research references per animal. Check the age, system and units before using a figure for your farm.')}</p>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <Fact label={inlineTemplate(lang, e.product === 'fish' ? 'Harvest per {unit}' : '{product} per {unit}', null, { product: ui(PRODUCT_LABEL[e.product]), unit: unitText(e.animalUnit) })} value={rangeText(e.outputPerAnimal, ui(e.outputUnit))} source={e.outputPerAnimal?.source} qualifier={animalReferenceQualifier(e, 'outputPerAnimal')} note={e.outputPerAnimal?.note} />
        <Fact label={ui('When')} value={months.length ? `${monthSpanText(lang, months)}${e.windows.length === 1 ? ` · ${firstWindow.region}` : ` ${ui('across SA sources')}`}` : null} source={firstWindow?.source} />
        <Fact label={ui('First product')} value={e.weeksToFirstProduct ? formatWeeks(e.weeksToFirstProduct.value, lang) : null} source={e.weeksToFirstProduct?.source} qualifier={animalReferenceQualifier(e, 'weeksToFirstProduct')} note={e.weeksToFirstProduct?.note} />
        <Fact label={ui('Productive life')} value={rangeText(e.productiveLifeYears, ui('years'))} source={e.productiveLifeYears?.source} qualifier={animalReferenceQualifier(e, 'productiveLifeYears')} note={e.productiveLifeYears?.note} />
        <Fact label={inlineTemplate(lang, 'Feed per {unit}', null, { unit: unitText(e.animalUnit) })} value={rangeText(e.feedKgPerDay, ui('kg a day'))} source={e.feedKgPerDay?.source} qualifier={animalReferenceQualifier(e, 'feedKgPerDay')} note={e.feedKgPerDay?.note} />
        <Fact label={inlineTemplate(lang, 'Water per {unit}', null, { unit: unitText(e.animalUnit) })} value={rangeText(e.waterLPerDay, ui('L a day'))} source={e.waterLPerDay?.source} qualifier={animalReferenceQualifier(e, 'waterLPerDay')} note={e.waterLPerDay?.note} />
        <Fact label={inlineTemplate(lang, 'Space per {unit}', null, { unit: unitText(e.animalUnit) })} value={rangeText(e.spaceM2, 'm²')} source={e.spaceM2?.source} qualifier={animalReferenceQualifier(e, 'spaceM2')} note={e.spaceM2?.note} />
      </div>
      {!isFoodProduct(e.product) && (
        <p className="font-sans mt-3" style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>
          {inlineTemplate(lang, '{product} is not food, so it stays off the availability chart and the year of food.', null, { product: ui(PRODUCT_LABEL[e.product]) })}
        </p>
      )}
      {e.seasonalPattern && (
        <p className="font-sans mt-3" style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
          {ui(e.seasonalPattern.text)} <SourceLink source={e.seasonalPattern.source} />
        </p>
      )}
      {!!e.productionReferences?.length && <details className="mt-3 p-3 rounded-xl font-sans" style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)', background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
        <summary style={{ cursor: 'pointer', minHeight: 44, paddingTop: 10, color: 'var(--text-primary)', fontWeight: 600 }}>{ui('Production by age & system')}</summary>
        <p className="mt-2">{ui("Match breed, stage and units to your stock. Enter your farm's expected or actual output separately.")}</p>
        <ul className="mt-2 flex flex-col gap-2" style={{ listStyle: 'disc', paddingInlineStart: 20 }}>{e.productionReferences.map((reference, index) => <li key={index}>{ui(reference.point)} <SourceLink source={reference.source} /></li>)}</ul>
      </details>}
      {e.welfare.length > 0 && (
        <div className="mt-3">
          <div className="font-sans font-semibold inline-flex items-center gap-1.5 mb-1" style={{ fontSize: 12, color: 'var(--text-primary)' }}>
            <HeartHandshake size={13} aria-hidden style={{ color: 'var(--emerald)' }} /> {ui('What they need')}
          </div>
          <ul className="font-sans flex flex-col gap-1" style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45, listStyle: 'disc', paddingInlineStart: 20 }}>
            {e.welfare.map((p, i) => <li key={i}>{ui(p.point)}</li>)}
          </ul>
        </div>
      )}
      {e.legal.length > 0 && (
        <div className="mt-3">
          <div className="font-sans font-semibold inline-flex items-center gap-1.5 mb-1" style={{ fontSize: 12, color: 'var(--text-primary)' }}>
            <Scale size={13} aria-hidden style={{ color: 'var(--gold-dim)' }} /> {ui('The law')}
          </div>
          <ul className="font-sans flex flex-col gap-1" style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45, listStyle: 'disc', paddingInlineStart: 20 }}>
            {e.legal.map((p, i) => <li key={i}>{ui(p.point)}</li>)}
          </ul>
        </div>
      )}
      {sources.length > 0 && (
        <details className="mt-2 font-sans" style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
          <summary style={{ cursor: 'pointer' }}>{inlineTemplate(lang, 'What the sources say ({n})', null, { n: sources.length })}</summary>
          <ul className="flex flex-col gap-2 pt-2">
            {sources.map((c, i) => (
              <li key={i} style={{ lineHeight: 1.45 }}>
                <span style={{ color: 'var(--text-primary)' }}>&ldquo;{c.quote}&rdquo;</span>{' '}
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
  const ui = (english: string) => inlineText(lang, english);
  if (groups.length === 0) return null;
  return (
    <div className="rounded-2xl p-4 mt-4" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)' }} data-animal-enterprises>
      <div className="font-display font-semibold mb-1 inline-flex items-center gap-1.5" style={{ fontSize: 'clamp(15px, 1.15vw, 17px)', color: 'var(--text-primary)' }}>
        <PawPrint size={14} aria-hidden /> {ui('Animals on your map')}
      </div>
      <p className="font-sans mb-3" style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>
        {ui('The map shows housing, not animal numbers. Choose what you keep, then confirm the months it gives food here. Housing stays on the printed plan even when dates are unknown.')}
      </p>
      <p className="font-sans mb-3" style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>{ui('These confirmations are kept on this device for this design.')}</p>
      <div className="flex flex-col gap-4">
        {groups.map((g) => {
          const options = enterprisesForHousing(g.housing);
          const chosen = options.find((e) => e.enterpriseId === choices[g.housing]) ?? null;
          const total = g.existing + g.proposed;
          const [one, many] = STRUCTURE_NOUN[g.housing];
          return (
            <section key={g.housing} style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }} data-animal-housing={g.housing}>
              <div className="font-sans font-semibold" style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>
                {ui(HOUSING_LABEL[g.housing])}
                <span className="font-normal" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  {' '}· {inlineTemplate(lang, '{n} {structure} on the map', null, { n: total, structure: ui(total === 1 ? one : many) })}{g.proposed > 0 ? ` (${inlineTemplate(lang, '{n} proposed', null, { n: g.proposed })})` : ''}
                </span>
              </div>
              <div className="font-sans mt-2 mb-1" style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{ui(PURPOSE_QUESTION[g.housing] ?? 'What are they for?')}</div>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={PURPOSE_QUESTION[g.housing] ? ui(PURPOSE_QUESTION[g.housing]!) : inlineTemplate(lang, 'What the {housing} are for', null, { housing: ui(HOUSING_LABEL[g.housing]).toLowerCase() })}>
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
                      style={{ fontSize: 12, fontWeight: on ? 600 : 400, padding: '4px 10px', minHeight: 40, cursor: 'pointer', border: `1px solid ${on ? 'var(--emerald)' : 'var(--border)'}`, background: on ? 'var(--bg-2)' : 'transparent', color: on ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                    >
                      {chipArt
                        ? <img className="produce-art" src={chipArt} alt="" aria-hidden width={16} height={16} style={{ width: 16, height: 16, objectFit: 'contain' }} />
                        : <Icon size={12} aria-hidden />} {e.name}
                    </button>
                  );
                })}
              </div>
              {chosen && isFoodProduct(chosen.product) && onSeasonsChange && <>
                <p className="font-sans mt-3 mb-2" style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{inlineTemplate(lang, 'Tap months when your animals already give {product} here. A reference season is not a promise for this farm.', null, { product: ui(PRODUCT_LABEL[chosen.product]).toLowerCase() })}{chosen.enterpriseId === 'chicken-layer' ? ` ${ui('The all-year source is for commercial layers with managed feeding and lighting.')}` : ''}</p>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label={inlineTemplate(lang, '{housing} local production months', null, { housing: ui(HOUSING_LABEL[g.housing]) })}>
                  {MONTHS_SHORT.map((name, i) => {
                    const months = seasons[g.housing]?.enterpriseId === chosen.enterpriseId ? seasons[g.housing]?.months ?? [] : [];
                    const on = months.includes(i + 1);
                    return <button key={name} type="button" aria-pressed={on} disabled={g.existing === 0} onClick={() => onSeasonsChange(g.housing, chosen.enterpriseId, on ? months.filter((m) => m !== i + 1) : [...months, i + 1].sort((a, b) => a - b))} className="font-sans rounded-lg" style={{ minWidth: 44, minHeight: 44, fontSize: 12, cursor: 'pointer', color: 'var(--text-primary)', border: `1px solid ${on ? 'var(--emerald)' : 'var(--border)'}`, background: on ? 'var(--bg-2)' : 'transparent' }}>{name}</button>;
                  })}
                </div>
                {g.existing === 0 && <p className="font-sans mt-2" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ui('Only proposed housing: no animals giving food yet.')}</p>}
              </>}
              {chosen ? compact ? <details className="mt-3 font-sans" style={{ fontSize: 12 }}><summary style={{ cursor: 'pointer', color: 'var(--text-primary)' }}>{ui('Reference seasons, care and sources')}</summary><EnterpriseFacts e={chosen} /></details> : <EnterpriseFacts e={chosen} /> : (
                <p className="font-sans mt-2 inline-flex items-center gap-1.5" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                  <ShieldCheck size={12} aria-hidden /> {ui('Choose what they are kept for. Production months need local confirmation.')}
                </p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
