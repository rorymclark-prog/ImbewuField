import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import Illustration from '@/components/Illustration';

export interface EmptyStateProps {
  title?: string;
  message: string;
  className?: string;
  // ux-14/sdesk-08/desk-10/nav-14: the map-unsupported states need a Lucide icon (MapOff) and a
  // next-step action, neither of which the default sprout illustration card offered. Both are
  // optional so every existing caller — which passes neither — renders exactly as before.
  icon?: LucideIcon;
  actions?: ReactNode;
}

export default function EmptyState({ title, message, className = '', icon: Icon, actions }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-10 px-4 ${className}`}>
      {Icon ? (
        <Icon size={40} strokeWidth={1.5} className="mb-4" style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
      ) : (
        <Illustration name="empty-sprout" className="mb-4" />
      )}
      {title && (
        <div className="font-display font-semibold mb-1" style={{ fontSize: 16, color: 'var(--color-ink)' }}>
          {title}
        </div>
      )}
      <div className="font-sans" style={{ fontSize: 13, color: 'var(--color-muted)', maxWidth: 280 }}>
        {message}
      </div>
      {actions && <div className="flex items-center justify-center gap-2 flex-wrap mt-4">{actions}</div>}
    </div>
  );
}
