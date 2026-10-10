'use client';

import { isRecordsRegionalLang, recordsDraft, recordsTemplate } from '@/lib/records-regional-drafts';

/**
 * Keeps financial wording readable in isiZulu while showing the exact English source.
 *
 * Sesotho, Tshivenda and Xitsonga drafts come from the source-keyed lookup in
 * lib/records-regional-drafts.ts. A sentence that carries a figure or a name passes the English
 * TEMPLATE and its values, so the draft is bound to the sentence and not to one amount; with no
 * draft the English stands alone, as it did before.
 */
export default function IsiZuluDraftSource({
  lang,
  zulu,
  english,
  template,
  vars,
  className = '',
  style,
}: {
  lang: string;
  zulu: string;
  english: string;
  /** English with {placeholders}; omit for a fixed sentence (the lookup then uses `english`). */
  template?: string;
  vars?: Record<string, string | number>;
  className?: string;
  style?: React.CSSProperties;
}) {
  // isiZulu keeps its own wording where a call site has one; with none (`zulu` empty) and for the
  // regional languages, the draft is looked up by the exact English sentence.
  // The lookup path counts only when the SENTENCE itself has a draft. A sentence with no draft but a
  // localised fragment inside its values would otherwise come back as English with a stray local word.
  const sentence = template ?? english;
  const looked = (code: string) => (recordsDraft(code, sentence) !== null ? recordsTemplate(code, sentence, null, vars ?? {}) : english);
  const local = lang === 'zu'
    ? (zulu || looked('zu'))
    : isRecordsRegionalLang(lang) ? looked(lang) : english;
  if (!local || local === english) return <p className={className} style={style}>{english}</p>;

  return (
    <div className={className} style={style}>
      <p lang={lang} style={{ margin: 0 }}>{local}</p>
      <p className="mt-1 text-xs leading-snug text-stone-600" style={{ marginBottom: 0 }}>
        {lang === 'zu' && <span>Unreviewed isiZulu draft. </span>}
        <span lang="en">English source: {english}</span>
      </p>
    </div>
  );
}
