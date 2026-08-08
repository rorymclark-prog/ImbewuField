'use client';

// "Show me an example" — onboarding Phase C10.
//
// A brand-new farmer can open /example to SEE what a finished site report
// looks like without doing anything. This is a self-contained, curated,
// READ-ONLY showcase built from the demo fixture in lib/demo-site.ts — it is
// NOT the live ReportView (which has a saveReport path). Nothing here reads
// or writes localStorage, so a curious tap can never pollute a real farmer's
// saved places/reports. No auth guard either: this page must be safely
// viewable by someone who hasn't signed up yet.

import { useRouter } from 'next/navigation';
import { Eye, Sprout, Droplets, Layers, Snowflake, Mountain, AlertTriangle } from 'lucide-react';
import { LanguageProvider, useLanguage } from '@/lib/i18n';
import CompletionScore from '@/components/report/CompletionScore';
import { DEMO_LOCATION, DEMO_SITE_DATA, DEMO_WATER_DATA, DEMO_COMPLETION } from '@/lib/demo-site';

import Illustration from '@/components/Illustration';

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        backgroundColor: '#FFFEFA',
        border: '1px solid #E2D8C4',
        borderRadius: 12,
        padding: 16,
      }}
    >
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-mono mb-1.5 uppercase tracking-wider" style={{ color: '#5C5040' }}>
      {children}
    </div>
  );
}

export default function ExamplePage() {
  return (
    <LanguageProvider>
      <ExampleInner />
    </LanguageProvider>
  );
}

