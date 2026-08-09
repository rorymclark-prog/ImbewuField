'use client';

// Design Studio Shell (v2) — top-level layout + state owner.
//
// Layout: LeftToolbar | (TopStepper above CanvasStage+ElementPalette) | RightPanel, with
// BottomBar full-width beneath everything. Every child component below is presentational and
// receives its data as props (same "parent owns state, child just draws it" split
// components/design/DesignCanvas.tsx already uses) — so wiring a real backing canvas in later
// is a matter of swapping what feeds these props, not restructuring the layout.
//
// PERSISTENCE: deliberately none. This shell has no real siteId/CanvasFrame to anchor a
// DesignCanvasState to, and inventing one would be a second, competing schema — exactly the
// "two catalogs drift" trap lib/design-canvas.ts's own ElementStatus comment warns about.
// State resets on reload; a later integration phase is expected to swap this local state for
// loadCanvasState/saveCanvasState (lib/design-canvas.ts) against the farmer's real siteId.

import { useCallback, useEffect, useState } from 'react';
import { isSampleMode, SAMPLE_MODE_EVENT } from '@/lib/sample-mode';
import LeftToolbar from './LeftToolbar';
import IdentityBar from './IdentityBar';
import TopStepper from './TopStepper';
import RightPanel from './RightPanel';
import BottomBar from './BottomBar';
import ElementPalette from './ElementPalette';
import CanvasStage from './CanvasStage';
import {
  SHEET_CONFIG, SHEET_META, SHEET_ORDER, DEFAULT_LAYER_STATE, applyForceLayers, nextSheetId,
  waterInfraForLine, subLayerForWaterElement, ELEMENT_CATALOG_BY_ID,
  type SheetId, type LayerKeyId, type LayerStateMap, type QuickActionDef, type DemoItem, type DemoLine,
} from '@/lib/design-studio-shell';
import { getElementArt, CATEGORY_ICON } from '@/lib/design-studio-shell-icons';
import type { LucideIcon } from 'lucide-react';
import type { LineShape } from '@/lib/design-canvas';
import { newId } from '@/lib/design-canvas';

export type ToolMode = 'add' | 'view' | 'layers' | 'draw' | 'measure' | 'sunwind';

interface DesignState { items: DemoItem[]; lines: DemoLine[]; }
const EMPTY_DESIGN: DesignState = { items: [], lines: [] };

/** Matches app/design/page.tsx's own MAX_UNDO — no reason for this shell's stack to behave
 *  differently from the app it is standing in for. */
const MAX_UNDO = 25;

