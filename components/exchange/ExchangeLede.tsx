'use client';

import { useLanguage } from '@/lib/i18n';
import { produceLabel } from '@/lib/produce-label';
import { useAppLevel } from '@/lib/app-level';
import { inlineTemplate, inlineText } from '@/lib/xh-inline';
import { EX } from './theme';

type Summary = { total: number; farmerCount: number; cropCount: number; offers: number; wants: number };
type Crop = { cropKey: string; name: string; icon: string; art: string | null };

export default function ExchangeLede({ summary, crops }: { summary: Summary; crops: Crop[] }) {
  const { lang } = useLanguage();
  const zu = lang === 'zu';
  const simple = useAppLevel() === 'simple';
  const listings = summary.total === 1 ? (zu ? 'isikhangiso' : 'listing') : (zu ? 'izikhangiso' : 'listings');
  return (
    <>
      <p className="font-sans" style={{ fontSize: 13.5, color: EX.muted, lineHeight: 1.6, margin: 0 }}>
        {/* Simple: the board's stats row below already shows the listing/farmer/crop counts, so
            the intro here stops after the plain-language sentence instead of saying the same
            numbers twice. All tools keeps the fuller sentence. */}
        {simple
          ? (zu ? 'Abalimi bahwebelana ngembewu, izithombo, umkhiqizo osele, amathuluzi nomsebenzi abelana ngawo.' : inlineText(lang, 'Farmers trading with farmers — seed, seedlings, surplus produce, tools and work-share.'))
          : (zu ? <>Abalimi bahwebelana ngembewu, izithombo, umkhiqizo osele, amathuluzi nomsebenzi abelana ngawo. Leli bhodi linezikhangiso zesibonelo ezingu-<strong style={{ color: EX.ink, fontWeight: 600 }}>{summary.total} ezivuliwe</strong>, ezivela kubalimi abangu-<strong style={{ color: EX.ink, fontWeight: 600 }}>{summary.farmerCount}</strong> nezitshalo ezingu-<strong style={{ color: EX.ink, fontWeight: 600 }}>{summary.cropCount}</strong>. Ezingu-{summary.offers} ziyanikela; ezingu-{summary.wants} ziyafunwa.</> : lang === 'xh' ? boldParts(`${inlineText(lang, 'Farmers trading with farmers — seed, seedlings, surplus produce, tools and work-share.')} ${inlineTemplate(lang, summary.total === 1 ? 'The trading board is carrying **{total} open listing** from **{farmerCount} farmers** across {cropCount} crops — {offers} offering, {wants} wanted.' : 'The trading board is carrying **{total} open listings** from **{farmerCount} farmers** across {cropCount} crops — {offers} offering, {wants} wanted.', null, { total: summary.total, farmerCount: summary.farmerCount, cropCount: summary.cropCount, offers: summary.offers, wants: summary.wants })}`) : <>Farmers trading with farmers — seed, seedlings, surplus produce, tools and work-share. The trading board is carrying <strong style={{ color: EX.ink, fontWeight: 600 }}>{summary.total} open {listings}</strong> from <strong style={{ color: EX.ink, fontWeight: 600 }}>{summary.farmerCount} farmers</strong> across {summary.cropCount} crops — {summary.offers} offering, {summary.wants} wanted.</>)}
      </p>
      {crops.length > 0 && (
        <p className="font-sans flex flex-wrap items-center" style={{ fontSize: 12.5, color: EX.faint, lineHeight: 1.6, margin: '8px 0 0', columnGap: 14 }}>
          {/* w19-05: gap-only row — a "·" inside each item left wrapped lines starting with a dot. */}
          <span>{zu ? 'Ezihwebelwa kakhulu manje: ' : inlineText(lang, 'Most traded right now: ')}</span>
          {crops.map((crop) => (
            <span key={crop.cropKey} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {crop.art ? <img className="produce-art produce-art--inline" src={crop.art} alt="" aria-hidden style={{ width: 14, height: 14, objectFit: 'contain' }} /> : <span>{crop.icon}</span>}
              {produceLabel(crop.cropKey, lang)}
            </span>
          ))}
        </p>
      )}
    </>
  );
}

/** Renders `**bold**` spans from a translated sentence (the isiXhosa lede keeps the counts bold). */
function boldParts(text: string) {
  return text.split(/\*\*(.+?)\*\*/).map((part, i) =>
    i % 2 === 1 ? <strong key={i} style={{ color: EX.ink, fontWeight: 600 }}>{part}</strong> : part);
}
