'use client';
import React from 'react';
import { cn } from '@/lib/utils';
import { Sprout } from 'lucide-react';
import type { ReactNode, HTMLAttributes, ButtonHTMLAttributes } from 'react';

// Overline — small ochre uppercase label above headings
export function Overline({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('text-xs font-sans font-semibold uppercase tracking-widest', className)} style={{ color: '#C07A1E' }}>{children}</span>;
}

// AlmanacCard — the main raised surface
export function AlmanacCard({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-lg border', className)} style={{ backgroundColor: '#FFFEFA', borderColor: '#E2D8C4', boxShadow: '0 1px 3px rgba(32,25,15,0.08)' }} {...props}>{children}</div>;
}

// LimaAvatar — forest square with sprout icon
export function LimaAvatar({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <div className={cn('flex items-center justify-center rounded-lg flex-shrink-0', className)} style={{ width: size, height: size, backgroundColor: '#1F4D2B' }}>
      <Sprout size={Math.round(size * 0.55)} className="text-white" strokeWidth={1.75} />
    </div>
  );
}

// AlmanacButton variants
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'ochre';
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: BtnVariant; size?: 'sm'|'md'|'lg'; }
const btnBase = 'inline-flex items-center justify-center gap-2 rounded-full font-sans font-medium transition-colors focus-visible:outline-none disabled:opacity-50 disabled:pointer-events-none';
const btnSizes = { sm: 'h-8 px-3 text-sm', md: 'h-10 px-4 text-sm', lg: 'h-12 px-6 text-base' };
const btnStyles: Record<BtnVariant, React.CSSProperties> = {
  primary:   { backgroundColor: '#1F4D2B', color: '#fff' },
  secondary: { backgroundColor: '#FFFEFA', color: '#20190F', border: '1px solid #E2D8C4' },
  ghost:     { color: '#20190F' },
  ochre:     { backgroundColor: '#C07A1E', color: '#fff' },
};
export function AlmanacButton({ variant = 'primary', size = 'md', className, style, ...props }: BtnProps) {
  return <button className={cn(btnBase, btnSizes[size], className)} style={{ ...btnStyles[variant], ...style }} {...props} />;
}

// Badge

type BadgeColor = 'forest'|'ochre'|'water'|'muted';
const badgeStyles: Record<BadgeColor, React.CSSProperties> = {
  forest: { backgroundColor: 'rgba(31,77,43,0.1)', color: '#1F4D2B' },
  ochre:  { backgroundColor: 'rgba(192,122,30,0.1)', color: '#9A6018' },
  water:  { backgroundColor: 'rgba(35,94,134,0.1)', color: '#235E86' },
  muted:  { backgroundColor: '#E2D8C4', color: '#5C5040' },
};
export function Badge({ children, color = 'muted', className }: { children: ReactNode; color?: BadgeColor; className?: string }) {
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium font-sans', className)} style={badgeStyles[color]}>{children}</span>;
}

// SectionHeading
export function SectionHeading({ overline, heading, className }: { overline?: string; heading: string; className?: string }) {
  return (
    <div className={cn('space-y-1', className)}>
      {overline && <Overline>{overline}</Overline>}
      <h2 className="font-display text-xl font-semibold tracking-tight" style={{ color: '#20190F' }}>{heading}</h2>
    </div>
  );
}

// Divider
export function Divider({ className }: { className?: string }) {
  return <hr className={cn('border-0 h-px', className)} style={{ backgroundColor: '#E2D8C4' }} />;
}

// Stat — metric display cell
export function Stat({ label, value, unit }: { label: string; value: string|number; unit?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-sans uppercase tracking-wide" style={{ color: '#5C5040' }}>{label}</span>
      <span className="font-display text-2xl font-semibold" style={{ color: '#20190F' }}>
        {value}{unit && <span className="text-base font-sans ml-1" style={{ color: '#5C5040' }}>{unit}</span>}
      </span>
    </div>
  );
}
