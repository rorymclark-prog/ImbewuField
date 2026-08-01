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
import { sunArcApexFraction } from '@/lib/solar';
import { formatDesignTranslation } from '@/lib/design-studio-i18n';
import { useLanguage } from '@/lib/i18n';

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
  const { t } = useLanguage();
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

  // A little sun: filled disc + eight short rays, with a dark halo so it survives on a bright
  // satellite roof as well as on shadowed bush. Rays start clear of the disc (1.35r) so the glyph
  // still reads as a sun at the ~4px end sizes a phone renders it at.
  const sunGlyph = (key: string, x: number, y: number, r: number) => (
    <g key={key}>
      <circle cx={x} cy={y} r={r} fill={SUN} stroke={HALO} strokeWidth={Math.max(1, r * 0.3)} />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4;
        return (
          <line
            key={i}
            x1={x + Math.cos(a) * r * 1.35}
            y1={y + Math.sin(a) * r * 1.35}
            x2={x + Math.cos(a) * r * 2.05}
            y2={y + Math.sin(a) * r * 2.05}
            stroke={SUN}
            strokeWidth={Math.max(1.2, r * 0.34)}
            strokeLinecap="round"
          />
        );
      })}
    </g>
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
      <text x={cx} y={cy - R - rowH * 0.5}>{t('designSectorNorth')}</text>
      <text x={cx} y={cy + R + rowH * 0.5}>{t('designSectorSouth')}</text>
      <text x={cx + R + rowH * 0.55} y={cy}>{t('designSectorEast')}</text>
      <text x={cx - R - rowH * 0.55} y={cy}>{t('designSectorWest')}</text>
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
      els.push(label('fire-lbl', cx + lp[0] * R * 0.55, cy + lp[1] * R * 0.55, t('designSectorFire'), FIRE_LBL));
    } else {
      arrow('fire-arr', lp, FIRE, Math.max(2.4, W * 0.004), '10 6');
      els.push(label('fire-lbl', cx + lp[0] * (R + arrowLen * 0.95), cy + lp[1] * (R + arrowLen * 0.95), t('designSectorFire'), FIRE_LBL));
    }
  }

  // 3. SUN — TWO REAL PATHS, AT THIS LATITUDE'S REAL ANGLES.
  //
  // Rory: "sector sun azimuth should have the winter and also show sun angle according to global
  // map position." He was right twice over. This drew ONE generic half-circle from due east to due
  // west with a "SUN" label — no season, and no angle at all. (The SUMMER/WINTER labels he could
  // see belong to the WIND arrows.) So the diagram said the same thing at the equator and at the
  // Cape, which is the one thing a sector diagram exists not to do.
  //
  // Everything needed was already computed and thrown away: lib/solar.ts derives, from latitude
  // and the Earth's obliquity, each season's sunrise and sunset azimuth, its noon ALTITUDE, and
  // the shadow ratio that follows from it. Now it is drawn.
  //
  // Each season is one curve from its true sunrise bearing to its true sunset bearing, with the
  // apex raised in proportion to that season's noon altitude — so a Highveld winter sun reads as
  // a low flat path and midsummer as a high one, and the difference between them is the thing you
  // are actually designing around. A quadratic Bézier through a computed apex: for a quadratic the
  // curve's own midpoint is (P0 + 2C + P2)/4, so C = 2·apex − (P0 + P2)/2 puts the apex exactly
  // where the altitude says it should be.
  const sunR = R + arrowLen * 0.45;
  const sunSeasons = [
    { key: 'summer', path: model.solar.summer, word: t('designSectorSummer') },
    { key: 'winter', path: model.solar.winter, word: t('designSectorWinter') },
  ] as const;
  for (const { key, path, word } of sunSeasons) {
    // A polar site can have no sunrise at all in one season — draw nothing rather than a guess.
    if (path.sunriseAzDeg == null || path.sunsetAzDeg == null) continue;
    const rise = bearingToUnitVector(path.sunriseAzDeg);
    const set = bearingToUnitVector(path.sunsetAzDeg);
    const p0 = [cx + rise[0] * sunR, cy + rise[1] * sunR];
    const p2 = [cx + set[0] * sunR, cy + set[1] * sunR];
    // WHICH SIDE noon is on is per-SEASON, not per-hemisphere: inside the tropics the two
    // solstices genuinely disagree (solar.middayFrom === 'mixed'), and a site 20° south sees the
    // December sun pass to the SOUTH while the June sun passes to the north. Reading `isSH` here
    // drew both of that farm's arcs on the same wrong side. Matches the plan-set sheet, which
    // already branches on path.noonSide (buildBlueprintSectorMap).
    const noonNorth = path.noonSide === 'N' || (path.noonSide === 'overhead' && isSH);
    const noon = bearingToUnitVector(noonNorth ? 0 : 180);
    // How far the rise/set ends already lie along the noon bearing — see sunArcApexFraction.
    const chordFraction = rise[0] * noon[0] + rise[1] * noon[1];
    const apexF = sunArcApexFraction(path.noonAltitudeDeg, chordFraction);
    const apex = [cx + noon[0] * apexF * sunR, cy + noon[1] * apexF * sunR];
    const ctrl = [2 * apex[0] - (p0[0] + p2[0]) / 2, 2 * apex[1] - (p0[1] + p2[1]) / 2];
    const winter = key === 'winter';
    els.push(
      <path
        key={`sun-arc-${key}`}
        d={`M ${p0[0].toFixed(1)} ${p0[1].toFixed(1)} Q ${ctrl[0].toFixed(1)} ${ctrl[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`}
        fill="none"
        stroke={SUN}
        strokeWidth={Math.max(winter ? 2 : 2.8, W * (winter ? 0.0038 : 0.005))}
        strokeLinecap="round"
        // The winter path is dashed as well as lower, so the two are told apart by shape and not
        // by thickness alone — the first thing to go in direct sunlight on a phone.
        strokeDasharray={winter ? '10 7' : undefined}
        opacity={winter ? 0.85 : 1}
      />,
    );
    // A LITTLE SUN AT EACH END OF THE AZIMUTH (Rory's ask), and a bigger one at noon. The ends
    // are where the sun actually comes up and goes down on this farm — the two bearings a farmer
    // walks out and checks against a hill or a neighbour's treeline — so they deserve a mark you
    // read as the sun, not a bare line ending. Same three-glyph grammar the printed sheet 02
    // already uses (drawSunIcon in buildBlueprintSectorMap), so the screen and the print agree.
    const endR = Math.max(winter ? 3 : 3.6, W * (winter ? 0.0055 : 0.0065));
    els.push(sunGlyph(`sun-rise-${key}`, p0[0], p0[1], endR));
    els.push(sunGlyph(`sun-set-${key}`, p2[0], p2[1], endR));
    els.push(sunGlyph(`sun-apex-${key}`, apex[0], apex[1], Math.max(winter ? 4 : 5.5, W * (winter ? 0.0072 : 0.0095))));
    // The altitude IS the label. A season word alone repeats what the two curves already show;
    // "39°" is the number you use to work out whether that tree shades the beds in June. It sits
    // OUTSIDE the apex along the noon bearing so the glyph's rays never print through the text.
    els.push(label(
      `sun-lbl-${key}`,
      apex[0] + noon[0] * rowH * 1.15,
      apex[1] + noon[1] * rowH * 1.15,
      `${word.toUpperCase()} ${Math.round(path.noonAltitudeDeg)}°`,
      SUN,
    ));
  }
  // The lone "sun comes from here" arrow that used to run down the noon axis is gone: it was
  // drawn from the ring inward to 0.6R, which is exactly where a low winter sun's noon glyph now
  // sits, so it speared its own arc. Two labelled arcs with suns on them say the same thing
  // without a line through the middle of the farm.
  // THE SHADOW RATIO, which is the altitude made useful: at the winter solstice a vertical metre
  // throws this many metres of shadow at noon. It is the number that decides where a shade tree
  // may stand without taking the winter sun off the beds — and it is the reason the altitude is
  // worth drawing at all.
  {
    const r = model.solar.winter.shadowRatio;
    if (r != null && Number.isFinite(r) && r > 0 && r < 20) {
      els.push(label(
        'sun-shadow',
        cx,
        isSH ? cy - sunR - rowH * 1.7 : cy + sunR + rowH * 1.7,
        formatDesignTranslation(t('designSectorWinterShadow'), { ratio: r.toFixed(1) }),
        SUN,
      ));
    }
  }

  // 4. WIND — summer + winter arrows entering from where each wind blows FROM.
  const windWidth = (spd?: number) => Math.max(2.2, (2 + Math.min(spd ?? 3, 8) * 0.5) * (W / 700));
  if (model.windSummer) {
    const v = bearingToUnitVector(model.windSummer.bearingDeg);
    arrow('wind-s-arr', v, SUMMER, windWidth(model.windSummer.speed), '9 5');
    els.push(label('wind-s-lbl', cx + v[0] * (R + arrowLen), cy + v[1] * (R + arrowLen), formatDesignTranslation(t('designSectorSeasonWind'), {
      season: t('designSectorSummer'),
      direction: model.windSummer.fromLabel,
    }), SUMMER_LBL));
  }
  if (model.windWinter) {
    const v = bearingToUnitVector(model.windWinter.bearingDeg);
    arrow('wind-w-arr', v, WINTER, windWidth(model.windWinter.speed), '9 5');
    els.push(label('wind-w-lbl', cx + v[0] * (R + arrowLen), cy + v[1] * (R + arrowLen), formatDesignTranslation(t('designSectorSeasonWind'), {
      season: t('designSectorWinter'),
      direction: model.windWinter.fromLabel,
    }), WINTER_LBL));
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
    els.push(label('water-lbl', wex, wey + rowH * 0.55, t(model.water.indicative ? 'designSectorDownhillApprox' : 'designSectorDownhill'), WATER_LBL));
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
    els.push(label('frost-lbl', fx, fy, t('designSectorFrost'), FROST_LBL));
  }

  return (
    <g pointerEvents="none" opacity={0.7}>
      {els}
    </g>
  );
}
