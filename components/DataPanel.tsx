'use client';

import { useState, useEffect, useRef } from 'react';
import { loadSurvey, type SiteSurvey } from '@/lib/site-survey';
import SiteSurveySheet from './SiteSurveySheet';
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
import LifeGuide from './LifeGuide';
import WaterBalance from './WaterBalance';
import { useLanguage } from '@/lib/i18n';
import { MapPin, MessageCircle, Droplets, Layers, Sun, Ruler, Camera, Compass, Sparkles, Bookmark, FileText, Wheat, Sprout, Leaf, TreeDeciduous, AlertTriangle, Trash2, Snowflake, Mountain, Loader2 } from 'lucide-react';

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
  placeName?: string | null;
  activePlaceId?: string;
}

const TABS = ['Overview', 'Ask', 'Water', 'Soil', 'Climate', 'Nature', 'Area', 'Photos', 'Design', 'AI', 'Places', 'Reports', 'Farm'] as const;
type Tab = typeof TABS[number];
// Farm and Reports live on the home screen quick actions and are reached via
// deep link (/farmer?panel=Farm). Keep them in TABS so the panel still renders,
// but hide them from the scrollable tab strip to reduce clutter.
const VISIBLE_TABS = TABS.filter((t) => t !== 'Farm' && t !== 'Reports');

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
  Nature: <TreeDeciduous size={16} />,
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
    <div className="text-xs font-mono mb-1.5 uppercase tracking-wider" style={{ color: '#5C5040' }}>
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
        style={{ fontSize: 21, color: color ?? '#20190F', letterSpacing: '-0.02em' }}
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
          className="font-display font-bold leading-tight text-gradient mb-2"
          style={{ fontSize: 'clamp(24px, 2.2vw, 28px)', letterSpacing: '-0.03em' }}
        >
          ImbewuField
        </h1>
        <p className="font-sans leading-relaxed mb-8" style={{ fontSize: 14, color: '#5C5040', maxWidth: 272 }}>
          {t('heroSub')}
        </p>

        {/* Pulse click hint */}
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-full text-xs mb-10"
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
export default function DataPanel({ data, loading, coords, mapCapture, siteData, waterData, forcedTab, onTabChange, onOpenReport, onJumpTo, onViewReport, appLang, placeName, activePlaceId }: Props) {
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  useEffect(() => {
    const refresh = () => setSavedReports(loadReports());
    refresh();
    window.addEventListener('imbewu-reports-changed', refresh);
    return () => window.removeEventListener('imbewu-reports-changed', refresh);
  }, []);
  const [tab, setTab] = useState<Tab>('Overview');
  const [survey, setSurvey] = useState<SiteSurvey | null>(null);
  useEffect(() => { setSurvey(activePlaceId ? loadSurvey(activePlaceId) : null); }, [activePlaceId]);
  const [surveyPromptOpen, setSurveyPromptOpen] = useState(false);
  const [surveySheetOpen, setSurveySheetOpen] = useState(false);
  const [photoAnalysis, setPhotoAnalysis] = useState<string | undefined>();

  // Photo prompt (pre-report interstitial)
  const [photoPromptOpen, setPhotoPromptOpen] = useState(false);
  const [promptPreviews, setPromptPreviews] = useState<string[]>([]);
  const [promptImageData, setPromptImageData] = useState<Array<{ data: string; mediaType: string }>>([]);
  const [promptLoading, setPromptLoading] = useState(false);
  const promptInputRef = useRef<HTMLInputElement>(null);

  async function resizeForPrompt(file: File): Promise<{ data: string; mediaType: string }> {
    return new Promise((resolve) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target!.result as string;
        img.onload = () => {
          const ratio = Math.min(1120 / img.width, 1120 / img.height, 1);
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * ratio);
          canvas.height = Math.round(img.height * ratio);
          canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve({ data: canvas.toDataURL('image/jpeg', 0.82).split(',')[1], mediaType: 'image/jpeg' });
        };
      };
      reader.readAsDataURL(file);
    });
  }

  async function handlePromptFiles(files: FileList | null) {
    if (!files?.length) return;
    const valid = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, 6);
    const resized = await Promise.all(valid.map(resizeForPrompt));
    setPromptPreviews(prev => [...prev, ...valid.map(f => URL.createObjectURL(f))].slice(0, 6));
    setPromptImageData(prev => [...prev, ...resized].slice(0, 6));
  }

  async function analyseAndGenerate() {
    if (!promptImageData.length || !data) return;
    setPromptLoading(true);
    try {
      const res = await fetch('/api/analyse-photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: promptImageData, locationData: data, source: 'upload' }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let text = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += dec.decode(value, { stream: true });
      }
      const analysis = text.trim() ? text : undefined;
      if (analysis) setPhotoAnalysis(analysis);
      setPhotoPromptOpen(false);
      onOpenReport(analysis ?? photoAnalysis);
    } catch {
      setPhotoPromptOpen(false);
      onOpenReport(photoAnalysis);
    } finally {
      setPromptLoading(false);
    }
  }

  function openPhotoOrReport() {
    if (!photoAnalysis) {
      setPhotoPromptOpen(true);
    } else {
      onOpenReport(photoAnalysis);
    }
  }

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

  // Suitability badge — quick heuristic from rainfall + slope
  const suitability = (() => {
    const r = data.rainfall.annual;
    const s = data.elevation.slopeDeg;
    if (r >= 500 && s < 15) return { label: 'Good fit', bg: '#E7F0E0', border: '#BCD6B0', dot: '#1F4D2B', text: '#1F4D2B' };
    if (r >= 300 && s < 25) return { label: 'Fair site', bg: 'rgba(192,122,30,0.1)', border: 'rgba(192,122,30,0.3)', dot: '#C07A1E', text: '#9A6018' };
    return { label: 'Challenging', bg: 'rgba(212,110,66,0.1)', border: 'rgba(212,110,66,0.3)', dot: '#D4922A', text: '#B83A18' };
  })();

  // Frost label
  const frostLabel = data.climate.minTemp < 2 ? 'Likely' : data.climate.minTemp < 5 ? 'Occasional' : 'Rare';

  // Lima contextual read — one-line from actual data
  const limaRead = (() => {
    const r = data.rainfall.annual;
    const soil = data.soil.textureClass.toLowerCase();
    const crops = data.biome.keySpecies.slice(0, 2).join(' and ');
    const waterNote = r < 400 ? `Only ${r}mm of rain so water harvesting is essential.` : `${r}mm of rain — enough for year-round production.`;
    const frostNote = data.climate.minTemp < 2 ? ' Protect against frost in winter.' : '';
    return `${waterNote} This ${soil} soil works well for ${crops || 'food trees and vegetables'}.${frostNote} Want a full planting plan?`;
  })();

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* ── Site report header (Screen 3 design) ─── */}
      <div className="flex-shrink-0 px-5 pt-3 pb-4" style={{ borderBottom: '1px solid #E2D8C4' }}>
        {/* Overline */}
        <div className="font-sans font-bold uppercase mb-2" style={{ fontSize: 11, color: '#C07A1E', letterSpacing: '0.16em' }}>
          Site report
        </div>

        {/* Name + suitability badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {placeName ? (
              <>
                <div className="font-display font-semibold leading-tight" style={{ fontSize: 16, color: '#20190F', letterSpacing: '-0.01em' }}>
                  {placeName}
                </div>
                <div className="font-sans mt-0.5 truncate" style={{ fontSize: 11.5, color: '#5C5040' }}>
                  {data.biome.name}
                </div>
              </>
            ) : (
              <div className="font-display font-semibold leading-tight" style={{ fontSize: 15, color: '#20190F', letterSpacing: '-0.01em' }}>
                {data.biome.name}
              </div>
            )}
            {data.vegetation && (
              <div className="font-sans mt-0.5 truncate" style={{ fontSize: 12, color: placeName ? '#94876F' : '#5C5040' }}>
                {data.vegetation.vegUnit}
              </div>
            )}
            <div className="font-mono mt-1" style={{ fontSize: 11, color: '#94876F' }}>
              {Math.abs(data.lat).toFixed(2)}°&thinsp;S,&ensp;{data.lon.toFixed(2)}°&thinsp;E
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg flex-shrink-0"
               style={{ background: suitability.bg, border: `1px solid ${suitability.border}` }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: suitability.dot, display: 'inline-block', flexShrink: 0 }} />
            <span className="font-sans font-bold" style={{ fontSize: 12, color: suitability.text, whiteSpace: 'nowrap' }}>
              {suitability.label}
            </span>
          </div>
        </div>
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
          {VISIBLE_TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex items-center gap-1.5 flex-shrink-0 transition-all duration-150"
              style={{
                padding: '9px 12px',
                borderBottom: tab === t ? '2px solid #C07A1E' : '2px solid transparent',
                borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                background: 'transparent',
                color: tab === t ? '#C07A1E' : '#5C5040',
                fontSize: 12.5,
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
            {/* Measured land / water — updates LIVE as a boundary is drawn or edited */}
            {(siteData || (waterData && waterData.count > 0)) && (
              <div className="space-y-2">
                {siteData && (
                  <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(31,77,43,0.06)', border: '1px solid rgba(31,77,43,0.22)' }}>
                    <div className="flex items-center gap-3 px-3.5 py-2.5">
                      <div className="flex items-center justify-center flex-shrink-0 rounded-xl" style={{ width: 32, height: 32, background: '#1F4D2B' }}>
                        <Sprout size={16} style={{ color: '#A8D88A' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-display font-semibold" style={{ fontSize: 13.5, color: '#1F4D2B' }}>
                          Your land{siteData.count && siteData.count > 1 ? ` · ${siteData.count} parcels` : ''}
                        </div>
                        <div className="font-sans" style={{ fontSize: 11.5, color: '#5C5040' }}>
                          {siteData.perimeterM >= 1000 ? `${(siteData.perimeterM / 1000).toFixed(2)} km` : `${siteData.perimeterM} m`} perimeter · {siteData.areaM2.toLocaleString()} m²
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-display font-bold" style={{ fontSize: 17, color: '#20190F', lineHeight: 1 }}>{siteData.areaHa}</div>
                        <div className="font-sans" style={{ fontSize: 11, color: '#94876F' }}>hectares</div>
                      </div>
                    </div>
                    {siteData.features && siteData.features.some(f => f.name) && (
                      <div className="px-3.5 pb-2.5 space-y-1">
                        {siteData.features.map((f, i) => f.name ? (
                          <div key={i} className="flex items-center gap-2 font-sans" style={{ fontSize: 11.5, color: '#5C5040' }}>
                            <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#1F4D2B', opacity: 0.6 }} />
                            <span className="font-medium" style={{ color: '#20190F' }}>{f.name}</span>
                            {f.category && <span style={{ color: '#94876F' }}>{f.category}</span>}
                            <span className="ml-auto" style={{ color: '#94876F' }}>{f.areaHa} ha</span>
                          </div>
                        ) : null)}
                      </div>
                    )}
                  </div>
                )}
                {waterData && waterData.count > 0 && (
                  <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(35,94,134,0.06)', border: '1px solid rgba(35,94,134,0.25)' }}>
                    <div className="flex items-center gap-3 px-3.5 py-2.5">
                      <div className="flex items-center justify-center flex-shrink-0 rounded-xl" style={{ width: 32, height: 32, background: '#235E86' }}>
                        <Droplets size={16} style={{ color: '#CFE6F5' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-display font-semibold" style={{ fontSize: 13.5, color: '#235E86' }}>
                          Harvesting areas{waterData.count > 1 ? ` · ${waterData.count}` : ''}
                        </div>
                        <div className="font-sans" style={{ fontSize: 11.5, color: '#5C5040' }}>
                          {waterData.areaM2.toLocaleString()} m² catchment area
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-display font-bold" style={{ fontSize: 17, color: '#20190F', lineHeight: 1 }}>{waterData.estVolumeKL.toLocaleString()}</div>
                        <div className="font-sans" style={{ fontSize: 11, color: '#94876F' }}>kL est.</div>
                      </div>
                    </div>
                    {waterData.features && waterData.features.some(f => f.name) && (
                      <div className="px-3.5 pb-2.5 space-y-1">
                        {waterData.features.map((f, i) => f.name ? (
                          <div key={i} className="flex items-center gap-2 font-sans" style={{ fontSize: 11.5, color: '#5C5040' }}>
                            <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#235E86', opacity: 0.6 }} />
                            <span className="font-medium" style={{ color: '#20190F' }}>{f.name}</span>
                            {f.category && <span style={{ color: '#94876F' }}>{f.category}</span>}
                            <span className="ml-auto" style={{ color: '#94876F' }}>{f.estVolumeKL.toLocaleString()} kL</span>
                          </div>
                        ) : null)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Stats ledger — Screen 3 design */}
            <div style={{ background: '#FBF6EC', borderRadius: 16, border: '1px solid #E2D8C4', overflow: 'hidden' }}>
              <div className="flex items-center gap-3 px-4" style={{ height: 46, borderBottom: '1px solid #E2D8C4' }}>
                <Droplets size={18} style={{ color: '#235E86', flexShrink: 0 }} />
                <span className="flex-1 font-sans font-medium" style={{ fontSize: 12, color: '#5C5040' }}>Annual rainfall</span>
                <span className="font-display font-semibold" style={{ fontSize: 14, color: '#20190F' }}>
                  {data.rainfall.annual}<span className="font-sans font-medium" style={{ fontSize: 11, color: '#94876F' }}> mm</span>
                </span>
                {data.rainfall.rainfallSource && (
                  <span
                    className="font-sans ml-2"
                    style={{
                      fontSize: 9, letterSpacing: '0.04em', padding: '1px 5px', borderRadius: 4,
                      background: data.rainfall.rainfallSource === 'open-meteo' ? 'rgba(35,94,134,0.10)' : 'rgba(32,25,15,0.06)',
                      color: data.rainfall.rainfallSource === 'open-meteo' ? '#235E86' : '#8C7A62',
                      border: `1px solid ${data.rainfall.rainfallSource === 'open-meteo' ? 'rgba(35,94,134,0.25)' : '#E2D8C4'}`,
                      whiteSpace: 'nowrap',
                    }}
                    title={data.rainfall.rainfallSource === 'open-meteo' ? 'ERA5-Land 9km grid (Open-Meteo)' : 'NASA POWER 50km grid'}
                  >
                    {data.rainfall.rainfallSource === 'open-meteo' ? 'ERA5' : 'NASA'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 px-4" style={{ height: 46, borderBottom: '1px solid #E2D8C4' }}>
                <Layers size={16} style={{ color: '#C07A1E', flexShrink: 0 }} />
                <span className="flex-1 font-sans font-medium" style={{ fontSize: 12, color: '#5C5040' }}>Soil texture</span>
                <span className="font-display font-semibold" style={{ fontSize: 14, color: '#20190F' }}>
                  {data.soil.textureClass}
                </span>
              </div>
              <div className="flex items-center gap-3 px-4" style={{ height: 46, borderBottom: '1px solid #E2D8C4' }}>
                <Snowflake size={16} style={{ color: '#235E86', flexShrink: 0 }} />
                <span className="flex-1 font-sans font-medium" style={{ fontSize: 12, color: '#5C5040' }}>Frost risk</span>
                <span className="font-display font-semibold" style={{ fontSize: 14, color: data.climate.minTemp < 2 ? '#235E86' : '#20190F' }}>
                  {frostLabel}
                </span>
              </div>
              <div className="flex items-center gap-3 px-4" style={{ height: 46 }}>
                <Mountain size={16} style={{ color: '#5C5040', flexShrink: 0 }} />
                <span className="flex-1 font-sans font-medium" style={{ fontSize: 12, color: '#5C5040' }}>Elevation</span>
                <span className="font-display font-semibold" style={{ fontSize: 14, color: '#20190F' }}>
                  {data.elevation.elevation}<span className="font-sans font-medium" style={{ fontSize: 11, color: '#94876F' }}> m</span>
                </span>
              </div>
            </div>

            {/* Lima contextual read card */}
            <div className="flex gap-3 items-start" style={{ background: '#FBF6EC', borderRadius: 14, border: '1px solid #E7DDC9', padding: '12px 13px' }}>
              <div className="flex items-center justify-center flex-shrink-0" style={{ width: 30, height: 30, borderRadius: 9, background: '#1F4D2B' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#EAF3E2" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 21V11" /><path d="M12 11c0-3.5-2.5-6-6.5-6 0 4 2.5 6 6.5 6Z" /><path d="M12 13c0-3 2.2-5.2 6-5.2 0 3.6-2.2 5.2-6 5.2Z" />
                </svg>
              </div>
              <p style={{ fontSize: 12.5, lineHeight: 1.5, color: '#4A3F2E', margin: 0 }}>
                <span className="font-display font-semibold" style={{ color: '#1F4D2B' }}>Lima · </span>
                {limaRead}
              </p>
            </div>

            {/* Primary CTA */}
            <button
              onClick={() => {
                if (activePlaceId && !loadSurvey(activePlaceId)) {
                  setSurveyPromptOpen(true);
                } else {
                  openPhotoOrReport();
                }
              }}
              className="w-full flex items-center justify-center gap-2 font-sans font-bold transition-opacity hover:opacity-90 active:opacity-75"
              style={{ height: 46, background: '#1F4D2B', color: '#F7F2E9', borderRadius: 13, border: 'none', fontSize: 14, letterSpacing: '-0.01em', cursor: 'pointer' }}
            >
              <Sprout size={16} />
              Generate full report
              {siteData && <span className="font-mono font-normal" style={{ fontSize: 12, color: 'rgba(234,243,226,0.7)', marginLeft: 4 }}>{siteData.areaHa} ha</span>}
            </button>

            {/* Save place — secondary */}
            <button
              onClick={quickSavePlace}
              disabled={placeSaved}
              className="w-full flex items-center justify-center gap-2 font-sans font-semibold transition-opacity"
              style={{
                height: 36, borderRadius: 11, border: '1px solid #E2D8C4', cursor: 'pointer',
                background: placeSaved ? 'rgba(31,77,43,0.06)' : '#FBF6EC',
                color: placeSaved ? '#5C5040' : '#1F4D2B', fontSize: 13,
              }}
            >
              <Bookmark size={14} />
              {placeSaved ? 'Saved to places' : 'Save this place'}
            </button>

            {/* Key species */}
            <Card>
              <Label>Key species</Label>
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
            <WaterBalance
              locationData={data}
              waterData={waterData ?? null}
              survey={survey}
              siteAreaHa={siteData?.areaHa}
            />
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
                sub={data.soil.ph < 5.5 ? 'Acidic — add lime' : data.soil.ph > 7.5 ? 'Alkaline — add sulphur' : 'Near-neutral'}
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
                    <div className="flex justify-between text-xs font-sans mb-1" style={{ color: '#5C5040' }}>
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
              <Stat label="Winter min" value={`${data.climate.minTemp}°C`} sub={data.climate.minTemp < 2 ? 'Frost likely' : 'Frost-free'} color={data.climate.minTemp < 2 ? '#235E86' : undefined} />
            </div>

            {/* Wind — prominent because it drives windbreak design */}
            <div className="rounded-xl p-3" style={{ background: '#F4EFE4', border: '1px solid #E2D8C4' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono uppercase tracking-wider font-semibold" style={{ color: '#235E86' }}>Wind</span>
                <span className="font-display font-bold" style={{ fontSize: 20, color: '#235E86' }}>
                  {(data.climate.windSpeed * 3.6).toFixed(0)} <span className="text-xs font-mono font-normal" style={{ color: '#5C5040' }}>km/h avg</span>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg p-2" style={{ background: '#FBF6EC', border: '1px solid #E2D8C4' }}>
                  <p className="text-xs font-mono mb-0.5" style={{ color: '#8C7A62' }}>Summer (prevails FROM)</p>
                  <p className="text-sm font-display font-bold" style={{ color: '#20190F' }}>{data.climate.windFromSummer}</p>
                </div>
                <div className="rounded-lg p-2" style={{ background: '#FBF6EC', border: '1px solid #E2D8C4' }}>
                  <p className="text-xs font-mono mb-0.5" style={{ color: '#8C7A62' }}>Winter (prevails FROM)</p>
                  <p className="text-sm font-display font-bold" style={{ color: '#20190F' }}>{data.climate.windFromWinter}</p>
                </div>
              </div>
              <p className="text-xs font-display mt-2 leading-relaxed" style={{ color: '#5C5040' }}>
                {data.climate.windSpeed > 4
                  ? `⚠ Strong winds — place windbreaks on the ${data.climate.windFromSummer} and ${data.climate.windFromWinter} sides before planting crops.`
                  : `Moderate winds — a windbreak on the ${data.climate.windFromSummer} side will still protect young plants and cut water loss.`
                }
              </p>
            </div>

            <Card>
              <Label>Monthly temperature (°C)</Label>
              <div className="mt-2" style={{ position: 'relative' }}>
                <div className="flex items-end gap-0.5" style={{ height: 72 }}>
                  {data.climate.monthlyTemp.map((t, i) => {
                    const tMin = Math.min(...data.climate.monthlyTemp);
                    const tMax = Math.max(...data.climate.monthlyTemp);
                    const range = tMax - tMin + 0.01;
                    const norm = (t - tMin) / range;
                    const isHot = t === tMax;
                    const isCold = t === tMin;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center" style={{ gap: 2 }}>
                        {(isHot || isCold) && (
                          <span style={{ fontSize: 8, color: isHot ? '#C03C1E' : '#235E86', fontFamily: 'var(--font-mono)', fontWeight: 700, lineHeight: 1 }}>
                            {t.toFixed(0)}°
                          </span>
                        )}
                        {!(isHot || isCold) && <span style={{ fontSize: 8, color: 'transparent' }}>0</span>}
                        <div
                          className="w-full rounded-sm"
                          style={{
                            height: `${Math.max(6, norm * 52)}px`,
                            background: `linear-gradient(to top, hsl(${25 + norm * 35}, 70%, ${28 + norm * 22}%), hsl(${30 + norm * 30}, 60%, ${35 + norm * 18}%))`,
                          }}
                          title={`${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i]}: ${t.toFixed(1)}°C`}
                        />
                        <span style={{ fontSize: 8, color: '#8C7A62', fontFamily: 'var(--font-mono)' }}>
                          {['J','F','M','A','M','J','J','A','S','O','N','D'][i]}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-1">
                  <span style={{ fontSize: 9, color: '#8C7A62', fontFamily: 'var(--font-mono)' }}>{Math.min(...data.climate.monthlyTemp).toFixed(0)}°C min</span>
                  <span style={{ fontSize: 9, color: '#8C7A62', fontFamily: 'var(--font-mono)' }}>{Math.max(...data.climate.monthlyTemp).toFixed(0)}°C max</span>
                </div>
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
              <p className="text-xs font-sans mt-2" style={{ color: '#5C5040' }}>
                → Earthworks before first rains: {data.biome.rainfallPattern === 'winter' ? 'Apr–May' : 'Aug–Sep'}
              </p>
            </Card>
          </>
        )}

        {/* NATURE */}
        {tab === 'Nature' && <LifeGuide locationData={data} />}

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

      {/* ── Pre-report survey prompt ── */}
      {surveyPromptOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-md font-sans" style={{ background: '#F7F2E9', borderRadius: '24px 24px 0 0', padding: '24px 20px 32px', paddingBottom: 'calc(32px + env(safe-area-inset-bottom))' }}>
            <div className="flex items-start gap-3 mb-4">
              <div style={{ width: 44, height: 44, borderRadius: 13, background: '#1F4D2B', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EAF3E2" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 21V11" /><path d="M12 11c0-3.5-2.5-6-6.5-6 0 4 2.5 6 6.5 6Z" /><path d="M12 13c0-3 2.2-5.2 6-5.2 0 3.6-2.2 5.2-6 5.2Z" />
                </svg>
              </div>
              <div>
                <div className="font-display font-semibold" style={{ fontSize: 17, color: '#20190F' }}>Want a sharper report?</div>
                <div className="font-sans" style={{ fontSize: 13, color: '#5C5040', lineHeight: 1.5, marginTop: 3 }}>
                  The site questionnaire takes 2 minutes and gives Lima things the map can&apos;t: how many people work here, irrigation, goals, and challenges. The report becomes far more specific.
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <button onClick={() => { setSurveyPromptOpen(false); setSurveySheetOpen(true); }}
                className="w-full flex items-center justify-center gap-2 font-sans font-bold"
                style={{ height: 46, borderRadius: 13, background: '#1F4D2B', color: '#F7F2E9', border: 'none', fontSize: 14, cursor: 'pointer' }}>
                Fill in the questionnaire (2 min)
              </button>
              <button onClick={() => { setSurveyPromptOpen(false); openPhotoOrReport(); }}
                className="w-full flex items-center justify-center font-sans font-semibold"
                style={{ height: 40, borderRadius: 13, background: 'transparent', color: '#8C7A62', border: 'none', fontSize: 13, cursor: 'pointer' }}>
                Skip for now, generate anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Site survey sheet ── */}
      {surveySheetOpen && activePlaceId && (
        <SiteSurveySheet
          placeId={activePlaceId}
          onSaved={() => { setSurveySheetOpen(false); openPhotoOrReport(); }}
          onClose={() => setSurveySheetOpen(false)}
        />
      )}

      {/* ── Pre-report photo prompt ── */}
      {photoPromptOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-md font-sans" style={{ background: '#F7F2E9', borderRadius: '24px 24px 0 0', padding: '24px 20px', paddingBottom: 'calc(32px + env(safe-area-inset-bottom))', maxHeight: '90dvh', overflowY: 'auto' }}>

            {/* Header */}
            <div className="flex items-start gap-3 mb-4">
              <div style={{ width: 44, height: 44, borderRadius: 13, background: '#1A3A4A', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Camera size={20} color="#EAF3E2" />
              </div>
              <div>
                <div className="font-display font-semibold" style={{ fontSize: 17, color: '#20190F' }}>Add site photos</div>
                <div className="font-sans" style={{ fontSize: 13, color: '#5C5040', lineHeight: 1.5, marginTop: 3 }}>
                  Satellite images are blurry and can&apos;t see soil colour, drainage, or what&apos;s actually growing. A few photos let Lima give you a plan based on what&apos;s really there.
                </div>
              </div>
            </div>

            {/* What to photograph */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                { Icon: Camera,   label: 'All directions',   detail: 'Stand in the middle, shoot 4 shots around you' },
                { Icon: Layers,   label: 'Soil profile',     detail: 'Dig a small hole — show the colour and layers' },
                { Icon: Droplets, label: 'Water & drainage', detail: 'Dams, wet spots, channels, waterlogged areas' },
                { Icon: Leaf,     label: "What's growing",   detail: 'Trees, plants, bare patches, any crops' },
              ].map(({ Icon, label, detail }) => (
                <div key={label} style={{ background: 'rgba(31,77,43,0.06)', borderRadius: 10, padding: '9px 10px' }}>
                  <Icon size={15} color="#1F4D2B" />
                  <div className="font-sans font-semibold" style={{ fontSize: 12, color: '#20190F', marginTop: 4 }}>{label}</div>
                  <div className="font-sans" style={{ fontSize: 11, color: '#8C7A62', lineHeight: 1.4, marginTop: 2 }}>{detail}</div>
                </div>
              ))}
            </div>

            {/* Upload area */}
            <input
              ref={promptInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handlePromptFiles(e.target.files)}
            />

            {promptPreviews.length === 0 ? (
              <button
                onClick={() => promptInputRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-2"
                style={{ height: 76, borderRadius: 13, border: '2px dashed rgba(31,77,43,0.3)', background: 'rgba(31,77,43,0.04)', cursor: 'pointer' }}>
                <Camera size={20} color="#1F4D2B" />
                <span className="font-sans font-semibold" style={{ fontSize: 13, color: '#1F4D2B' }}>Tap to add photos</span>
              </button>
            ) : (
              <div className="flex gap-2 pb-1 overflow-x-auto">
                {promptPreviews.map((url, i) => (
                  <img key={i} src={url} alt="" className="rounded-xl object-cover flex-shrink-0" style={{ width: 68, height: 68, border: '1.5px solid rgba(31,77,43,0.2)' }} />
                ))}
                {promptPreviews.length < 6 && (
                  <button
                    onClick={() => promptInputRef.current?.click()}
                    className="flex-shrink-0 flex items-center justify-center rounded-xl"
                    style={{ width: 68, height: 68, background: 'rgba(31,77,43,0.06)', border: '2px dashed rgba(31,77,43,0.25)', cursor: 'pointer' }}>
                    <span style={{ fontSize: 24, color: '#1F4D2B', lineHeight: 1 }}>+</span>
                  </button>
                )}
              </div>
            )}

            <div className="space-y-2 mt-3">
              {promptPreviews.length > 0 && (
                <button
                  onClick={analyseAndGenerate}
                  disabled={promptLoading}
                  className="w-full flex items-center justify-center gap-2 font-sans font-bold"
                  style={{ height: 46, borderRadius: 13, background: '#1F4D2B', color: '#F7F2E9', border: 'none', fontSize: 14, cursor: promptLoading ? 'default' : 'pointer', opacity: promptLoading ? 0.75 : 1 }}>
                  {promptLoading
                    ? <><Loader2 size={16} className="animate-spin" />Analysing photos…</>
                    : <><Camera size={16} />Analyse &amp; generate plan</>}
                </button>
              )}
              <button
                onClick={() => { setPhotoPromptOpen(false); onOpenReport(photoAnalysis); }}
                className="w-full flex items-center justify-center font-sans font-semibold"
                style={{ height: 40, borderRadius: 13, background: 'transparent', color: '#8C7A62', border: 'none', fontSize: 13, cursor: 'pointer' }}>
                Skip — generate without photos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
