'use client';

// Design Studio — phone-first page where a farmer places elements at true real-world
// scale, draws zone polygons/lines, is guided by an AI advisor, and ends with a strict
// AI "glossy" render of exactly what they built. NEW file only — does not modify any
// existing route or component.

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { Position } from 'geojson';
import { ArrowLeft, Compass } from 'lucide-react';

import type { LocationData } from '@/lib/types';
import {
  designSiteIdFromLocation,
  loadDesignStudioState,
  mergeFarmShapesIntoDesignState,
  type DesignLayer,
} from '@/lib/design-studio';
import { readLocalFarmShapes, MAP_STATE_EVENT } from '@/lib/map-sync';
import {
  computeCanvasFrame,
  fetchImageAsDataUrl,
  loadCanvasState,
  saveCanvasState,
  newId,
  type CanvasFrame,
  type DesignCanvasState,
  type PlacedItem,
  type WizardStep,
} from '@/lib/design-canvas';
import { ELEMENTS_BY_ID } from '@/lib/design-elements';
import { loadSiteElements, type SiteElementType } from '@/lib/site-elements';
import type { Advice } from '@/lib/design-rules';

const PAPER = '#FBF6EC';
const GOLD = '#F7C97E';
const GREEN = '#1F4D2B';
const DARK = '#0B120B';

const MAX_UNDO = 25;

// Pre-seed mapping: existing traced site-element types → Design Studio catalog defIds.
const SITE_ELEMENT_TO_DEF: Record<SiteElementType, string> = {
  jojo_tank: 'jojo_5000',
  tap: 'tap_point',
  borehole: 'borehole',
  pond_dam: 'pond_small',
  compost: 'compost_bay',
  beehive: 'beehive',
  nursery: 'nursery_table',
  tree: 'tree_indigenous',
  gate: 'gate',
};

function ringFromGeometry(geom: DesignLayer['geometry'] | undefined): Position[] {
  if (!geom) return [];
  if (geom.type === 'Polygon') return geom.coordinates[0] ?? [];
  if (geom.type === 'MultiPolygon') return geom.coordinates[0]?.[0] ?? [];
  return [];
}

function lineFromGeometry(geom: DesignLayer['geometry'] | undefined): Position[] {
  if (!geom) return [];
  if (geom.type === 'LineString') return geom.coordinates ?? [];
  if (geom.type === 'MultiLineString') return geom.coordinates[0] ?? [];
  if (geom.type === 'Polygon') return geom.coordinates[0] ?? [];
  return [];
}

function centroidOf(ring: Array<[number, number]>): [number, number] | null {
  if (ring.length === 0) return null;
  let sx = 0;
  let sy = 0;
  for (const [x, y] of ring) {
    sx += x;
    sy += y;
  }
  return [sx / ring.length, sy / ring.length];
}

interface RefLayers {
  boundary: Array<[number, number]>;
  house: Array<[number, number]>;
  driveway: Array<[number, number]>;
}

interface SiteCtx {
  windFromSummer?: string;
  slopeDeg?: number;
  aspectLabel?: string;
  rainfallMm?: number;
  biome?: string;
}

function freshState(siteId: string, frame: Omit<CanvasFrame, 'satDataUrl'>): DesignCanvasState {
  return {
    siteId,
    frame,
    items: [],
    zones: [],
    lines: [],
    step: 'base',
    updatedAt: new Date().toISOString(),
  };
}

function readCachedLocationData(lat: number, lon: number): LocationData | null {
  if (typeof window === 'undefined') return null;
  try {
    const cacheKey = `imbewu_loc_${lat.toFixed(5)}_${lon.toFixed(5)}`;
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as LocationData) : null;
  } catch {
    return null;
  }
}

function EmptyState() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: 24,
        background: PAPER,
        color: DARK,
        textAlign: 'center',
      }}
    >
      <Compass size={40} color={GREEN} />
      <p style={{ fontSize: 16, maxWidth: 320, lineHeight: 1.5 }}>
        Open a site on the map first, then tap Design Studio.
      </p>
      <Link
        href="/farmer"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 20px',
          minHeight: 44,
          borderRadius: 999,
          background: GREEN,
          color: PAPER,
          fontWeight: 600,
          textDecoration: 'none',
        }}
      >
        <ArrowLeft size={18} />
        Back to map
      </Link>
    </div>
  );
}

