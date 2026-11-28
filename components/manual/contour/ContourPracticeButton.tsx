'use client';

import { useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { ArrowDown, ArrowUp, Flag, Gamepad2, RotateCcw, X } from 'lucide-react';
import {
  framePose, initialPeg, limitTurn, nextPracticePeg, startingTurn, TOTAL_PEGS,
  TURN_LIMIT, TURN_STEP, type GroundPoint,
} from '@/lib/contour-practice';
import type { ManualLang } from '@/lib/manual';
import type { createContourScene } from './scene';
import copy from './copy.json';
import styles from './ContourPractice.module.css';

type Copy = (typeof copy)[ManualLang];
type Scene = Awaited<ReturnType<typeof createContourScene>>;

export default function ContourPracticeButton({ lang }: { lang: ManualLang }) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const ui = copy[lang];
  function close() {
    setOpen(false);
    opener.current?.focus({ preventScroll: true });
  }
  return (
    <>
      <button type="button" ref={opener} className={styles.entry} onClick={() => setOpen(true)} aria-haspopup="dialog">
        <Gamepad2 aria-hidden size={21} />
        <span><strong>{ui.title}</strong><small>{ui.open}</small></span>
      </button>
      {open && <Practice lang={lang} ui={ui} onClose={close} />}
    </>
  );
}

