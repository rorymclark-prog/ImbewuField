'use client';

import { useState, useEffect } from 'react';
import { Sprout, Leaf, Droplets, Sun, Snowflake } from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';
import SettingsButton from '@/components/SettingsButton';
import TabBar from '@/components/TabBar';
import LessonLink from '@/components/design/LessonLink';
import { activeAccountLocalStorageKey } from '@/lib/account-local-storage';
import { CATALOG_KEY_FOR_CROP } from '@/lib/crop-display';
import { sowMarksForPattern, type PlantMark } from '@/lib/crop-calendar';

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

interface CropRow {
  name: string;
  catalogKey: string;
  marks: PlantMark[];
  harvestMonths: number[]; // 0-indexed
}

const CALENDAR_RAIN_PATTERN = 'summer' as const;

const CROPS: CropRow[] = [
  { name: 'Spinach', catalogKey: CATALOG_KEY_FOR_CROP.Spinach, harvestMonths: [5, 6, 7, 8, 9] },
  { name: 'Tomatoes', catalogKey: CATALOG_KEY_FOR_CROP.Tomatoes, harvestMonths: [11, 0, 1, 2] },
  { name: 'Maize', catalogKey: CATALOG_KEY_FOR_CROP.Maize, harvestMonths: [1, 2, 3] },
  { name: 'Beans', catalogKey: CATALOG_KEY_FOR_CROP.Beans, harvestMonths: [11, 0, 1, 2] },
  { name: 'Carrots', catalogKey: CATALOG_KEY_FOR_CROP.Carrots, harvestMonths: [5, 6, 7, 8] },
  { name: 'Sweet Potato', catalogKey: CATALOG_KEY_FOR_CROP['Sweet potato'], harvestMonths: [1, 2, 3] },
  { name: 'Garlic', catalogKey: CATALOG_KEY_FOR_CROP.Garlic, harvestMonths: [8, 9, 10] },
  { name: 'Pumpkin', catalogKey: CATALOG_KEY_FOR_CROP.Pumpkin, harvestMonths: [1, 2, 3] },
].map((crop) => ({
  ...crop,
  marks: sowMarksForPattern(crop.catalogKey, CALENDAR_RAIN_PATTERN),
}));

// ---------------------------------------------------------------------------
// Monthly planting / harvest / maintain data
// ---------------------------------------------------------------------------

interface MonthData {
  plant: string[];
  harvest: string[];
  maintain: string[];
  season: 'summer' | 'autumn' | 'winter' | 'spring';
  limaAdvice: string;
}

