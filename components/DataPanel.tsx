'use client';

import { useState, useEffect } from 'react';
import type { LocationData, SiteData, WaterData } from '@/lib/types';
import RainfallChart from './RainfallChart';
import { savePlace, generateId } from '@/lib/saved-places';
import { loadReports, deleteReport, type SavedReport } from '@/lib/saved-reports';
import InsightsPanel from './InsightsPanel';
import AreaPanel from './AreaPanel';
import PhotoUpload from './PhotoUpload';
import SiteDesign from './SiteDesign';
import SavedPlaces from './SavedPlaces';
import MyRecords from './MyRecords';
import ChatPanel from './ChatPanel';
import { useLanguage } from '@/lib/i18n';
import { MapPin, MessageCircle, Droplets, Layers, Sun, Ruler, Camera, Compass, Sparkles, Bookmark, FileText, Wheat, Sprout, Leaf, AlertTriangle, Trash2 } from 'lucide-react';

interface Props {
  data: LocationData | null;
  loading: boolean;
  coords: { lat: number; lon: number } | null;
  mapCapture?: string | null;
  siteData?: SiteData | null;
  waterData?: WaterData | null;
  forcedTab?: string | null;
  onTabChange?: () => void;
  onOpenReport: (analysis?: string) => void;
  onJumpTo: (lat: number, lon: number) => void;
  onViewReport?: (r: SavedReport) => void;
  appLang?: string;
}

const TABS = ['Overview', 'Ask', 'Water', 'Soil', 'Climate', 'Area', 'Photos', 'Design', 'AI', 'Places', 'Reports', 'Farm'] as const;
type Tab = typeof TABS[number];

const BIOME_COLORS: Record<string, string> = {
  SV: '#8B9D5E', GR: '#6BA84F', FY: '#C8974A', SK: '#D07850',
  NK: '#B89040', DE: '#C8A842', AT: '#5A8B4A', IOCB: '#3A9A7A', FOR: '#2D7A5C',
};

