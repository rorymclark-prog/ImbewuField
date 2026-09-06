'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  X, Map, DollarSign, GraduationCap, Wheat, FileText,
  MessageCircle, Leaf, Calendar, LayoutGrid, ClipboardList,
  Camera, Home, User, Users, BarChart3, Building2, Palette, Handshake, Sparkles, Earth, Sprout, Footprints,
} from 'lucide-react';
import { exitSampleMode } from '@/lib/sample-mode';
import { useLanguage } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { canSeeNavLink } from '@/lib/role-access';
import { useRoleNavigation } from '@/lib/use-role-navigation';
import { canSeeWorkspaceLink } from '@/lib/role-navigation';
import { communityEnabled } from '@/lib/community/flag';

interface NavDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function NavDrawer({ open, onClose }: NavDrawerProps) {
  const pathname = usePathname();
  const { t } = useLanguage();
  // Every link below used to be offered to everybody, including the four staff dashboards. See
  // lib/role-access.ts for why that is a usability failure rather than a security one, and for
  // what `role === null` deliberately does NOT do.
  const { role } = useAuth();
  const { navigationRole, sample } = useRoleNavigation();

  const mainItems = [
    { href: '/home',    Icon: Home,          label: t('tabHome') },
    { href: '/farmer',  Icon: Map,           label: t('navDesignMap') },
    // The report had no way in of its own: it lived behind the map, three taps down a panel
    // most farmers never scrolled to. It is the thing they came for, so it gets a door.
    // Choose a saved site first, including sites that do not have a report yet.
    { href: '/reports', Icon: FileText, label: t('siteReportOverline') },
    { href: '/atlas',   Icon: Earth,         label: 'Atlas' },
    // ONE money door. This row used to be the only way into /finances from the menu, and
    // there was no row for /records at all — so the menu offered half her money and the home
    // screen offered the other half under a different name. Both are the same book now.
    { href: '/records', Icon: DollarSign,   label: t('homeQuickMyRecords') },
    { href: '/student', Icon: GraduationCap, label: t('homeQuickStudy') },
    { href: '/contact', Icon: MessageCircle, label: t('homeQuickContact') },
    // /network was ungated when it ran on lib/network-demo.ts. It now reads real farmers'
    // production and income through /api/network/farmers and is gated to ngo/funder/admin, so
    // this link is filtered like the other staff routes rather than opening onto a refusal.
    { href: '/network',  Icon: Users,     label: 'Network' },
    { href: '/exchange', Icon: Sprout,    label: 'Exchange' },
    // Invisible when the master kill switch is off — no entry point, no reads.
    ...(communityEnabled() ? [{ href: '/community', Icon: Handshake, label: t('navCommunity') }] : []),
  ];

