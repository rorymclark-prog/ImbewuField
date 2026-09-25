'use client';

import { useLanguage } from '@/lib/i18n';

type Summary = { total: number; farmerCount: number; cropCount: number; offers: number; wants: number };
type Crop = { cropKey: string; name: string; icon: string; art: string | null };

export default function ExchangeLede({ summary, crops }: { summary: Summary; crops: Crop[] }) {
  const { lang } = useLanguage();
  const zu = lang === 'zu';
  const listings = summary.total === 1 ? (zu ? 'isikhangiso' : 'listing') : (zu ? 'izikhangiso' : 'listings');
  return (
    <>
      <p className="font-sans" style={{ fontSize: 13.5, color: '#5C5040', lineHeight: 1.6, margin: 0 }}>
        {zu ? <>Abalimi bahwebelana ngembewu, izithombo, umkhiqizo osele, amathuluzi nomsebenzi abelana ngawo. Leli bhodi linezikhangiso zesibonelo ezingu-<strong style={{ color: '#20190F', fontWeight: 600 }}>{summary.total} ezivuliwe</strong>, ezivela kubalimi abangu-<strong style={{ color: '#20190F', fontWeight: 600 }}>{summary.farmerCount}</strong> nezitshalo ezingu-<strong style={{ color: '#20190F', fontWeight: 600 }}>{summary.cropCount}</strong>. Ezingu-{summary.offers} ziyanikela; ezingu-{summary.wants} ziyafunwa.</> : <>Farmers trading with farmers — seed, seedlings, surplus produce, tools and work-share. The trading board is carrying <strong style={{ color: '#20190F', fontWeight: 600 }}>{summary.total} open {listings}</strong> from <strong style={{ color: '#20190F', fontWeight: 600 }}>{summary.farmerCount} farmers</strong> across {summary.cropCount} crops — {summary.offers} offering, {summary.wants} wanted.</>}
      </p>
      {crops.length > 0 && (
        <p className="font-sans" style={{ fontSize: 12.5, color: '#755942', lineHeight: 1.6, margin: '8px 0 0' }}>
          {zu ? 'Ezihwebelwa kakhulu manje: ' : 'Most traded right now: '}
          {crops.map((crop, i) => (
            <span key={crop.cropKey} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              {i > 0 && ' · '}
              {crop.art ? <img className="produce-art" src={crop.art} alt="" aria-hidden style={{ width: 14, height: 14, objectFit: 'contain' }} /> : <span>{crop.icon}</span>}{' '}
              {crop.name}
            </span>
          ))}
        </p>
      )}
    </>
  );
}
