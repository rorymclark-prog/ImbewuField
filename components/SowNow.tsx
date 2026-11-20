'use client';

// "Sow now, eat then": a twelve-month strip of the sample farm's year, with the months that have no
// fresh vegetable marked, and one more sowing (a crop, a month) laid on it as an arc: sow, tray,
// bed, pick. The reader drags the sowing month and watches the arc land on the calendar, filling a
// hungry month or missing it.
//
// Every number and month list comes from lib/sow-now.ts, which runs the sample farm's own crop plan
// (lib/demo-farm.ts) through the planner's food chart (lib/crop-plan.ts buildFoodAvailability,
// lib/year-of-food.ts buildYearOfFood, suggestGapFills). Nothing is typed in here. Reduced motion
// gets the finished arc as a still; Step and Replay still work, one month at a time.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronsRight, Pause, Play, Repeat } from 'lucide-react';
import {
  SOW_NOW_CROPS,
  YEAR_ORDER,
  bestSowMonth,
  plannerSowingsFor,
  sowNowBaseline,
  sowOutcome,
  type ArcStage,
  type SowNowCropKey,
  type SowOutcome,
} from '@/lib/sow-now';
import s from './SowNow.module.css';

const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_LETTER = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const CROP_NAME: Record<SowNowCropKey, string> = {
  'swiss-chard': 'chard', beetroot: 'beetroot', broccoli: 'broccoli', tomatoes: 'tomatoes', 'sweet-potato': 'sweet potato',
};
const CROP_LABEL: Record<SowNowCropKey, string> = {
  'swiss-chard': 'Chard', beetroot: 'Beetroot', broccoli: 'Broccoli', tomatoes: 'Tomatoes', 'sweet-potato': 'Sweet potato',
};
const STAGE_WORD: Record<ArcStage, string> = { sow: 'Sow', tray: 'Tray', bed: 'Bed', pick: 'Pick' };
const STEP_MS = 650;
const SETTLE_MS = 420;

const T = {
  title: 'Sow now, eat then',
  cropLabel: 'Crop',
  sowLabel: 'Sow in',
  play: 'Play', pause: 'Pause', replay: 'Replay', step: 'Step',
  playLabel: 'Play the sowing month by month', pauseLabel: 'Pause', stepLabel: 'Show the next month', replayLabel: 'Replay from the sowing month',
  keysHint: 'Use the left and right arrow keys on the slider to move the sowing month.',
  stripTitle: 'Fresh vegetables, month by month',
  arcTitle: 'The sowing',
  gapsTitle: 'The planner’s own suggestions for an empty month',
  gapsHint: 'Choose an empty month to see which of these five crops the planner would sow for it.',
  legend: { fresh: 'fresh vegetable coming', gap: 'none', filled: 'filled by this sowing', sow: 'sow', tray: 'tray', bed: 'in the bed', pick: 'pick' },
  note: 'These are the planner’s own crop timings for this farm, not a forecast: weather, pests and how you tend the crop move them. ' +
    'The year is the sample farm’s settled one: the crop plan’s repeating plantings, with the one-off crops already in the ground left out, ' +
    'vegetables only (fruit and animal products are not counted). A sowing is placed in the bed with the most free room, as the planner’s gap filler does, ' +
    'and only in months its calendar for this farm sources. There is no weather-station gate here.',
};

const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const monthList = (ms: number[]) => list(ms.map((m) => MONTH_LONG[m - 1]));
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

function finishedSentence(o: SowOutcome, key: SowNowCropKey): string {
  const name = CROP_NAME[key];
  const sow = MONTH_LONG[o.sowMonth - 1];
  const picks = o.pickMonths;
  const span = `${MONTH_LONG[picks[0] - 1]} to ${MONTH_LONG[picks[picks.length - 1] - 1]}`;
  const best = bestSowMonth(key);
  if (o.status === 'out-of-season') {
    return `${sow} is not a sourced sowing month for ${name} on this farm’s calendar, so the planner would not offer it. On paper it would be picked in ${span}${o.wouldFill.length ? `, reaching the empty ${plural(o.wouldFill.length, 'month', 'months')} of ${monthList(o.wouldFill)}` : ''}, but nothing is sown.`;
  }
  const head = `Sown in ${sow}, ${name} is picked fresh from ${span}.`;
  if (o.status === 'no-room') {
    return `${head} No bed has room for it over those months, so it cannot go in.`;
  }
  const where = o.placed ? ` It would go in ${o.placed.bedLabel}.` : '';
  if (o.status === 'adds-nothing-new') {
    return `${head} Every one of those months already has a fresh vegetable, so this sowing ends no empty month.${best ? ` ${key === 'swiss-chard' ? 'Chard' : CROP_LABEL[key]} does most when sown in ${MONTH_LONG[best.sowMonth - 1]}.` : ''}`;
  }
  const covered = o.alreadyCovered.length ? ` ${monthList(o.alreadyCovered)} already had a fresh vegetable.` : '';
  const left = o.gapsAfter.length ? ` Still empty: ${monthList(o.gapsAfter)}.` : ' No empty month is left.';
  return `${head} That ends the empty ${plural(o.filled.length, 'month', 'months')} of ${monthList(o.filled)}.${covered}${left}${where}`;
}

