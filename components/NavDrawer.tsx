'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  X, Map, DollarSign, GraduationCap, Wheat, FileText,
  MessageCircle, Leaf, CalendarDays, LayoutGrid, ClipboardList,
  Camera, Home, User, Users, BarChart3, Building2, Sprout,
} from 'lucide-react';

interface NavDrawerProps {
  open: boolean;
  onClose: () => void;
}

const NAV_SECTIONS = [
  {
    label: 'Main',
    items: [
      { href: '/home',    Icon: Home,          label: 'Home' },
      { href: '/farmer',  Icon: Map,           label: 'Design Map' },
      { href: '/finances', Icon: DollarSign,   label: 'Finance' },
      { href: '/student', Icon: GraduationCap, label: 'Study' },
      { href: '/contact', Icon: MessageCircle, label: 'Contact' },
    ],
  },
  {
    label: 'Farm Tools',
    items: [
      { href: '/journal',  Icon: Leaf,        label: 'Field Journal' },
      { href: '/plan',     Icon: CalendarDays, label: 'Crop Planner' },
      { href: '/cropplan', Icon: Wheat,        label: 'Task Planner' },
      { href: '/survey',   Icon: LayoutGrid,   label: 'Garden Survey' },
      { href: '/vision',   Icon: Camera,       label: 'Lima Vision' },
    ],
  },
  {
    label: 'Organisation',
    items: [
      { href: '/surveys',     Icon: ClipboardList, label: 'Surveys' },
      { href: '/mentor',      Icon: Users,         label: 'Mentor' },
      { href: '/ngo',         Icon: BarChart3,     label: 'NGO Dashboard' },
      { href: '/funder',      Icon: Building2,     label: 'Funder' },
      { href: '/facilitator', Icon: Sprout,        label: 'Facilitator' },
    ],
  },
  {
    label: 'Account',
    items: [
      { href: '/account', Icon: User, label: 'My Account' },
    ],
  },
];

export default function NavDrawer({ open, onClose }: NavDrawerProps) {
  const pathname = usePathname();

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

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
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
        style={{
          position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 61,
          width: 'min(310px, 85vw)',
          background: '#FBF6EC',
          borderRight: '1px solid #E2D8C4',
          boxShadow: '4px 0 32px rgba(32,25,15,0.16)',
          display: 'flex', flexDirection: 'column',
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
          willChange: 'transform',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 flex-shrink-0"
          style={{ height: 60, borderBottom: '1px solid #E2D8C4' }}
        >
          <div>
            <div className="font-display font-bold" style={{ fontSize: 17, color: '#20190F', letterSpacing: '-0.01em' }}>
              ImbewuField
            </div>
            <div className="font-sans" style={{ fontSize: 10.5, color: '#8C7A62', marginTop: 1 }}>
              Permaculture Intelligence
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close menu"
            style={{
              background: 'rgba(32,25,15,0.06)', border: '1px solid #E2D8C4',
              borderRadius: 8, padding: 7, cursor: 'pointer', color: '#5C5040',
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
                style={{ fontSize: 9.5, color: '#94876F', letterSpacing: '0.13em', padding: '8px 20px 4px' }}
              >
                {section.label}
              </div>

              {section.items.map(({ href, Icon, label }) => {
                const active = pathname === href || (href !== '/' && pathname.startsWith(href + '?'));
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
                      background: exactActive ? 'rgba(31,77,43,0.09)' : 'transparent',
                      borderRight: exactActive ? '3px solid #1F4D2B' : '3px solid transparent',
                      transition: 'background 0.12s',
                    }}
                  >
                    <Icon
                      size={16}
                      strokeWidth={exactActive ? 2 : 1.6}
                      style={{ color: exactActive ? '#1F4D2B' : '#5C5040', flexShrink: 0 }}
                    />
                    <span
                      className="font-sans"
                      style={{
                        fontSize: 14,
                        color: exactActive ? '#1F4D2B' : '#20190F',
                        fontWeight: exactActive ? 600 : 400,
                      }}
                    >
                      {label}
                    </span>
                  </Link>
                );
              })}

              <div style={{ height: 1, background: '#E2D8C4', margin: '4px 20px 4px' }} />
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          className="font-sans flex-shrink-0"
          style={{ fontSize: 10.5, color: '#94876F', padding: '12px 20px', borderTop: '1px solid #E2D8C4' }}
        >
          ImbewuField · grown with you
        </div>
      </div>
    </>
  );
}
