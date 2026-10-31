'use client';

import { Fragment, type ImgHTMLAttributes, type ReactNode } from 'react';
import { useLanguage } from '@/lib/i18n';
import { fillInline, inlineText, xhInlineDraft } from '@/lib/xh-inline';
import ArrowLabel from './ArrowLabel';
import draftStyles from './DesignDraftCopy.module.css';

/**
 * English-only study copy for isiXhosa readers. Server-rendered study pages cannot call
 * useLanguage(), so they render their fixed English through this small client piece.
 * English, isiZulu and every other language see the English unchanged; isiXhosa sees the draft
 * keyed by the exact English, marked lang="xh" when one exists.
 * `values` fills {name} placeholders in both the English and the draft. `plain` skips the lang="xh" span
 * (inside SVG text and <title>, where a span would be invalid).
 */
export default function Tx({ en, values, lookup, plain }: { en: string; values?: Record<string, string | number>; lookup?: string[]; plain?: boolean }) {
  const { lang } = useLanguage();
  const draft = lang === 'xh' && !plain ? xhInlineDraft(en) : null;
  return draft ? <span lang="xh">{render(lang, en, values, lookup)}</span> : <>{render(lang, en, values, lookup)}</>;
}

/** `lookup` names the values that are themselves English course text (a lesson title) and get their own draft. */
function render(lang: string, en: string, values?: Record<string, string | number>, lookup?: string[]): string {
  if (!values) return inlineText(lang, en);
  const filled = lookup?.length ? Object.fromEntries(Object.entries(values).map(([key, value]) => [key, lookup.includes(key) ? inlineText(lang, String(value)) : value])) : values;
  return fillInline(inlineText(lang, en), filled);
}

/** A button or link label with a trailing Lucide arrow: the words stay a plain string so ArrowLabel can keep the last word and the arrow together. */
export function TxArrow({ en, values, lookup, dir }: { en: string; values?: Record<string, string | number>; lookup?: string[]; dir?: 'next' | 'back' | 'up' }) {
  const { lang } = useLanguage();
  return <ArrowLabel dir={dir}>{render(lang, en, values, lookup)}</ArrowLabel>;
}

/** Same lookup for a sentence with markup in it: each {name} placeholder is replaced by the given node
 *  (a <strong> with a figure, say) in the English and in the isiXhosa draft alike. */
export function TxRich({ en, nodes }: { en: string; nodes: Record<string, ReactNode> }) {
  const { lang } = useLanguage();
  const draft = lang === 'xh' ? xhInlineDraft(en) : null;
  const parts = (draft ?? en).split(/(\{[a-zA-Z]+\})/);
  const body = parts.map((part, index) => {
    const name = /^\{([a-zA-Z]+)\}$/.exec(part)?.[1];
    return name && name in nodes ? <Fragment key={index}>{nodes[name]}</Fragment> : part;
  });
  return draft ? <span lang="xh">{body}</span> : <>{body}</>;
}

/** An isiXhosa line that carries values (a file name, a count), which the exact-English lookup of
 *  DesignDraftCopy cannot match. Same markup as DesignDraftCopy's isiXhosa branch: the draft with its
 *  filled English source beneath it. */
export function XhDraftLine({ xh, en }: { xh: string; en: string }) {
  return <span lang="xh" style={{ display: 'inline-block', minWidth: 0 }}>{xh}<small lang="en" className={draftStyles.source}>English source: {en}</small></span>;
}

/** An illustration whose alt text is English course copy: isiXhosa readers get the draft for it. */
export function TxImg({ alt, ...rest }: Omit<ImgHTMLAttributes<HTMLImageElement>, 'alt'> & { alt: string }) {
  const { lang } = useLanguage();
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...rest} alt={inlineText(lang, alt)} />;
}