const MONTHLY_DATA: MonthData[] = [
  // Jan (0) — midsummer
  {
    season: 'summer',
    plant: ['Maize (succession sow)', 'Beans', 'Sweet potato slips', 'Pumpkin'],
    harvest: ['Tomatoes', 'Beans', 'Maize', 'Pumpkin', 'Sweet potato'],
    maintain: [
      'Water deeply early morning — evaporation peaks this month',
      'Mulch thickly to retain soil moisture',
      'Check for pests daily: aphids, whitefly, cutworm',
      'Turn compost every two weeks — heat accelerates breakdown',
    ],
    limaAdvice:
      'Midsummer in the Southern Hemisphere is prime harvest season. Focus energy on watering and pest patrol. Any bare soil should be mulched immediately — this is the biggest yield-protector you have in January.',
  },
  // Feb (1) — late summer
  {
    season: 'summer',
    plant: ['Beans (last sow)', 'Sweet potato (transition)'],
    harvest: ['Maize', 'Beans', 'Sweet potato', 'Pumpkin', 'Tomatoes'],
    maintain: [
      'Continue deep watering — soil dries fast',
      'Side-dress maize with compost if growth is slow',
      'Begin curing pumpkins and sweet potatoes for storage',
      'Remove spent tomato plants before disease spreads',
    ],
    limaAdvice:
      'Late-summer rains can bring fungal pressure. Increase airflow around tomatoes by removing lower leaves. Cure harvested sweet potatoes in a warm shaded spot for 10 days before storage — this heals the skin and extends shelf life greatly.',
  },
  // Mar (2) — early autumn
  {
    season: 'autumn',
    plant: ['Spinach (possible)', 'Carrots (possible)', 'Garlic (possible)'],
    harvest: ['Maize (finish)', 'Sweet potato (finish)', 'Pumpkin (finish)', 'Garlic (late)'],
    maintain: [
      'Clear summer beds and add compost before cooler season',
      'Prep soil for winter crops — loosen compacted rows',
      'Collect and dry seeds from tomatoes, beans, pumpkin',
      'Check irrigation systems before dry months',
    ],
    limaAdvice:
      'March is the hinge month: summer crops winding down, winter crops about to start. Take a day to map which beds you want for spinach, carrots, and garlic — cooler soil from April onwards gives them the strong germination they need.',
  },
  // Apr (3) — autumn
  {
    season: 'autumn',
    plant: ['Spinach', 'Carrots', 'Garlic'],
    harvest: ['Spinach (early)', 'Carrots (early)'],
    maintain: [
      'Plant garlic cloves pointed-end up, 10 cm deep',
      'Sow spinach and carrots in well-composted beds',
      'Reduce watering frequency as temperatures drop',
      'Apply compost mulch to protect soil in cooler nights',
    ],
    limaAdvice:
      'April is the best time to plant garlic in most of South Africa. Use healthy large cloves from disease-free stock. Spinach germinates well now — thin seedlings to 15 cm apart for big leaves. Cooler nights mean less pest pressure: advantage yours.',
  },
  // May (4) — mid-autumn
  {
    season: 'autumn',
    plant: ['Spinach', 'Carrots', 'Garlic (succession)'],
    harvest: ['Spinach', 'Carrots (early)'],
    maintain: [
      'Weed regularly — winter weeds compete aggressively',
      'Apply liquid seaweed fertiliser to new plantings',
      'Check soil drainage before winter rains arrive',
      'Start a second compost heap from dry autumn leaves',
    ],
    limaAdvice:
      'Succession sow spinach every 3 weeks from May through July for a continuous harvest window. Carrots sown now will be ready by August. Autumn is also the ideal time to improve soil — dig in mature compost now and the earthworms will do the rest over winter.',
  },
  // Jun (5) — winter
  {
    season: 'winter',
    plant: ['Spinach', 'Garlic (last sow)'],
    harvest: ['Spinach', 'Carrots', 'Garlic (early greens)'],
    maintain: [
      'Protect tender seedlings from frost with shade cloth or row cover',
      'Water only when soil is dry — overwatering in winter causes root rot',
      'Clear weeds before they set seed',
      'Use cold mornings to plan next season — sketch crop rotations',
    ],
    limaAdvice:
      'June is the coldest month in the Highveld. In frost-prone areas, protect spinach seedlings overnight with fleece or dry grass. On the coast and in the Cape, June is actually ideal growing weather — focus there on maximising yields before spring heat arrives.',
  },
  // Jul (6) — winter
  {
    season: 'winter',
    plant: ['Spinach', 'Carrots (last sow)'],
    harvest: ['Spinach', 'Carrots', 'Garlic greens'],
    maintain: [
      'Keep beds weed-free — fewer weeds mean more soil nutrients for your crops',
      'Check stored pumpkins and sweet potatoes for rot',
      'Prep compost with dry matter for spring feeds',
      'Order or source seeds for spring planting — supply runs thin by September',
    ],
    limaAdvice:
      'July is the deepest point of the growing pause. Use the time well: source good tomato, bean, and maize seed now while it is plentiful and cheap. Mid-July, start tomato seeds indoors in trays if you have a warm spot — they will be ready to transplant by September.',
  },
  // Aug (7) — late winter / early spring
  {
    season: 'winter',
    plant: ['Tomatoes (trays indoors)', 'Beans (transitional)', 'Spinach (last sow)'],
    harvest: ['Spinach', 'Carrots', 'Garlic greens'],
    maintain: [
      'Start tomato and pepper seeds in warm trays indoors',
      'Prepare spring beds — dig in compost before the heat arrives',
      'Last chance to plant carrots before spring warmth slows germination',
      'Remove frost cloth as days warm — let sun strengthen seedlings',
    ],
    limaAdvice:
      'August signals transition. Sow tomato seeds indoors now — 6 to 8 weeks before your last frost gives transplants a running start. In frost-free coastal regions you can direct-sow tomatoes in the ground by late August. Begin loosening winter-compacted soil in every bed.',
  },
  // Sep (8) — spring
  {
    season: 'spring',
    plant: ['Tomatoes (transplant)', 'Beans', 'Maize (early)', 'Pumpkin (early)', 'Sweet potato'],
    harvest: ['Spinach (last)', 'Carrots (finish)', 'Garlic'],
    maintain: [
      'Harden off tomato seedlings — move outside for a few hours each day',
      'Prepare trellises and cages for climbing beans and tomatoes',
      'Begin regular watering schedule as temperatures rise',
      'Apply compost tea to beds before transplanting',
    ],
    limaAdvice:
      'Spring arrives quickly in South Africa — do not rush tomato transplants into cold soil. Wait until night temperatures stay above 12 °C. September is also garlic harvest month: leaves yellowing from the base means the bulb is ready. Cure harvested garlic in a shaded, airy spot for two weeks.',
  },
  // Oct (9) — spring
  {
    season: 'spring',
    plant: ['Tomatoes', 'Beans', 'Maize', 'Sweet potato', 'Pumpkin', 'Spinach (last call)'],
    harvest: ['Garlic', 'Carrots (finish)'],
    maintain: [
      'Increase watering as heat builds',
      'Pinch out tomato suckers for stronger central growth',
      'Stake maize in pairs — cross-pollination needs plant proximity',
      'Mulch deeply around all beds to prepare for summer heat',
    ],
    limaAdvice:
      'October is the most active planting month in summer-rainfall regions. Get everything in the ground before the real heat arrives. Stagger maize sowing over two to three weeks to spread the harvest. Water tomatoes consistently — irregular watering now causes blossom-end rot in January.',
  },
  // Nov (10) — late spring
  {
    season: 'spring',
    plant: ['Tomatoes (final sow)', 'Beans', 'Maize (succession)', 'Pumpkin'],
    harvest: ['Garlic (finish)', 'Spinach (bolt watch)'],
    maintain: [
      'Watch for tomato flower drop in afternoon heat — mulch and consistent water helps',
      'Tie bean and pumpkin vines as they sprawl',
      'Patrol for cutworm at night — hand-pick or use DE around stems',
      'Keep compost moist in the heat',
    ],
    limaAdvice:
      'November brings the first summer rains in many regions — a welcome relief after spring dry spells. Do not skip watering: rain is unpredictable and surface-shallow. Deep irrigation weekly beats shallow rain every time for root development. Protect young maize from strong wind after rain.',
  },
  // Dec (11) — early summer
  {
    season: 'summer',
    plant: ['Beans (late)', 'Maize (last succession)'],
    harvest: ['Tomatoes (first)', 'Beans', 'Maize (early)', 'Pumpkin'],
    maintain: [
      'Harvest tomatoes before they overripen in the heat',
      'Water daily in the morning — evening watering invites fungal disease',
      'Tie up heavy tomato trusses to prevent stem snap',
      'Record what worked this season before you forget — next year will thank you',
    ],
    limaAdvice:
      'The first tomatoes of the season are a milestone. Pick them at first blush and let them ripen indoors — they develop more flavour off the vine in the heat of December. This is also the month to take stock: what germinated well, what failed, what variety performed. That knowledge is your most valuable harvest.',
  },
];

