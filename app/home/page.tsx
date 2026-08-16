'use client';

import Link from 'next/link';
import {
  Sprout,
  Users,
  BarChart3,
  Building2,
  GraduationCap,
  ChevronRight,
  ChevronDown,
  Settings,
  Leaf,
  CalendarDays,
  ClipboardList,
  Camera,
  Menu,
  DollarSign,
  MessageCircle,
  Wheat,
  Circle,
  CheckCircle2,
  CalendarPlus,
  Sparkles,
  Tag,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { enterSampleMode } from '@/lib/sample-mode';
import ThemePanel from '@/components/ThemePanel';
import LimaBar from '@/components/LimaBar';
import TabBar from '@/components/TabBar';
import NavDrawer from '@/components/NavDrawer';
import HomeHeroCard from '@/components/home/HomeHeroCard';
import { useLanguage } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { getLastSite, type LastSite } from '@/lib/last-site';
import LessonLink from '@/components/design/LessonLink';
import { loadPlaces, resolveMainSite, setMainSiteId, type SavedPlace } from '@/lib/saved-places';
import { TASK_BOARD_CHANGED_EVENTS, loadCropBoardTasks, loadCompletedTaskIds, setCompletedTaskState, downloadTaskIcs, type BoardTask } from '@/lib/task-board';
import { useSiteProgress, type Coords } from '@/lib/site-progress';
import type { CompletionStepKey } from '@/lib/completion-score';
import WeatherWidget from '@/components/WeatherWidget';

// Map app lang codes to BCP 47 locale codes for date formatting.
// Falls back to 'en-ZA' for any code not listed (covers future additions).
const LANG_TO_LOCALE: Record<string, string> = {
  en: 'en-ZA',
  af: 'af-ZA',
  zu: 'zu-ZA',
  xh: 'xh-ZA',
  st: 'st-ZA',
  nso: 'nso-ZA',
  tn: 'tn-ZA',
  ts: 'ts-ZA',
  ve: 've-ZA',
  ss: 'ss-ZA',
  nr: 'nr-ZA',
};

function getDayDate(lang: string) {
  const locale = LANG_TO_LOCALE[lang] ?? 'en-ZA';
  const now = new Date();
  const day = now.toLocaleDateString(locale, { weekday: 'long' });
  const date = now.toLocaleDateString(locale, { day: 'numeric', month: 'long' });
  return `${day} · ${date}`;
}

function LastSiteCard({ site }: { site: LastSite }) {
  const { t } = useLanguage();
  const d = site.locationData;
  const stats = [
    { label: t('homeStatRain'), value: `${d.rainfall.annual}mm/yr` },
    { label: t('homeStatTemp'), value: `${d.climate.meanTemp}°C avg` },
    { label: t('homeStatSoilPH'), value: String(d.soil.ph) },
    { label: t('homeStatASL'), value: `${d.elevation.elevation}m` },
  ];
  return (
    <Link href="/farmer" style={{ textDecoration: 'none' }}>
      <div
        className="rounded-2xl p-4"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest" style={{ color: 'var(--color-muted)', letterSpacing: '0.1em' }}>{t('homeLastSite')}</div>
            <div className="font-display font-semibold text-base mt-0.5" style={{ color: 'var(--color-ink)' }}>{d.biome.name}</div>
          </div>
          <div className="flex items-center gap-1 text-xs font-display" style={{ color: 'var(--color-forest-800)' }}>
            {t('homeReopenMap')}<ChevronRight size={13} />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl px-2.5 py-2 text-center" style={{ background: 'rgba(31,77,43,0.06)', border: '1px solid rgba(31,77,43,0.08)' }}>
              <div className="font-display font-semibold text-sm" style={{ color: 'var(--color-ink)' }}>{s.value}</div>
              <div className="font-mono mt-0.5" style={{ color: 'var(--color-muted)', fontSize: 10 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </Link>
  );
}

// Weather for the farmer's designated MAIN site — separate from LastSiteCard
// (which tracks the last-VIEWED map point, not necessarily a saved/main site).
function MainSiteWeatherCard({ site, places, onSetMain }: { site: SavedPlace; places: SavedPlace[]; onSetMain: (id: string) => void }) {
  const { t } = useLanguage();
  const showPicker = places.length > 1;
  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-xs font-mono uppercase tracking-widest" style={{ color: 'var(--color-muted)', letterSpacing: '0.1em' }}>{t('homeMainSite')}</div>
          <div className="font-display font-semibold text-base mt-0.5" style={{ color: 'var(--color-ink)' }}>{site.name}</div>
        </div>
        {showPicker && (
          <select
            value={site.id}
            onChange={(e) => onSetMain(e.target.value)}
            aria-label={t('homeSetAsMain')}
            className="font-sans"
            style={{ fontSize: 11, border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-surface)', color: 'var(--color-muted-strong)', padding: '4px 6px', maxWidth: 120 }}
          >
            {places.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
      </div>
      <WeatherWidget lat={site.lat} lon={site.lon} compact />
    </div>
  );
}

// Soonest 4 by monthsAway, with completed items sorted to the bottom of that
// set rather than removed — avoids a task vanishing (and the card jumping in
// height) the instant it's ticked off.
const VISIBLE_TASK_COUNT = 4;
function visibleBoardTasks(tasks: BoardTask[]): BoardTask[] {
  return tasks.slice(0, VISIBLE_TASK_COUNT).sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1));
}

function TaskBoardCard({ tasks, onToggle }: { tasks: BoardTask[]; onToggle: (id: string) => void }) {
  const { t } = useLanguage();
  const visible = visibleBoardTasks(tasks);
  return (
    <section>
      <div className="flex items-center justify-between" style={{ padding: '2px 2px' }}>
        <span className="uppercase tracking-widest font-sans" style={{ fontSize: 10, color: 'var(--color-muted)', letterSpacing: '0.12em' }}>
          {t('homeUpcomingTasks')}
        </span>
        <Link href="/facilitator/crops" className="flex items-center gap-1 font-display" style={{ fontSize: 12, color: 'var(--color-forest-800)', textDecoration: 'none' }}>
          {t('homeTaskBoardViewPlan')}<ChevronRight size={13} />
        </Link>
      </div>
      <div className="mt-2.5" style={{ background: 'var(--color-surface)', borderRadius: 16, border: '1px solid var(--color-border)', overflow: 'hidden', boxShadow: '0 1px 3px rgba(32,25,15,0.06)' }}>
        {visible.map((task, i) => (
          <div
            key={task.id}
            style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px', borderBottom: i < visible.length - 1 ? '1px solid var(--color-border)' : 'none' }}
          >
            <button
              onClick={() => onToggle(task.id)}
              aria-label={task.completed ? 'Mark not done' : 'Mark done'}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', color: 'var(--color-forest-800)', flexShrink: 0 }}
            >
              {task.completed ? <CheckCircle2 size={20} strokeWidth={1.8} /> : <Circle size={20} strokeWidth={1.8} />}
            </button>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(31,77,43,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 17 }}>
              {task.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div
                className="font-display"
                style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-ink)', letterSpacing: '-0.01em', lineHeight: 1.2, textDecoration: task.completed ? 'line-through' : 'none', opacity: task.completed ? 0.5 : 1 }}
              >
                {task.title}
              </div>
              <div className="font-sans truncate" style={{ fontSize: 12.5, color: 'var(--color-muted-strong)', marginTop: 1, lineHeight: 1.4 }}>{task.subtitle}</div>
            </div>
            <button
              onClick={() => downloadTaskIcs(task)}
              aria-label="Add to calendar"
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', color: 'var(--color-muted)', flexShrink: 0 }}
            >
              <CalendarPlus size={18} strokeWidth={1.6} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

// Gamified "Your farm plan" progress card — overall % across the 5-stage
// completion score (lib/completion-score.ts) for the farmer's MAIN site, plus
// the single next action, deep-linked. Deliberately mirrors the same source
// of truth as DataPanel/NextStepCoach/HomeHeroCard (lib/site-progress.ts) so
// this can never drift into a second scoring path.
interface StepAction { label: string; href: (coords: Coords | null, siteId?: string) => string }
const STEP_ACTIONS: Record<CompletionStepKey, StepAction> = {
  located: { label: 'Tap your land on the map', href: () => '/farmer' },
  // Land on THIS site, reticle already armed to trace — the same imbewu-arm-draw handoff
  // the "+Add → Boundary" row fires on the map itself (components/Map.tsx), reached here
  // via the farmer page's ?arm= one-shot deep link (app/farmer/page.tsx). Used to be a bare
  // '/farmer': tapping "Trace your boundary" dropped the farmer on the default map with no
  // site loaded and nothing armed, so the coaching told them to do a thing this link never
  // actually started — same fix the NextStepCoach in-panel card already gets for free by
  // dispatching the event directly (it's already sitting on the right site).
  boundary: {
    label: 'Trace your boundary',
    href: (_c, siteId) => (siteId ? `/farmer?site=${siteId}&arm=site` : '/farmer?arm=site'),
  },
  // The real survey sheet that feeds this score lives inside DataPanel; /farmer?openSurvey=1
  // loads the main site and auto-opens it (the older /survey wizard used a different store
  // and never moved this score).
  survey: { label: 'Do the site survey', href: () => '/farmer?openSurvey=1' },
  design: {
    label: 'Design your farm',
    href: (c) => (c ? `/design?lat=${c.lat.toFixed(5)}&lon=${c.lon.toFixed(5)}` : '/design'),
  },
  cropPlan: { label: 'Plan your crops', href: () => '/facilitator/crops' },
};

function FarmPlanCard({ places, mainSite }: { places: SavedPlace[] | null; mainSite: SavedPlace | null }) {
  const coords: Coords | null = mainSite ? { lat: mainSite.lat, lon: mainSite.lon } : null;
  const progress = useSiteProgress(coords);

  // Hide entirely for a brand-new user — no saved places means nothing to show yet,
  // and the hero card's welcome variant already owns that moment. `progress` stays
  // null until useSiteProgress's post-mount effect runs (hydration-safe), so this
  // also renders nothing on the very first client tick, matching SSR.
  if (!places || places.length === 0) return null;
  if (!progress) return null;

  const { pct, nextStep } = progress;
  const designHref = coords ? `/design?lat=${coords.lat.toFixed(5)}&lon=${coords.lon.toFixed(5)}` : '/design';

  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 20, padding: '16px 18px' }}>
      <div className="font-display font-semibold" style={{ fontSize: 15, color: 'var(--color-ink)', marginBottom: 10 }}>
        Your farm plan
      </div>

      <div style={{ height: 8, borderRadius: 4, background: '#EDE7DB', overflow: 'hidden' }}>
        <div
          style={{ height: '100%', width: `${pct}%`, background: 'var(--color-forest-800)', borderRadius: 4, transition: 'width 0.4s ease' }}
        />
      </div>
      <div className="font-sans" style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 6 }}>
        {pct}% complete
      </div>

      {nextStep ? (
        <Link
          href={STEP_ACTIONS[nextStep].href(coords, mainSite?.id)}
          className="flex items-center justify-between font-sans font-semibold"
          style={{ marginTop: 12, fontSize: 14, color: 'var(--color-forest-800)', textDecoration: 'none' }}
        >
          {STEP_ACTIONS[nextStep].label}
          <ChevronRight size={16} strokeWidth={1.8} />
        </Link>
      ) : (
        <Link
          href={designHref}
          className="flex items-center font-sans font-semibold"
          style={{ marginTop: 12, fontSize: 14, color: 'var(--color-forest-800)', textDecoration: 'none' }}
        >
          Plan complete — print your plan set →
        </Link>
      )}
    </div>
  );
}

function HomeLandingInner() {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [lastSite, setLastSite] = useState<LastSite | null>(null);
  // null until the places effect runs → HomeHeroCard paints its DEFAULT (today's CTA)
  // on SSR/first render, so returning users never flash the new-user welcome.
  const [places, setPlaces] = useState<SavedPlace[] | null>(null);
  const [boardTasks, setBoardTasks] = useState<BoardTask[]>([]);
  const { user } = useAuth();
  const firstName = user?.displayName?.split(' ')[0] ?? null;

  useEffect(() => {
    setLastSite(getLastSite());
    const refresh = () => {
      setPlaces(loadPlaces());
      setBoardTasks(loadCropBoardTasks(loadCompletedTaskIds()));
    };
    refresh();
    // setMainSiteId() fires this same event, so the picker + weather block
    // and its task source update immediately without a page reload. Crop-plan
    // and canvas saves likewise refresh tasks while Home remains mounted.
    TASK_BOARD_CHANGED_EVENTS.forEach((event) => window.addEventListener(event, refresh));
    return () => TASK_BOARD_CHANGED_EVENTS.forEach((event) => window.removeEventListener(event, refresh));
  }, []);

  const mainSite = resolveMainSite(places ?? []);

  function toggleTaskComplete(id: string) {
    if (!boardTasks.some((task) => task.id === id)) return;
    const durableBefore = loadCompletedTaskIds();
    const durableAfter = setCompletedTaskState(id, !durableBefore.has(id));
    // Keep React's updater pure: Strict Mode may invoke it more than once, but the storage write
    // above must happen exactly once. Paint the state that actually survived localStorage.
    setBoardTasks((prev) => prev.map((task) => (
      task.id === id ? { ...task, completed: durableAfter.has(task.id) } : task
    )));
  }

  const ROLES = [
    { href: '/farmer',  Icon: Sprout,        label: t('homeRoleFarmerLabel'),  desc: t('homeRoleFarmerDesc') },
    { href: '/mentor',  Icon: Users,         label: t('homeRoleMentorLabel'),  desc: t('homeRoleMentorDesc') },
    { href: '/student', Icon: GraduationCap, label: t('homeRoleStudentLabel'), desc: t('homeRoleStudentDesc') },
    { href: '/ngo',     Icon: BarChart3,     label: t('homeRoleNGOLabel'),     desc: t('homeRoleNGODesc') },
    { href: '/funder',  Icon: Building2,     label: t('homeRoleFunderLabel'),  desc: t('homeRoleFunderDesc') },
  ];

  const QUICK_ACTIONS = [
    { href: '/finances',          Icon: DollarSign,    art: undefined as string | undefined, label: t('homeQuickFinance'),     desc: t('homeQuickFinanceDesc'),     color: 'var(--color-harvest)', bg: 'rgba(192,122,30,0.10)' },
    { href: '/student',           Icon: GraduationCap, art: undefined as string | undefined, label: t('homeQuickStudy'),       desc: t('homeQuickStudyDesc'),       color: 'var(--color-water)', bg: 'rgba(35,94,134,0.10)' },
    { href: '/contact',           Icon: MessageCircle, art: undefined as string | undefined, label: t('homeQuickContact'),     desc: t('homeQuickContactDesc'),     color: '#5A7A3A', bg: 'rgba(90,122,58,0.10)' },
    // These four carry real illustrated art (public/home-icons/) instead of a Lucide glyph —
    // same "art field with an Icon fallback" pattern as def.art in DesignPalette.tsx and
    // getCropArt() on the Prices/Exchange pages. Icon stays wired as the fallback if the art
    // path is ever wrong, never dead-code.
    { href: '/journal',           Icon: Leaf,          art: '/home-icons/journal.png',      label: t('homeQuickJournal'),     desc: t('homeQuickJournalDesc'),     color: 'var(--color-forest-800)', bg: 'rgba(31,77,43,0.08)' },
    { href: '/facilitator/crops', Icon: CalendarDays,  art: '/home-icons/crop-planner.png', label: t('homeQuickCropPlanner'), desc: t('homeQuickCropPlannerDesc'), color: 'var(--color-forest-800)', bg: 'rgba(31,77,43,0.08)' },
    { href: '/records',           Icon: Wheat,         art: '/home-icons/my-records.png',   label: t('homeQuickMyRecords'),   desc: t('homeQuickMyRecordsDesc'),   color: 'var(--color-forest-800)', bg: 'rgba(31,77,43,0.08)' },
    // Not translated via t() like the rest of this grid — deliberately, to avoid adding keys to
    // every locale block in lib/i18n.tsx (a large shared file well outside this change's scope) for
    // a single new tile. Falls back to plain English, same as this file's other hardcoded
    // farmer-facing strings (e.g. the "Your farm plan" and sample-farm copy above).
    { href: '/prices',            Icon: Tag,           art: '/home-icons/prices.png',       label: 'Prices',                  desc: 'Wholesale & retail',          color: 'var(--color-forest-800)', bg: 'rgba(31,77,43,0.08)' },
  ];

  return (
    <div
      className="h-[100dvh] flex flex-col font-sans overflow-hidden"
      style={{ background: 'var(--color-canvas)', color: 'var(--color-ink)' }}
    >
      {/* ── Header ── */}
      <header
        className="flex-shrink-0 flex items-center gap-3 px-4"
        style={{ height: 56, borderBottom: '1px solid var(--color-border)' }}
      >
        <button
          onClick={() => setNavOpen(true)}
          aria-label="Open navigation"
          className="flex items-center justify-center rounded-xl flex-shrink-0"
          style={{ width: 36, height: 36, background: 'rgba(32,25,15,0.06)', border: '1px solid var(--color-border)', color: 'var(--color-muted-strong)', cursor: 'pointer' }}
        >
          <Menu size={18} strokeWidth={1.7} />
        </button>

        <div className="flex flex-col justify-center flex-1">
          <span className="uppercase tracking-widest font-sans" style={{ fontSize: 9.5, color: 'var(--color-harvest)', letterSpacing: '0.12em', lineHeight: 1 }}>
            {getDayDate(lang)}
          </span>
          <span className="font-display font-bold" style={{ fontSize: 20, letterSpacing: '-0.02em', color: 'var(--color-ink)', lineHeight: 1.15, marginTop: 2 }}>
            {firstName ? t('homeGreeting').replace('{name}', firstName) : 'ImbewuField'}
          </span>
        </div>

        <LessonLink id="home:overview" label="Learn" />
        <button
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
          className="flex items-center justify-center rounded-xl flex-shrink-0"
          style={{ width: 36, height: 36, background: 'rgba(32,25,15,0.06)', border: '1px solid var(--color-border)', color: 'var(--color-muted-strong)', cursor: 'pointer' }}
        >
          <Settings size={16} strokeWidth={1.6} />
        </button>
      </header>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto flex flex-col px-4 py-6 max-w-xl mx-auto w-full gap-6">

        {lastSite && <LastSiteCard site={lastSite} />}

        {places && mainSite && (
          <MainSiteWeatherCard site={mainSite} places={places} onSetMain={setMainSiteId} />
        )}

        {/* ── Hero: new-user welcome / returner Continue / default analyse-CTA ── */}
        <HomeHeroCard places={places} mainSite={mainSite} firstName={firstName} />

        {/* ── See a sample farm — NGO/onboarding "show me how it works" entry point.
            Sample mode is a session-only, in-memory overlay (lib/sample-mode.ts) —
            it never reads or writes any real farmer's saved data. ── */}
        <button
          type="button"
          onClick={() => { if (enterSampleMode()) router.push('/farmer?panel=Overview'); }}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            background: 'transparent',
            border: '1.5px dashed rgba(192,122,30,0.45)',
            borderRadius: 20,
            padding: '16px 18px',
            cursor: 'pointer',
          }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles size={16} style={{ color: 'var(--color-harvest)', flexShrink: 0 }} />
            <span className="font-display font-semibold" style={{ fontSize: 15, color: 'var(--color-ink)' }}>
              Explore the sample farm — Ubhejane Crèche
            </span>
          </div>
          <p className="font-sans" style={{ fontSize: 12.5, color: 'var(--color-muted-strong)', lineHeight: 1.4 }}>
            A real crèche food garden, fully set up: design maps, crop plan, sales &amp;
            expenses, invoices. Look around, change anything — it never touches your own farm.
          </p>
        </button>

        {/* ── Your farm plan — gamified pull-through: overall % + the single next
            action, deep-linked. Hidden for brand-new users (no saved places). ── */}
        <FarmPlanCard places={places} mainSite={mainSite} />

        {/* ── Quick actions ── */}
        <div className="grid grid-cols-3 gap-3">
          {QUICK_ACTIONS.map((q) => (
            <Link
              key={q.href}
              href={q.href}
              className="flex flex-col items-center gap-2 p-3 rounded-2xl text-center transition-all hover:opacity-90"
              style={{ textDecoration: 'none', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            >
              <div className="flex items-center justify-center rounded-xl" style={{ width: 44, height: 44, background: q.bg, color: q.color }}>
                {q.art ? (
                  <img src={q.art} alt="" aria-hidden style={{ width: 38, height: 38, objectFit: 'contain' }} />
                ) : (
                  <q.Icon size={20} strokeWidth={1.6} />
                )}
              </div>
              <div>
                <div className="font-display font-semibold" style={{ fontSize: 12.5, color: 'var(--color-ink)', lineHeight: 1.2 }}>{q.label}</div>
                <div className="font-sans" style={{ fontSize: 10.5, color: 'var(--color-muted)', marginTop: 1 }}>{q.desc}</div>
              </div>
            </Link>
          ))}
        </div>

        {boardTasks.length > 0 && <TaskBoardCard tasks={boardTasks} onToggle={toggleTaskComplete} />}

        {/* ── Dashboards disclosure ── */}
        <section>
          <button
            onClick={() => setRolesOpen((o) => !o)}
            className="w-full flex items-center justify-between"
            aria-expanded={rolesOpen}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 2px' }}
          >
            <span className="uppercase tracking-widest font-sans" style={{ fontSize: 10, color: 'var(--color-muted)', letterSpacing: '0.12em' }}>
              {t('homeDashboards')}
            </span>
            <span className="flex items-center gap-1 font-sans" style={{ fontSize: 12, color: 'var(--color-muted)' }}>
              {rolesOpen ? t('homeDashboardsHide') : t('homeDashboardsSummary')}
              <ChevronDown size={14} strokeWidth={1.7} style={{ transform: rolesOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </span>
          </button>

          {rolesOpen && (
            <div className="mt-2.5" style={{ background: 'var(--color-surface)', borderRadius: 16, border: '1px solid var(--color-border)', overflow: 'hidden', boxShadow: '0 1px 3px rgba(32,25,15,0.06)' }}>
              {ROLES.map((r, i) => (
                <Link
                  key={r.href}
                  href={r.href}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px', textDecoration: 'none', borderBottom: i < ROLES.length - 1 ? '1px solid var(--color-border)' : 'none', transition: 'background 0.12s' }}
                  className="hover:bg-[rgba(32,25,15,0.03)]"
                >
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(31,77,43,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--color-forest-800)' }}>
                    <r.Icon size={17} strokeWidth={1.6} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-display" style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-ink)', letterSpacing: '-0.01em', lineHeight: 1.2 }}>{r.label}</div>
                    <div className="font-sans truncate" style={{ fontSize: 12.5, color: 'var(--color-muted-strong)', marginTop: 1, lineHeight: 1.4 }}>{r.desc}</div>
                  </div>
                  <ChevronRight size={16} strokeWidth={1.6} style={{ color: 'var(--color-muted)', flexShrink: 0 }} />
                </Link>
              ))}

              <Link
                href="/surveys"
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px', textDecoration: 'none', borderTop: '1px solid var(--color-border)', transition: 'background 0.12s' }}
                className="hover:bg-[rgba(32,25,15,0.03)]"
              >
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(192,122,30,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--color-harvest)' }}>
                  <ClipboardList size={17} strokeWidth={1.6} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display" style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-ink)', letterSpacing: '-0.01em', lineHeight: 1.2 }}>{t('homeSurveysLabel')}</div>
                  <div className="font-sans truncate" style={{ fontSize: 12.5, color: 'var(--color-muted-strong)', marginTop: 1, lineHeight: 1.4 }}>{t('homeSurveysDesc')}</div>
                </div>
                <ChevronRight size={16} strokeWidth={1.6} style={{ color: 'var(--color-muted)', flexShrink: 0 }} />
              </Link>

              <Link
                href="/vision"
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px', textDecoration: 'none', borderTop: '1px solid var(--color-border)', transition: 'background 0.12s' }}
                className="hover:bg-[rgba(32,25,15,0.03)]"
              >
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(31,77,43,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--color-forest-800)' }}>
                  <Camera size={17} strokeWidth={1.6} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display" style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-ink)', letterSpacing: '-0.01em', lineHeight: 1.2 }}>{t('homeLimaVisionLabel')}</div>
                  <div className="font-sans truncate" style={{ fontSize: 12.5, color: 'var(--color-muted-strong)', marginTop: 1, lineHeight: 1.4 }}>{t('homeLimaVisionDesc')}</div>
                </div>
                <ChevronRight size={16} strokeWidth={1.6} style={{ color: 'var(--color-muted)', flexShrink: 0 }} />
              </Link>
            </div>
          )}
        </section>

        <footer className="text-center font-sans" style={{ fontSize: 11, color: 'var(--color-muted)', opacity: 0.7, paddingBottom: 8 }}>
          {t('homeFooter')}
        </footer>
      </main>

      <LimaBar />
      <TabBar />
      <ThemePanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <NavDrawer open={navOpen} onClose={() => setNavOpen(false)} />
    </div>
  );
}

export default function HomeLanding() {
  return <HomeLandingInner />;
}
