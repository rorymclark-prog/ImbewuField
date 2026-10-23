import { Children, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react';

const TRAILING = /\s*[→↑]\s*$/;
const LEADING = /^\s*←\s*/;

/** Strips a trailing "→" / leading "←" glyph so translated or course strings can carry one without it being rendered. */
export function stripArrow(text: string): string {
  return text.replace(TRAILING, '').replace(LEADING, '');
}

/**
 * Button/link label with a Lucide arrow instead of a text arrow. The words stay the accessible name
 * (the icon is aria-hidden) and the last word is kept on one line with the icon so the arrow can never
 * wrap onto its own line. One wrapper span keeps it a single item inside flex buttons.
 */
export default function ArrowLabel({ children, dir = 'next' }: { children: ReactNode; dir?: 'next' | 'back' | 'up' }) {
  const parts = Children.toArray(children).map(child => (typeof child === 'string' ? stripArrow(child) : child));
  const Icon = dir === 'back' ? ArrowLeft : dir === 'up' ? ArrowUp : ArrowRight;
  const icon = <Icon aria-hidden className="h-4 w-4 shrink-0" style={{ display: 'inline-block', verticalAlign: '-0.15em' }} />;
  const last = parts[parts.length - 1];
  if (dir !== 'back' && typeof last === 'string') {
    const cut = last.search(/\S+$/);
    const head = cut > 0 ? last.slice(0, cut) : '';
    const tail = cut >= 0 ? last.slice(cut) : last;
    return <span>{parts.slice(0, -1)}{head}<span style={{ whiteSpace: 'nowrap' }}>{tail}{'\u00a0'}{icon}</span></span>;
  }
  if (dir === 'back') return <span>{icon}{'\u00a0'}{parts}</span>;
  return <span>{parts}{'\u00a0'}<span style={{ whiteSpace: 'nowrap' }}>{icon}</span></span>;
}
