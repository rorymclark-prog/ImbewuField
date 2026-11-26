import { useState } from 'react';
import { BookOpen, ChevronDown, PencilLine } from 'lucide-react';
import { FIELD_CASES, LESSON_FIELD_TASKS } from '@/lib/study-fieldwork';
import { isManualLang, manualUi, type ManualFigure } from '@/lib/manual';
import manualFigures from '@/content/manual/figures.json';
import passages from '@/content/study/manual-passages.json';
import { ManualFigureView } from '@/components/manual/ManualBlocks';
import OfflinePageLink from './OfflinePageLink';
import styles from './StudyFieldwork.module.css';

const figures = new Map((manualFigures as ManualFigure[]).map(figure => [figure.id, figure]));

function FieldText({ copy, lang }: { copy: { en: string; zu: string }; lang: string }) {
  if (lang !== 'zu') return <span lang="en">{copy.en}</span>;
  return <><span lang="zu">{copy.zu}</span><small className={styles.source} lang="en">{copy.en}</small></>;
}

function editionLabel(lang: string, english: string, zulu: string) {
  if (lang === 'zu') return <><span lang="zu">{zulu}</span><span lang="en"> · isiZulu draft</span></>;
  return <span lang="en">{english}{lang !== 'en' && ' · English'}</span>;
}

export function ModuleFieldCase({ moduleId, lang }: { moduleId: string; lang: string }) {
  const [unavailableFigure, setUnavailableFigure] = useState<string | null>(null);
  const example = FIELD_CASES[moduleId];
  if (!example) return null;
  const edition = isManualLang(lang) ? lang : 'en';
  const ui = manualUi(edition);
  const extracts = passages[moduleId as keyof typeof passages];
  const excerpt = extracts[edition];
  const figure = example.figure ? figures.get(example.figure) : undefined;
  return (
    <section className={styles.fieldCase} aria-labelledby={`field-case-${moduleId}`}>
      <header>
        <p className={styles.kicker}>{editionLabel(lang, 'Practice case', 'Isibonelo sokuzilolonga')}</p>
        <h3 id={`field-case-${moduleId}`} className="font-display"><FieldText copy={example.title} lang={lang} /></h3>
      </header>
      <div className={styles.caseBody}>
        <p className={styles.scene}><FieldText copy={example.scene} lang={lang} /></p>
        <div className={styles.discussion}>
          <p className={styles.question}><FieldText copy={example.question} lang={lang} /></p>
          <details className={styles.reasoning}>
            <summary><span><FieldText copy={{ en: 'Compare your thinking', zu: 'Qhathanisa indlela ocabanga ngayo' }} lang={lang} /></span><ChevronDown size={16} aria-hidden="true" /></summary>
            <p><FieldText copy={example.reasoning} lang={lang} /></p>
            <blockquote className={styles.excerpt} lang={edition}>
              <cite>{ui.title} · {excerpt.sectionTitle}</cite>
              <p>{excerpt.passage}</p>
              {edition !== 'en' && <><small>{ui.draftNotice}</small><p className={styles.source} lang="en">{extracts.en.passage}</p></>}
            </blockquote>
          </details>
        </div>
        {figure && unavailableFigure !== figure.id && (
          <div className={styles.artwork} onErrorCapture={() => setUnavailableFigure(figure.id)}>
            <ManualFigureView figure={figure} lang={lang === 'zu' ? 'zu' : 'en'} grouped />
            {lang === 'zu' && <small lang="en" className={styles.source}>{figure.caption.en}</small>}
          </div>
        )}
      </div>
      <OfflinePageLink className={styles.manual} lang={edition} href={`/manual/${edition}/${example.chapter}#section-${example.section}`}>
        <BookOpen size={17} aria-hidden="true" />
        {ui.title} · {excerpt.sectionTitle}
      </OfflinePageLink>
    </section>
  );
}

export function LessonFieldTask({ lessonId, lang }: { lessonId: string; lang: string }) {
  const task = LESSON_FIELD_TASKS[lessonId];
  if (!task) return null;
  return (
    <section className={styles.task}>
      <h4><PencilLine size={17} aria-hidden="true" />{editionLabel(lang, 'In your field notebook', 'Encwadini yakho yasensimini')}</h4>
      <p><FieldText copy={task} lang={lang} /></p>
    </section>
  );
}
