import BackButton from '@/components/BackButton';
import MenuButton from '@/components/MenuButton';
import { APP_HEADER_INSET } from '@/lib/app-header';

/** The manual's top bar — theme tokens, so it follows dark mode with the page under it. */
export default function ManualHeader({ fallback, label }: { fallback: string; label: string }) {
  return (
    <header
      style={{
        ...APP_HEADER_INSET,
        position: 'sticky', top: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', gap: 8,
        paddingLeft: 12, paddingRight: 12,
        background: 'var(--bg-1)', borderBottom: '1px solid var(--border)',
      }}
    >
      <MenuButton />
      <BackButton fallback={fallback} />
      <span className="font-display" style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </header>
  );
}