// Permaculture context per SA biome — design principles, zone guidance, water strategy
const PERMA_CONTEXT: Record<string, { type: string; principles: string[]; water: string; zones: string }> = {
  GR: {
    type: 'Seasonal grassland / savanna analogue',
    principles: ['Build swales on contour before summer rains', 'Pioneer legumes to accelerate succession', 'Integrate livestock for soil fertility and grass management'],
    water: 'Summer thunderstorm — earthworks built in winter, planted before first rains (Aug–Sep)',
    zones: 'Z1–2: intensive beds with windbreaks · Z3: food forest with indigenous trees · Z4–5: managed grassland',
  },
  SV: {
    type: 'Fire-climax savanna — browse-adapted system',
    principles: ['Firebreaks as productive edges (aloes, agave, succulents)', 'Multipurpose indigenous trees for shade, fodder, fruit', 'All earthworks before wet season; mulch heavily in dry months'],
    water: 'Strong seasonality — brief intense storms; design for rapid capture and slow release',
    zones: 'Z1: intensive garden near water · Z2–3: food forest with savanna-edge species · Z4: rotational grazing + timber',
  },
  FY: {
    type: 'Mediterranean shrubland — fire-adapted, winter rainfall',
    principles: ['Plant in autumn (Apr–May) not spring — rains follow planting', 'Fire-proof design: green belts, diverse species, no litter build-up', 'Fynbos soils are phosphorus-poor — avoid high-P compost; use leaf mulch only'],
    water: 'Winter rainfall — harvest winter storms; long summer drought means passive conservation (mulch, shade) is critical',
    zones: 'Z1–2: imported-soil beds (fynbos soil is challenging) · Z3–4: indigenous food forest (rooibos, buchu, wild figs, honeybush)',
  },
  SK: {
    type: 'Semi-arid succulent scrub — drought-tolerance design',
    principles: ['Every drop counts — channel all surfaces to productive soil', 'Succulents as living mulch and frost/wind barriers', 'Animals critical for nutrient cycling where biomass is low'],
    water: 'Bimodal or erratic rain — all-year water capture needed; check-dams and subsurface cisterns most effective',
    zones: 'Z1–2: very compact (water efficiency) · Z3: spekboom food forest (drought-proof, carbon-rich) · Z4–5: succulent rangeland',
  },
  NK: {
    type: 'Karoo shrubland — semi-arid, unpredictable',
    principles: ['Deep-rooted perennials over annuals — they survive drought gaps', 'Holistic planned grazing to restore karoo bush', 'Intensive production close to house; extensive low-impact use beyond'],
    water: 'Unpredictable year-round rain — design for drought resilience first; opportunistic planting when rain arrives',
    zones: 'Z1: drip-irrigated garden · Z2: food trees with deep root basins · Z3–5: karoo bush management and restoration',
  },
  DE: {
    type: 'Desert oasis design — extreme scarcity',
    principles: ['Underground cisterns for every rain event', 'Shade-first design — windbreaks and shade cloth protect soil and crops', 'All bare soil mulched to 10cm+ depth; no exposed soil ever'],
    water: 'Every cm of rain is precious — fog collectors, condensation traps, check-dams maximise capture',
    zones: 'Z1 only (intensive near water) · Everything else is passive wilderness management',
  },
  AT: {
    type: 'Subtropical thicket — dense browse system',
    principles: ['Spekboom (Portulacaria afra) is the keystone species — food, carbon, water storage', 'Dense multi-layer planting is the natural state — mimic it', 'Goats integrate naturally (as in wild thicket) — managed browsing'],
    water: 'Variable rain — spekboom stores water in its leaves; thicket density shades and protects soil',
    zones: 'Z1–2: irrigated garden · Z2–3: spekboom food forest · Z4–5: restore thicket (major carbon sequestration opportunity)',
  },
  IOCB: {
    type: 'Subtropical coast — high-productivity tropical analogue',
    principles: ['Year-round growing — stagger plantings weekly for continuous harvest', 'High humidity = fungal risk; good spacing and airflow essential', 'Tropical food forest layers (banana, pawpaw, avocado, moringa) are highly productive'],
    water: 'Summer rainfall reliable — still harvest for dry spells; humidity reduces irrigation need significantly',
    zones: 'Full 5-zone design possible · Z1–2: tropical kitchen garden · Z3: dense food forest · Z4: timber and fodder · Z5: coastal forest remnants',
  },
  FOR: {
    type: 'Afro-temperate forest — shaded multi-layer system',
    principles: ['Shade-tolerant food plants under existing canopy (wild ginger, arum, wild garlic)', 'No-dig in root zones — forest soil structure is delicate and irreplaceable', 'The forest edge is the most productive zone — light + shelter combined'],
    water: 'Generally humid with high-quality water from leaf-litter filtration — protect water sources from any disturbance',
    zones: 'Z1–2: clearings and forest edges for intensive food · Z3: food trees in light shade · Z4–5: forest conservation (highest SA biodiversity value)',
  },
};

const TAB_ICONS: Record<string, JSX.Element> = {
  Overview: <MapPin size={16} />,
  Ask: <MessageCircle size={16} />,
  Water: <Droplets size={16} />,
  Soil: <Layers size={16} />,
  Climate: <Sun size={16} />,
  Area: <Ruler size={16} />,
  Photos: <Camera size={16} />,
  Design: <Compass size={16} />,
  AI: <Sparkles size={16} />,
  Places: <Bookmark size={16} />,
  Reports: <FileText size={16} />,
  Farm: <Wheat size={16} />,
};

function Card({ children, className = '', accent }: { children: React.ReactNode; className?: string; accent?: string }) {
  return (
    <div
      className={`rounded-xl transition-all duration-200 ${className}`}
      style={{
        backgroundColor: '#FBF6EC',
        border: '1px solid #E2D8C4',
        borderRadius: 12,
        padding: 16,
        ...(accent ? { borderLeftWidth: 2, borderLeftColor: accent, borderLeftStyle: 'solid' } : {}),
      }}
    >
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-mono mb-1.5 uppercase tracking-wider" style={{ color: '#5C5040', fontFamily: 'var(--font-mono)' }}>
      {children}
    </div>
  );
}

