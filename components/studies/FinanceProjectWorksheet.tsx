'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { isSampleMode, SAMPLE_MODE_EVENT } from '@/lib/sample-mode';
import { checkProjectAnswers, deriveProject, PROJECT_NUMBER_QUESTIONS, PROJECT_REASONING, projectMoney, readProjectDraft, type FinanceProjectCase, type ProjectAnswers } from '@/lib/finance-project';
import styles from './FinanceCourse.module.css';

export default function FinanceProjectWorksheet({ exercise }: { exercise: FinanceProjectCase }) {
  const { user, loading } = useAuth();
  const [sample, setSample] = useState<boolean | null>(null);
  const [draft, setDraft] = useState<{ key: string; answers: ProjectAnswers } | null>(null);
  const [savedMessage, setSavedMessage] = useState('');
  const [loadError, setLoadError] = useState(false);
  const [feedbackKey, setFeedbackKey] = useState<string | null>(null);
  useEffect(() => {
    const update = () => setSample(isSampleMode());
    update(); window.addEventListener(SAMPLE_MODE_EVENT, update);
    return () => window.removeEventListener(SAMPLE_MODE_EVENT, update);
  }, []);
  const key = `imbewu:finance-project:v1:${sample ? 'sample' : user?.uid ?? 'guest'}:${exercise.id}`;
  useEffect(() => {
    if (loading || sample === null) return;
    setFeedbackKey(null); setLoadError(false);
    try { setDraft({ key, answers: readProjectDraft(localStorage.getItem(key)) }); setSavedMessage('Practice answers stay on this device. Use Save before leaving this case.'); }
    catch { setDraft({ key, answers: {} }); setLoadError(true); setSavedMessage('An existing practice draft could not be opened. Work on paper or print this page; the stored copy has not been replaced.'); }
  }, [key, loading, sample]);
  const ready = !loading && sample !== null && draft?.key === key;
  const answers = ready ? draft.answers : {};
  const change = (id: string, value: string) => {
    if (!ready) return;
    setDraft({ key, answers: { ...answers, [id]: value } }); setFeedbackKey(null);
    setSavedMessage(loadError ? 'Practice is open, but the existing stored copy could not be read. Print your work to keep it.' : 'You have changes to save.');
  };
  const save = () => {
    if (!ready || loadError) return;
    try { localStorage.setItem(key, JSON.stringify(answers)); setSavedMessage(sample ? 'Saved for this sample session only. Sample answers reset when the session ends.' : 'Saved on this device. This is not a submitted assessment.'); }
    catch { setSavedMessage('The device could not save your answers. Keep this page open or print your work.'); }
  };
  const checks = checkProjectAnswers(exercise, answers);
  const showFeedback = feedbackKey === key;
  const derived = deriveProject(exercise);
  return <section className={styles.section} id="worksheet">
    <p className={styles.eyebrow}>Your worksheet</p><h2>Follow the records. Explain the decisions.</h2>
    <p>Use a notebook and calculator, or type here. Enter rand in the money boxes and kilograms in the stock box. Use a minus sign for a cash gap. A comma or point can separate decimals.</p>
    <p>Try every calculation before checking. You can read out or point to your reasoning while a facilitator writes it down. These self-checks do not award course credit.</p>
    {!ready && <p role="status">Opening your practice worksheet…</p>}
    <div className={styles.answerGrid}>{PROJECT_NUMBER_QUESTIONS.map(question => <label className={styles.answerField} key={question.id} htmlFor={`answer-${question.id}`}>
      <span>{question.label} ({question.unit})</span>
      <input id={`answer-${question.id}`} type="text" inputMode={question.id === 'plannedMinimum' || question.id === 'cashDifference' ? 'text' : 'decimal'} disabled={!ready} maxLength={30} value={answers[question.id] ?? ''} onChange={event => change(question.id, event.target.value)} />
    </label>)}</div>
    <h3>Explain with source references</h3>
    {PROJECT_REASONING.map(question => <label className={styles.answerField} key={question.id} htmlFor={`answer-${question.id}`}>
      <strong>{question.label}</strong><span>{question.prompt}</span>
      <textarea id={`answer-${question.id}`} disabled={!ready} rows={4} maxLength={3000} value={answers[question.id] ?? ''} onChange={event => change(question.id, event.target.value)} />
    </label>)}
    <div className={styles.actions}>
      <button type="button" disabled={!ready || loadError} onClick={save}>Save practice on this device</button>
      <button type="button" onClick={() => window.print()}>Print the case and my answers</button>
      <button type="button" className={styles.primary} disabled={!ready || checks.some(check => check.entered === null)} onClick={() => setFeedbackKey(key)}>Check my calculations</button>
    </div>
    <p role="status">{savedMessage}</p>
    {!showFeedback && <p>Fill all nine number boxes with valid numbers to open calculation feedback. Your written explanations need a facilitator or learning partner to review them.</p>}
    {showFeedback && <div className={styles.practice} aria-live="polite">
      <h3>{checks.filter(check => check.correct).length} of {checks.length} calculations match the supplied records</h3>
      <p>This checks calculations, not the quality of your reasoning or your readiness to manage a real business. No assessment result has been submitted.</p>
      <ul>{checks.map(check => <li key={check.id}><strong>{check.correct ? 'Matches' : 'Check again'} — {check.label}:</strong> {check.unit === 'kg' ? `${check.expected / 1000} kg` : projectMoney(check.expected)}.</li>)}</ul>
      <h4>Trace the answer</h4>
      <p>Harvest left = opening stock + harvest − delivery − household food − recorded loss. Compare it with {exercise.stockCount.reference}. Invoice value = delivered kilograms × the agreed price per kilogram. The in-month payment clears part of that invoice; {exercise.laterPayment.reference} is outside this month.</p>
      <p>The original forecast starts at {projectMoney(exercise.opening.cashCents)}, pays the two quoted amounts, then receives the assumed sale. Actual cash starts at the same opening amount and uses only the dated cash records. It also includes the stated funding and household withdrawal. The unknown, unpaid water charge changes neither the counted cash nor what is known about the missing cost.</p>
      <p>Full profit is unknown. The source pack does not supply complete production costs, stock values, equipment use and other relevant adjustments. Do not treat a cash balance, cash change or the difference between sales and the two payments as full profit.</p>
      <details><summary>See the running balances</summary><h4>Original forecast</h4><ol>{derived.plannedBalances.map(row => <li key={row.reference}>{row.date} · {row.reference}: {projectMoney(row.balance)}{row.balance < 0 ? ' — unfunded gap, not cash in a tin' : ''}</li>)}</ol><h4>Actual cash</h4><ol>{derived.actualBalances.map(row => <li key={row.reference}>{row.date} · {row.reference}: {projectMoney(row.balance)}</li>)}</ol></details>
      <h4>Explain the change from planned to actual cash</h4>
      <ul>{derived.bridge.map(row => <li key={row.label}>{row.label}: {projectMoney(row.cents)}.</li>)}</ul>
      <p>These changes add to {projectMoney(derived.cashDifference)}. They explain the change in closing cash, not profit. In these cases the price per kilogram stays the same; the sales difference comes from quantity.</p>
      <h4>Discuss and try a fresh case</h4><p>For every correction, point to the source and explain what went wrong. Use the next case after feedback. Repeating the same remembered totals does not demonstrate the method.</p>
    </div>}
    <div className={styles.printAnswers}><h3>Written answers</h3>{PROJECT_REASONING.map(q => <div key={q.id}><h4>{q.label}</h4><p>{answers[q.id] || 'Not yet written'}</p></div>)}</div>
  </section>;
}