export default function SowNow() {
  const base = useMemo(() => sowNowBaseline(), []);
  const gaps = base.year.vegGapMonths;
  const [cropKey, setCropKey] = useState<SowNowCropKey>('swiss-chard');
  const [sowMonth, setSowMonth] = useState(4);
  const [gapSel, setGapSel] = useState<number | null>(null);
  const [reduced, setReduced] = useState(false);
  const outcome = useMemo(() => sowOutcome(cropKey, sowMonth), [cropKey, sowMonth]);
  const total = outcome.steps.length;
  // Steps shown so far. The first paint is the finished state, so a page with no script still reads whole.
  const [shown, setShown] = useState(total);
  const [playing, setPlaying] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const touched = useRef(false);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducedRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const apply = () => { reducedRef.current = !!mq?.matches; setReduced(!!mq?.matches); };
    apply();
    mq?.addEventListener?.('change', apply);
    return () => mq?.removeEventListener?.('change', apply);
  }, []);

  // Play the first arc once, when the figure scrolls into view.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting) || touched.current || reducedRef.current) return;
      touched.current = true;
      setShown(0); setPlaying(true);
      io.disconnect();
    }, { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!playing) return;
    if (shown >= total) { setPlaying(false); return; }
    const id = setTimeout(() => setShown((n) => Math.min(total, n + 1)), shown === 0 ? 200 : STEP_MS);
    return () => clearTimeout(id);
  }, [playing, shown, total]);

  useEffect(() => () => { if (settle.current) clearTimeout(settle.current); }, []);

  // A new crop or month: show the sowing alone, then let the arc land once the reader stops moving.
  const restart = useCallback((nextTotal: number) => {
    touched.current = true;
    if (settle.current) clearTimeout(settle.current);
    setPlaying(false);
    if (reducedRef.current) { setShown(nextTotal); return; }
    setShown(1);
    settle.current = setTimeout(() => setPlaying(true), SETTLE_MS);
  }, []);

  const choose = useCallback((key: SowNowCropKey, month: number) => {
    setCropKey(key); setSowMonth(month);
    restart(sowOutcome(key, month).steps.length);
  }, [restart]);

  const togglePlay = () => {
    touched.current = true;
    if (playing) { setPlaying(false); return; }
    if (shown >= total) setShown(0);
    setPlaying(true);
  };
  const stepOnce = () => { touched.current = true; setPlaying(false); setShown((n) => (n >= total ? 1 : n + 1)); };
  const replay = () => {
    touched.current = true;
    setShown(reducedRef.current ? 1 : 0);
    setPlaying(!reducedRef.current);
  };

  const finished = shown >= total;
  const visible = outcome.steps.filter((st) => st.offset < shown);
  const byMonth = new Map(visible.map((st) => [st.month, st]));
  const pickShown = new Set(visible.filter((st) => st.stage === 'pick').map((st) => st.month));
  const filledNow = outcome.filled.filter((m) => pickShown.has(m));

  const caption = useMemo(() => {
    if (finished) return finishedSentence(outcome, cropKey);
    const last = outcome.steps[Math.max(0, shown - 1)];
    const name = CROP_NAME[cropKey];
    const m = MONTH_LONG[last.month - 1];
    const text: Record<ArcStage, string> = {
      sow: outcome.transplant ? `${m}: sow ${name} in a tray.` : `${m}: sow ${name} in the bed.`,
      tray: `${m}: the seedlings grow on in the tray.`,
      bed: `${m}: ${name} grows in ${outcome.placed?.bedLabel ?? 'the bed'}.`,
      pick: `${m}: first fresh ${name} to pick.`,
    };
    if (last.stage === 'pick' && outcome.steps.slice(0, last.offset).some((st) => st.stage === 'pick')) return `${m}: still picking ${name}${outcome.filled.includes(last.month) ? `, and ${m} is no longer empty` : ''}.`;
    if (last.stage === 'pick' && outcome.filled.includes(last.month)) return `${text.pick.replace('.', '')}, and ${m} is no longer empty.`;
    return text[last.stage];
  }, [finished, shown, outcome, cropKey]);

  const planner = gapSel ? plannerSowingsFor(gapSel) : [];
  const gapNames = monthList(gaps);
  const sowAria = `${MONTH_LONG[sowMonth - 1]}`;
  const best = bestSowMonth(cropKey);

  return (
    <section ref={sectionRef} className={s.card} aria-labelledby="sow-now-title">
      <div className={s.head}>
        <h2 id="sow-now-title" className={s.title}>{T.title}</h2>
        <p className={s.sub}>
          In the sample farm’s settled year, {numberWord(gaps.length)} months have no fresh vegetable from the crop plan: {gapNames}.
          Pick a crop and drag its sowing month to see which of them it would feed, and when.
        </p>
      </div>

      <div className={s.controls}>
        <div className={s.group}>
          <span className={s.groupLabel} id="sow-now-crop">{T.cropLabel}</span>
          <div className={s.chips} role="group" aria-labelledby="sow-now-crop">
            {SOW_NOW_CROPS.map((k) => (
              <button key={k} type="button" className={s.chip} aria-pressed={k === cropKey} onClick={() => choose(k, sowMonth)}>{CROP_LABEL[k]}</button>
            ))}
          </div>
        </div>
        <div className={s.actions}>
          {!reduced && (
            <button type="button" className={`${s.play} ${s.playMain}`} onClick={togglePlay} aria-label={playing ? T.pauseLabel : T.playLabel}>
              {playing ? <Pause size={16} aria-hidden /> : finished ? <Repeat size={16} aria-hidden /> : <Play size={16} aria-hidden />}
              {playing ? T.pause : finished ? T.replay : T.play}
            </button>
          )}
          <button type="button" className={`${s.play}${reduced ? ` ${s.playMain}` : ''}`} onClick={stepOnce} aria-label={T.stepLabel}>
            <ChevronsRight size={16} aria-hidden />{T.step}
          </button>
          <button type="button" className={s.play} onClick={replay} aria-label={T.replayLabel}>
            <Repeat size={16} aria-hidden />{T.replay}
          </button>
        </div>
      </div>

      <div className={s.scrub}>
        <label htmlFor="sow-now-month" className={s.groupLabel}>{T.sowLabel}</label>
        <input
          id="sow-now-month"
          type="range"
          min={1}
          max={12}
          step={1}
          value={sowMonth}
          className={s.range}
          aria-valuetext={`${sowAria}${outcome.inSeason ? '' : ', not a sourced sowing month'}`}
          aria-describedby="sow-now-keys"
          onChange={(e) => choose(cropKey, Number(e.currentTarget.value))}
        />
        <span className={s.sowReadout} aria-hidden>{MONTH_LONG[sowMonth - 1]}</span>
      </div>
      <p id="sow-now-keys" className={s.srOnly}>{T.keysHint}</p>
      {!outcome.inSeason && (
        <p className={s.warn} role="note">{MONTH_LONG[sowMonth - 1]} is not a sourced sowing month for {CROP_NAME[cropKey]} here{best ? `; the planner would sow it in ${MONTH_LONG[best.sowMonth - 1]}, for instance.` : '.'}</p>
      )}

      <div className={s.stripWrap}>
        <div className={s.rowTitle}>{T.stripTitle}</div>
        <ol className={s.strip} aria-label="Twelve months, January to December">
          {YEAR_ORDER.map((m) => {
            const mo = base.year.months[m - 1];
            const gap = mo.vegGap;
            const filled = filledNow.includes(m);
            const would = !filled && outcome.status !== 'fills' && pickShown.has(m) && outcome.wouldFill.includes(m);
            const state = filled ? 'filled' : gap ? 'gap' : 'fresh';
            const label = `${MONTH_LONG[m - 1]}: ${gap ? 'no fresh vegetable' : `${mo.freshVeg.length} fresh vegetable ${plural(mo.freshVeg.length, 'kind', 'kinds')}`}${filled ? ', now filled by this sowing' : ''}${would ? ', picking would reach this month but nothing is sown' : ''}`;
            return (
              <li key={m} className={s.cell} data-state={state} data-would={would || undefined} aria-label={label}>
                <span className={s.mLetter} aria-hidden>{MONTH_LETTER[m - 1]}</span>
                <span className={s.mShort} aria-hidden>{MONTH_SHORT[m - 1]}</span>
                <span className={s.mark} aria-hidden>
                  {filled ? '✓' : gap ? (would ? '?' : '–') : mo.freshVeg.length}
                </span>
              </li>
            );
          })}
        </ol>

        <div className={s.rowTitle}>{T.arcTitle}: {CROP_NAME[cropKey]}, sown in {MONTH_LONG[sowMonth - 1]}</div>
        <ol className={s.strip} aria-hidden>
          {YEAR_ORDER.map((m) => {
            const st = byMonth.get(m);
            return (
              <li key={m} className={s.arc} data-stage={st?.stage} data-empty={st ? undefined : true}>
                <span className={s.mLetter}>{MONTH_LETTER[m - 1]}</span>
                <span className={s.mShort}>{MONTH_SHORT[m - 1]}</span>
                <span className={s.stage}>{st ? STAGE_WORD[st.stage] : ''}</span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className={s.legend} aria-hidden>
        <span className={s.key}><span className={s.swFresh} />{T.legend.fresh}</span>
        <span className={s.key}><span className={s.swGap} />{`no fresh vegetable (${T.legend.gap})`}</span>
        <span className={s.key}><span className={s.swFilled} />{T.legend.filled}</span>
        <span className={s.key}><span className={s.swSow} />{T.legend.sow}</span>
        <span className={s.key}><span className={s.swTray} />{T.legend.tray}</span>
        <span className={s.key}><span className={s.swBed} />{T.legend.bed}</span>
        <span className={s.key}><span className={s.swPick} />{T.legend.pick}</span>
      </div>

      <p className={s.caption} aria-live="polite">{caption}</p>

      <div className={s.gaps}>
        <span className={s.groupLabel} id="sow-now-gaps">{T.gapsTitle}</span>
        <p className={s.hint}>{T.gapsHint}</p>
        <div className={s.chips} role="group" aria-labelledby="sow-now-gaps">
          {gaps.map((m) => (
            <button key={m} type="button" className={s.chip} aria-pressed={gapSel === m} onClick={() => setGapSel(gapSel === m ? null : m)}>{MONTH_SHORT[m - 1]}</button>
          ))}
        </div>
        {gapSel && (
          <div className={s.suggest} role="group" aria-label={`Sowings the planner offers for ${MONTH_LONG[gapSel - 1]}`}>
            {planner.length === 0 && <span className={s.hint}>None of these five crops reaches {MONTH_LONG[gapSel - 1]} in a sourced sowing month with room in a bed.</span>}
            {planner.map((p) => (
              <button key={`${p.cropKey}${p.sowMonth}`} type="button" className={s.chip} onClick={() => choose(p.cropKey as SowNowCropKey, p.sowMonth)}>
                {CROP_LABEL[p.cropKey as SowNowCropKey]}, sow {MONTH_SHORT[p.sowMonth - 1]}
              </button>
            ))}
          </div>
        )}
      </div>

      <details className={s.details}>
        <summary>Month by month, as a table</summary>
        <div className={s.tableWrap}>
          <table className={s.table}>
            <caption>Fresh vegetable kinds in the sample farm’s settled year, before and after sowing {CROP_NAME[cropKey]} in {MONTH_LONG[sowMonth - 1]}</caption>
            <thead>
              <tr><th scope="col">Month</th><th scope="col">Before</th><th scope="col">After</th></tr>
            </thead>
            <tbody>
              {YEAR_ORDER.map((m) => {
                const before = base.year.months[m - 1].freshVeg.length;
                const add = outcome.status === 'fills' && outcome.pickMonths.includes(m) ? 1 : 0;
                return (
                  <tr key={m}>
                    <th scope="row">{MONTH_LONG[m - 1]}</th>
                    <td className={before === 0 ? s.cellNone : undefined}>{before === 0 ? 'none' : before}</td>
                    <td className={before + add === 0 ? s.cellNone : undefined}>{before + add === 0 ? 'none' : before + add}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>

      <p className={s.note}>{T.note}</p>
    </section>
  );
}

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
function numberWord(n: number): string { return NUMBER_WORDS[n] ?? String(n); }
