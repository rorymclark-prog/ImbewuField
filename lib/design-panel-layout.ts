/**
 * Desktop Studio panels are view chrome, never plan data. Keeping their bounds here gives the
 * canvas a predictable safe gutter while still letting each farmer set a comfortable width.
 */
export const DESIGN_PANEL_LAYOUT_KEY = 'imbewu_design_panel_layout_v1';
export const DESIGN_WORKSPACE_MODE_KEY = 'imbewu_design_workspace_mode_v1';
export const DESKTOP_ELEMENTS_PANEL_MIN = 124;
export const DESKTOP_ELEMENTS_PANEL_MAX = 440;
export const DESKTOP_LAYERS_PANEL_MIN = 248;
export const DESKTOP_LAYERS_PANEL_MAX = 420;

export type DesktopPanelLayout = {
  elements: number;
  layers: number;
};

export type DesignWorkspaceMode = 'docked' | 'floating' | 'tray';

export const DESIGN_WORKSPACE_MODES: readonly DesignWorkspaceMode[] = ['docked', 'floating', 'tray'];
export const DEFAULT_DESIGN_WORKSPACE_MODE: DesignWorkspaceMode = 'docked';

export const DEFAULT_DESKTOP_PANEL_LAYOUT: DesktopPanelLayout = {
  elements: 304,
  layers: 304,
};

export function clampDesktopPanelWidth(panel: keyof DesktopPanelLayout, width: number): number {
  const [min, max] = panel === 'elements'
    ? [DESKTOP_ELEMENTS_PANEL_MIN, DESKTOP_ELEMENTS_PANEL_MAX]
    : [DESKTOP_LAYERS_PANEL_MIN, DESKTOP_LAYERS_PANEL_MAX];
  if (!Number.isFinite(width)) return DEFAULT_DESKTOP_PANEL_LAYOUT[panel];
  return Math.round(Math.min(max, Math.max(min, width)));
}

export function restoreDesktopPanelLayout(raw: string | null): DesktopPanelLayout {
  if (!raw) return DEFAULT_DESKTOP_PANEL_LAYOUT;
  try {
    const parsed = JSON.parse(raw) as Partial<DesktopPanelLayout>;
    return {
      elements: clampDesktopPanelWidth('elements', Number(parsed.elements)),
      layers: clampDesktopPanelWidth('layers', Number(parsed.layers)),
    };
  } catch {
    return DEFAULT_DESKTOP_PANEL_LAYOUT;
  }
}

export function restoreDesignWorkspaceMode(raw: string | null): DesignWorkspaceMode {
  return DESIGN_WORKSPACE_MODES.includes(raw as DesignWorkspaceMode)
    ? raw as DesignWorkspaceMode
    : DEFAULT_DESIGN_WORKSPACE_MODE;
}

/** Card columns are a consequence of usable width, never a separately saved preference. */
export function elementPanelColumns(width: number): 1 | 2 | 3 {
  if (width >= 292) return 3;
  if (width >= 196) return 2;
  return 1;
}

/** Narrow docks show fewer cards, so spend the recovered width on recognition rather than air. */
export function elementCardMetrics(columns: 1 | 2 | 3): { artSize: number; minHeight: number } {
  if (columns === 1) return { artSize: 92, minHeight: 148 };
  if (columns === 2) return { artSize: 70, minHeight: 126 };
  return { artSize: 62, minHeight: 116 };
}

/** Floating panels and the bottom tray overlay the map; only docked panels reserve gutters. */
export function reservedDesktopPanelSpace(mode: DesignWorkspaceMode, width: number): number {
  return mode === 'docked' ? width + 24 : 0;
}
