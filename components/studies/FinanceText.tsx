import type { ReactNode } from 'react';
import styles from './FinanceCourse.module.css';

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|`[^`]+`)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) return <span key={i}>{part.slice(1, -1)}</span>;
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const href = link[2].replace('https://imbewufield.vercel.app/student/guides/', '/student/guides/');
      return /^(https:\/\/|\/student\/guides\/)/.test(href) ? <a key={i} href={href}>{link[1]}</a> : <span key={i}>{link[1]}</span>;
    }
    return part;
  });
}

/** Render the authored text as accessible elements; manuscript HTML is never executed. */
export default function FinanceText({ text }: { text: string }) {
  const blocks = text.trim().split(/\n\s*\n/);
  return <div className={styles.prose}>{blocks.map((block, i) => {
    const lines = block.split('\n');
    if (lines[0].startsWith('|') && lines.length > 1 && /^\|[\s:|\-]+\|$/.test(lines[1])) {
      const cells = (line: string) => line.replace(/^\||\|$/g, '').split('|').map(cell => cell.trim());
      return <div key={i} className={styles.tableScroll} tabIndex={0} role="region" aria-label="Practice table; scroll sideways if needed"><table>
        <caption>Scroll sideways if any columns are hidden.</caption>
        <thead><tr>{cells(lines[0]).map((cell, n) => <th scope="col" key={n}>{inline(cell)}</th>)}</tr></thead>
        <tbody>{lines.slice(2).map((line, n) => <tr key={n}>{cells(line).map((cell, c) => <td key={c}>{inline(cell)}</td>)}</tr>)}</tbody>
      </table></div>;
    }
    if (lines.every(line => /^[-*] /.test(line))) return <ul key={i}>{lines.map((line, n) => <li key={n}>{inline(line.slice(2))}</li>)}</ul>;
    if (lines.every(line => /^\d+\. /.test(line))) return <ol key={i}>{lines.map((line, n) => <li key={n}>{inline(line.replace(/^\d+\. /, ''))}</li>)}</ol>;
    if (/^#{1,6} /.test(block)) return <h4 key={i}>{inline(block.replace(/^#{1,6} /, ''))}</h4>;
    return <p key={i}>{inline(block)}</p>;
  })}</div>;
}
