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

import { numberLabel } from '@/lib/format-figures';
import { useRouter } from 'next/navigation';
import { Eye, Sprout, Droplets, Layers, Snowflake, Mountain, AlertTriangle } from 'lucide-react';
import { LanguageProvider, useLanguage } from '@/lib/i18n';
import CompletionScore from '@/components/report/CompletionScore';
import { DEMO_LOCATION, DEMO_SITE_DATA, DEMO_WATER_DATA, DEMO_COMPLETION } from '@/lib/demo-site';

import Illustration from '@/components/Illustration';
import workspace from '@/components/layout/Workspace.module.css';

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        backgroundColor: 'var(--bg-1)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 'clamp(16px, 1.6vw, 24px)',
      }}
    >
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
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
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)' }}>
      {/* This page leads with the demonstration banner, not a title, so the heading that names
          it is for screen readers only — a page with no h1 gives "jump to heading 1" nowhere
          to land. Reuses the banner's own translated string rather than a new English literal. */}
      <h1 className="sr-only">{t('demoBannerLabel')}</h1>
      {/* Fixed top banner — always visible, above the content */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          // nav-15: white text on the raw ochre fill (#C07A1E) is 2.54:1, below the 4.5:1 rule —
          // CLAUDE.md's own answer for white type under an ochre fill is #9A6018.
          background: '#9A6018',
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
          <div className="font-sans" style={{ fontSize: 12, color: '#FFFFFF', lineHeight: 1.3 }}>
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

      {/* Curated read-only report, scrollable. desk-13: this used to be a single ~410px column
          centred in a 1280px frame with 430px gutters either side — the shared formWidth token
          plus Workspace's twoColumns grid (one column on phone, two at md+) gives the completeness
          ring a real desktop neighbour instead of a stretched phone layout. */}
      <div
        className={`${workspace.workspace} ${workspace.formWidth}`}
        style={{
          // dark-07: 40px left the 'Main challenges' heading sitting right behind the global
          // floating Lima button on phone; var(--lima-fab-clearance) clears it on every page
          // the launcher can land on, not just the fixed offset that happened to fit here.
          padding: '84px 16px calc(max(96px, var(--lima-fab-clearance, 96px)))',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <Illustration name="example-hero" className="w-full h-40" />

        <div className={workspace.twoColumns}>
          <CompletionScore inputs={DEMO_COMPLETION} surface />

          {/* Your land / Harvesting areas — mirrors DataPanel Overview cards */}
          <div className="space-y-2">
          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(31,77,43,0.06)', border: '1px solid rgba(31,77,43,0.22)' }}>
            <div className="flex items-center gap-3 px-3.5 py-2.5">
              <div className="flex items-center justify-center flex-shrink-0 rounded-xl" style={{ width: 32, height: 32, background: '#1F4D2B' }}>
                <Sprout size={16} style={{ color: '#A8D88A' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display font-semibold" style={{ fontSize: 'clamp(13.5px, 1.1vw, 16px)', color: 'var(--color-forest-800)' }}>
                  {t('yourLand')}
                </div>
                <div className="font-sans" style={{ fontSize: 'clamp(12px, 0.95vw, 14px)', color: 'var(--text-secondary)' }}>
                  {site.perimeterM >= 1000 ? `${(site.perimeterM / 1000).toFixed(2)} km` : `${site.perimeterM} m`} {t('perimeterUnit')} · {numberLabel(site.areaM2)} m²
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                {site.areaHa < 1
                  ? (
                    <>
                      <div className="font-display font-bold" style={{ fontSize: 'clamp(15px, 1.3vw, 18px)', color: 'var(--text-primary)', lineHeight: 1 }}>{numberLabel(site.areaM2)}</div>
                      <div className="font-sans" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>m²</div>
                    </>
                  )
                  : (
                    <>
                      <div className="font-display font-bold" style={{ fontSize: 'clamp(15px, 1.3vw, 18px)', color: 'var(--text-primary)', lineHeight: 1 }}>{site.areaHa}</div>
                      <div className="font-sans" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('hectaresUnit')}</div>
                    </>
                  )}
              </div>
            </div>
            {site.features && site.features.some((f) => f.name) && (
              <div className="px-3.5 pb-2.5 space-y-1">
                {site.features.map((f, i) => (f.name ? (
                  <div key={i} className="flex items-center gap-2 font-sans" style={{ fontSize: 'clamp(12px, 0.95vw, 14px)', color: 'var(--text-secondary)' }}>
                    <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#1F4D2B', opacity: 0.6 }} />
                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{f.name}</span>
                    {f.category && <span style={{ color: 'var(--text-secondary)' }}>{f.category}</span>}
                    <span className="ml-auto" style={{ color: 'var(--text-secondary)' }}>{f.areaHa < 1 ? `${numberLabel(Math.round(f.areaHa * 10000))} m²` : `${f.areaHa} ha`}</span>
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
                <div className="font-display font-semibold" style={{ fontSize: 'clamp(13.5px, 1.1vw, 16px)', color: 'var(--blue)' }}>
                  {t('harvestingAreas')}
                </div>
                <div className="font-sans" style={{ fontSize: 'clamp(12px, 0.95vw, 14px)', color: 'var(--text-secondary)' }}>
                  {numberLabel(water.areaM2)} m² {t('catchmentAreaLabel')}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-display font-bold" style={{ fontSize: 'clamp(15px, 1.3vw, 18px)', color: 'var(--text-primary)', lineHeight: 1 }}>{numberLabel(water.estVolumeKL)}</div>
                <div className="font-sans" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>kL est.</div>
              </div>
            </div>
            {water.features && water.features.some((f) => f.name) && (
              <div className="px-3.5 pb-2.5 space-y-1">
                {water.features.map((f, i) => (f.name ? (
                  <div key={i} className="flex items-center gap-2 font-sans" style={{ fontSize: 'clamp(12px, 0.95vw, 14px)', color: 'var(--text-secondary)' }}>
                    <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#235E86', opacity: 0.6 }} />
                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{f.name}</span>
                    {f.category && <span style={{ color: 'var(--text-secondary)' }}>{f.category}</span>}
                    <span className="ml-auto" style={{ color: 'var(--text-secondary)' }}>{numberLabel(f.estVolumeKL)} kL</span>
                  </div>
                ) : null))}
              </div>
            )}
          </div>
          </div>
        </div>

        {/* Stats ledger — mirrors DataPanel Overview */}
        <div style={{ background: 'var(--bg-1)', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div className="flex items-center gap-3 px-4" style={{ height: 46, borderBottom: '1px solid var(--border)' }}>
            <Droplets size={18} style={{ color: 'var(--blue)', flexShrink: 0 }} />
            <span className="flex-1 font-sans font-medium" style={{ fontSize: 'clamp(12px, 1vw, 14px)', color: 'var(--text-secondary)' }}>{t('statAnnualRainfall')}</span>
            <span className="font-display font-semibold" style={{ fontSize: 'clamp(14px, 1.15vw, 16px)', color: 'var(--text-primary)' }}>
              {data.rainfall.annual}<span className="font-sans font-medium" style={{ fontSize: 12, color: 'var(--text-secondary)' }}> mm</span>
            </span>
          </div>
          <div className="flex items-center gap-3 px-4" style={{ height: 46, borderBottom: '1px solid var(--border)' }}>
            <Layers size={16} style={{ color: 'var(--gold-dim)', flexShrink: 0 }} />
            <span className="flex-1 font-sans font-medium" style={{ fontSize: 'clamp(12px, 1vw, 14px)', color: 'var(--text-secondary)' }}>{t('statSoilTexture')}</span>
            <span className="font-display font-semibold" style={{ fontSize: 'clamp(14px, 1.15vw, 16px)', color: 'var(--text-primary)' }}>
              {data.soil.textureClass}
            </span>
          </div>
          <div className="flex items-center gap-3 px-4" style={{ height: 46, borderBottom: '1px solid var(--border)' }}>
            <Snowflake size={16} style={{ color: 'var(--blue)', flexShrink: 0 }} />
            <span className="flex-1 font-sans font-medium" style={{ fontSize: 'clamp(12px, 1vw, 14px)', color: 'var(--text-secondary)' }}>{t('statFrostRisk')}</span>
            <span className="font-display font-semibold" style={{ fontSize: 'clamp(14px, 1.15vw, 16px)', color: data.climate.minTemp < 2 ? 'var(--blue)' : 'var(--text-primary)' }}>
              {frostLabel}
            </span>
          </div>
          <div className="flex items-center gap-3 px-4" style={{ height: 46 }}>
            <Mountain size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
            <span className="flex-1 font-sans font-medium" style={{ fontSize: 'clamp(12px, 1vw, 14px)', color: 'var(--text-secondary)' }}>{t('statElevation')}</span>
            <span className="font-display font-semibold" style={{ fontSize: 'clamp(14px, 1.15vw, 16px)', color: 'var(--text-primary)' }}>
              {data.elevation.elevation}<span className="font-sans font-medium" style={{ fontSize: 12, color: 'var(--text-secondary)' }}> m</span>
            </span>
          </div>
        </div>

        <div className={workspace.twoColumns}>
          {/* Key species */}
          <Card>
            <Label>{t('cardKeySpecies')}</Label>
            <div className="flex flex-wrap gap-1.5">
              {data.biome.keySpecies.slice(0, 6).map((s) => (
                <span
                  key={s}
                  className="px-2.5 py-1 rounded-full font-display"
                  // dark-07: these were a fixed forest-green text/fill in every theme, which read
                  // as near-invisible dark blobs on the near-black dark-mode card. Tokens (same
                  // ones DataPanel.tsx's own species chips use) follow each theme's own swing.
                  style={{ fontSize: 'clamp(13px, 1vw, 15px)', background: 'var(--badge-bg)', border: '1px solid var(--border)', color: 'var(--color-forest-800)' }}
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
                <div key={i} className="flex gap-2 font-display leading-relaxed" style={{ fontSize: 'clamp(13px, 1vw, 15px)', color: 'var(--text-primary)' }}>
                  <span className="flex-shrink-0 mt-0.5 flex items-center" style={{ color: '#9A6018' }}><AlertTriangle size={12} /></span>
                  {c}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