export default function StudioShell() {
  const [activeSheet, setActiveSheet] = useState<SheetId>('site');
  const [completed, setCompleted] = useState<Set<SheetId>>(new Set());
  const [layerState, setLayerState] = useState<LayerStateMap>(DEFAULT_LAYER_STATE);
  const [expanded, setExpanded] = useState<Set<LayerKeyId>>(new Set(['water']));

  // SampleModeBanner.tsx is mounted globally (app/layout.tsx) and fixed-positions itself at
  // the very bottom of the viewport whenever sample mode is on — it has no idea this shell
  // also pins a BottomBar there. Reusing the same isSampleMode()/SAMPLE_MODE_EVENT pair the
  // banner itself uses (rather than a body-class check of our own) so this can only ever agree
  // with it, then reserving that strip in our OWN flow so the banner overlays blank background
  // instead of our Continue button — same fix shape as globals.css's own
  // `body.is-sample-mode .mapboxgl-ctrl-bottom-*` margin reserve for the Mapbox controls.
  const [sampleBannerActive, setSampleBannerActive] = useState(false);
  useEffect(() => {
    const sync = () => setSampleBannerActive(isSampleMode());
    sync();
    window.addEventListener(SAMPLE_MODE_EVENT, sync);
    return () => window.removeEventListener(SAMPLE_MODE_EVENT, sync);
  }, []);

  const [tool, setTool] = useState<ToolMode>('add');
  // Guided/Pro is a real segmented control in the header rather than decoration, so it holds
  // real state — but it deliberately does NOT gate anything yet. The current studio's guided
  // mode filters the palette by step; wiring that here before this shell owns a real canvas
  // would fork that behaviour into a second implementation, which is the drift trap
  // lib/design-studio-shell.ts's own applyForceLayers note warns about.
  const [mode, setMode] = useState<'guided' | 'pro'>('guided');
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [previewMode, setPreviewMode] = useState(false);
  const [armedDefId, setArmedDefId] = useState<string | null>(null);
  const [drawKind, setDrawKind] = useState<LineShape['kind']>('pipe');
  const [inProgressLine, setInProgressLine] = useState<Array<[number, number]>>([]);
  const [measurePoints, setMeasurePoints] = useState<Array<[number, number]>>([]);

  // items+lines live in ONE state atom (not two useState calls) so a placement can never read a
  // stale sibling. Two quick actions fired back to back (caught while verifying this shell —
  // "Add pipe" then "Add swale" in immediate succession) both computed their offset from
  // lines.length read out of a closure the second call's re-render hadn't replaced yet, so both
  // landed on identical coordinates. Every updater below goes through the functional setState
  // form against this single atom, which React guarantees sees every prior queued update —
  // including ones from the same batch — so the same race cannot recur here.
  const [design, setDesign] = useState<DesignState>(EMPTY_DESIGN);
  const [past, setPast] = useState<DesignState[]>([]);
  const [future, setFuture] = useState<DesignState[]>([]);

  const sheet = SHEET_CONFIG[activeSheet];
  const markSheetTouched = useCallback((id: SheetId) => {
    setCompleted((c) => (c.has(id) ? c : new Set(c).add(id)));
  }, []);

  const placeItem = useCallback((defId: string, xM: number, yM: number, forceLayers: LayerKeyId[]) => {
    setLayerState((s) => applyForceLayers(s, forceLayers));
    setDesign((prev) => {
      setPast((p) => [...p.slice(-(MAX_UNDO - 1)), prev]);
      setFuture([]);
      return { ...prev, items: [...prev.items, { id: newId(), defId, xM, yM }] };
    });
    markSheetTouched(activeSheet);
  }, [activeSheet, markSheetTouched]);

  const placeLine = useCallback((kind: LineShape['kind'], pointsM: Array<[number, number]>, forceLayers: LayerKeyId[]) => {
    setLayerState((s) => applyForceLayers(s, forceLayers));
    setDesign((prev) => {
      setPast((p) => [...p.slice(-(MAX_UNDO - 1)), prev]);
      setFuture([]);
      return { ...prev, lines: [...prev.lines, { id: newId(), kind, pointsM }] };
    });
    markSheetTouched(activeSheet);
  }, [activeSheet, markSheetTouched]);

  // ── Quick actions ──────────────────────────────────────────────────────────────────────
  const runQuickAction = useCallback((action: QuickActionDef) => {
    if (action.defId) {
      const n = design.items.filter((it) => it.defId === action.defId).length;
      placeItem(action.defId, 6 + (n % 5) * 2.4, 5 + Math.floor(n / 5) * 2.4, action.forceLayers);
    } else if (action.lineKind) {
      // Offset by the TOTAL line count, not the per-kind count — otherwise the first pipe and
      // the first swale (each "the 0th of its kind") would land on identical coordinates.
      const n = design.lines.length;
      const x = 16 + n * 1.4, y = 14 + n * 1.2;
      placeLine(action.lineKind, [[x, y], [x + 4.5, y - 0.6]], action.forceLayers);
    }
  }, [design, placeItem, placeLine]);

  // ── Palette click-to-place ─────────────────────────────────────────────────────────────
  const handleArm = useCallback((defId: string) => {
    setTool('add');
    setArmedDefId((cur) => (cur === defId ? null : defId));
    // Same guard as Quick Actions, applied the moment the tool is armed — mirrors
    // app/design/page.tsx's useEffect keyed on placeDefId, which forces the layer on before
    // the farmer has even tapped the canvas.
    setLayerState((s) => applyForceLayers(s, ['water', subLayerForWaterElement(defId)]));
  }, []);

  const handlePlaceOnStage = useCallback((xM: number, yM: number) => {
    if (!armedDefId) return;
    placeItem(armedDefId, xM, yM, ['water', subLayerForWaterElement(armedDefId)]);
  }, [armedDefId, placeItem]);

  const handleDragItem = useCallback((id: string, xM: number, yM: number) => {
    setDesign((prev) => ({ ...prev, items: prev.items.map((it) => (it.id === id ? { ...it, xM, yM } : it)) }));
  }, []);

  // ── Draw tool ──────────────────────────────────────────────────────────────────────────
  const handleDrawPoint = useCallback((xM: number, yM: number) => {
    setInProgressLine((pts) => [...pts, [xM, yM]]);
  }, []);
  const handleFinishLine = useCallback(() => {
    setInProgressLine((pts) => {
      if (pts.length >= 2) {
        const sub = waterInfraForLine(drawKind);
        placeLine(drawKind, pts, sub ? ['water', sub] : ['water']);
      }
      return [];
    });
  }, [drawKind, placeLine]);
  const handleCancelLine = useCallback(() => setInProgressLine([]), []);

  // ── Measure tool ───────────────────────────────────────────────────────────────────────
  const handleMeasurePoint = useCallback((xM: number, yM: number) => {
    setMeasurePoints((pts) => (pts.length >= 2 ? [[xM, yM]] : [...pts, [xM, yM]]));
  }, []);

  // ── Undo / redo ────────────────────────────────────────────────────────────────────────
  const handleUndo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p;
      const last = p[p.length - 1];
      setDesign((cur) => {
        setFuture((f) => [cur, ...f]);
        return last;
      });
      return p.slice(0, -1);
    });
  }, []);
  const handleRedo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const nxt = f[0];
      setDesign((cur) => {
        setPast((p) => [...p, cur]);
        return nxt;
      });
      return f.slice(1);
    });
  }, []);

  // ── Layers panel ───────────────────────────────────────────────────────────────────────
  const handleToggleVisible = useCallback((key: LayerKeyId) => {
    setLayerState((s) => {
      const cur = s[key] ?? { visible: true, opacity: 100 };
      return { ...s, [key]: { ...cur, visible: !cur.visible } };
    });
  }, []);
  const handleOpacityChange = useCallback((key: LayerKeyId, opacity: number) => {
    setLayerState((s) => ({ ...s, [key]: { visible: s[key]?.visible ?? true, opacity } }));
  }, []);
  const handleToggleExpanded = useCallback((key: LayerKeyId) => {
    setExpanded((e) => {
      const next = new Set(e);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);
  const handleSetAll = useCallback((keys: LayerKeyId[], visible: boolean) => {
    setLayerState((s) => {
      const next = { ...s };
      for (const k of keys) next[k] = { visible, opacity: next[k]?.opacity ?? 100 };
      return next;
    });
  }, []);

  // ── Toolbar / stepper / bottom bar ────────────────────────────────────────────────────
  const handleToolSelect = useCallback((id: ToolMode) => {
    if (id === 'view') { setPreviewMode((v) => !v); return; }
    if (id === 'layers') { setRightPanelOpen((v) => !v); return; }
    if (id === 'sunwind') { setActiveSheet('sector'); return; }
    setTool(id);
    setArmedDefId(null);
    setInProgressLine([]);
    setMeasurePoints([]);
  }, []);

  const handleContinue = useCallback(() => {
    markSheetTouched(activeSheet);
    const next = nextSheetId(activeSheet);
    if (next) setActiveSheet(next);
  }, [activeSheet, markSheetTouched]);

  const next = nextSheetId(activeSheet);
  const quickActionIcon = useCallback((action: QuickActionDef): LucideIcon => {
    if (action.defId) {
      const art = getElementArt(ELEMENT_CATALOG_BY_ID[action.defId]);
      return art.kind === 'icon' ? art.Icon : CATEGORY_ICON.water;
    }
    return CATEGORY_ICON.water;
  }, []);

  return (
    <div
      className={`studio-shell-root flex h-dvh w-full flex-col overflow-hidden ${sampleBannerActive ? 'reserve-sample-banner' : ''}`}
      style={{ background: 'var(--bg)', color: 'var(--text)' }}
    >
      <style jsx>{`
        /* Matches the banner's own breakpoint exactly (SampleModeBanner.tsx: "bottom-
           [calc(60px+safe-area)] lg:bottom-0") so the reserve appears and disappears at the
           same width the banner itself moves at, rather than guessing a breakpoint. */
        .reserve-sample-banner { padding-bottom: calc(60px + env(safe-area-inset-bottom, 0px)); }
        @media (min-width: 1024px) {
          .reserve-sample-banner { padding-bottom: 44px; }
        }
      `}</style>
      <IdentityBar
        siteName="Ubhejane Crèche"
        mode={mode}
        onModeChange={setMode}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={past.length > 0}
        canRedo={future.length > 0}
        dirty={design.items.length > 0 || design.lines.length > 0}
      />
      <TopStepper active={activeSheet} completed={completed} onSelect={setActiveSheet} />

      <div className="flex min-h-0 flex-1">
        <LeftToolbar
          tool={tool}
          viewOn={previewMode}
          layersOn={rightPanelOpen}
          onSelect={handleToolSelect}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <CanvasStage
            items={design.items}
            lines={design.lines}
            defsById={ELEMENT_CATALOG_BY_ID}
            layerState={layerState}
            armedDefId={previewMode ? null : armedDefId}
            tool={previewMode ? 'view' : tool}
            drawKind={drawKind}
            inProgressLine={inProgressLine}
            measurePoints={measurePoints}
            onPlaceItem={handlePlaceOnStage}
            onDrawPoint={handleDrawPoint}
            onMeasurePoint={handleMeasurePoint}
            onDragItem={handleDragItem}
            onFinishLine={handleFinishLine}
            onCancelLine={handleCancelLine}
            onSetDrawKind={setDrawKind}
          />
          {!previewMode && (
            <ElementPalette
              items={sheet.paletteDefIds.map((id) => ELEMENT_CATALOG_BY_ID[id]).filter(Boolean)}
              tabs={sheet.paletteTabs}
              armedDefId={armedDefId}
              onArm={handleArm}
            />
          )}
        </div>

        {rightPanelOpen && !previewMode && (
          <div className="w-[300px] shrink-0">
            <RightPanel
              sheet={sheet}
              layerState={layerState}
              expanded={expanded}
              onToggleVisible={handleToggleVisible}
              onOpacityChange={handleOpacityChange}
              onToggleExpanded={handleToggleExpanded}
              onSetAll={handleSetAll}
              onQuickAction={runQuickAction}
              quickActionIcon={quickActionIcon}
            />
          </div>
        )}
      </div>

      <BottomBar
        nextLabel={next ? SHEET_META[next].label : null}
        onContinue={handleContinue}
        doneCount={completed.size}
        totalCount={SHEET_ORDER.length}
      />
    </div>
  );
}