function Practice({ lang, ui, onClose }: { lang: ManualLang; ui: Copy; onClose: () => void }) {
  const headingId = useId();
  const introId = useId();
  const statusId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const slider = useRef<HTMLInputElement>(null);
  const restart = useRef<HTMLButtonElement>(null);
  const draw = useRef<Scene | null>(null);
  const drag = useRef<{ finger: number; y: number; turn: number }>();
  const [pegs, setPegs] = useState<GroundPoint[]>(() => [initialPeg()]);
  const [turn, setTurn] = useState(() => startingTurn(1));
  const [visual, setVisual] = useState<'loading' | 'ready' | 'fallback'>('loading');
  const [justPlaced, setJustPlaced] = useState(false);
  const pivot = pegs[pegs.length - 1];
  const done = pegs.length === TOTAL_PEGS;
  const pose = done ? null : framePose(pivot, turn);
  const nextSceneState = { pivot, pose, pegs };
  const latest = useRef(nextSceneState);
  // This feeds the asynchronous renderer the latest move even if its textures are still loading.
  latest.current = nextSceneState;

  useEffect(() => {
    const modal = dialog.current;
    if (modal && !modal.open) modal.showModal();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const target = canvas.current;
    if (!target) return;
    function unavailable() {
      if (controller.signal.aborted) return;
      setVisual('fallback');
    }
    target.addEventListener('webglcontextlost', unavailable);
    async function load() {
      try {
        const { createContourScene } = await import('./scene');
        if (controller.signal.aborted || !target) return;
        const scene = await createContourScene(target, controller.signal);
        if (controller.signal.aborted) {
          scene.dispose();
          return;
        }
        draw.current = scene;
        scene.update(latest.current);
        setVisual('ready');
      } catch {
        unavailable();
      }
    }
    void load();
    return () => {
      controller.abort();
      target.removeEventListener('webglcontextlost', unavailable);
      draw.current?.dispose();
      draw.current = null;
    };
  }, []);

  useEffect(() => {
    draw.current?.update(latest.current);
  }, [pegs, turn]);

  function steer(value: number) {
    if (done) return;
    setJustPlaced(false);
    setTurn(limitTurn(Math.round(value / TURN_STEP) * TURN_STEP));
  }
  function grip(e: PointerEvent<HTMLCanvasElement>) {
    if (done || e.button !== 0 || drag.current) return;
    drag.current = { finger: e.pointerId, y: e.clientY, turn };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function stretch(e: PointerEvent<HTMLCanvasElement>) {
    const held = drag.current;
    if (held?.finger === e.pointerId) steer(held.turn + (e.clientY - held.y) * .44);
  }
  function release(e: PointerEvent<HTMLCanvasElement>) {
    if (drag.current?.finger === e.pointerId) drag.current = undefined;
  }
  function place() {
    if (done) return;
    const next = nextPracticePeg(pivot, turn);
    if (!next) return;
    drag.current = undefined;
    const updated = [...pegs, next];
    setPegs(updated);
    setTurn(startingTurn(updated.length));
    setJustPlaced(true);
    requestAnimationFrame(() => (updated.length === TOTAL_PEGS ? restart : slider).current?.focus());
  }
  function startAgain() {
    setPegs([initialPeg()]);
    setTurn(startingTurn(1));
    setJustPlaced(false);
    drag.current = undefined;
    requestAnimationFrame(() => slider.current?.focus());
  }

  const balance = pose?.aligned ? ui.aligned : (pose?.rise ?? 0) > 0 ? ui.higher : ui.lower;
  const feedback = done ? ui.complete : justPlaced ? ui.nextCue : balance;
  const progress = ui.progress.replace('{current}', String(pegs.length)).replace('{total}', String(TOTAL_PEGS));
  const stringPosition = Math.min(92, Math.max(8, 50 + (pose?.reading ?? 0) * 183));
  return (
    <dialog ref={dialog} className={styles.dialog} data-contour-practice lang={lang}
      aria-labelledby={headingId} aria-describedby={introId} onClose={onClose}>
      <header className={styles.header}>
        <div><p className={styles.progress}>{progress}</p><h3 id={headingId} className="font-display">{ui.title}</h3></div>
        <button className={styles.close} type="button" aria-label={ui.close} onClick={() => dialog.current?.close()}>
          <X aria-hidden size={22} />
        </button>
      </header>
      <p id={introId} className={styles.intro}>{ui.intro}</p>
      <div className={styles.stage} data-look={visual}>
        <canvas ref={canvas} aria-label={ui.scene} role="img" className={styles.canvas}
          onPointerDown={grip} onPointerMove={stretch} onPointerUp={release}
          onPointerCancel={release} onLostPointerCapture={release} />
        {visual !== 'ready' && <p className={styles.notice} role="status">{visual === 'loading' ? ui.loading : ui.unavailable}</p>}
        {visual === 'ready' && !done && <p className={styles.dragHint}>{ui.drag}</p>}
      </div>
      <div className={styles.console}>
        <div className={styles.readout}>
          <div className={styles.gauge} data-aligned={Boolean(pose?.aligned || done)} aria-hidden="true"
            style={{ '--string-position': `${stringPosition}%` } as CSSProperties}>
            <span className={styles.center} /><span className={styles.needle} />
          </div>
          <div><span className={styles.readingTitle}>{ui.plumb}</span>
            <p id={statusId} role="status" className={styles.feedback} data-aligned={Boolean(pose?.aligned || done)}>{feedback}</p>
          </div>
        </div>
        {!done && <div className={styles.steer}>
          <button type="button" onClick={() => steer(turn - 2)} className={styles.turn} aria-label={ui.uphill} title={ui.uphill}>
            <ArrowUp size={19} aria-hidden />
          </button>
          <input ref={slider} type="range" min={-TURN_LIMIT} max={TURN_LIMIT} step={TURN_STEP} value={turn}
            onChange={event => steer(Number(event.currentTarget.value))} aria-label={ui.turn} aria-valuetext={balance}
            aria-describedby={statusId} data-contour-turn />
          <button type="button" onClick={() => steer(turn + 2)} className={styles.turn} aria-label={ui.downhill} title={ui.downhill}>
            <ArrowDown size={19} aria-hidden />
          </button>
        </div>}
        <div className={styles.actions}>
          <button ref={restart} className={styles.restart} type="button" onClick={startAgain}>
            <RotateCcw size={16} aria-hidden /> {ui.restart}
          </button>
          {!done && <button className={styles.place} type="button" onClick={place}
            disabled={!pose?.aligned} aria-describedby={statusId} data-contour-place>
            <Flag size={17} aria-hidden /> {ui.place}
          </button>}
        </div>
      </div>
    </dialog>
  );
}