function DesignStudioInner() {
  const params = useSearchParams();
  const lat = Number(params.get('lat'));
  const lon = Number(params.get('lon'));
  const hasSite = Number.isFinite(lat) && Number.isFinite(lon);

  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [layers, setLayers] = useState<DesignLayer[]>([]);
  const [refLayers, setRefLayers] = useState<RefLayers>({ boundary: [], house: [], driveway: [] });
  const [houseXY, setHouseXY] = useState<[number, number] | null>(null);
  const [frame, setFrame] = useState<CanvasFrame | null>(null);
  const [canvasState, setCanvasState] = useState<DesignCanvasState | null>(null);
  const [saved, setSaved] = useState(true);
  const [advice, setAdvice] = useState<Advice[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [placeDefId, setPlaceDefId] = useState<string | null>(null);
  const [zoneDraw, setZoneDraw] = useState<0 | 1 | 2 | 3 | 4 | 5 | null>(null);
  const [lineKind, setLineKind] = useState<'swale' | 'fence' | 'path' | 'pipe' | 'drip' | 'windbreak' | null>(null);
  const [activeLayers, setActiveLayers] = useState<{ items: boolean; zones: boolean; lines: boolean }>({
    items: true,
    zones: true,
    lines: true,
  });

  const undoStack = useRef<DesignCanvasState[]>([]);
  const siteId = useMemo(
    () => designSiteIdFromLocation(hasSite ? ({ lat, lon } as LocationData) : null),
    [hasSite, lat, lon],
  );

  const site: SiteCtx | null = useMemo(() => {
    if (!locationData) return null;
    return {
      windFromSummer: locationData.climate?.windFromSummer,
      slopeDeg: locationData.elevation?.slopeDeg,
      aspectLabel: locationData.elevation?.aspectLabel,
      rainfallMm: locationData.rainfall?.annual,
      biome: locationData.biome?.name,
    };
  }, [locationData]);

  // Load location data cache + traced layers + build the canvas frame.
  useEffect(() => {
    if (!hasSite) return;
    setLocationData(readCachedLocationData(lat, lon));

    const refresh = () => {
      const saved0 = loadDesignStudioState(siteId);
      const merged = mergeFarmShapesIntoDesignState(readLocalFarmShapes(), saved0, siteId);
      setLayers(merged.layers);

      const boundaryLayer =
        merged.layers.find((l) => l.layerType === 'property_boundary' && l.approved) ??
        merged.layers.find((l) => l.layerType === 'property_boundary');
      const houseLayer =
        merged.layers.find((l) => (l.layerType === 'roof' || l.layerType === 'structure') && l.approved) ??
        merged.layers.find((l) => l.layerType === 'roof' || l.layerType === 'structure');
      const driveLayer =
        merged.layers.find((l) => l.layerType === 'access' && l.approved) ??
        merged.layers.find((l) => l.layerType === 'access');

      const { frame: frameNoImg, url, project } = computeCanvasFrame(merged.layers, lat);

      const boundaryRing = ringFromGeometry(boundaryLayer?.geometry).map((c) => project(c));
      const houseRing = ringFromGeometry(houseLayer?.geometry).map((c) => project(c));
      const driveLine = driveLayer
        ? (driveLayer.geometry?.type === 'Polygon' || driveLayer.geometry?.type === 'MultiPolygon'
            ? ringFromGeometry(driveLayer.geometry)
            : lineFromGeometry(driveLayer.geometry)
          ).map((c) => project(c))
        : [];

      setRefLayers({ boundary: boundaryRing, house: houseRing, driveway: driveLine });
      setHouseXY(centroidOf(houseRing));

      setFrame({ ...frameNoImg, satDataUrl: null });

      if (url) {
        fetchImageAsDataUrl(url)
          .then((dataUrl) => setFrame({ ...frameNoImg, satDataUrl: dataUrl }))
          .catch(() => setFrame({ ...frameNoImg, satDataUrl: null }));
      }

      // Canvas state: load existing, or seed fresh from traced site elements on first visit.
      setCanvasState((prev) => {
        const existing = loadCanvasState(siteId);
        if (existing) return existing;
        if (prev && prev.siteId === siteId) return prev;

        const fresh = freshState(siteId, frameNoImg);
        const siteElements = loadSiteElements(siteId);
        const items: PlacedItem[] = [];
        for (const el of siteElements) {
          const defId = SITE_ELEMENT_TO_DEF[el.type];
          if (!defId || !ELEMENTS_BY_ID[defId]) continue;
          const [x, y] = project([el.lon, el.lat]);
          items.push({ id: newId(), defId, x, y, label: el.label, note: el.note });
        }
        return { ...fresh, items };
      });
    };

    refresh();
    window.addEventListener(MAP_STATE_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(MAP_STATE_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSite, lat, lon, siteId]);

  // Persist canvas state on change (with undo history), and re-run the advisor.
  const commitState = useCallback(
    (next: DesignCanvasState, opts?: { skipUndo?: boolean }) => {
      setCanvasState((prev) => {
        if (prev && !opts?.skipUndo) {
          undoStack.current = [...undoStack.current, prev].slice(-MAX_UNDO);
        }
        return next;
      });
      saveCanvasState(next);
      setSaved(true);
    },
    [],
  );

  const handleChange = useCallback(
    (updater: (prev: DesignCanvasState) => DesignCanvasState) => {
      setCanvasState((prev) => {
        if (!prev) return prev;
        undoStack.current = [...undoStack.current, prev].slice(-MAX_UNDO);
        const next = updater(prev);
        saveCanvasState(next);
        setSaved(true);
        return next;
      });
    },
    [],
  );

  const handleUndo = useCallback(() => {
    setCanvasState((prev) => {
      const popped = undoStack.current.pop();
      if (!popped || !prev) return prev;
      saveCanvasState(popped);
      return popped;
    });
  }, []);

  // Re-evaluate advisor rules whenever the canvas or site context changes.
  useEffect(() => {
    if (!canvasState) return;
    let cancelled = false;
    import('@/lib/design-rules').then(({ evaluateDesign }) => {
      if (cancelled) return;
      setAdvice(
        evaluateDesign(canvasState, ELEMENTS_BY_ID, site ?? undefined, houseXY ? { houseXY } : undefined),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [canvasState, site, houseXY]);

  const setStep = useCallback(
    (step: WizardStep) => {
      handleChange((prev) => ({ ...prev, step }));
    },
    [handleChange],
  );

  if (!hasSite) return <EmptyState />;

  const siteName = locationData
    ? `${locationData.lat.toFixed(4)}, ${locationData.lon.toFixed(4)}`
    : `${lat.toFixed(4)}, ${lon.toFixed(4)}`;

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: PAPER,
        color: DARK,
      }}
    >
      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 14px',
          borderBottom: `1px solid rgba(11,18,11,0.12)`,
          background: PAPER,
          position: 'sticky',
          top: 0,
          zIndex: 20,
        }}
      >
        <Link
          href="/farmer"
          aria-label="Back to map"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'rgba(31,77,43,0.08)',
            color: GREEN,
          }}
        >
          <ArrowLeft size={20} />
        </Link>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Design Studio</span>
          <span style={{ fontSize: 12, opacity: 0.65 }}>{siteName}</span>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.6 }}>
          {saved ? 'Saved' : 'Saving…'}
        </div>
      </header>

      {/* Wizard (top) */}
      {canvasState && (
        <DesignWizardPlaceholder
          step={canvasState.step}
          onStep={setStep}
          advice={advice}
        />
      )}

      {/* Canvas (middle) */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {canvasState && canvasState.step === 'glossy' && frame ? (
          <DesignGlossyLazy
            state={canvasState}
            frame={frame}
            refLayers={refLayers}
            site={site ? { biome: site.biome, rainfallMm: site.rainfallMm } : null}
            placeName={siteName}
          />
        ) : (
          <DesignCanvasPlaceholder
            state={canvasState}
            frame={frame}
            refLayers={refLayers}
            selectedId={selectedId}
            onSelect={setSelectedId}
            placeDefId={placeDefId}
            zoneDraw={zoneDraw}
            lineKind={lineKind}
            activeLayers={activeLayers}
            onChange={handleChange}
            onUndo={handleUndo}
          />
        )}
      </div>

      {/* Palette (docked bottom) */}
      {canvasState && canvasState.step !== 'glossy' && (
        <DesignPalettePlaceholder
          placeDefId={placeDefId}
          onPickItem={setPlaceDefId}
          zoneDraw={zoneDraw}
          onPickZone={setZoneDraw}
          lineKind={lineKind}
          onPickLine={setLineKind}
          activeLayers={activeLayers}
          onToggleLayer={(k) => setActiveLayers((prev) => ({ ...prev, [k]: !prev[k] }))}
        />
      )}

      {/* Advisor (floating) */}
      {canvasState && canvasState.step !== 'glossy' && (
        <DesignAdvisorPlaceholder advice={advice} />
      )}
    </div>
  );
}