function Stat({ label, value, sub, color, contextPct }: { label: string; value: string; sub?: string; color?: string; contextPct?: number }) {
  return (
    <Card>
      <Label>{label}</Label>
      <div
        className="font-display font-bold leading-none mt-1"
        style={{ fontSize: 29, color: color ?? '#20190F', letterSpacing: '-0.02em' }}
      >
        {value}
      </div>
      {contextPct !== undefined && (
        <div style={{ height: 3, background: 'rgba(226,216,196,0.6)', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${Math.min(100, Math.max(4, contextPct))}%`,
            background: color ?? '#1F4D2B',
            borderRadius: 2,
            transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
          }} />
        </div>
      )}
      {sub && <div className="text-xs mt-1.5 font-mono" style={{ color: '#5C5040' }}>{sub}</div>}
    </Card>
  );
}

/* ── Empty state ──────────────────────────────────── */
function EmptyState() {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col h-full">
      {/* Hero area */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-8 text-center"
        style={{ minHeight: 0 }}
      >
        {/* Glow orb behind icon */}
        <div className="relative mb-6">
          <div
            className="absolute inset-0 rounded-full blur-2xl opacity-30"
            style={{ background: 'radial-gradient(circle, rgba(31,77,43,0.2), transparent 70%)', transform: 'scale(2.5)' }}
          />
          <div
            className="relative w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(31,77,43,0.2), rgba(31,77,43,0.05))',
              border: '1px solid rgba(31,77,43,0.35)',
              boxShadow: '0 8px 32px rgba(31,77,43,0.2), inset 0 1px 0 rgba(255,255,255,0.06)',
            }}
          >
            <Sprout size={32} style={{ color: '#1F4D2B' }} />
          </div>
        </div>

        <h1
          className="font-display font-bold text-3xl leading-tight text-gradient mb-2"
          style={{ letterSpacing: '-0.03em' }}
        >
          ImbewuField
        </h1>
        <p className="font-display text-sm leading-relaxed mb-8" style={{ color: '#5C5040', maxWidth: 260 }}>
          {t('heroSub')}
        </p>

        {/* Pulse click hint */}
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-full text-sm mb-10"
          style={{
            background: 'rgba(31,77,43,0.2)',
            border: '1px solid rgba(31,77,43,0.2)',
            color: '#1F4D2B',
          }}
        >
          <span className="relative flex h-2 w-2">
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ background: '#1F4D2B' }}
            />
            <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: '#1F4D2B' }} />
          </span>
          <span className="font-display font-medium">{t('clickAnalyse')}</span>
        </div>

      </div>
    </div>
  );
}

/* ── Loading skeleton ─────────────────────────────── */
function Skeleton() {
  return (
    <div className="p-5 space-y-3">
      <div className="h-6 w-40 rounded-lg animate-pulse" style={{ background: 'rgba(226,216,196,0.5)' }} />
      <div className="h-3 w-56 rounded animate-pulse" style={{ background: 'rgba(226,216,196,0.5)' }} />
      <div className="grid grid-cols-2 gap-2 mt-4">
        {[1,2,3,4].map(i => (
          <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: 'rgba(226,216,196,0.5)', animationDelay: `${i*80}ms` }} />
        ))}
      </div>
      <div className="h-28 rounded-xl animate-pulse mt-2" style={{ background: 'rgba(226,216,196,0.5)' }} />
    </div>
  );
}

/* ── Main component ───────────────────────────────── */
export default function DataPanel({ data, loading, coords, mapCapture, siteData, waterData, forcedTab, onTabChange, onOpenReport, onJumpTo, onViewReport, appLang }: Props) {
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  useEffect(() => {
    const refresh = () => setSavedReports(loadReports());
    refresh();
    window.addEventListener('imbewu-reports-changed', refresh);
    return () => window.removeEventListener('imbewu-reports-changed', refresh);
  }, []);
  const [tab, setTab] = useState<Tab>('Overview');
  const [photoAnalysis, setPhotoAnalysis] = useState<string | undefined>();
  const [placeSaved, setPlaceSaved] = useState(false);
  useEffect(() => { setPlaceSaved(false); }, [coords]);

  // One-tap save of the current location (prominent, vs the Places tab form).
  const quickSavePlace = () => {
    if (!data || !coords) return;
    const name = data.biome.name !== 'Outside South Africa'
      ? `${data.biome.name} site`
      : `${Math.abs(coords.lat).toFixed(3)}°S ${coords.lon.toFixed(3)}°E`;
    savePlace({
      id: generateId(), name,
      lat: coords.lat, lon: coords.lon,
      biome: data.biome.name,
      rainfall: data.rainfall.annual,
      elevation: data.elevation.elevation,
      savedAt: new Date().toISOString(),
    });
    setPlaceSaved(true);
  };

  useEffect(() => {
    if (forcedTab && TABS.includes(forcedTab as Tab)) {
      setTab(forcedTab as Tab);
      onTabChange?.();
    }
  }, [forcedTab, onTabChange]);

  if (!data && !loading) return <EmptyState />;
  if (loading && !data) return <Skeleton />;
  if (!data) return null;

  const bColor = BIOME_COLORS[data.biome.code] ?? '#6BA84F';

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* ── Biome header ──────────────────────────── */}
      <div
        className="flex-shrink-0 px-5 pt-5 pb-4"
        style={{ borderBottom: '1px solid #E2D8C4' }}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${bColor}28, ${bColor}10)`,
              border: `1px solid ${bColor}44`,
              boxShadow: `0 4px 16px ${bColor}18`,
            }}
          >
            <Sprout size={20} style={{ color: bColor }} />
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="font-display font-bold text-base leading-tight mb-0.5"
              style={{ color: bColor }}
            >
              {data.biome.name}
            </div>
            <div className="text-xs leading-snug truncate" style={{ color: '#5C5040', fontFamily: 'var(--font-display)' }}>
              {data.biome.description}
            </div>
            {data.vegetation && (
              <div className="text-xs mt-1 leading-snug font-display flex items-center gap-1" style={{ color: bColor, opacity: 0.95 }}
                   title={`SANBI 2018 vegetation unit · ${data.vegetation.bioregion}`}>
                <Leaf size={12} /> {data.vegetation.vegUnit}
              </div>
            )}
            <div className="text-xs mt-1 font-mono" style={{ color: '#5C5040', opacity: 0.7 }}>
              {Math.abs(data.lat).toFixed(4)}°S &nbsp;{data.lon.toFixed(4)}°E
            </div>
          </div>
        </div>
      </div>

      {/* ── Save + Report buttons ─────────────────────── */}
      <div className="flex-shrink-0 px-4 py-2 flex gap-2" style={{ borderBottom: '1px solid #E2D8C4', background: '#F7F2E9' }}>
        <button
          onClick={quickSavePlace}
          disabled={placeSaved}
          className="flex-shrink-0 py-2 px-3 rounded-xl text-xs font-display font-semibold flex items-center justify-center gap-1.5 transition-all"
          style={placeSaved
            ? { background: 'rgba(31,77,43,0.1)', border: '1px solid rgba(31,77,43,0.3)', color: '#5C5040' }
            : { background: 'rgba(31,77,43,0.1)', border: '1px solid rgba(31,77,43,0.3)', color: '#1F4D2B' }}
          title="Save this place"
        >
          {placeSaved ? '✓ Saved' : <><Bookmark size={13} /> Save</>}
        </button>
        <button
          onClick={() => onOpenReport(photoAnalysis)}
          className="flex-1 py-2 rounded-xl text-xs font-display font-semibold flex flex-wrap items-center justify-center gap-1.5 md:gap-2 transition-all"
          style={{
            background: 'rgba(192,122,30,0.12)',
            border: '1px solid rgba(192,122,30,0.3)',
            color: '#C07A1E',
          }}
        >
          <FileText size={14} />
          Generate Full Report
          {siteData && <span className="px-1.5 py-0.5 rounded-md font-mono" style={{ background: 'rgba(31,77,43,0.1)', color: '#1F4D2B', fontSize: 11 }}>{siteData.areaHa} ha</span>}
          {waterData && <span className="px-1.5 py-0.5 rounded-md font-mono flex items-center gap-0.5" style={{ background: 'rgba(35,94,134,0.12)', color: '#235E86', fontSize: 11 }}><Droplets size={11} /> {waterData.estVolumeKL.toLocaleString()} kL</span>}
          {photoAnalysis && <span className="px-1.5 py-0.5 rounded-md font-mono flex items-center gap-0.5" style={{ background: 'rgba(35,94,134,0.12)', color: '#235E86', fontSize: 11 }}><Camera size={11} /></span>}
          <span style={{ opacity: 0.6 }}>→</span>
        </button>
      </div>

      {/* ── Tabs (wrap so all are always visible) ──── */}
      <div
        className="flex-shrink-0"
        style={{ borderBottom: '1px solid #E2D8C4', background: '#FBF6EC' }}
      >
        <div
          className="flex overflow-x-auto"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex items-center gap-1.5 flex-shrink-0 transition-all duration-150"
              style={{
                padding: '10px 14px',
                borderBottom: tab === t ? '2px solid #C07A1E' : '2px solid transparent',
                borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                background: 'transparent',
                color: tab === t ? '#C07A1E' : '#5C5040',
                fontSize: 13,
                fontFamily: 'var(--font-display)',
                fontWeight: tab === t ? 600 : 400,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center' }}>{TAB_ICONS[t]}</span>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ───────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3"
        style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>

        {/* OVERVIEW */}
        {tab === 'Overview' && (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              <Stat label="Elevation" value={`${data.elevation.elevation}m`} sub="above sea level"
                contextPct={Math.min(100, (data.elevation.elevation / 2800) * 100)} />
              <Stat label="Annual Rain" value={`${data.rainfall.annual}mm`} sub={data.rainfall.pattern} color="#235E86"
                contextPct={Math.min(100, (data.rainfall.annual / 1400) * 100)} />
              <Stat
                label="Slope / Aspect"
                value={`${data.elevation.slopeDeg}°`}
                sub={`${data.elevation.slopePct}% · ${data.elevation.aspectLabel}-facing`}
                color={data.elevation.slopeDeg > 8 ? '#D4922A' : undefined}
                contextPct={Math.min(100, (data.elevation.slopeDeg / 30) * 100)}
              />
              <Stat label="Mean Temp" value={`${data.climate.meanTemp}°C`} sub={`${data.climate.minTemp}–${data.climate.maxTemp}°C range`}
                contextPct={Math.min(100, ((data.climate.meanTemp - 6) / 24) * 100)} />
            </div>

            <Card>
              <Label>Key species</Label>
              <div className="flex flex-wrap gap-1.5">
                {data.biome.keySpecies.slice(0, 6).map((s) => (
                  <span
                    key={s}
                    className="px-2 py-0.5 rounded-full text-xs font-display"
                    style={{
                      background: 'rgba(31,77,43,0.1)',
                      border: '1px solid rgba(31,77,43,0.2)',
                      color: '#1F4D2B',
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </Card>

            <Card>
              <Label>Main challenges</Label>
              <div className="space-y-1.5">
                {data.biome.challenges.slice(0, 4).map((c, i) => (
                  <div key={i} className="flex gap-2 text-xs font-display leading-relaxed" style={{ color: '#20190F' }}>
                    <span className="flex-shrink-0 mt-0.5 flex items-center" style={{ color: '#D4922A' }}><AlertTriangle size={12} /></span>
                    {c}
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}

        {/* WATER */}
        {tab === 'Water' && (
          <>
            <Card>
              <RainfallChart rainfall={data.rainfall} />
            </Card>
            <div className="grid grid-cols-2 gap-2.5">
              <Stat label="Solar" value={`${data.climate.solarRadiation} kWh`} sub="m²/day avg" color="#C07A1E" />
              <Stat label="ETo est." value={`${(data.climate.solarRadiation * 1.1).toFixed(1)}mm`} sub="evapotransp/day" color="#D4922A" />
            </div>
            <Card>
              <Label>Water harvesting strategy</Label>
              <p className="text-xs font-display leading-relaxed" style={{ color: '#20190F' }}>
                {data.biome.waterStrategy}
              </p>
            </Card>
          </>
        )}

        {/* SOIL */}
        {tab === 'Soil' && (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              <Stat label="Texture" value={data.soil.textureClass} />
              <Stat
                label="pH"
                value={data.soil.ph.toString()}
                sub={data.soil.ph < 5.5 ? 'Acidic — add lime' : data.soil.ph > 7.5 ? 'Alkaline — add sulphur' : 'Near-neutral ✓'}
                color={data.soil.ph < 5.5 || data.soil.ph > 7.5 ? '#D4922A' : '#2D6B3C'}
              />
              <Stat
                label="Organic Carbon"
                value={`${data.soil.organicCarbon}%`}
                sub={data.soil.organicCarbon < 1.5 ? 'Low — target 2–3%' : 'Acceptable'}
                color={data.soil.organicCarbon < 1.5 ? '#D4922A' : '#1F4D2B'}
              />
              <Stat label="Bulk Density" value={`${data.soil.bulkDensity} g/cm³`} sub={data.soil.bulkDensity > 1.4 ? 'Compacted' : 'OK'} />
            </div>
            <Card>
              <Label>Texture composition</Label>
              <div className="space-y-2.5">
                {[
                  { name: 'Sand', pct: data.soil.sand, color: '#C07A1E' },
                  { name: 'Silt', pct: data.soil.silt, color: '#1F4D2B' },
                  { name: 'Clay', pct: data.soil.clay, color: '#2D6B3C' },
                ].map(({ name, pct, color }) => (
                  <div key={name}>
                    <div className="flex justify-between text-xs font-mono mb-1" style={{ color: '#5C5040' }}>
                      <span>{name}</span>
                      <span style={{ color }}>{pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(226,216,196,0.6)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: color, opacity: 0.8 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <Label>Soil strategy</Label>
              <p className="text-xs font-display leading-relaxed" style={{ color: '#20190F' }}>
                {data.biome.soilStrategy}
              </p>
            </Card>
          </>
        )}

        {/* CLIMATE */}
        {tab === 'Climate' && (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              <Stat label="Köppen" value={data.climate.koppen} sub={data.climate.koppenDesc} color="#C07A1E" />
              <Stat label="Solar" value={`${data.climate.solarRadiation}`} sub="kWh/m²/day" color="#C07A1E" />
              <Stat label="Summer max" value={`${data.climate.maxTemp}°C`} />
              <Stat label="Winter min" value={`${data.climate.minTemp}°C`} sub={data.climate.minTemp < 2 ? '⚠ Frost likely' : 'Frost-free'} color={data.climate.minTemp < 2 ? '#235E86' : undefined} />
            </div>
            <Card>
              <Label>Monthly temperature (°C)</Label>
              <div className="flex items-end gap-1 h-14 mt-2">
                {data.climate.monthlyTemp.map((t, i) => {
                  const range = data.climate.maxTemp - data.climate.minTemp + 0.01;
                  const norm = (t - data.climate.minTemp) / range;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full rounded-sm transition-all"
                        style={{
                          height: `${Math.max(6, norm * 48)}px`,
                          background: `linear-gradient(to top, hsl(${25 + norm * 35}, 70%, ${28 + norm * 22}%), hsl(${30 + norm * 30}, 60%, ${35 + norm * 18}%))`,
                        }}
                      />
                      <span style={{ fontSize: 9, color: '#5C5040', fontFamily: 'var(--font-mono)' }}>
                        {['J','F','M','A','M','J','J','A','S','O','N','D'][i]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
            <Card>
              <Label>Rainfall timing</Label>
              <p className="text-sm font-display font-medium capitalize mb-1" style={{ color: '#20190F' }}>
                {data.rainfall.pattern} rainfall
              </p>
              <p className="text-xs font-display" style={{ color: '#5C5040' }}>
                Wet: {data.rainfall.wetSeason} &nbsp;·&nbsp; Dry: {data.rainfall.drySeason}
              </p>
              <p className="text-xs font-mono mt-2" style={{ color: '#5C5040' }}>
                → Earthworks before first rains: {data.biome.rainfallPattern === 'winter' ? 'Apr–May' : 'Aug–Sep'}
              </p>
            </Card>
          </>
        )}

        {/* PHOTOS */}
        {tab === 'Photos' && (
          <PhotoUpload
            locationData={data}
            mapCapture={mapCapture}
            onAnalysisComplete={(analysis) => setPhotoAnalysis(analysis)}
          />
        )}

        {/* DESIGN */}
        {tab === 'Design' && (
          <SiteDesign locationData={data} photoAnalysis={photoAnalysis} appLang={appLang} />
        )}

        {/* AI */}
        {tab === 'Area' && <AreaPanel coords={coords} />}

        {tab === 'AI' && <InsightsPanel locationData={data} />}

        {/* ASK — site-aware permaculture / organic / finance chat assistant */}
        {tab === 'Ask' && <ChatPanel locationData={data} siteData={siteData} waterData={waterData} appLang={appLang} />}

        {/* PLACES */}
        {tab === 'Places' && (
          <SavedPlaces
            locationData={data}
            coords={coords}
            onJumpTo={onJumpTo}
          />
        )}

        {/* REPORTS — saved permaculture reports, reopen without regenerating */}
        {tab === 'Reports' && (
          <div className="space-y-3">
            <div className="text-xs font-mono uppercase tracking-wider" style={{ color: '#5C5040' }}>
              Saved Reports
            </div>
            {savedReports.length === 0 ? (
              <div className="rounded-xl p-4 text-sm" style={{ background: 'rgba(226,216,196,0.3)', border: '1px solid #E2D8C4', color: '#5C5040' }}>
                No saved reports yet. Open <span style={{ color: '#C07A1E' }}>Generate Full Report</span>, then tap <span style={{ color: '#1F4D2B' }}>Save report</span> to keep it here.
              </div>
            ) : (
              savedReports.map((r) => (
                <div key={r.id} className="rounded-xl p-3 flex items-center gap-2" style={{ background: '#FBF6EC', border: '1px solid #E2D8C4' }}>
                  <button onClick={() => onViewReport?.(r)} className="flex-1 min-w-0 text-left">
                    <div className="text-sm font-display font-semibold truncate" style={{ color: '#20190F' }}>{r.name}</div>
                    <div className="text-xs font-mono" style={{ color: '#5C5040' }}>
                      {new Date(r.savedAt).toLocaleDateString()} · {Math.abs(r.location.lat).toFixed(3)}°S {r.location.lon.toFixed(3)}°E
                    </div>
                  </button>
                  <button onClick={() => onViewReport?.(r)} className="px-3 py-1.5 rounded-lg text-xs font-display font-semibold flex-shrink-0"
                    style={{ background: 'rgba(31,77,43,0.1)', border: '1px solid rgba(31,77,43,0.3)', color: '#1F4D2B' }}>
                    Open
                  </button>
                  <button onClick={() => deleteReport(r.id)} title="Delete" className="px-2 py-1.5 flex-shrink-0 flex items-center" style={{ color: '#5C5040' }}><Trash2 size={14} /></button>
                </div>
              ))
            )}
          </div>
        )}

        {/* FARM — the farmer's own production & sales records */}
        {tab === 'Farm' && <MyRecords />}
      </div>
    </div>
  );
}
