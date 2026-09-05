'use client';
import { useState } from 'react';
import styles from './MelDashboard.module.css';

export type ReportSection = { title: string; lines: string[] };
export default function ReportComposer({ title, sample, sections }: { title: string; sample: boolean; sections: ReportSection[] }) {
  const [format, setFormat] = useState<'summary' | 'full'>('summary');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const visible = sections.map(s => ({ ...s, lines: format === 'summary' ? s.lines.slice(0, 5) : s.lines }));
  async function download() {
    setBusy(true); setError('');
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF(); let y = 25;
      // The bundled PDF font cannot represent every Unicode punctuation mark.
      const plain = (s: string) => s.replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/→/g, 'to').replace(/²/g, '2').replace(/·/g, '|');
      const line = (text: string, bold = false) => {
        doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(bold ? 14 : 11);
        const rows = doc.splitTextToSize(plain(text), 174) as string[];
        for (const row of rows) { if (y > 272) { doc.addPage(); y = 23; } doc.text(row, 18, y); y += bold ? 8 : 6; }
        y += 3;
      };
      line(title, true); line(`${sample ? 'SAMPLE - fictional demonstration data' : 'Recorded programme information'} | Generated ${new Date().toISOString().slice(0, 10)}`);
      line(format === 'summary' ? 'Brief summary: up to five items per section. Use the full report for all items.' : 'Full report');
      for (const section of visible) { line(section.title, true); section.lines.forEach(s => line(s)); }
      const pages = doc.getNumberOfPages();
      for (let page = 1; page <= pages; page++) { doc.setPage(page); doc.setFontSize(9); doc.setTextColor(60); doc.text(`${sample ? 'SAMPLE - NOT ACTUAL RESULTS | ' : ''}ImbewuField | ${page} / ${pages}`, 18, 287); }
      doc.save(`${sample ? 'Sample-' : ''}ImbewuField-${title.replace(/[^a-zA-Z0-9]+/g, '-')}.pdf`);
    } catch { setError('The PDF could not be created. Your records have not changed.'); }
    finally { setBusy(false); }
  }
  return <article className={styles.card} style={{ marginTop: 20 }}>
    <div className={styles.row}><h2>{title}</h2><span className={styles.tag}>{sample ? 'Fictional sample' : 'Recorded data'}</span></div>
    <div className={styles.row}><button aria-pressed={format === 'summary'} onClick={() => setFormat('summary')}>Brief summary</button><button aria-pressed={format === 'full'} onClick={() => setFormat('full')}>Full report</button><button className={styles.primary} disabled={busy} onClick={() => void download()}>{busy ? 'Preparing…' : 'Download ink-saving PDF'}</button></div>
    <p>White paper, dark text and no background pictures. {format === 'summary' ? 'Showing up to five items per section; page count depends on the content.' : 'Includes all items available in this view.'}</p>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.grid}>{visible.map(s => <section key={s.title} className={styles.card}><h3>{s.title}</h3>{s.lines.length ? s.lines.map((line, i) => <p key={i}>{line}</p>) : <p>Nothing recorded yet.</p>}</section>)}</div>
  </article>;
}
