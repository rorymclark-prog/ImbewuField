"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { isSampleMode, SAMPLE_MODE_EVENT } from '@/lib/sample-mode';
import { PORTFOLIO_STAGES, PORTFOLIO_LIMIT, PORTFOLIO_NOTICE, portfolioStorageKey, portfolioText, readPortfolio, type PortfolioAnswers } from '@/lib/design-portfolio';
import OfflinePageLink from './OfflinePageLink';
import styles from './FinanceCourse.module.css';
import folder from './DesignPortfolio.module.css';

type Draft = { key: string; answers: PortfolioAnswers; baseline: string | null; loadError: boolean; dirty: boolean };

export default function DesignPortfolio() {
  const { user, loading } = useAuth();
  const [sample, setSample] = useState<boolean | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const update = () => setSample(isSampleMode());
    update(); window.addEventListener(SAMPLE_MODE_EVENT, update);
    return () => window.removeEventListener(SAMPLE_MODE_EVENT, update);
  }, []);
  const key = portfolioStorageKey(user?.uid ?? null, sample === true);
  useEffect(() => {
    if (loading || sample === null) return;
    try {
      const raw = localStorage.getItem(key);
      setDraft({ key, answers: readPortfolio(raw), baseline: raw, loadError: false, dirty: false });
      setMessage(raw === null ? 'Your folder is empty. Save your notes before leaving.' : 'Opened the saved folder for this device.');
    } catch {
      setDraft({ key, answers: {}, baseline: null, loadError: true, dirty: false });
      setMessage('The saved folder could not be opened. Its stored copy has not been replaced. You can write here and download a text copy.');
    }
  }, [key, loading, sample]);
  const ready = !loading && sample !== null && draft?.key === key;
  const answers = ready ? draft.answers : {};
  useEffect(() => {
    if (!ready || !draft.dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [ready, draft]);
  function change(id: string, value: string) {
    if (!ready) return;
    setDraft({ ...draft, answers: { ...answers, [id]: value }, dirty: true });
    setMessage(draft.loadError ? 'Keep this work by downloading a text copy. The unreadable stored draft is protected.' : 'You have notes to save. Save before following another lesson link.');
  }
  function save() {
    if (!ready || draft.loadError) return;
    try {
      // Another open tab may hold newer work. Keep both copies instead of overwriting it unnoticed.
      if (localStorage.getItem(key) !== draft.baseline) {
        setMessage('This saved folder changed in another tab. Download your current notes before reopening the saved folder. This page has not overwritten it.');
        return;
      }
      const raw = JSON.stringify({ version: 1, answers });
      localStorage.setItem(key, raw);
      setDraft({ ...draft, baseline: raw, dirty: false });
      setMessage(sample ? 'Saved for this sample session. Download a copy before ending the session.' : 'Saved on this device. Not uploaded or submitted.');
    } catch { setMessage('This device could not save the folder. Keep this page open and download a text copy.'); }
  }
  function download() {
    if (!ready) return;
    const url = URL.createObjectURL(new Blob([portfolioText(answers)], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'imbewu-design-learning-folder.txt';
    document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage('Text copy requested. Check your Downloads for imbewu-design-learning-folder.txt. The drawing files are separate.');
  }
  return <>
    <aside className={`${styles.notice} ${styles.projectNotice}`}><p>{PORTFOLIO_NOTICE}</p></aside>
    <section className={styles.section}>
      <h2>One folder, from brief to revision</h2>
      <p>Use this beside your drawings, or work on paper. Read out your answers while a learning partner writes if that helps. Use a practice site or a short site label; private household details are not needed here.</p>
      <p>Saving keeps one folder for this account on this browser and device. It does not sync to another device. Guest notes are shared by people using this browser. Download a text copy to keep with your drawings, and save before leaving this page.</p>
      <nav className={folder.stageLinks} aria-label="Design folder stages">{PORTFOLIO_STAGES.map((stage, index) => <a key={stage.id} href={`#folder-${stage.id}`}><span>{index + 1}</span>{stage.title}</a>)}</nav>
    </section>
    {!ready && <p role="status">Opening your design folder…</p>}
    {PORTFOLIO_STAGES.map((stage, index) => <section className={`${styles.section} ${folder.stage}`} id={`folder-${stage.id}`} key={stage.id}>
      <p className={styles.eyebrow}>Stage {index + 1} · Your design evidence</p>
      <h2>{stage.title}</h2><p>{stage.purpose}</p>
      <details className={folder.example}><summary>Discuss the busy-yard example</summary><p>{stage.example}</p></details>
      {stage.fields.map(field => <div className={styles.answerField} key={field.id}>
        <label htmlFor={`portfolio-${field.id}`}><strong>{field.label}</strong></label>
        <span id={`help-${field.id}`}>{field.prompt}</span>
        <textarea id={`portfolio-${field.id}`} aria-describedby={`help-${field.id}`} disabled={!ready} rows={5} maxLength={PORTFOLIO_LIMIT} value={answers[field.id] ?? ''} onChange={event => change(field.id, event.target.value)} />
        {(answers[field.id]?.length ?? 0) > PORTFOLIO_LIMIT - 500 && <span>{PORTFOLIO_LIMIT - (answers[field.id]?.length ?? 0)} characters remaining. Keep longer evidence in a separate document and reference it here.</span>}
        <p className={folder.printAnswer}>{answers[field.id] || '[Not yet recorded]'}</p>
      </div>)}
      <aside className={folder.review}><h3>Review the reasoning together</h3><p>{stage.review}</p><p>Discuss what is supported, what needs more evidence and the next attempt. Record feedback and changes in stage 6.</p></aside>
      <div className={styles.actions}><button type="button" disabled={!ready || draft.loadError} onClick={save}>Save folder after this stage</button><OfflinePageLink href={`/student/design/${stage.lesson}`}>Revisit this stage’s lessons →</OfflinePageLink>{stage.id === 'd4' && <OfflinePageLink href="/student/guides/design">Design Studio guide →</OfflinePageLink>}{stage.id === 'd5' && <OfflinePageLink href="/student/finance">Farm Finance →</OfflinePageLink>}</div><p className={folder.saveNote}>{ready ? message : 'Opening your folder…'}</p>
    </section>)}
    <section className={styles.section}><h2>Bring the folder and the actual plan</h2><p>A reviewer needs the evidence notes, drawings and your explanation together. Check that each reference names the right revision. Explain an alternative you rejected, a decision still on hold and what could make you revise the plan.</p><p>This page does not grade your answers or approve a design. Your facilitator reviews what you can explain and demonstrate, then helps identify the next attempt.</p></section>
    <div className={folder.saveBar}>
      <div className={styles.actions}><button type="button" className={styles.primary} disabled={!ready || draft.loadError} onClick={save}>Save folder on this device</button><button type="button" disabled={!ready} onClick={download}>Download my folder as text</button></div>
      <p role="status">{ready ? message : 'Opening your folder…'}</p>
    </div>
  </>;
}
