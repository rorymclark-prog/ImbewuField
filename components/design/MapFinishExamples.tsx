'use client';

import { useId, useRef, useState } from 'react';
import { EXACT_PLANTING_FINISHES } from '@/lib/planting-cartography';
import type { StylePreset } from '@/lib/producer-prompt';
import styles from './MapFinishExamples.module.css';

type Sample = { key: string; label: string };

function SampleGrid({ kind, samples }: { kind: 'exact' | 'ai'; samples: readonly Sample[] }) {
  return (
    <div className={styles.grid}>
      {samples.map(({ key, label }) => (
        <figure key={key}>
          <img src={`/map-finishes/${kind}-${key}.webp`} width={320} height={240} alt="" decoding="async" />
          <figcaption>{label}</figcaption>
        </figure>
      ))}
    </div>
  );
}

export default function MapFinishExamples({ exact, aiStyles }: {
  exact?: boolean;
  aiStyles: ReadonlyArray<{ key: StylePreset; label: string }>;
}) {
  const launch = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button ref={launch} type="button" aria-haspopup="dialog" className={styles.launch} onClick={() => {
        dialog.current?.showModal();
        setOpen(true);
      }}>Compare finish samples</button>
      <dialog ref={dialog} className={styles.dialog} aria-labelledby={heading} onClose={() => {
        setOpen(false);
        launch.current?.focus({ preventScroll: true });
      }}>
        <header className={styles.header}>
          <h2 id={heading}>Compare map finishes</h2>
          <form method="dialog"><button autoFocus aria-label="Close finish samples">Close</button></form>
        </header>
        {open && (
          <div className={styles.content}>
            <p>One example garden, viewed from above. Browsing these samples is free.</p>
            {exact && (
              <>
                <h3>Exact map finishes</h3>
                <SampleGrid kind="exact" samples={Object.entries(EXACT_PLANTING_FINISHES).map(([key, label]) => ({ key, label }))} />
              </>
            )}
            {aiStyles.length > 0 && (
              <>
                <h3>AI illustration styles</h3>
                <SampleGrid kind="ai" samples={aiStyles} />
              </>
            )}
          </div>
        )}
      </dialog>
    </>
  );
}
