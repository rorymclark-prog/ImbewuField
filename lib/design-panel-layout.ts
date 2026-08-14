/**
 * Desktop Studio panels are view chrome, never plan data. Keeping their bounds here gives the
 * canvas a predictable safe gutter while still letting each farmer set a comfortable width.
 */
export const DESIGN_PANEL_LAYOUT_KEY = 'imbewu_design_panel_layout_v1';
export const DESKTOP_ELEMENTS_PANEL_MIN = 240;
export const DESKTOP_ELEMENTS_PANEL_MAX = 440;
export const DESKTOP_LAYERS_PANEL_MIN = 248;
export const DESKTOP_LAYERS_PANEL_MAX = 420;

export type DesktopPanelLayout = {
  elements: number;
  layers: number;
};

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
