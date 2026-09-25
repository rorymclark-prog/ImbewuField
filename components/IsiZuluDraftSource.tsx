'use client';

/** Keeps financial wording readable in isiZulu while showing the exact English source. */
export default function IsiZuluDraftSource({
  lang,
  zulu,
  english,
  className = '',
  style,
}: {
  lang: string;
  zulu: string;
  english: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  if (lang !== 'zu') return <p className={className} style={style}>{english}</p>;

  return (
    <div className={className} style={style}>
      <p lang="zu" style={{ margin: 0 }}>{zulu}</p>
      <p className="mt-1 text-xs leading-snug text-stone-600" style={{ marginBottom: 0 }}>
        <span>Unreviewed isiZulu draft. </span>
        <span lang="en">English source: {english}</span>
      </p>
    </div>
  );
}