// ── Lightweight inline placeholders for the sibling components (DesignCanvas,
// DesignPalette, DesignWizard, DesignAdvisor) so this page renders standalone.
// These are intentionally minimal — components/design/* being built in parallel
// under the shared contract types own the real UI. Swap by importing the real
// components once they exist on disk; the state/prop wiring above already matches
// the CanvasFrame/DesignCanvasState/PlacedItem contract exactly.

function DesignWizardPlaceholder({
  step,
  onStep,
  advice,
}: {
  step: WizardStep;
  onStep: (s: WizardStep) => void;
  advice: Advice[];
}) {
  const steps: WizardStep[] = ['base', 'water', 'zones', 'planting', 'structures', 'review', 'glossy'];
  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        overflowX: 'auto',
        padding: '8px 12px',
        borderBottom: '1px solid rgba(11,18,11,0.08)',
        background: PAPER,
      }}
    >
      {steps.map((s) => (
        <button
          key={s}
          onClick={() => onStep(s)}
          style={{
            minHeight: 36,
            padding: '6px 12px',
            borderRadius: 999,
            border: 'none',
            fontSize: 12,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            background: s === step ? GREEN : 'rgba(31,77,43,0.08)',
            color: s === step ? PAPER : GREEN,
          }}
        >
          {s}
        </button>
      ))}
      {advice.length > 0 && (
        <span style={{ marginLeft: 8, alignSelf: 'center', fontSize: 11, opacity: 0.6 }}>
          {advice.length} tip{advice.length === 1 ? '' : 's'}
        </span>
      )}
    </div>
  );
}

