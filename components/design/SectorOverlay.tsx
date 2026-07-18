'use client';

// Design Studio — Sector energies overlay (the interactive-canvas twin of plan-set 02's
// SECTOR ANALYSIS sheet, buildBlueprintSectorMap in DesignGlossy). A LIGHT, non-interactive
// SVG layer drawn over the live design: the sun path across the north (southern hemisphere),
// summer/winter wind arrows, the dry-season fire wedge, the downhill water-flow arrow, and a
// frost-pocket marker — ALL and ONLY what lib/sector.deriveSectorModel returns. Nothing is
// invented; each energy degrades independently and simply doesn't draw when its data is missing.
//
// Rendered INSIDE DesignCanvas's world-space transform group, so it pans/zooms anchored to the
// site (exactly like the contour overlay). pointerEvents:none throughout — it must never block
// placing/drawing/selecting. It does NOT redraw on-contour lines: the Contours layer owns those,
// and duplicating them here would double-draw the same guides.

import type { ReactElement } from 'react';
import { bearingToUnitVector, type SectorModel } from '@/lib/sector';

// Palette lifted verbatim from buildBlueprintSectorMap so the overlay and the printed sheet read
// as the same analysis. Kept a touch lighter here (thin strokes + a group-wide ~0.7 opacity).
const SUN = '#F7C97E';
const SUMMER = '#E08A2C';
const SUMMER_LBL = '#F0B76A';
const WINTER = '#C97B25';
const WINTER_LBL = '#E0A45A';
const FIRE = '#D64A2A';
const FIRE_LBL = '#F0A58C';
const FIRE_WEDGE = 'rgba(214,74,42,0.20)';
const WATER = '#3A8EC4';
const WATER_LBL = '#8FD0F0';
const FROST = '#9FD0E8';
const FROST_LBL = '#CDE7FA';
const FROST_FILL = 'rgba(159,208,232,0.16)';
const RING = 'rgba(255,255,255,0.5)';
const TICK = '#D8DEE3';
const HALO = 'rgba(8,14,22,0.9)';

export interface SectorOverlayProps {
  model: SectorModel;
  imgW: number;
  imgH: number;
  boundary: Array<[number, number]>; // normalised [0..1] ring; [] when the site is untraced
}