// ---------------------------------------------------------------------------
// Season icon helper
// ---------------------------------------------------------------------------

function SeasonIcon({ season, size = 16 }: { season: MonthData['season']; size?: number }) {
  if (season === 'summer') return <Sun size={size} color="#C07A1E" strokeWidth={1.6} />;
  if (season === 'winter') return <Snowflake size={size} color="#235E86" strokeWidth={1.6} />;
  if (season === 'spring') return <Sprout size={size} color="#1F4D2B" strokeWidth={1.6} />;
  return <Leaf size={size} color="#5C5040" strokeWidth={1.6} />;
}

function seasonLabel(season: MonthData['season']) {
  const map: Record<MonthData['season'], string> = {
    summer: 'Summer',
    autumn: 'Autumn',
    winter: 'Winter',
    spring: 'Spring',
  };
  return map[season];
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: 'var(--font-mono, monospace)',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.10em',
        textTransform: 'uppercase',
        color: '#8C7A62',
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        background: color + '14',
        border: `1px solid ${color}30`,
        borderRadius: 20,
        padding: '3px 10px',
        fontSize: 13,
        fontFamily: 'var(--font-sans, sans-serif)',
        color: '#20190F',
        marginRight: 6,
        marginBottom: 6,
      }}
    >
      {children}
    </span>
  );
}