function DesignCanvasPlaceholder({
  state,
  frame,
}: {
  state: DesignCanvasState | null;
  frame: CanvasFrame | null;
  refLayers: RefLayers;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  placeDefId: string | null;
  zoneDraw: number | null;
  lineKind: string | null;
  activeLayers: { items: boolean; zones: boolean; lines: boolean };
  onChange: (updater: (prev: DesignCanvasState) => DesignCanvasState) => void;
  onUndo: () => void;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: frame?.satDataUrl ? `url(${frame.satDataUrl}) center/cover` : '#1F4D2B22',
        touchAction: 'none',
      }}
    >
      {!state && <span style={{ color: DARK, opacity: 0.6 }}>Loading site…</span>}
    </div>
  );
}

function DesignPalettePlaceholder({
  activeLayers,
  onToggleLayer,
}: {
  placeDefId: string | null;
  onPickItem: (id: string | null) => void;
  zoneDraw: number | null;
  onPickZone: (z: 0 | 1 | 2 | 3 | 4 | 5 | null) => void;
  lineKind: string | null;
  onPickLine: (k: 'swale' | 'fence' | 'path' | 'pipe' | 'drip' | 'windbreak' | null) => void;
  activeLayers: { items: boolean; zones: boolean; lines: boolean };
  onToggleLayer: (k: 'items' | 'zones' | 'lines') => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        padding: '10px 12px',
        borderTop: '1px solid rgba(11,18,11,0.08)',
        background: PAPER,
      }}
    >
      {(['items', 'zones', 'lines'] as const).map((k) => (
        <button
          key={k}
          onClick={() => onToggleLayer(k)}
          style={{
            minHeight: 44,
            minWidth: 44,
            padding: '8px 14px',
            borderRadius: 10,
            border: 'none',
            background: activeLayers[k] ? GOLD : 'rgba(11,18,11,0.06)',
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          {k}
        </button>
      ))}
    </div>
  );
}

function DesignAdvisorPlaceholder({ advice }: { advice: Advice[] }) {
  if (advice.length === 0) return null;
  const top = advice[0];
  return (
    <div
      style={{
        position: 'absolute',
        right: 12,
        bottom: 90,
        maxWidth: 260,
        padding: '10px 14px',
        borderRadius: 14,
        background: top.severity === 'warn' ? '#B53A3A' : GREEN,
        color: PAPER,
        fontSize: 12,
        lineHeight: 1.4,
        boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
      }}
    >
      {top.msg}
    </div>
  );
}

function DesignGlossyLazy(props: {
  state: DesignCanvasState;
  frame: CanvasFrame;
  refLayers: RefLayers;
  site: { biome?: string; rainfallMm?: number } | null;
  placeName?: string;
}) {
  const [Comp, setComp] = useState<React.ComponentType<typeof props> | null>(null);
  useEffect(() => {
    let cancelled = false;
    import('@/components/design/DesignGlossy').then((mod) => {
      if (!cancelled) setComp(() => mod.default as React.ComponentType<typeof props>);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  if (!Comp) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        Loading glossy render…
      </div>
    );
  }
  return <Comp {...props} />;
}

export default function DesignStudioPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100dvh', background: PAPER }} />}>
      <DesignStudioInner />
    </Suspense>
  );
}