// The interactive-canvas port of the sheet's ring geometry (section 3 of buildBlueprintSectorMap):
// centre = boundary centroid (fallback frame centre), radius sized to the plot and capped so the
// arrows/labels stay inside the frame at fit-zoom. All maths in viewBox px (the group's units).
export default function SectorOverlay({ model, imgW: W, imgH: H, boundary }: SectorOverlayProps) {
  const isSH = model.southernHemisphere;

  let cx = W / 2;
  let cy = H / 2;
  let siteR = Math.min(W, H) * 0.22;
  if (boundary.length >= 3) {
    let minX = 1, minY = 1, maxX = 0, maxY = 0, sx = 0, sy = 0;
    for (const [x, y] of boundary) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      sx += x;
      sy += y;
    }
    cx = (sx / boundary.length) * W;
    cy = (sy / boundary.length) * H;
    siteR = 0.5 * Math.hypot((maxX - minX) * W, (maxY - minY) * H);
  }

  const margin = W * 0.035;
  const arrowLen = W * 0.055;
  const rowH = W * 0.026;
  const labelFont = Math.max(9, rowH * 0.48);
  const tickFont = Math.max(10, rowH * 0.6);
  const maxRx = Math.min(cx - margin, W - margin - cx);
  const maxRy = Math.min(cy - margin, H - margin - cy);
  const cap = Math.max(24, Math.min(maxRx, maxRy) - arrowLen);
  const R = Math.min(Math.max(siteR * 0.7 + 10, Math.min(siteR + W * 0.02, cap)), cap);

  const els: ReactElement[] = [];

  const label = (key: string, x: number, y: number, text: string, color: string) => (
    <text
      key={key}
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={labelFont}
      fontWeight={800}
      fontFamily="system-ui, sans-serif"
      fill={color}
      stroke={HALO}
      strokeWidth={labelFont * 0.28}
      strokeLinejoin="round"
      style={{ paintOrder: 'stroke' }}
    >
      {text}
    </text>
  );

  // Inward energy arrow: tail OUTSIDE the ring at `fromVec`, head INSIDE — energy entering the
  // site (matches the sheet's drawArrow). Returns the tail point for callers that also label it.
  const arrow = (
    key: string,
    fromVec: [number, number],
    color: string,
    width: number,
    dash: string | undefined,
    lenIn = R * 0.4,
  ) => {
    const sxp = cx + fromVec[0] * (R + arrowLen * 0.75);
    const syp = cy + fromVec[1] * (R + arrowLen * 0.75);
    const exp = cx + fromVec[0] * (R - lenIn);
    const eyp = cy + fromVec[1] * (R - lenIn);
    const ang = Math.atan2(eyp - syp, exp - sxp);
    const ah = Math.max(9, width * 2.6);
    const p1x = exp - ah * Math.cos(ang - 0.42);
    const p1y = eyp - ah * Math.sin(ang - 0.42);
    const p2x = exp - ah * Math.cos(ang + 0.42);
    const p2y = eyp - ah * Math.sin(ang + 0.42);
    els.push(
      <g key={key}>
        <line x1={sxp} y1={syp} x2={exp} y2={eyp} stroke={color} strokeWidth={width} strokeLinecap="round" strokeDasharray={dash} />
        <polygon points={`${exp},${eyp} ${p1x},${p1y} ${p2x},${p2y}`} fill={color} />
      </g>,
    );
  };

  // 1. Faint dashed compass ring + N/E/S/W ticks — orients the arrows as "entering the site".
  els.push(<circle key="ring" cx={cx} cy={cy} r={R} fill="none" stroke={RING} strokeWidth={1.5} strokeDasharray="6 6" />);
  els.push(
    <g key="ticks" fontFamily="system-ui, sans-serif" fontWeight={700} fontSize={tickFont} fill={TICK} textAnchor="middle" dominantBaseline="central">
      <text x={cx} y={cy - R - rowH * 0.5}>N</text>
      <text x={cx} y={cy + R + rowH * 0.5}>S</text>
      <text x={cx + R + rowH * 0.55} y={cy}>E</text>
      <text x={cx - R - rowH * 0.55} y={cy}>W</text>
    </g>,
  );

  // 2. FIRE wedge (under the arrows) — a translucent red sector from the dry-season wind direction.
  if (model.fire) {
    const v1 = bearingToUnitVector(model.fire.bearingDeg - 24);
    const v2 = bearingToUnitVector(model.fire.bearingDeg + 24);
    const rr = R * 1.16;
    els.push(
      <polygon
        key="fire-wedge"
        points={`${cx},${cy} ${cx + v1[0] * rr},${cy + v1[1] * rr} ${cx + v2[0] * rr},${cy + v2[1] * rr}`}
        fill={FIRE_WEDGE}
      />,
    );
    // Fire's bearing EQUALS the dry-season wind's bearing by construction, so when they coincide the
    // wedge carries the message and the label sits INSIDE it (avoids overprinting the wind arrow);
    // only draw a separate fire arrow when fire somehow sits on its own bearing.
    const lp = bearingToUnitVector(model.fire.bearingDeg);
    const fireOnWind = model.fire.bearingDeg === model.windWinter?.bearingDeg || model.fire.bearingDeg === model.windSummer?.bearingDeg;
    if (fireOnWind) {
      els.push(label('fire-lbl', cx + lp[0] * R * 0.55, cy + lp[1] * R * 0.55, 'FIRE', FIRE_LBL));
    } else {
      arrow('fire-arr', lp, FIRE, Math.max(2.4, W * 0.004), '10 6');
      els.push(label('fire-lbl', cx + lp[0] * (R + arrowLen * 0.95), cy + lp[1] * (R + arrowLen * 0.95), 'FIRE', FIRE_LBL));
    }
  }

  // 3. SUN — a gold arc across the equator-facing sky (north for SH) + apex dot + midday ray.
  const sunR = R + arrowLen * 0.45;
  const sweep = isSH ? 1 : 0; // SH bulges over the TOP (north); NH over the bottom (south)
  const apexY = isSH ? cy - sunR : cy + sunR;
  els.push(
    <path
      key="sun-arc"
      d={`M ${cx - sunR} ${cy} A ${sunR} ${sunR} 0 0 ${sweep} ${cx + sunR} ${cy}`}
      fill="none"
      stroke={SUN}
      strokeWidth={Math.max(2.5, W * 0.005)}
      strokeLinecap="round"
    />,
  );
  els.push(<circle key="sun-apex" cx={cx} cy={apexY} r={Math.max(6, W * 0.011)} fill={SUN} />);
  arrow('sun-ray', bearingToUnitVector(isSH ? 0 : 180), SUN, Math.max(3, W * 0.0045), undefined);
  els.push(label('sun-lbl', cx, isSH ? cy - sunR - rowH * 0.7 : cy + sunR + rowH * 0.7, 'SUN', SUN));

  // 4. WIND — summer + winter arrows entering from where each wind blows FROM.
  const windWidth = (spd?: number) => Math.max(2.2, (2 + Math.min(spd ?? 3, 8) * 0.5) * (W / 700));
  if (model.windSummer) {
    const v = bearingToUnitVector(model.windSummer.bearingDeg);
    arrow('wind-s-arr', v, SUMMER, windWidth(model.windSummer.speed), '9 5');
    els.push(label('wind-s-lbl', cx + v[0] * (R + arrowLen), cy + v[1] * (R + arrowLen), `SUMMER ${model.windSummer.fromLabel}`, SUMMER_LBL));
  }
  if (model.windWinter) {
    const v = bearingToUnitVector(model.windWinter.bearingDeg);
    arrow('wind-w-arr', v, WINTER, windWidth(model.windWinter.speed), '9 5');
    els.push(label('wind-w-lbl', cx + v[0] * (R + arrowLen), cy + v[1] * (R + arrowLen), `WINTER ${model.windWinter.fromLabel}`, WINTER_LBL));
  }

  // 5. WATER — a downslope arrow through the centre (dashed when the slope is SRTM-indicative).
  if (model.water) {
    const dn = bearingToUnitVector(model.water.downhillBearingDeg);
    const wsx = cx - dn[0] * siteR * 0.7;
    const wsy = cy - dn[1] * siteR * 0.7;
    const wex = cx + dn[0] * siteR * 0.9;
    const wey = cy + dn[1] * siteR * 0.9;
    const wang = Math.atan2(wey - wsy, wex - wsx);
    const wah = Math.max(9, W * 0.011);
    els.push(
      <g key="water">
        <line x1={wsx} y1={wsy} x2={wex} y2={wey} stroke={WATER} strokeWidth={Math.max(2.4, W * 0.004)} strokeLinecap="round" strokeDasharray={model.water.indicative ? '8 6' : undefined} />
        <polygon
          points={`${wex},${wey} ${wex - wah * Math.cos(wang - 0.42)},${wey - wah * Math.sin(wang - 0.42)} ${wex - wah * Math.cos(wang + 0.42)},${wey - wah * Math.sin(wang + 0.42)}`}
          fill={WATER}
        />
      </g>,
    );
    els.push(label('water-lbl', wex, wey + rowH * 0.55, model.water.indicative ? 'DOWNHILL ~' : 'DOWNHILL', WATER_LBL));
  }

  // 6. FROST — icy dashed downslope arrow + frost-pocket ellipse at the low end.
  if (model.frost) {
    const dn = bearingToUnitVector(model.frost.downhillBearingDeg);
    const fx = cx + dn[0] * siteR * 0.85;
    const fy = cy + dn[1] * siteR * 0.85;
    els.push(
      <g key="frost">
        <line x1={cx} y1={cy} x2={fx} y2={fy} stroke={FROST} strokeWidth={2.2} strokeDasharray="3 4" strokeLinecap="round" />
        <ellipse cx={fx} cy={fy} rx={Math.max(18, W * 0.026)} ry={Math.max(11, W * 0.016)} fill={FROST_FILL} stroke={FROST} strokeWidth={1.6} strokeDasharray="4 3" />
      </g>,
    );
    els.push(label('frost-lbl', fx, fy, 'FROST', FROST_LBL));
  }

  return (
    <g pointerEvents="none" opacity={0.7}>
      {els}
    </g>
  );
}