function Dot({ mark }: { mark: PlantMark }) {
  if (mark === 'B') {
    return (
      <span
        style={{
          display: 'inline-block',
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: '#1F4D2B',
          flexShrink: 0,
        }}
        aria-label="Best time to plant"
      />
    );
  }
  return <span style={{ display: 'inline-block', width: 10, height: 10 }} />;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CalendarPage() {
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [myPlannerCrops, setMyPlannerCrops] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(
        activeAccountLocalStorageKey('imbewu_planner_crops'),
      );
      if (raw) setMyPlannerCrops(JSON.parse(raw) as string[]);
    } catch { /* ignore */ }
  }, []);

  const visibleCrops = myPlannerCrops.length > 0
    ? CROPS.filter((c) => myPlannerCrops.some((p) => p.toLowerCase() === c.name.toLowerCase()))
    : CROPS;
  const isFiltered = myPlannerCrops.length > 0;

  const monthData = MONTHLY_DATA[selectedMonth];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        overflow: 'hidden',
        background: '#E4DCC6',
      }}
    >
      {/* Header */}
      <header className="flex-shrink-0 flex items-center px-4 gap-3" style={{ height: 52, background: '#FFFEFA', borderBottom: '1px solid #E2D8C4' }}>
        <BrandLogo />
        <div className="w-px h-5" style={{ background: '#E2D8C4' }} />
        <span className="text-xs font-display" style={{ color: '#5C5040' }}>Planting Calendar</span>
        <div className="flex-1" />
        <LessonLink id="crops:calendar" label="Learn" />
        <SettingsButton />
      </header>

      {/* Scrollable body */}
      <main
        style={{
          flex: 1,
          overflowY: 'auto',
          background: '#E4DCC6',
        }}
      >
        {/* ---- Month strip ---- */}
        <div
          style={{
            background: '#FFFEFA',
            borderBottom: '1px solid #E2D8C4',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: 4,
              padding: '10px 14px',
              minWidth: 'max-content',
            }}
          >
            {MONTH_ABBR.map((abbr, idx) => {
              const active = idx === selectedMonth;
              return (
                <button
                  key={abbr}
                  onClick={() => setSelectedMonth(idx)}
                  style={{
                    background: active ? '#1F4D2B' : 'transparent',
                    border: active ? '1px solid #1F4D2B' : '1px solid #E2D8C4',
                    borderRadius: 8,
                    color: active ? '#EAF3E2' : '#5C5040',
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: 12,
                    fontWeight: active ? 700 : 500,
                    padding: '5px 11px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    flexShrink: 0,
                    letterSpacing: '0.04em',
                  }}
                  aria-pressed={active}
                  aria-label={`Select ${MONTH_ABBR[idx]}`}
                >
                  {abbr}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ padding: '16px 16px 24px' }}>
          {/* ---- What to do this month ---- */}
          <div
            style={{
              background: '#FFFEFA',
              border: '1px solid #E2D8C4',
              borderRadius: 14,
              padding: '16px',
              marginBottom: 16,
            }}
          >
            {/* Card header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 20,
                    fontWeight: 600,
                    color: '#20190F',
                    lineHeight: 1.2,
                  }}
                >
                  {MONTH_ABBR[selectedMonth]} — What to do
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    marginTop: 4,
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: 11,
                    color: '#8C7A62',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  <SeasonIcon season={monthData.season} size={13} />
                  {seasonLabel(monthData.season)}
                </div>
              </div>
            </div>

            {/* Plant */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Sprout size={14} color="#1F4D2B" strokeWidth={1.7} />
                <SectionLabel>Plant now</SectionLabel>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                {monthData.plant.length > 0 ? (
                  monthData.plant.map((crop) => (
                    <Pill key={crop} color="#1F4D2B">
                      {crop}
                    </Pill>
                  ))
                ) : (
                  <span style={{ fontSize: 13, color: '#8C7A62', fontStyle: 'italic' }}>
                    No planting recommended this month
                  </span>
                )}
              </div>
            </div>

            {/* Harvest */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Leaf size={14} color="#C07A1E" strokeWidth={1.7} />
                <SectionLabel>Harvest ready</SectionLabel>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                {monthData.harvest.length > 0 ? (
                  monthData.harvest.map((crop) => (
                    <Pill key={crop} color="#C07A1E">
                      {crop}
                    </Pill>
                  ))
                ) : (
                  <span style={{ fontSize: 13, color: '#8C7A62', fontStyle: 'italic' }}>
                    Nothing ready to harvest this month
                  </span>
                )}
              </div>
            </div>

            {/* Maintain */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Droplets size={14} color="#235E86" strokeWidth={1.7} />
                <SectionLabel>Maintain</SectionLabel>
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {monthData.maintain.map((task) => (
                  <li
                    key={task}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      marginBottom: 6,
                      fontSize: 13,
                      fontFamily: 'var(--font-sans, sans-serif)',
                      color: '#20190F',
                      lineHeight: 1.45,
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-block',
                        width: 5,
                        height: 5,
                        borderRadius: '50%',
                        background: '#235E86',
                        marginTop: 6,
                        flexShrink: 0,
                      }}
                    />
                    {task}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* ---- Lima tip card ---- */}
          <div
            style={{
              background: '#1F4D2B0D',
              border: '1px solid #1F4D2B30',
              borderRadius: 14,
              padding: '14px 16px',
              marginBottom: 16,
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
            }}
          >
            <div
              style={{
                background: '#1F4D2B',
                borderRadius: 8,
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: 1,
              }}
            >
              {/* Lima sprout icon */}
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#EAF3E2"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 21V11" />
                <path d="M12 11c0-3.5-2.5-6-6.5-6 0 4 2.5 6 6.5 6Z" />
                <path d="M12 13c0-3 2.2-5.2 6-5.2 0 3.6-2.2 5.2-6 5.2Z" />
              </svg>
            </div>
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.10em',
                  textTransform: 'uppercase',
                  color: '#1F4D2B',
                  marginBottom: 5,
                }}
              >
                Lima — Seasonal advice
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  fontFamily: 'var(--font-sans, sans-serif)',
                  color: '#20190F',
                  lineHeight: 1.55,
                }}
              >
                {monthData.limaAdvice}
              </p>
            </div>
          </div>

          {/* ---- SA Planting Calendar Grid ---- */}
          <div
            style={{
              background: '#FFFEFA',
              border: '1px solid #E2D8C4',
              borderRadius: 14,
              overflow: 'hidden',
              marginBottom: 8,
            }}
          >
            {/* Grid header */}
            <div
              style={{
                padding: '12px 14px 8px',
                borderBottom: '1px solid #E2D8C4',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 16,
                  fontWeight: 600,
                  color: '#20190F',
                  marginBottom: 2,
                }}
              >
                12-Month Planting Grid
              </div>
              {/* Legend */}
              <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Dot mark="B" />
                  <span
                    style={{
                      fontSize: 11,
                      fontFamily: 'var(--font-mono, monospace)',
                      color: '#5C5040',
                    }}
                  >
                    In catalog sowing window
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: 'var(--font-mono, monospace)',
                    color: '#5C5040',
                  }}
                >
                  Summer-rainfall pattern
                </span>
              </div>
            </div>

            {/* Crop planner filter notice */}
            {isFiltered && (
              <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(31,77,43,0.06)', border: '1px solid rgba(31,77,43,0.15)', borderRadius: 10, fontSize: 12, fontFamily: 'var(--font-sans)', color: '#1F4D2B', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Showing your {visibleCrops.length} planned crops</span>
                <button onClick={() => setMyPlannerCrops([])} style={{ fontSize: 11, color: '#5C5040', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                  Show all
                </button>
              </div>
            )}

            {/* Scrollable table */}
            <div
              style={{
                overflowX: 'auto',
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none',
              }}
            >
              <table
                style={{
                  borderCollapse: 'collapse',
                  width: '100%',
                  minWidth: 560,
                }}
                aria-label="South African planting calendar"
              >
                <thead>
                  <tr style={{ background: '#E4DCC6' }}>
                    <th
                      style={{
                        padding: '7px 14px',
                        textAlign: 'left',
                        fontFamily: 'var(--font-mono, monospace)',
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: '#8C7A62',
                        borderBottom: '1px solid #E2D8C4',
                        whiteSpace: 'nowrap',
                        minWidth: 110,
                        position: 'sticky',
                        left: 0,
                        background: '#E4DCC6',
                        zIndex: 1,
                      }}
                    >
                      Crop
                    </th>
                    {MONTH_ABBR.map((abbr, idx) => (
                      <th
                        key={abbr}
                        style={{
                          padding: '7px 4px',
                          textAlign: 'center',
                          fontFamily: 'var(--font-mono, monospace)',
                          fontSize: 10,
                          fontWeight: idx === selectedMonth ? 700 : 500,
                          letterSpacing: '0.06em',
                          color: idx === selectedMonth ? '#1F4D2B' : '#8C7A62',
                          borderBottom: '1px solid #E2D8C4',
                          borderLeft: '1px solid #E2D8C420',
                          background:
                            idx === selectedMonth ? '#1F4D2B12' : '#E4DCC6',
                          minWidth: 36,
                        }}
                      >
                        {abbr}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleCrops.map((crop, rowIdx) => (
                    <tr
                      key={crop.name}
                      style={{
                        background: rowIdx % 2 === 0 ? '#FFFEFA' : '#E4DCC6',
                      }}
                    >
                      {/* Crop name — sticky left */}
                      <td
                        style={{
                          padding: '9px 14px',
                          fontFamily: 'var(--font-sans, sans-serif)',
                          fontSize: 13,
                          fontWeight: 500,
                          color: '#20190F',
                          borderBottom: '1px solid #E2D8C430',
                          whiteSpace: 'nowrap',
                          position: 'sticky',
                          left: 0,
                          background: rowIdx % 2 === 0 ? '#FFFEFA' : '#E4DCC6',
                          zIndex: 1,
                        }}
                      >
                        {crop.name}
                      </td>
                      {crop.marks.map((mark, monthIdx) => (
                        <td
                          key={monthIdx}
                          style={{
                            padding: '9px 4px',
                            textAlign: 'center',
                            borderBottom: '1px solid #E2D8C430',
                            borderLeft: '1px solid #E2D8C420',
                            background:
                              monthIdx === selectedMonth
                                ? '#1F4D2B0A'
                                : 'transparent',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'center',
                              alignItems: 'center',
                            }}
                          >
                            <Dot mark={mark} />
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom breathing room */}
          <div style={{ height: 8 }} />
        </div>
      </main>

      <TabBar />
    </div>
  );
}