function ExampleInner() {
  const { t } = useLanguage();
  const router = useRouter();
  const data = DEMO_LOCATION;
  const site = DEMO_SITE_DATA;
  const water = DEMO_WATER_DATA;

  const frostLabel = data.climate.minTemp < 2 ? t('frostLikely') : data.climate.minTemp < 5 ? t('frostOccasional') : t('frostRare');

  return (
    <div style={{ minHeight: '100vh', background: '#F7F2E9' }}>
      {/* Fixed top banner — always visible, above the content */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          background: '#C07A1E',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 14px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
        }}
      >
        <Eye size={20} style={{ color: '#FFFFFF', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="font-sans font-bold" style={{ fontSize: 13, color: '#FFFFFF', lineHeight: 1.3 }}>
            {t('demoBannerLabel')}
          </div>
          <div className="font-sans" style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 1.3 }}>
            {t('demoBannerBody')}
          </div>
        </div>
        <button
          type="button"
          onClick={() => router.push('/home')}
          className="font-sans font-bold"
          style={{
            flexShrink: 0,
            minHeight: 44,
            minWidth: 44,
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#FFFFFF',
            color: '#1F4D2B',
            borderRadius: 9999,
            fontSize: 13,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {t('demoExit')}
        </button>
      </div>

      {/* Curated read-only report, scrollable, centered column */}
      <div
        style={{
          maxWidth: 440,
          margin: '0 auto',
          padding: '84px 16px 40px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <Illustration name="example-hero" className="w-full h-40" />
        
        <CompletionScore inputs={DEMO_COMPLETION} />

        {/* Your land / Harvesting areas — mirrors DataPanel Overview cards */}
        <div className="space-y-2">
          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(31,77,43,0.06)', border: '1px solid rgba(31,77,43,0.22)' }}>
            <div className="flex items-center gap-3 px-3.5 py-2.5">
              <div className="flex items-center justify-center flex-shrink-0 rounded-xl" style={{ width: 32, height: 32, background: '#1F4D2B' }}>
                <Sprout size={16} style={{ color: '#A8D88A' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display font-semibold" style={{ fontSize: 13.5, color: '#1F4D2B' }}>
                  {t('yourLand')}
                </div>
                <div className="font-sans" style={{ fontSize: 11.5, color: '#5C5040' }}>
                  {site.perimeterM >= 1000 ? `${(site.perimeterM / 1000).toFixed(2)} km` : `${site.perimeterM} m`} {t('perimeterUnit')} · {site.areaM2.toLocaleString()} m²
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                {site.areaHa < 1
                  ? (
                    <>
                      <div className="font-display font-bold" style={{ fontSize: 15, color: '#20190F', lineHeight: 1 }}>{site.areaM2.toLocaleString()}</div>
                      <div className="font-sans" style={{ fontSize: 11, color: '#94876F' }}>m²</div>
                    </>
                  )
                  : (
                    <>
                      <div className="font-display font-bold" style={{ fontSize: 15, color: '#20190F', lineHeight: 1 }}>{site.areaHa}</div>
                      <div className="font-sans" style={{ fontSize: 11, color: '#94876F' }}>{t('hectaresUnit')}</div>
                    </>
                  )}
              </div>
            </div>
            {site.features && site.features.some((f) => f.name) && (
              <div className="px-3.5 pb-2.5 space-y-1">
                {site.features.map((f, i) => (f.name ? (
                  <div key={i} className="flex items-center gap-2 font-sans" style={{ fontSize: 11.5, color: '#5C5040' }}>
                    <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#1F4D2B', opacity: 0.6 }} />
                    <span className="font-medium" style={{ color: '#20190F' }}>{f.name}</span>
                    {f.category && <span style={{ color: '#94876F' }}>{f.category}</span>}
                    <span className="ml-auto" style={{ color: '#94876F' }}>{f.areaHa < 1 ? `${Math.round(f.areaHa * 10000).toLocaleString()} m²` : `${f.areaHa} ha`}</span>
                  </div>
                ) : null))}
              </div>
            )}
          </div>

          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(35,94,134,0.06)', border: '1px solid rgba(35,94,134,0.25)' }}>
            <div className="flex items-center gap-3 px-3.5 py-2.5">
              <div className="flex items-center justify-center flex-shrink-0 rounded-xl" style={{ width: 32, height: 32, background: '#235E86' }}>
                <Droplets size={16} style={{ color: '#CFE6F5' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display font-semibold" style={{ fontSize: 13.5, color: '#235E86' }}>
                  {t('harvestingAreas')}
                </div>
                <div className="font-sans" style={{ fontSize: 11.5, color: '#5C5040' }}>
                  {water.areaM2.toLocaleString()} m² {t('catchmentAreaLabel')}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-display font-bold" style={{ fontSize: 15, color: '#20190F', lineHeight: 1 }}>{water.estVolumeKL.toLocaleString()}</div>
                <div className="font-sans" style={{ fontSize: 11, color: '#94876F' }}>kL est.</div>
              </div>
            </div>
            {water.features && water.features.some((f) => f.name) && (
              <div className="px-3.5 pb-2.5 space-y-1">
                {water.features.map((f, i) => (f.name ? (
                  <div key={i} className="flex items-center gap-2 font-sans" style={{ fontSize: 11.5, color: '#5C5040' }}>
                    <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#235E86', opacity: 0.6 }} />
                    <span className="font-medium" style={{ color: '#20190F' }}>{f.name}</span>
                    {f.category && <span style={{ color: '#94876F' }}>{f.category}</span>}
                    <span className="ml-auto" style={{ color: '#94876F' }}>{f.estVolumeKL.toLocaleString()} kL</span>
                  </div>
                ) : null))}
              </div>
            )}
          </div>
        </div>

        {/* Stats ledger — mirrors DataPanel Overview */}
        <div style={{ background: '#FFFEFA', borderRadius: 16, border: '1px solid #E2D8C4', overflow: 'hidden' }}>
          <div className="flex items-center gap-3 px-4" style={{ height: 46, borderBottom: '1px solid #E2D8C4' }}>
            <Droplets size={18} style={{ color: '#235E86', flexShrink: 0 }} />
            <span className="flex-1 font-sans font-medium" style={{ fontSize: 12, color: '#5C5040' }}>{t('statAnnualRainfall')}</span>
            <span className="font-display font-semibold" style={{ fontSize: 14, color: '#20190F' }}>
              {data.rainfall.annual}<span className="font-sans font-medium" style={{ fontSize: 11, color: '#94876F' }}> mm</span>
            </span>
          </div>
          <div className="flex items-center gap-3 px-4" style={{ height: 46, borderBottom: '1px solid #E2D8C4' }}>
            <Layers size={16} style={{ color: '#C07A1E', flexShrink: 0 }} />
            <span className="flex-1 font-sans font-medium" style={{ fontSize: 12, color: '#5C5040' }}>{t('statSoilTexture')}</span>
            <span className="font-display font-semibold" style={{ fontSize: 14, color: '#20190F' }}>
              {data.soil.textureClass}
            </span>
          </div>
          <div className="flex items-center gap-3 px-4" style={{ height: 46, borderBottom: '1px solid #E2D8C4' }}>
            <Snowflake size={16} style={{ color: '#235E86', flexShrink: 0 }} />
            <span className="flex-1 font-sans font-medium" style={{ fontSize: 12, color: '#5C5040' }}>{t('statFrostRisk')}</span>
            <span className="font-display font-semibold" style={{ fontSize: 14, color: data.climate.minTemp < 2 ? '#235E86' : '#20190F' }}>
              {frostLabel}
            </span>
          </div>
          <div className="flex items-center gap-3 px-4" style={{ height: 46 }}>
            <Mountain size={16} style={{ color: '#5C5040', flexShrink: 0 }} />
            <span className="flex-1 font-sans font-medium" style={{ fontSize: 12, color: '#5C5040' }}>{t('statElevation')}</span>
            <span className="font-display font-semibold" style={{ fontSize: 14, color: '#20190F' }}>
              {data.elevation.elevation}<span className="font-sans font-medium" style={{ fontSize: 11, color: '#94876F' }}> m</span>
            </span>
          </div>
        </div>

        {/* Key species */}
        <Card>
          <Label>{t('cardKeySpecies')}</Label>
          <div className="flex flex-wrap gap-1.5">
            {data.biome.keySpecies.slice(0, 6).map((s) => (
              <span
                key={s}
                className="px-2 py-0.5 rounded-full text-xs font-display"
                style={{ background: 'rgba(31,77,43,0.1)', border: '1px solid rgba(31,77,43,0.2)', color: '#1F4D2B' }}
              >
                {s}
              </span>
            ))}
          </div>
        </Card>

        {/* Main challenges */}
        <Card>
          <Label>{t('cardMainChallenges')}</Label>
          <div className="space-y-1.5">
            {data.biome.challenges.slice(0, 4).map((c, i) => (
              <div key={i} className="flex gap-2 text-xs font-display leading-relaxed" style={{ color: '#20190F' }}>
                <span className="flex-shrink-0 mt-0.5 flex items-center" style={{ color: '#D4922A' }}><AlertTriangle size={12} /></span>
                {c}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
