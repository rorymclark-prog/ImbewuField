'use client';

import { ArrowDown, BookOpen, Check, FileText, LayoutDashboard } from 'lucide-react';
import styles from './ReportReadingGuide.module.css';

export type ReportReadingDepth = 'one' | 'five' | 'full';

export default function ReportReadingGuide({ reading, onChange, language, chapters, onChapter }: {
  reading: ReportReadingDepth;
  onChange: (reading: ReportReadingDepth) => void;
  language: string;
  chapters: { id: string; title: string }[];
  onChapter: (id: string) => void;
}) {
  const t = (en: string, zu: string) => language === 'zu' ? zu : en;
  const editions = [
    { id: 'one', Icon: LayoutDashboard, title: t('At a glance', 'Ngokubheka nje'), note: t('The essentials, clearly laid out.', 'Okubalulekile, kubekwe ngokucacile.'), detail: t('1-page summary PDF', 'I-PDF yesifinyezo sekhasi elilodwa') },
    { id: 'five', Icon: FileText, title: t('Field guide', 'Umhlahlandlela wasensimini'), note: t('The site, resources and next actions.', 'Indawo, izinsiza nezinyathelo ezilandelayo.'), detail: t('5-page summary PDF', 'I-PDF yesifinyezo samakhasi amahlanu') },
    { id: 'full', Icon: BookOpen, title: t('Complete report', 'Umbiko ogcwele'), note: t('Every chapter, map and visual.', 'Zonke izahluko, amamephu nemifanekiso.'), detail: t('Full report PDF', 'I-PDF yombiko ogcwele') },
  ] as const;
  return <section className={`${styles.guide} no-print`} aria-label={t('Choose how to read', 'Khetha indlela yokufunda')}>
    <div className={styles.heading}><span>{t('YOUR REPORT, YOUR PACE', 'UMBIKO WAKHO, NGEJUBANE LAKHO')}</span><p>{t('Switch views without rewriting your report.', 'Shintsha ukubuka ngaphandle kokubhala kabusha umbiko wakho.')}</p></div>
    <div className={styles.editions}>{editions.map(({ id, Icon, title, note, detail }) => <button type="button" key={id} aria-pressed={reading === id} onClick={() => onChange(id)}>
      <div className={styles.cardTop}><Icon size={22} aria-hidden="true" /><span>{detail}</span>{reading === id && <Check size={17} aria-hidden="true" />}</div>
      <strong>{title}</strong><small>{note}</small>
    </button>)}</div>
    {reading !== 'full' && <p className={styles.exportNote}>{t('Visuals help you read on screen. The summary PDF is a concise, ink-saving handout; choose Complete report for the full visual PDF.', 'Imifanekiso isiza ukufunda esikrinini. I-PDF yesifinyezo iyonga uyinki; khetha Umbiko ogcwele ukuze uthole i-PDF enemifanekiso yonke.')}</p>}
    {reading === 'full' && chapters.length > 0 && <details className={styles.contents}>
      <summary><ArrowDown size={17} aria-hidden="true" />{t('Find a chapter', 'Thola isahluko')}<span>{chapters.length}</span></summary>
      <nav aria-label={t('Report chapters', 'Izahluko zombiko')}>{chapters.map((chapter, i) => <button key={chapter.id} onClick={() => onChapter(chapter.id)}><span>{String(i + 1).padStart(2, '0')}</span>{chapter.title}</button>)}</nav>
    </details>}
  </section>;
}