  const NAV_SECTIONS = [
    {
      label: t('navSectionMain'),
      items: mainItems,
    },
    {
      label: t('navSectionFarmTools'),
      items: [
        { href: '/journal',  Icon: Leaf,        label: t('navFieldJournal') },
        // '/plan' used to be its own page; it now only redirects here (see app/plan/page.tsx —
        // "one crop-planning authority"). A separate menu row for a redirect just duplicated
        // this one under a different label, so it's gone rather than sending a farmer to the
        // same screen twice wondering which one they meant.
        { href: '/facilitator/crops', Icon: FileText, label: 'Bed-by-Bed Crop Plan' },
        { href: '/cropplan', Icon: Wheat,        label: t('navTaskPlanner') },
        // Repointed from /survey: that wizard writes imbewu_garden_survey, but
        // lib/site-progress.ts (the Home progress bar and its next-step nudge) reads
        // the DataPanel survey via lib/site-survey.ts — the two stores never meet.
        // /farmer?openSurvey=1 is the same deep link app/home/page.tsx already uses
        // for its "Do the site survey" nudge, so the menu now lands where the score
        // actually reads. /survey (app/survey/page.tsx) is untouched and now orphaned
        // from the menu — it may still be bookmarked; merging the two survey stores
        // is a product decision, not made here.
        { href: '/farmer?openSurvey=1', Icon: LayoutGrid, label: t('navGardenSurvey') },
        // Otherwise unreachable: no tab, no card on /home, no link from /plan
        // or /cropplan pointed here — the 12-month SA planting grid existed
        // but no farmer could ever tap their way to it.
        { href: '/calendar', Icon: Calendar,     label: t('navPlantingCalendar') },
        { href: '/vision',   Icon: Camera,       label: t('homeLimaVisionLabel') },
      ],
    },
    {
      label: t('navSectionOrganisation'),
      items: [
        { href: '/surveys',     Icon: ClipboardList, label: t('homeSurveysLabel') },
        { href: '/assessments', Icon: ClipboardList, label: 'Project assessments' },
        { href: '/mentor',      Icon: Users,         label: t('homeRoleMentorLabel') },
        { href: '/ngo',         Icon: BarChart3,     label: t('navNGODashboard') },
        { href: '/funder',      Icon: Building2,     label: t('homeRoleFunderLabel') },
        { href: '/design',      Icon: Palette,       label: 'Design Studio' },
      ],
    },
    {
      label: t('tabAccount'),
      items: [
        { href: '/account', Icon: User, label: t('navMyAccount') },
        { href: '/samples', Icon: Sprout, label: 'Try a sample' },
        { href: '/samples/gardens', Icon: Sprout, label: 'Browse sample gardens' },
        { href: '/tour', Icon: Footprints, label: '15-minute tour' },
        { href: '/feedback', Icon: MessageCircle, label: 'Report a bug / suggest a feature' },
        { href: '/updates', Icon: Sparkles, label: "What's new" },
      ],
    },
  ];

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Set `inert` as a real DOM property, not a JSX attribute — react-dom 18 warns
  // ("Received `true` for a non-boolean attribute `inert`") when it's passed as a
  // prop (native inert support is React 19). The property works today in all evergreen browsers.
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (panelRef.current) panelRef.current.inert = !open; }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden={!open}
        style={{
          position: 'fixed', inset: 0, zIndex: 60,
          background: 'rgba(0,0,0,0.38)',
          backdropFilter: 'blur(2px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.25s',
        }}
      />

      {/* Drawer panel */}
      <div
        ref={panelRef}
        aria-hidden={!open}
        style={{
          position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 61,
          width: 'min(310px, 85vw)',
          // Tokens, not the '#FFFEFA'/'#E2D8C4' this used to carry: this is the app's main nav
          // drawer, present on the home and farm-map screens, so it used to slide a bright white
          // panel over an otherwise-dark screen in dark mode.
          background: 'var(--bg-1)',
          borderRight: '1px solid var(--border)',
          boxShadow: '4px 0 32px rgba(32,25,15,0.16)',
          display: 'flex', flexDirection: 'column',
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
          willChange: 'transform',
          overflowY: 'auto',
          visibility: open ? 'visible' : 'hidden',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 flex-shrink-0"
          style={{ height: 60, borderBottom: '1px solid var(--border)' }}
        >
          <div>
            <div className="font-display font-bold" style={{ fontSize: 17, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              ImbewuField
            </div>
            <div className="font-sans" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
              {t('tagline')}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t('navCloseMenu')}
            style={{
              background: 'var(--bg-2)', border: '1px solid var(--border)',
              borderRadius: 8, padding: 7, cursor: 'pointer', color: 'var(--text-secondary)',
              display: 'flex', alignItems: 'center',
            }}
          >
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>

        {sample && <section style={{margin:'8px 16px',padding:12,border:'1px solid var(--border)',borderRadius:12}} aria-label="Sample controls"><strong>Sample workspace</strong><p style={{fontSize:12,margin:'6px 0'}}>Practice data · changes stay in this demo.</p><div style={{display:'grid',gap:8}}><Link href="/samples" onClick={onClose} style={{minHeight:44,display:'flex',alignItems:'center'}}>Choose sample view</Link><Link href="/samples/gardens" onClick={onClose} style={{minHeight:44,display:'flex',alignItems:'center'}}>18 gardens &amp; completed reports</Link><Link href="/tour" onClick={onClose} style={{minHeight:44,display:'flex',alignItems:'center'}}>Start the tour</Link><button type="button" onClick={()=>{exitSampleMode();window.location.href='/home';}} style={{minHeight:44,textAlign:'left'}}>Exit sample</button></div></section>}
        {/* Nav sections */}
        <div style={{ flex: 1, overflowY: 'auto', paddingTop: 8, paddingBottom: 24 }}>
          {NAV_SECTIONS.map((section) => ({
            ...section,
            items: section.items.filter(({ href }) => (sample || canSeeNavLink(role, href)) && canSeeWorkspaceLink(navigationRole, href)),
          }))
            // A section whose every link was filtered out must go too, heading and all —
            // otherwise a farmer gets an "ORGANISATION" label with nothing beneath it, which
            // reads as something failing to load rather than as something not meant for her.
            .filter((section) => section.items.length > 0)
            .map((section) => (
            <div key={section.label} style={{ marginBottom: 4 }}>
              <div
                className="font-sans uppercase tracking-widest"
                style={{ fontSize: 12, color: 'var(--text-muted)', letterSpacing: '0.13em', padding: '8px 20px 4px' }}
              >
                {section.label}
              </div>

              {section.items.map(({ href, Icon, label }) => {
                // Pathname only, deliberately. Telling the two /farmer entries apart would mean
                // useSearchParams here, and this drawer renders on every screen — that opts the
                // lot of them out of static rendering to move one highlight bar.
                const exactActive = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onClose}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 20px',
                      textDecoration: 'none',
                      // '#1F4D2B'-derived hardcodes, not var(--badge-bg)/var(--emerald): the earth
                      // theme's --emerald (#3A7518, an "ok"-status olive-green, see globals.css)
                      // is a different hue from the brand forest green every other screen still
                      // hardcodes — swapping just this one would put two visibly different
                      // "brand greens" in the app at once. Stays literal until that migrates.
                      background: exactActive ? 'rgba(31,77,43,0.09)' : 'transparent',
                      borderRight: exactActive ? '3px solid #1F4D2B' : '3px solid transparent',
                      transition: 'background 0.12s',
                    }}
                  >
                    <Icon
                      size={16}
                      strokeWidth={exactActive ? 2 : 1.6}
                      style={{ color: exactActive ? '#1F4D2B' : 'var(--text-secondary)', flexShrink: 0 }}
                    />
                    <span
                      className="font-sans"
                      style={{
                        fontSize: 14,
                        color: exactActive ? '#1F4D2B' : 'var(--text-primary)',
                        fontWeight: exactActive ? 600 : 400,
                      }}
                    >
                      {label}
                    </span>
                  </Link>
                );
              })}

              <div style={{ height: 1, background: 'var(--border)', margin: '4px 20px 4px' }} />
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          className="font-sans flex-shrink-0"
          style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 20px', borderTop: '1px solid var(--border)' }}
        >
          {t('homeFooter')}
        </div>
      </div>
    </>
  );
}
