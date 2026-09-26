import { Fragment, type CSSProperties, type ReactNode } from 'react';
import { figureCaption, type Block, type Inline, type ManualFigure, type ManualLang } from '@/lib/manual';

// Renders lib/manual.ts's parsed blocks. No hooks and no HTML strings, so it runs inside the
// statically generated chapter page and a translation can only ever produce text.

function InlineText({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((part, i) => {
        let node: ReactNode = part.text;
        if (part.italic) node = <em>{node}</em>;
        if (part.bold) node = <strong style={{ fontWeight: 700 }}>{node}</strong>;
        return <span key={i}>{node}</span>;
      })}
    </>
  );
}

const body: CSSProperties = {
  fontSize: 'clamp(16px, 1.1vw + 12px, 18px)',
  lineHeight: 1.7,
  color: 'var(--text-primary)',
  margin: '0 0 16px',
};

const cell: CSSProperties = {
  padding: '10px 12px',
  borderBottom: '1px solid var(--border)',
  textAlign: 'left',
  verticalAlign: 'top',
  fontSize: 15,
  lineHeight: 1.5,
};

export function ManualFigureView({ figure, lang }: { figure: ManualFigure; lang: ManualLang }) {
  const caption = figureCaption(figure, lang);
  return (
    <figure style={{ margin: '4px 0 24px' }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- static export, sized, lazy */}
      <img
        src={figure.src}
        alt={caption.text}
        width={figure.width}
        height={figure.height}
        loading="lazy"
        style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-2)' }}
      />
      <figcaption lang={caption.lang} style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--text-secondary)', marginTop: 8 }}>
        {caption.text}
        {figure.credit && <span style={{ display: 'block', fontSize: 12, marginTop: 2 }}>{figure.credit}</span>}
      </figcaption>
    </figure>
  );
}

/**
 * `figures` maps a section index (the Nth "## " heading, from 0; -1 = before the first) to the
 * pictures that belong there. Each lands after the first paragraph/list/table of its section, so
 * it sits beside the text it illustrates rather than between a heading and its opening sentence.
 */
export default function ManualBlocks({ blocks, figures, lang = 'en' }: { blocks: Block[]; figures?: Map<number, ManualFigure[]>; lang?: ManualLang }) {
  let section = -1;
  const placed = new Set<number>();
  const after = (i: number): ReactNode => {
    const block = blocks[i];
    if (block.type === 'h1' || block.type === 'h2') {
      if (block.type === 'h2') section += 1;
      return null;
    }
    if (block.type === 'h3' || !figures || placed.has(section)) return null;
    placed.add(section);
    const list = figures.get(section);
    return list?.map((figure) => <ManualFigureView key={figure.id} figure={figure} lang={lang} />) ?? null;
  };
  return (
    <>
      {blocks.map((block, i) => {
        const rendered = renderBlock(block, i);
        const extra = after(i);
        return extra ? <Fragment key={i}>{rendered}{extra}</Fragment> : rendered;
      })}
    </>
  );
}

function renderBlock(block: Block, i: number): ReactNode {
  switch (block.type) {
    // The page itself owns the <h1> (the chapter title), so a stray "# " inside the body
    // renders as a section heading rather than a second h1.
    case 'h1':
    case 'h2':
      return (
        <h2 key={i} className="font-display" style={{ fontSize: 'clamp(22px, 1.6vw + 16px, 28px)', lineHeight: 1.25, fontWeight: 600, color: 'var(--text-primary)', margin: '32px 0 12px' }}>
          <InlineText parts={block.content} />
        </h2>
      );
    case 'h3':
      return (
        <h3 key={i} style={{ fontSize: 'clamp(18px, 0.8vw + 15px, 21px)', lineHeight: 1.35, fontWeight: 700, color: 'var(--text-primary)', margin: '24px 0 8px' }}>
          <InlineText parts={block.content} />
        </h3>
      );
    case 'p':
      return <p key={i} style={body}><InlineText parts={block.content} /></p>;
    case 'ul':
    case 'ol': {
      const List = block.type;
      return (
        <List key={i} style={{ ...body, paddingLeft: 24, listStyle: block.type === 'ol' ? 'decimal' : 'disc' }}>
          {block.items.map((item, j) => (
            <li key={j} style={{ margin: '0 0 8px', paddingLeft: 4 }}><InlineText parts={item} /></li>
          ))}
        </List>
      );
    }
    case 'callout':
      return (
        <aside key={i} style={{ margin: '0 0 20px', padding: '14px 16px', borderRadius: 12, background: 'var(--bg-2)', border: '1px solid var(--border)', borderLeft: '6px solid var(--gold)' }}>
          {block.paragraphs.map((para, j) => (
            <p key={j} style={{ ...body, margin: j === block.paragraphs.length - 1 ? 0 : '0 0 8px' }}><InlineText parts={para} /></p>
          ))}
        </aside>
      );
    case 'table':
      return (
        <div key={i} style={{ overflowX: 'auto', margin: '0 0 20px', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg-1)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text-primary)' }}>
            <thead>
              <tr>{block.head.map((h, j) => <th key={j} scope="col" style={{ ...cell, fontWeight: 700, background: 'var(--bg-2)' }}><InlineText parts={h} /></th>)}</tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r}>{row.map((c, j) => <td key={j} style={cell}><InlineText parts={c} /></td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}
