// ── MAP DATA COLOURS ───────────────────────────────────────────────────────────
// These colours encode specific meaning on the map itself (as distinct from UI panels)
// and appear in printouts and exported reports. They are matched by byte-identical hex
// values so a farmer's screen matches the printout exactly.

export const MAP_COLOR_BOUNDARY_STROKE = '#9BE66B'; // The bright green used for the farm boundary line, drawn shapes, and active drawing cursors.
export const MAP_COLOR_BOUNDARY_FILL = '#A8D88A'; // The softer green fill for drawn areas.
export const MAP_COLOR_WATER_STROKE = '#5B9ED4'; // The solid blue used for drawn water features and lines.
export const MAP_COLOR_WATER_FILL = '#7CC6F2'; // The lighter blue fill used for water areas and water-related UI accents on the map.
export const MAP_COLOR_ALERT = '#C0492A'; // The rust-red used for destructive actions (delete), errors, and warnings (like un-closed polygons).
