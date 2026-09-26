import type { CSSProperties, ReactNode } from 'react';
import type { Block, Inline } from '@/lib/manual';

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

export default function ManualBlocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((block, i) => {
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
      })}
    </>
  );
}
