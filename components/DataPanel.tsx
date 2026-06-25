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
import PeoplePanel from './PeoplePanel';
import EvidenceSheet from './EvidenceSheet';
import EvidenceCatalogue from './EvidenceCatalogue';
import { EVIDENCE_CATALOGUE, type EvidenceCatalogueGroup, type EvidenceCatalogueItem } from '@/lib/evidence-catalogue';
import { getSiteEvidence, getReportCompleteness, getGroupCount, type EvidenceItem } from '@/lib/site-evidence';
import type { Profile } from '@/lib/db/types';

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
  people?: Profile[];
  peopleLoading?: boolean;
  currentUserId?: string;
  onOpenProfile?: () => void;
}

const TABS = ['Overview', 'Ask', 'Reports', 'People', 'Water', 'Soil', 'Climate', 'Nature', 'Area', 'Photos', 'Design', 'AI', 'Places', 'Farm'] as const;
type Tab = typeof TABS[number];
// Farm and Reports live on the home screen quick actions and are reached via
// deep link (/farmer?panel=Farm). Keep them in TABS so the panel still renders,
// but hide them from the scrollable tab strip to reduce clutter.
const VISIBLE_TABS = TABS.filter((t) => t !== 'Farm');

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
export default function DataPanel({ data, loading, coords, mapCapture, siteData, waterData, forcedTab, onTabChange, onOpenReport, onJumpTo, onViewReport, appLang, placeName, activePlaceId, people, peopleLoading, currentUserId, onOpenProfile }: Props) {
  const { t } = useLanguage();
  const REPORT_GROUP_LABEL: Record<string, string> = {
    water: t('reportGroupWater'), structures: t('reportGroupStructures'),
    soil: t('reportGroupSoil'), trees: t('reportGroupTrees'),
    animals: t('reportGroupAnimals'), energy: t('reportGroupEnergy'),
  };
  const REPORT_GROUP_ADD: Record<string, string> = {
    water: t('reportAddWater'), structures: t('reportAddStructures'),
    soil: t('reportAddSoil'), trees: t('reportAddTrees'),
    animals: t('reportAddAnimals'), energy: t('reportAddEnergy'),
  };
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

  // Evidence state
  const siteId = activePlaceId ?? 'default';
  const [evidenceSheet, setEvidenceSheet] = useState<{ group: EvidenceCatalogueGroup; item?: EvidenceCatalogueItem } | null>(null);
  const [evidenceCatalogueOpen, setEvidenceCatalogueOpen] = useState(false);
  const [evidenceTick, setEvidenceTick] = useState(0);
  const completeness = getReportCompleteness(siteId);

  // Photo prompt (pre-report interstitial)
  const [photoPromptOpen, setPhotoPromptOpen] = useState(false);
  const [promptPreviews, setPromptPreviews] = useState<string[]>([]);
  const [promptImageData, setPromptImageData] = useState<Array<{ data: string; mediaType: string }>>([]);
  const [promptLoading, setPromptLoading] = useState(false);
  const promptInputRef = useRef<HTMLInputElement>(null);

  async function resizeForPrompt(file: File): Promise<{ data: string; mediaType: string } | null> {
    return new Promise((resolve) => {
      const img = new Image();
      const reader = new FileReader();

      const fail = () => resolve(null); // HEIC or corrupt — skip silently

      reader.onload = (e) => {
        img.src = e.target!.result as string;
        img.onload = () => {
          if (!img.width || !img.height) { fail(); return; }
          const ratio = Math.min(1120 / img.width, 1120 / img.height, 1);
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * ratio);
          canvas.height = Math.round(img.height * ratio);
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          // Sanity check: sample 4 pixels — if all zero the browser couldn't decode the image
          const px = ctx.getImageData(0, 0, Math.min(4, canvas.width), 1).data;
          const allBlack = px.every((v, i) => i % 4 === 3 ? true : v < 5);
          if (allBlack) { fail(); return; }
          resolve({ data: canvas.toDataURL('image/jpeg', 0.82).split(',')[1], mediaType: 'image/jpeg' });
        };
        img.onerror = fail;
      };
      reader.onerror = fail;
      reader.readAsDataURL(file);
    });
  }

  async function handlePromptFiles(files: FileList | null) {
    if (!files?.length) return;
    const candidates = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, 6);
    const results = await Promise.all(candidates.map(async (f, i) => ({ f, i, r: await resizeForPrompt(f) })));
    const good = results.filter(x => x.r !== null);
    const skipped = results.length - good.length;
    if (skipped > 0) console.warn(`${skipped} photo(s) could not be decoded (possibly HEIC — use JPEG/PNG)`);
    setPromptPreviews(prev => [...prev, ...good.map(x => URL.createObjectURL(x.f))].slice(0, 6));
    setPromptImageData(prev => [...prev, ...good.map(x => x.r!)].slice(0, 6));
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
    if (r >= 500 && s < 15) return { label: t('suitabilityGoodFit'), bg: '#E7F0E0', border: '#BCD6B0', dot: '#1F4D2B', text: '#1F4D2B' };
    if (r >= 300 && s < 25) return { label: t('suitabilityFairSite'), bg: 'rgba(192,122,30,0.1)', border: 'rgba(192,122,30,0.3)', dot: '#C07A1E', text: '#9A6018' };
    return { label: t('suitabilityChallenging'), bg: 'rgba(212,110,66,0.1)', border: 'rgba(212,110,66,0.3)', dot: '#D4922A', text: '#B83A18' };
  })();

  // Frost label
  const frostLabel = data.climate.minTemp < 2 ? t('frostLikely') : data.climate.minTemp < 5 ? t('frostOccasional') : t('frostRare');

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
          {t('siteReportOverline')}
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
          {VISIBLE_TABS.map((tabName) => (
            <button
              key={tabName}
              onClick={() => setTab(tabName)}
              className="flex items-center gap-1.5 flex-shrink-0 transition-all duration-150"
              style={{
                padding: '9px 12px',
                borderBottom: tab === tabName ? '2px solid #C07A1E' : '2px solid transparent',
                borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                background: 'transparent',
                color: tab === tabName ? '#C07A1E' : '#5C5040',
                fontSize: 12.5,
                fontFamily: 'var(--font-display)',
                fontWeight: tab === tabName ? 600 : 400,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center' }}>{TAB_ICONS[tabName]}</span>
              {t('tab' + tabName)}
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
                          {t('yourLand')}{siteData.count && siteData.count > 1 ? ` · ${siteData.count} ${t('parcelsSectionLabel').toLowerCase()}` : ''}
                        </div>
                        <div className="font-sans" style={{ fontSize: 11.5, color: '#5C5040' }}>
                          {siteData.perimeterM >= 1000 ? `${(siteData.perimeterM / 1000).toFixed(2)} km` : `${siteData.perimeterM} m`} {t('perimeterUnit')} · {siteData.areaM2.toLocaleString()} m²
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {siteData.areaHa < 1
                          ? <><div className="font-display font-bold" style={{ fontSize: 17, color: '#20190F', lineHeight: 1 }}>{siteData.areaM2.toLocaleString()}</div>
                              <div className="font-sans" style={{ fontSize: 11, color: '#94876F' }}>m²</div></>
                          : <><div className="font-display font-bold" style={{ fontSize: 17, color: '#20190F', lineHeight: 1 }}>{siteData.areaHa}</div>
                              <div className="font-sans" style={{ fontSize: 11, color: '#94876F' }}>{t('hectaresUnit')}</div></>
                        }
                      </div>
                    </div>
                    {siteData.features && siteData.features.some(f => f.name) && (
                      <div className="px-3.5 pb-2.5 space-y-1">
                        {siteData.features.map((f, i) => f.name ? (
                          <div key={i} className="flex items-center gap-2 font-sans" style={{ fontSize: 11.5, color: '#5C5040' }}>
                            <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#1F4D2B', opacity: 0.6 }} />
                            <span className="font-medium" style={{ color: '#20190F' }}>{f.name}</span>
                            {f.category && <span style={{ color: '#94876F' }}>{f.category}</span>}
                            <span className="ml-auto" style={{ color: '#94876F' }}>{f.areaHa < 1 ? `${Math.round(f.areaHa * 10000).toLocaleString()} m²` : `${f.areaHa} ha`}</span>
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
                          {t('harvestingAreas')}{waterData.count > 1 ? ` · ${waterData.count}` : ''}
                        </div>
                        <div className="font-sans" style={{ fontSize: 11.5, color: '#5C5040' }}>
                          {waterData.areaM2.toLocaleString()} m² {t('catchmentAreaLabel')}
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
                <span className="flex-1 font-sans font-medium" style={{ fontSize: 12, color: '#5C5040' }}>{t('statAnnualRainfall')}</span>
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

            {/* Site insight bullets */}
            <div className="space-y-1.5">
              {([
                data.rainfall.annual < 400
                  ? { color: '#D4922A', text: t('insightSemiArid').replace('{mm}', String(data.rainfall.annual)) }
                  : data.rainfall.annual < 700
                  ? { color: '#5C5040', text: t('insightModerateRain').replace('{mm}', String(data.rainfall.annual)) }
                  : { color: '#1F4D2B', text: t('insightStrongRain').replace('{mm}', String(data.rainfall.annual)) },
                data.climate.minTemp < 2
                  ? { color: '#235E86', text: t('insightFrostExpected').replace('{tempC}', String(data.climate.minTemp)) }
                  : data.climate.minTemp < 6
                  ? { color: '#5C5040', text: t('insightLightFrost').replace('{tempC}', String(data.climate.minTemp)) }
                  : { color: '#1F4D2B', text: t('insightFrostFree').replace('{tempC}', String(data.climate.minTemp)) },
                (data.climate.windSpeed * 3.6) > 18
                  ? { color: '#D4922A', text: t('insightHighWind').replace('{kmh}', (data.climate.windSpeed * 3.6).toFixed(0)).replace('{dir}', data.climate.windFromSummer) }
                  : { color: '#5C5040', text: t('insightModerateWind').replace('{dir}', data.climate.windFromSummer) },
                data.soil.organicCarbon < 1.5
                  ? { color: '#C07A1E', text: t('insightLowSoilCarbon').replace('{oc}', String(data.soil.organicCarbon)) }
                  : { color: '#1F4D2B', text: t('insightGoodSoilCarbon').replace('{oc}', String(data.soil.organicCarbon)) },
              ] as { color: string; text: string }[]).map((ins, i) => (
                <div key={i} className="flex gap-2 items-start text-xs font-display leading-relaxed py-1.5 px-2.5 rounded-lg" style={{ background: 'rgba(251,246,236,0.8)', border: '1px solid rgba(226,216,196,0.5)', color: '#3A2E22' }}>
                  <span className="flex-shrink-0 font-bold mt-px" style={{ color: ins.color }}>→</span>
                  <span>{ins.text}</span>
                </div>
              ))}
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

            {/* 12-month planting calendar strip */}
            {data.rainfall.monthly?.length === 12 && (
              <div className="rounded-xl p-3" style={{ background: '#F4EFE4', border: '1px solid #E2D8C4' }}>
                <span className="text-xs font-mono uppercase tracking-wider font-semibold" style={{ color: '#1F4D2B' }}>{t('plantingCalendarHeader')}</span>
                <div className="flex gap-0.5 mt-2">
                  {['J','F','M','A','M','J','J','A','S','O','N','D'].map((m, i) => {
                    const rain = data.rainfall.monthly![i];
                    const temp = data.climate.monthlyTemp[i] ?? 20;
                    const isFrost = temp < 3;
                    const isGrow = !isFrost && temp >= 12 && rain >= 30;
                    const isDry  = !isFrost && !isGrow && rain < 20 && temp > 22;
                    const bg = isFrost ? '#BFD9EE' : isGrow ? '#B5D9B5' : isDry ? '#E8C87A' : '#D8CEBC';
                    const label = isFrost ? t('calendarFrost') : isGrow ? t('calendarGrow') : isDry ? t('calendarDry') : t('calendarRest');
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-0.5" title={`${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i]}: ${label} (${rain}mm, ${temp.toFixed(0)}°C)`}>
                        <div className="w-full rounded-sm" style={{ height: 26, background: bg }} />
                        <span style={{ fontSize: 7.5, color: '#8C7A62', fontFamily: 'var(--font-mono)' }}>{m}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-3 mt-2 flex-wrap">
                  {([['#B5D9B5', t('calendarGrow')],['#E8C87A', t('calendarDry')],['#BFD9EE', t('calendarFrost')],['#D8CEBC', t('calendarRest')]]).map(([c,l]) => (
                    <div key={l} className="flex items-center gap-1">
                      <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: c }} />
                      <span style={{ fontSize: 9.5, color: '#8C7A62', fontFamily: 'var(--font-mono)' }}>{l}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
              {t('generateFullReport')}
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
              {placeSaved ? t('savedToPlaces') : t('saveThisPlace')}
            </button>

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
          </>
        )}

        {/* PEOPLE */}
        {tab === 'People' && (
          <PeoplePanel
            people={people ?? []}
            loading={peopleLoading ?? false}
            currentUserId={currentUserId}
            onOpenProfile={onOpenProfile ?? (() => {})}
          />
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
            <Card>
              <Label>{t('waterHarvestingStrategyHeader')}</Label>
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
              <Stat label={t('statTexture')} value={data.soil.textureClass} />
              <Stat
                label={t('statPH')}
                value={data.soil.ph.toString()}
                sub={data.soil.ph < 5.5 ? t('phAcidic') : data.soil.ph > 7.5 ? t('phAlkaline') : t('phNeutral')}
                color={data.soil.ph < 5.5 || data.soil.ph > 7.5 ? '#D4922A' : '#2D6B3C'}
              />
              <Stat
                label={t('statOrganicCarbon')}
                value={`${data.soil.organicCarbon}%`}
                sub={data.soil.organicCarbon < 1.5 ? t('organicCarbonLow') : t('organicCarbonOk')}
                color={data.soil.organicCarbon < 1.5 ? '#D4922A' : '#1F4D2B'}
              />
              <Stat label={t('statBulkDensity')} value={`${data.soil.bulkDensity} g/cm³`} sub={data.soil.bulkDensity > 1.4 ? t('bulkDensityCompacted') : t('bulkDensityOk')} />
            </div>
            <Card>
              <Label>{t('textureCompositionHeader')}</Label>
              <div className="space-y-2.5">
                {[
                  { name: t('textureSand'), pct: data.soil.sand, color: '#C07A1E' },
                  { name: t('textureSilt'), pct: data.soil.silt, color: '#1F4D2B' },
                  { name: t('textureClay'), pct: data.soil.clay, color: '#2D6B3C' },
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
              <Label>{t('soilStrategyHeader')}</Label>
              <p className="text-xs font-display leading-relaxed" style={{ color: '#20190F' }}>
                {data.biome.soilStrategy}
              </p>
            </Card>

            {/* Soil health score */}
            {(() => {
              const ph = data.soil.ph;
              const oc = data.soil.organicCarbon;
              const bd = data.soil.bulkDensity;
              const sand = data.soil.sand;
              const clay = data.soil.clay;
              const pHScore  = ph  >= 6   && ph  <= 7   ? 2.5 : ph  >= 5.5 && ph  <= 7.5 ? 1.5 : 0.5;
              const ocScore  = oc  >= 2.5              ? 2.5 : oc  >= 1.5               ? 1.5 : 0.5;
              const bdScore  = bd  <  1.2              ? 2.5 : bd  <  1.4               ? 1.5 : 0.5;
              const texScore = (sand < 70 && clay < 40) ? 2.5 : (sand < 80 || clay < 50) ? 1.5 : 0.5;
              const total = Math.min(10, Math.round(pHScore + ocScore + bdScore + texScore));
              const scoreColor = total >= 8 ? '#1F4D2B' : total >= 5 ? '#C07A1E' : '#C03C1E';
              const scoreLabel = total >= 8 ? t('soilHealthScoreHealthy') : total >= 5 ? t('soilHealthScoreModerate') : t('soilHealthScoreDegraded');
              const improvements: string[] = [];
              if (pHScore < 2) improvements.push(ph < 6 ? `pH ${ph} is acidic — add agricultural lime (1–2 t/ha)` : `pH ${ph} is alkaline — add elemental sulphur or pine-needle mulch`);
              if (ocScore < 2) improvements.push(`Organic carbon ${oc}% is low — layer compost 5 cm deep, add kraal manure or biochar`);
              if (bdScore < 2) improvements.push(`Bulk density ${bd} g/cm³ suggests compaction — deep-rooted cover crops and broadfork open the profile`);
              if (texScore < 2 && clay > 40) improvements.push(`High clay (${clay}%) — gypsum + organic matter improve drainage and workability`);
              else if (texScore < 2 && sand > 70) improvements.push(`Sandy soil (${sand}%) — mulch heavily and boost CEC with compost and biochar`);
              return (
                <div className="rounded-xl p-3" style={{ background: '#F4EFE4', border: '1px solid #E2D8C4' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono uppercase tracking-wider font-semibold" style={{ color: '#5C5040' }}>{t('soilHealthScoreHeader')}</span>
                    <div className="flex items-baseline gap-1">
                      <span className="font-display font-bold" style={{ fontSize: 22, color: scoreColor, lineHeight: 1 }}>{total}</span>
                      <span className="font-mono" style={{ fontSize: 10, color: '#8C7A62' }}>/10</span>
                      <span className="font-sans font-semibold ml-1" style={{ fontSize: 10, color: scoreColor }}>{scoreLabel}</span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ background: 'rgba(226,216,196,0.6)' }}>
                    <div className="h-full rounded-full" style={{ width: `${total * 10}%`, background: scoreColor, transition: 'width 0.6s ease' }} />
                  </div>
                  {improvements.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-mono uppercase tracking-wider mb-1" style={{ color: '#8C7A62', fontSize: 9.5 }}>{t('priorityImprovementsHeader')}</p>
                      {improvements.slice(0, 3).map((imp, i) => (
                        <div key={i} className="flex gap-2 text-xs font-display leading-snug" style={{ color: '#3A2E22' }}>
                          <span className="flex-shrink-0 font-bold" style={{ color: '#C07A1E' }}>{i + 1}.</span>
                          {imp}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </>
        )}

        {/* CLIMATE */}
        {tab === 'Climate' && (() => {
          const MS = ['J','F','M','A','M','J','J','A','S','O','N','D'];
          const monthly = data.rainfall.monthly ?? [];
          const temps = data.climate.monthlyTemp;
          const annualRain = Math.round(data.rainfall.annual);
          const kmh = Math.round(data.climate.windSpeed * 3.6);
          const tMin = Math.min(...temps);
          const tMax = Math.max(...temps);
          const rainMax = Math.max(...monthly, 1);
          const rainAvg = annualRain / 12;
          const isWet = (r: number) => r > rainAvg * 0.9;

          const ZONE_LABELS: Record<string, string> = {
            Cwa: t('zoneHumidSubtropicalSummerRain'), Cwb: t('zoneHumidSubtropicalMistBelt'),
            Csa: t('zoneMediterraneanCoastal'), Csb: t('zoneMediterraneanMaritime'),
            Cfa: t('zoneHumidSubtropical'), Cfb: t('zoneTemperateOceanic'),
            BWh: t('zoneSemiAridHotDesert'), BWk: t('zoneSemiAridColdDesert'),
            BSh: t('zoneSemiAridHotSteppe'), BSk: t('zoneSemiAridColdSteppe'),
            ET: t('zoneAlpineMontane'),
          };
          const kp = data.climate.koppen;
          const zoneLabel = ZONE_LABELS[kp] ?? kp;

          const zoneSummary =
            kp.startsWith('Cw') ? t('summaryWarmWetSummer')
            : kp.startsWith('Cf') ? t('summaryReliableRainfall')
            : kp.startsWith('Cs') ? t('summaryWetMildWinter')
            : kp.startsWith('BS') ? t('summarySemiAridSteppe')
            : kp.startsWith('BW') ? t('summaryAridDesert')
            : kp.startsWith('ET') ? t('summaryHighAltitude')
            : 'Variable climate — use local rainfall and temperature data to plan your seasonal crop calendar.';

          const CROPS: Record<string, Array<{ pre: string; bold: string; post: string }>> = {
            Cwb: [{ pre: 'Year-round vegetables on summer rain — ', bold: 'maize, beans, leafy greens, brassicas & sweet potato', post: '. The mild, dry winter suits cool-season crops; the warm, frost-free conditions also carry ' }, { pre: '', bold: 'bananas, avocado & subtropical fruit', post: '.' }],
            Cwa: [{ pre: 'Year-round vegetables on summer rain — ', bold: 'maize, beans, leafy greens, brassicas & sweet potato', post: '. The warm, frost-free conditions also carry ' }, { pre: '', bold: 'tropical fruit, avocado & sugar cane', post: '.' }],
            Cfb: [{ pre: 'Well-distributed rain supports year-round production — ', bold: 'leafy greens, brassicas, stone fruit, berries & root vegetables', post: ' thrive. Mild winters keep frost-tender crops viable on protected aspects.' }],
            Cfa: [{ pre: 'Subtropical with year-round rain — ', bold: 'maize, subtropical fruit, leafy greens & legumes', post: '. High humidity — select disease-resistant varieties and maximise airflow.' }],
            Csb: [{ pre: 'Rainy winters grow the best crops — ', bold: 'wheat, alliums, legumes, brassicas & root vegetables', post: '. Dry summers need drought-tolerant varieties: ' }, { pre: '', bold: 'olives, figs, lavender & stone fruit', post: '.' }],
            Csa: [{ pre: 'Classic Mediterranean growing season — ', bold: 'wheat, olives, citrus, grapes, figs & root vegetables', post: ' thrive. Summer heat demands irrigation for annuals; drought-tolerant trees fruit without it.' }],
            BSh: [{ pre: 'Drought-tolerant crops are essential — ', bold: 'sorghum, cowpeas, Moringa & indigenous grains', post: '. Water harvesting is a prerequisite for ' }, { pre: '', bold: 'food trees and market gardens', post: '.' }],
            BSk: [{ pre: 'Cold steppe — ', bold: 'drought-tolerant small grains, garlic & root vegetables', post: ' on water-harvested plots. ' }, { pre: '', bold: 'Stone fruit & cool-season grains', post: ' are your most viable options.' }],
            BWh: [{ pre: 'Arid — water harvesting before any food production. With irrigation: ', bold: 'citrus, dates, melons & heat-tolerant vegetables', post: '.' }],
            BWk: [{ pre: 'Cold arid — water harvesting essential. Short growing window: ', bold: 'cold-hardy grains, root vegetables & wind-tolerant perennials', post: '.' }],
            ET:  [{ pre: 'Short alpine season — ', bold: 'potatoes, kale, oats & alpine herbs', post: ' on warm north-facing aspects. Protect all crops from frost and strong wind.' }],
          };
          const cropSegs = CROPS[kp] ?? [{ pre: 'Locally adapted varieties suited to your rainfall and temperature range.', bold: '', post: '' }];

          const patternChip = data.rainfall.pattern === 'winter' ? t('climatePatternWinter') : data.rainfall.pattern === 'summer' ? t('climatePatternSummer') : t('climatePatternYearRound');
          const frostChipGreen = tMin >= 5;
          const frostChip = tMin < 2 ? t('climateFrostExpected') : tMin < 5 ? t('climateLightFrost') : t('climateFrostFree');

          // Approximate monthly sunshine (seasonal model from annual solar average)
          const SUN_MULT = data.rainfall.pattern === 'winter'
            ? [1.10, 1.05, 0.97, 0.92, 0.88, 0.87, 0.88, 0.92, 0.98, 1.05, 1.10, 1.10]
            : [0.87, 0.89, 0.93, 0.98, 1.04, 1.08, 1.08, 1.04, 0.98, 0.93, 0.89, 0.87];
          const sunHours = SUN_MULT.map(m => Math.round((data.climate.solarRadiation / 0.82) * m * 10) / 10);
          const sunMax = Math.max(...sunHours, 1);
          const sunMin = Math.min(...sunHours);
          const sunAvg = Math.round(sunHours.reduce((a, b) => a + b, 0) / 12 * 10) / 10;

          // Approximate monthly wind (±~20% seasonal, windiest Aug–Oct)
          const WIND_MULT = [0.87, 0.87, 0.90, 0.92, 0.95, 0.96, 0.98, 1.13, 1.18, 1.12, 1.00, 0.91];
          const monthlyWind = WIND_MULT.map(m => Math.round(kmh * m));
          const windMax = Math.max(...monthlyWind, 1);

          // Frost strip
          const frostFreeDays = Math.round(temps.filter(t => t >= 5).length / 12 * 365);
          const lightFrostMonths = temps
            .map((t, i) => (t >= 2 && t < 5) ? ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i] : null)
            .filter((v): v is string => v !== null);

          // Compass rose: direction → SVG rotation degrees
          const DIR_DEG: Record<string, number> = { N:0, NE:45, E:90, SE:135, S:180, SW:225, W:270, NW:315 };
          const primRot = DIR_DEG[data.climate.windFromSummer] ?? 45;
          const secRot  = DIR_DEG[data.climate.windFromWinter]  ?? 225;

          // Colour helpers
          function tempColor(t: number) {
            const norm = (t - tMin) / ((tMax - tMin) || 1);
            return `hsl(${Math.round(47 - norm * 12)}, 62%, ${Math.round(33 + norm * 20)}%)`;
          }
          function sunColor(h: number) {
            const norm = (h - sunMin) / ((sunMax - sunMin) || 1);
            return `hsl(${Math.round(38 + norm * 5)}, ${Math.round(78 + norm * 8)}%, ${Math.round(54 + norm * 10)}%)`;
          }

          // Shared style helpers
          const cardSt = { background: '#FBF8F1', border: '1px solid #E6DDC9', borderRadius: 16, padding: '19px 19px 17px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' };
          const ovlSt  = { fontFamily: 'var(--font-sans)', fontWeight: 700 as const, fontSize: 11.5, letterSpacing: '0.13em', textTransform: 'uppercase' as const, color: '#B07A1E' };
          const implSt = { fontFamily: 'var(--font-display)', fontWeight: 400 as const, fontSize: 13.5, fontStyle: 'italic' as const, color: '#5C5240', lineHeight: 1.45 };
          const colSt  = { flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center' as const, justifyContent: 'flex-end' as const, height: '100%' };
          const valSt  = { fontFamily: 'var(--font-sans)', fontWeight: 600 as const, fontSize: 11, color: '#766A50', marginBottom: 5 };
          const monSt  = { fontFamily: 'var(--font-sans)', fontWeight: 600 as const, fontSize: 10, color: '#AC9E82', marginTop: 7, textTransform: 'uppercase' as const };
          function chip(bg: string, color: string) {
            return { display: 'inline-flex' as const, alignItems: 'center' as const, gap: 6, fontFamily: 'var(--font-sans)', fontWeight: 600 as const, fontSize: 12.5, padding: '5px 11px', borderRadius: 999, background: bg, color };
          }

          return (
            <div className="space-y-3.5">

              {/* 1 — Climate zone */}
              <div style={cardSt}>
                <div style={{ ...ovlSt, marginBottom: 8 }}>{t('climateZone')}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 21, color: '#2A2317', lineHeight: 1.15 }}>{zoneLabel}</div>
                <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 12.5, color: '#9A8C70', margin: '3px 0 11px' }}>
                  Köppen {kp} — {zoneLabel}
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 15, color: '#4A4030', lineHeight: 1.5 }}>{zoneSummary}</div>
                <div style={{ marginTop: 14, background: '#F1F4EA', border: '1px solid #DCE6CE', borderRadius: 12, padding: '13px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3C6B3F" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 21V11"/><path d="M12 11c0-3.5-2.5-6-6.5-6 0 4 2.5 6 6.5 6Z"/><path d="M12 13c0-3 2.2-5.2 6-5.2 0 3.6-2.2 5.2-6 5.2Z"/>
                    </svg>
                    <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 11.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#3C6B3F' }}>{t('goodForGrowing')}</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 14, color: '#3D4A36', lineHeight: 1.5 }}>
                    {cropSegs.map((seg, i) => (
                      <span key={i}>{seg.pre}{seg.bold && <b style={{ fontWeight: 600 }}>{seg.bold}</b>}{seg.post}</span>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 13, flexWrap: 'wrap' }}>
                  <span style={chip('#E7EEF4', '#3A6E92')}>≈ {annualRain} {t('chipRainPerYear')}</span>
                  <span style={chip('#EDE7DA', '#7A6A48')}>{patternChip}</span>
                  <span style={chip(frostChipGreen ? '#DDEBCF' : '#F4EAD0', frostChipGreen ? '#3C6B3F' : '#9A7A2E')}>{frostChip}</span>
                </div>
              </div>

              {/* 2 — Rainfall mm/month */}
              {monthly.length === 12 && (
                <div style={cardSt}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
                    <div style={ovlSt}>{t('rainfallMmMonth')}</div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13, color: '#3A6E92' }}>≈ {annualRain} mm / yr</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 150, paddingTop: 2 }}>
                    {monthly.map((r, i) => (
                      <div key={i} style={colSt}>
                        <span style={valSt}>{Math.round(r)}</span>
                        <div style={{ width: '64%', maxWidth: 23, height: Math.max(8, (r / rainMax) * 130), borderRadius: '5px 5px 2px 2px', background: isWet(r) ? '#3F92C9' : '#A6C9DF' }} />
                        <span style={monSt}>{MS[i]}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8, margin: '13px 0 9px' }}>
                    <span style={chip('#E7EEF4', '#3A6E92')}>
                      <span style={{ width: 9, height: 9, borderRadius: 2, background: '#3F92C9', display: 'inline-block' }} /> {t('climateWetLabel')} · {data.rainfall.wetSeason}
                    </span>
                    <span style={chip('#EFEADF', '#8A7B58')}>
                      <span style={{ width: 9, height: 9, borderRadius: 2, background: '#A6C9DF', display: 'inline-block' }} /> {t('climateDryLabel')} · {data.rainfall.drySeason}
                    </span>
                  </div>
                  <div style={implSt}>→ {t('climateRainfallInsight').replace('{wet}', data.rainfall.wetSeason).replace('{dry}', data.rainfall.drySeason)}</div>
                </div>
              )}

              {/* 3 — Monthly temperature */}
              <div style={cardSt}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
                  <div style={ovlSt}>{t('monthlyTempC')}</div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13, color: '#A06A20' }}>{Math.round(tMin)}° – {Math.round(tMax)}°</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 130, paddingTop: 2 }}>
                  {temps.map((temp, i) => {
                    const norm = (temp - tMin) / ((tMax - tMin) || 1);
                    return (
                      <div key={i} style={colSt}>
                        <span style={valSt}>{Math.round(temp)}°</span>
                        <div style={{ width: '64%', maxWidth: 23, height: Math.max(8, norm * 110 + 20), borderRadius: '5px 5px 2px 2px', background: tempColor(temp) }} />
                        <span style={monSt}>{MS[i]}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 11, fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 12, color: '#9A8C70' }}>
                  <span>{t('winterLowPrefix')} {Math.round(tMin)}° (Jun–Jul)</span>
                  <span>{t('summerHighPrefix')} {Math.round(tMax)}°</span>
                </div>
              </div>

              {/* 4 — Sunlight hours/day */}
              <div style={cardSt}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
                  <div style={ovlSt}>{t('sunlightHoursDay')}</div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13, color: '#C77F1A' }}>≈ {sunAvg} h avg</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 130, paddingTop: 2 }}>
                  {sunHours.map((h, i) => (
                    <div key={i} style={colSt}>
                      <span style={valSt}>{h.toFixed(1)}</span>
                      <div style={{ width: '64%', maxWidth: 23, height: Math.max(8, (h / sunMax) * 110), borderRadius: '5px 5px 2px 2px', background: sunColor(h) }} />
                      <span style={monSt}>{MS[i]}</span>
                    </div>
                  ))}
                </div>
                <div style={{ ...implSt, marginTop: 11 }}>
                  → {data.rainfall.pattern === 'winter'
                    ? 'Sunniest in the wet summer — maximise solar gain in autumn and spring.'
                    : 'Sunniest in the dry winter — ideal for cool-season crops and drying produce.'}
                </div>
              </div>

              {/* 5 — Wind + compass rose */}
              <div style={cardSt}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
                  <div style={ovlSt}>{t('windKmhCard')}</div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13, color: '#5E7A66' }}>
                    {kmh > 22 ? 'Moderate – strong' : kmh > 12 ? 'Light – moderate' : 'Light'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 5, height: 120 }}>
                    {monthlyWind.map((w, i) => (
                      <div key={i} style={colSt}>
                        <span style={valSt}>{w}</span>
                        <div style={{ width: '64%', maxWidth: 23, height: Math.max(6, (w / windMax) * 100), borderRadius: '5px 5px 2px 2px', background: (i >= 7 && i <= 9) ? '#5E8A6E' : '#9DB3A4' }} />
                        <span style={monSt}>{MS[i]}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ flexShrink: 0, width: 104, textAlign: 'center' }}>
                    <svg width="100" height="100" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" fill="#F1ECE0" stroke="#D8CFBA" strokeWidth="1.5"/>
                      <circle cx="50" cy="50" r="30" fill="none" stroke="#E2DAC6" strokeWidth="1"/>
                      <g transform={`rotate(${secRot}, 50, 50)`}>
                        <line x1="50" y1="50" x2="50" y2="16" stroke="#A9BEAF" strokeWidth="3.5" strokeLinecap="round"/>
                        <path d="M50 16 L44 26 M50 16 L56 26" fill="none" stroke="#A9BEAF" strokeWidth="3.5" strokeLinecap="round"/>
                      </g>
                      <g transform={`rotate(${primRot}, 50, 50)`}>
                        <line x1="50" y1="50" x2="50" y2="14" stroke="#3C6B4A" strokeWidth="4.5" strokeLinecap="round"/>
                        <path d="M50 14 L43 25 M50 14 L57 25" fill="none" stroke="#3C6B4A" strokeWidth="4.5" strokeLinecap="round"/>
                      </g>
                      <circle cx="50" cy="50" r="3.2" fill="#3C6B4A"/>
                      <text x="50" y="12" textAnchor="middle" fontFamily="var(--font-sans)" fontSize="11" fontWeight="700" fill="#6B6048">N</text>
                      <text x="91" y="54" textAnchor="middle" fontFamily="var(--font-sans)" fontSize="11" fontWeight="700" fill="#A89A7E">E</text>
                      <text x="50" y="95" textAnchor="middle" fontFamily="var(--font-sans)" fontSize="11" fontWeight="700" fill="#A89A7E">S</text>
                      <text x="9" y="54" textAnchor="middle" fontFamily="var(--font-sans)" fontSize="11" fontWeight="700" fill="#A89A7E">W</text>
                    </svg>
                    <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 12, color: '#3C6B4A', marginTop: 2 }}>{t('prevailingWind')} {data.climate.windFromSummer}</div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 11, color: '#9A8C70' }}>{data.climate.windFromWinter} {t('inWinter')}</div>
                  </div>
                </div>
                <div style={{ ...implSt, marginTop: 13 }}>
                  → Windiest Aug–Oct — site a windbreak along the {data.climate.windFromSummer} edge before spring.
                </div>
              </div>

              {/* 6 — Frost & growing season */}
              <div style={cardSt}>
                <div style={{ ...ovlSt, marginBottom: 13 }}>{t('frostGrowingSeason')}</div>
                <div style={{ display: 'flex', gap: 4, marginBottom: 7 }}>
                  {temps.map((temp, i) => {
                    const light = temp >= 2 && temp < 5;
                    const hard  = temp < 2;
                    return (
                      <div key={i} style={{ flex: 1, height: 30, borderRadius: 5,
                        background: hard ? '#C8D8EE' : light ? '#F2E2BB' : '#CDE3BE',
                        border: light ? '1.5px solid #DDB85E' : hard ? '1.5px solid #6B9AC4' : 'none',
                      }}/>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
                  {MS.map((m, i) => (
                    <div key={i} style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 10, color: '#AC9E82', textTransform: 'uppercase' }}>{m}</div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <span style={chip('#DDEBCF', '#3C6B3F')}>{t('frostFreePrefix')} {frostFreeDays} {t('daysUnit')}</span>
                  {lightFrostMonths.length > 0 && (
                    <span style={chip('#F4EAD0', '#9A7A2E')}>{t('lightFrostPrefix')} {lightFrostMonths.join('–')} valleys</span>
                  )}
                  {tMin < 5 && <span style={chip('#EDE7DA', '#7A6A48')}>{t('plantTenderMidAug')}</span>}
                </div>
              </div>

              {/* Lima → full report */}
              <button
                onClick={() => onOpenReport?.()}
                style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#274D2C', borderRadius: 15, padding: '13px 16px 13px 13px', width: '100%', border: 'none', cursor: 'pointer', textAlign: 'left' }}
              >
                <span style={{ width: 40, height: 40, flexShrink: 0, borderRadius: '50%', background: '#3C6B3F', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#CDEBB6' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 21V11"/><path d="M12 11c0-3.5-2.5-6-6.5-6 0 4 2.5 6 6.5 6Z"/><path d="M12 13c0-3 2.2-5.2 6-5.2 0 3.6-2.2 5.2-6 5.2Z"/>
                  </svg>
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14.5, color: '#EAF3E2' }}>{t('wantFullClimateReport')}</div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 12, color: 'rgba(234,243,226,0.6)' }}>{t('climateReportDesc')}</div>
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(234,243,226,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </button>

            </div>
          );
        })()}

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

        {/* REPORTS — evidence grid + completeness + generate report */}
        {tab === 'Reports' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Site survey card */}
            {(() => {
              const sv = survey;
              const steps = [
                !!(sv?.siteType && sv.goals?.length > 0),
                !!(sv?.waterSource?.length),
                sv?.roofMainM2 !== undefined && sv?.roofMainM2 !== null,
                !!(sv?.landPrepMethod && sv.soilCondition),
                !!(sv?.existingCrops?.length),
                !!(sv?.farmingPractice && sv.challenges?.length),
              ];
              const done = steps.filter(Boolean).length;
              const pct = Math.round(done / 6 * 100);
              const GOAL_LABELS: Record<string, string> = {
                food: t('surveyGoalFood'), income: t('surveyGoalIncome'),
                soil: t('surveyGoalSoil'), education: t('surveyGoalEducation'),
              };
              return (
                <div style={{ background: '#FBF8F1', border: '1px solid #E6DDC9', borderRadius: 13, padding: '13px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ font: '700 10.5px/1 system-ui, sans-serif', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A7C62' }}>
                      {t('surveySectionLabel')}
                    </span>
                    <span style={{ font: '600 11px/1 system-ui, sans-serif', color: done === 6 ? '#3C6B3F' : '#B07A1E' }}>
                      {t('surveyStepsOf6').replace('{n}', String(done))}
                    </span>
                  </div>
                  <div style={{ height: 6, background: '#DCD2BD', borderRadius: 3, overflow: 'hidden', marginBottom: 10 }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: done === 6 ? '#3C6B3F' : '#B07A1E', borderRadius: 3, transition: 'width 0.4s ease' }} />
                  </div>
                  {(sv?.goals?.length ?? 0) > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
                      {(sv?.goals ?? []).map((g: string) => (
                        <span key={g} style={{ font: '500 11px/1 system-ui', padding: '4px 9px', borderRadius: 99, background: 'rgba(31,77,43,0.1)', color: '#1F4D2B' }}>
                          {GOAL_LABELS[g] ?? g}
                        </span>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => setSurveySheetOpen(true)}
                    style={{ width: '100%', font: '600 12.5px/1 system-ui, sans-serif', color: '#3C6B3F', background: 'rgba(31,77,43,0.08)', border: '1px solid rgba(31,77,43,0.2)', borderRadius: 9, padding: '9px 0', cursor: 'pointer' }}
                  >
                    {done === 6 ? t('surveyUpdateButton') : t('surveyOpenButton')}
                  </button>
                </div>
              );
            })()}

            {/* Report completeness bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                <span style={{ font: '700 10.5px/1 system-ui, sans-serif', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A7C62' }}>
                  {t('reportCompletenessLabel')}
                </span>
                <span style={{ font: '700 11px/1 system-ui, sans-serif', color: completeness >= 60 ? '#3C6B3F' : '#B07A1E' }}>
                  {completeness}%
                </span>
              </div>
              <div style={{ height: 8, background: '#DCD2BD', borderRadius: 5, overflow: 'hidden' }}>
                <div style={{ width: `${completeness}%`, height: '100%', background: completeness >= 60 ? '#3C6B3F' : '#B07A1E', borderRadius: 5, transition: 'width 0.4s ease' }} />
              </div>
            </div>

            {/* Evidence & Documents label + catalogue link */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ font: '700 10.5px/1 system-ui, sans-serif', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A7C62' }}>
                {t('reportEvidenceDocsLabel')}
              </span>
              <button
                onClick={() => setEvidenceCatalogueOpen(true)}
                style={{ font: '500 11.5px/1 system-ui, sans-serif', color: '#3C6B3F', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                {t('reportFullLibraryLink')} →
              </button>
            </div>

            {/* Evidence group cards 2-col */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {EVIDENCE_CATALOGUE.map((group) => {
                const count = getGroupCount(siteId, group.key);
                const allItems = getSiteEvidence(siteId);
                const groupPhotos: EvidenceItem[] = Object.entries(allItems)
                  .filter(([k]) => k.startsWith(group.key))
                  .flatMap(([, arr]) => arr)
                  .filter((e) => e.type === 'photo')
                  .slice(0, 3);

                return (
                  <button
                    key={group.key}
                    onClick={() => setEvidenceSheet({ group })}
                    style={{
                      background: '#FBF8F1', border: '1px solid #E6DDC9', borderRadius: 13,
                      padding: '13px 14px', cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: groupPhotos.length > 0 || count === 0 ? 11 : 0 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: group.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16 }}>
                        {EVIDENCE_GROUP_ICON[group.key]}
                      </div>
                      <span style={{ font: '600 13px/1.2 system-ui, sans-serif', color: '#2D2519' }}>{REPORT_GROUP_LABEL[group.key] ?? group.label}</span>
                    </div>

                    {/* Thumbnail row or + prompt */}
                    <div style={{ display: 'flex', gap: 5 }}>
                      {groupPhotos.map((ev) => (
                        <div key={ev.id} style={{ width: 34, height: 34, borderRadius: 7, overflow: 'hidden', background: '#E0D6C2', flexShrink: 0 }}>
                          {ev.dataUrl && <img src={ev.dataUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                        </div>
                      ))}
                      <div style={{
                        width: 34, height: 34, borderRadius: 7,
                        border: '1.5px dashed #C3B695', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <span style={{ font: '400 18px/1 system-ui', color: '#9A8B6E' }}>+</span>
                      </div>
                    </div>

                    {count > 0 ? (
                      <div style={{ font: '400 11px/1 system-ui, sans-serif', color: '#9A8B6E', marginTop: 8 }}>{count} {count === 1 ? t('reportItemSingular') : t('reportItemPlural')}</div>
                    ) : (
                      <div style={{ font: '400 11px/1 system-ui, sans-serif', color: '#C0392B', marginTop: 8 }}>{REPORT_GROUP_ADD[group.key] ?? `Add ${group.label.toLowerCase()}`}</div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Site photos — full-width */}
            {(() => {
              const allItems = getSiteEvidence(siteId);
              const allPhotos = Object.values(allItems).flatMap((arr) => arr).filter((e) => e.type === 'photo');
              return (
                <button
                  onClick={() => setEvidenceSheet({ group: { key: 'site_photos', label: t('reportGroupSitePhotos'), color: '#7A5C92', bg: '#EAE0EE', iconBg: '#EAE0EE', items: [] } })}
                  style={{ background: '#FBF8F1', border: '1px solid #E6DDC9', borderRadius: 13, padding: '13px 14px', cursor: 'pointer', textAlign: 'left' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: '#EAE0EE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16 }}>
                      📸
                    </div>
                    <span style={{ font: '600 13px/1.2 system-ui, sans-serif', color: '#2D2519', flex: 1 }}>{t('reportGroupSitePhotos')}</span>
                    {allPhotos.length > 0 && <span style={{ font: '400 11px/1 system-ui, sans-serif', color: '#9A8B6E' }}>{t('reportPhotosCount').replace('{n}', String(allPhotos.length))}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {allPhotos.slice(0, 4).map((ev) => (
                      <div key={ev.id} style={{ flex: 1, height: 44, borderRadius: 8, overflow: 'hidden', background: '#E0D6C2', minWidth: 0 }}>
                        {ev.dataUrl && <img src={ev.dataUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                      </div>
                    ))}
                    <div style={{ width: 44, height: 44, borderRadius: 8, border: '1.5px dashed #C3B695', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ font: '400 20px/1 system-ui', color: '#9A8B6E' }}>+</span>
                    </div>
                  </div>
                </button>
              );
            })()}

            {/* Generate report button */}
            {data && (
              <button
                onClick={() => onOpenReport?.()}
                className="w-full flex items-center justify-center gap-2 rounded-xl font-display font-semibold"
                style={{ background: '#274D2C', color: '#EAF3E2', padding: '14px 16px', fontSize: 14.5, border: 'none', cursor: 'pointer' }}
              >
                <FileText size={16} color="#CDEBB6" />
                {t('generateFullReport')}
              </button>
            )}

            {/* Saved reports */}
            {savedReports.length > 0 && (
              <>
                <div style={{ font: '700 10.5px/1 system-ui, sans-serif', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A7C62' }}>
                  {t('savedReportsHeader')}
                </div>
                {savedReports.map((r) => (
                  <div key={r.id} className="rounded-xl p-3 flex items-center gap-2" style={{ background: '#FBF6EC', border: '1px solid #E2D8C4' }}>
                    <button onClick={() => onViewReport?.(r)} className="flex-1 min-w-0 text-left">
                      <div className="text-sm font-display font-semibold truncate" style={{ color: '#20190F' }}>{r.name}</div>
                      <div className="text-xs font-mono" style={{ color: '#5C5040' }}>
                        {new Date(r.savedAt).toLocaleDateString()} · {Math.abs(r.location.lat).toFixed(3)}°S {r.location.lon.toFixed(3)}°E
                      </div>
                    </button>
                    <button onClick={() => onViewReport?.(r)} className="px-3 py-1.5 rounded-lg text-xs font-display font-semibold flex-shrink-0"
                      style={{ background: 'rgba(31,77,43,0.1)', border: '1px solid rgba(31,77,43,0.3)', color: '#1F4D2B' }}>
                      {t('reportOpenButton')}
                    </button>
                    <button onClick={() => deleteReport(r.id)} title="Delete" className="px-2 py-1.5 flex-shrink-0 flex items-center" style={{ color: '#5C5040' }}><Trash2 size={14} /></button>
                  </div>
                ))}
              </>
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
                <div className="font-display font-semibold" style={{ fontSize: 17, color: '#20190F' }}>{t('surveyPromptTitle')}</div>
                <div className="font-sans" style={{ fontSize: 13, color: '#5C5040', lineHeight: 1.5, marginTop: 3 }}>
                  {t('surveyPromptBody')}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <button onClick={() => { setSurveyPromptOpen(false); setSurveySheetOpen(true); }}
                className="w-full flex items-center justify-center gap-2 font-sans font-bold"
                style={{ height: 46, borderRadius: 13, background: '#1F4D2B', color: '#F7F2E9', border: 'none', fontSize: 14, cursor: 'pointer' }}>
                {t('surveyFillButton')}
              </button>
              <button onClick={() => { setSurveyPromptOpen(false); openPhotoOrReport(); }}
                className="w-full flex items-center justify-center font-sans font-semibold"
                style={{ height: 40, borderRadius: 13, background: 'transparent', color: '#8C7A62', border: 'none', fontSize: 13, cursor: 'pointer' }}>
                {t('surveySkipButton')}
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
                <div className="font-display font-semibold" style={{ fontSize: 17, color: '#20190F' }}>{t('photoPromptTitle')}</div>
                <div className="font-sans" style={{ fontSize: 13, color: '#5C5040', lineHeight: 1.5, marginTop: 3 }}>
                  {t('photoPromptBody')}
                </div>
              </div>
            </div>

            {/* What to photograph */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                { Icon: Camera,   label: t('photoLabelAllDirections'),   detail: t('photoDetailAllDirections') },
                { Icon: Layers,   label: t('photoLabelSoilProfile'),     detail: t('photoDetailSoilProfile') },
                { Icon: Droplets, label: t('photoLabelWaterDrainage'),   detail: t('photoDetailWaterDrainage') },
                { Icon: Leaf,     label: t('photoLabelWhatsGrowing'),    detail: t('photoDetailWhatsGrowing') },
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
                <span className="font-sans font-semibold" style={{ fontSize: 13, color: '#1F4D2B' }}>{t('photoTapToAdd')}</span>
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
                    ? <><Loader2 size={16} className="animate-spin" />{t('photoAnalysingButton')}</>
                    : <><Camera size={16} />{t('photoAnalyseGenerateButton')}</>}
                </button>
              )}
              <button
                onClick={() => { setPhotoPromptOpen(false); onOpenReport(photoAnalysis); }}
                className="w-full flex items-center justify-center font-sans font-semibold"
                style={{ height: 40, borderRadius: 13, background: 'transparent', color: '#8C7A62', border: 'none', fontSize: 13, cursor: 'pointer' }}>
                {t('photoSkipButton')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Evidence sheet ── */}
      {evidenceSheet && (
        <EvidenceSheet
          siteId={siteId}
          group={evidenceSheet.group}
          item={evidenceSheet.item}
          onClose={() => setEvidenceSheet(null)}
          onChanged={() => setEvidenceTick((n) => n + 1)}
        />
      )}

      {/* ── Evidence catalogue modal ── */}
      {evidenceCatalogueOpen && (
        <EvidenceCatalogue
          siteId={siteId}
          onClose={() => setEvidenceCatalogueOpen(false)}
          onChanged={() => setEvidenceTick((n) => n + 1)}
        />
      )}
    </div>
  );
}

// Group icons used in the Reports tab evidence grid
const EVIDENCE_GROUP_ICON: Record<string, string> = {
  water: '💧',
  structures: '🏠',
  soil: '🌱',
  trees: '🌿',
  animals: '🐓',
  energy: '⚡',
  site_photos: '📸',
};
