'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  X, Map, DollarSign, GraduationCap, Wheat, FileText,
  MessageCircle, Leaf, CalendarDays, LayoutGrid, ClipboardList,
  Camera, Home, User, Users, BarChart3, Building2, Palette, Handshake, Sparkles, Earth, Sprout,
} from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { communityEnabled } from '@/lib/community/flag';

interface NavDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function NavDrawer({ open, onClose }: NavDrawerProps) {
  const pathname = usePathname();
  const { t } = useLanguage();

  const mainItems = [
    { href: '/home',    Icon: Home,          label: t('tabHome') },
    { href: '/farmer',  Icon: Map,           label: t('navDesignMap') },
    // The report had no way in of its own: it lived behind the map, three taps down a panel
    // most farmers never scrolled to. It is the thing they came for, so it gets a door.
    // `panel=Reports` lands on the list — generate one, or re-open any of the saved ones.
    { href: '/farmer?panel=Reports', Icon: FileText, label: t('siteReportOverline') },
    { href: '/atlas',   Icon: Earth,         label: 'Atlas' },
    { href: '/finances', Icon: DollarSign,   label: t('tabFinance') },
    { href: '/student', Icon: GraduationCap, label: t('homeQuickStudy') },
    { href: '/contact', Icon: MessageCircle, label: t('homeQuickContact') },
    // Ungated on purpose: neither route reads Firestore or another account's
    // data — both run entirely on their own declared sample sets, so there is
    // nothing here for a kill switch to protect.
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
        { href: '/plan',     Icon: CalendarDays, label: t('homeQuickCropPlanner') },
        { href: '/facilitator/crops', Icon: FileText, label: 'Bed-by-Bed Crop Plan' },
        { href: '/cropplan', Icon: Wheat,        label: t('navTaskPlanner') },
        { href: '/survey',   Icon: LayoutGrid,   label: t('navGardenSurvey') },
        { href: '/vision',   Icon: Camera,       label: t('homeLimaVisionLabel') },
      ],
    },
    {
      label: t('navSectionOrganisation'),
      items: [
        { href: '/surveys',     Icon: ClipboardList, label: t('homeSurveysLabel') },
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
            <div className="font-sans" style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 1 }}>
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

        {/* Nav sections */}
        <div style={{ flex: 1, overflowY: 'auto', paddingTop: 8, paddingBottom: 24 }}>
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} style={{ marginBottom: 4 }}>
              <div
                className="font-sans uppercase tracking-widest"
                style={{ fontSize: 9.5, color: 'var(--text-muted)', letterSpacing: '0.13em', padding: '8px 20px 4px' }}
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
                      // var(--badge-bg)/var(--emerald), not the '#1F4D2B'-derived hardcodes this
                      // used to carry: those are the accent tokens already used for this same
                      // "active" treatment elsewhere (see TabBar), and they move with the theme.
                      background: exactActive ? 'var(--badge-bg)' : 'transparent',
                      borderRight: exactActive ? '3px solid var(--emerald)' : '3px solid transparent',
                      transition: 'background 0.12s',
                    }}
                  >
                    <Icon
                      size={16}
                      strokeWidth={exactActive ? 2 : 1.6}
                      style={{ color: exactActive ? 'var(--emerald)' : 'var(--text-secondary)', flexShrink: 0 }}
                    />
                    <span
                      className="font-sans"
                      style={{
                        fontSize: 14,
                        color: exactActive ? 'var(--emerald)' : 'var(--text-primary)',
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
          style={{ fontSize: 10.5, color: 'var(--text-muted)', padding: '12px 20px', borderTop: '1px solid var(--border)' }}
        >
          {t('homeFooter')}
        </div>
      </div>
    </>
  );
}
