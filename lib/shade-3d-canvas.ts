import {
  BED_DISTANCES_M,
  SCREEN_LENGTH_M,
  type ShadeDay,
  type ShadeDayKey,
  hourAngleOf,
  shadeAt,
  sunPosition,
} from './shade-day';

export interface OrbitCamera {
  yawDeg: number;   // 0 = due South looking North; sweeps 0..360
  pitchDeg: number; // elevation tilt above horizon (18..62 deg)
}

interface Pt3 { x: number; y: number; z: number }
interface Pt2 { x: number; y: number; depth: number }

const DEG = Math.PI / 180;

function project(p: Pt3, yawDeg: number, pitchDeg: number, cx: number, cy: number, scale: number): Pt2 {
  const cyaw = Math.cos(yawDeg * DEG);
  const syaw = Math.sin(yawDeg * DEG);
  const cp = Math.cos(pitchDeg * DEG);
  const sp = Math.sin(pitchDeg * DEG);

  // Rotate around Z (ground normal) with center near beds centroid y = -3.2
  const dx = p.x;
  const dy = p.y + 3.2;
  const dz = p.z - 0.8;

  const rx = dx * cyaw - dy * syaw;
  const ry = dx * syaw + dy * cyaw;
  // Pitch: camera looks from negative ry toward origin
  const sx = rx;
  const sy = -(ry * sp + dz * cp);
  const depth = ry * cp - dz * sp;
  return { x: cx + sx * scale, y: cy + sy * scale, depth };
}

function drawPoly(ctx: CanvasRenderingContext2D, pts: Pt2[], fill: string, stroke?: string, lw = 1) {
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    if (i === 0) ctx.moveTo(pts[i].x, pts[i].y);
    else ctx.lineTo(pts[i].x, pts[i].y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

function drawBox(
  ctx: CanvasRenderingContext2D,
  proj: (p: Pt3) => Pt2,
  cx: number, cy: number, cz: number,
  w: number, d: number, h: number,
  colTop: string, colFront: string, colSide: string, edge?: string
) {
  const hw = w / 2, hd = d / 2;
  const c = [
    { x: cx - hw, y: cy - hd, z: cz },
    { x: cx + hw, y: cy - hd, z: cz },
    { x: cx + hw, y: cy + hd, z: cz },
    { x: cx - hw, y: cy + hd, z: cz },
    { x: cx - hw, y: cy - hd, z: cz + h },
    { x: cx + hw, y: cy - hd, z: cz + h },
    { x: cx + hw, y: cy + hd, z: cz + h },
    { x: cx - hw, y: cy + hd, z: cz + h },
  ].map(proj);

  const faces: { idx: number[]; fill: string; zAvg: number }[] = [
    { idx: [0, 1, 5, 4], fill: colFront, zAvg: (c[0].depth + c[1].depth + c[5].depth + c[4].depth) / 4 },
    { idx: [2, 3, 7, 6], fill: colFront, zAvg: (c[2].depth + c[3].depth + c[7].depth + c[6].depth) / 4 },
    { idx: [1, 2, 6, 5], fill: colSide, zAvg: (c[1].depth + c[2].depth + c[6].depth + c[5].depth) / 4 },
    { idx: [3, 0, 4, 7], fill: colSide, zAvg: (c[3].depth + c[0].depth + c[4].depth + c[7].depth) / 4 },
    { idx: [4, 5, 6, 7], fill: colTop, zAvg: (c[4].depth + c[5].depth + c[6].depth + c[7].depth) / 4 },
  ];

  // Cull back sides loosely by keeping front-most vertical faces + top, sorted back-to-front
  faces.sort((a, b) => b.zAvg - a.zAvg);
  for (const f of faces) {
    drawPoly(ctx, f.idx.map((k) => c[k]), f.fill, edge, 0.8);
  }
}

export function drawShade3DStage(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  latDeg: number,
  heightM: number,
  dayKey: ShadeDayKey,
  dayResult: ShadeDay,
  hour: number,
  cam: OrbitCamera
) {
  const at = shadeAt(dayResult, hour);
  const altDeg = at.up ? at.sun.altitudeDeg : 0;
  const azDeg = at.sun.azimuthDeg;

  // Dynamic sky & horizon gradient reacting to sun altitude
  const sunLift = Math.max(0, Math.min(1, altDeg / 70));
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  if (!at.up) {
    sky.addColorStop(0, '#19222B');
    sky.addColorStop(1, '#39464E');
  } else {
    sky.addColorStop(0, dayKey === 'december' ? '#DCE8F0' : dayKey === 'june' ? '#CFDCE6' : '#D6E2EB');
    sky.addColorStop(0.55, '#EFE7D6');
    sky.addColorStop(1, '#E3D9C3');
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const cx = w * 0.5;
  const cy = h * 0.56;
  const scale = Math.min(w, h) * 0.052;
  const P = (p: Pt3) => project(p, cam.yawDeg, cam.pitchDeg, cx, cy, scale);

  // 1. Ground plinth & 1m grid (-8..8 in x, -10..3.5 in y)
  drawPoly(
    ctx,
    [
      P({ x: -9.5, y: -10.5, z: 0 }),
      P({ x: 9.5, y: -10.5, z: 0 }),
      P({ x: 9.5, y: 4.5, z: 0 }),
      P({ x: -9.5, y: 4.5, z: 0 }),
    ],
    at.up ? '#E4DCC6' : '#BEB6A4',
    '#C4BA9F',
    1
  );

  ctx.strokeStyle = 'rgba(116, 98, 72, 0.24)';
  ctx.lineWidth = 1;
  for (let gx = -8; gx <= 8; gx++) {
    const a = P({ x: gx, y: -10, z: 0.01 });
    const b = P({ x: gx, y: 4, z: 0.01 });
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  for (let gy = -10; gy <= 4; gy++) {
    const a = P({ x: -8, y: gy, z: 0.01 });
    const b = P({ x: 8, y: gy, z: 0.01 });
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }

  // North compass arrow at y = 2.6..3.8
  const n0 = P({ x: 0, y: 2.0, z: 0.02 });
  const n1 = P({ x: 0, y: 3.4, z: 0.02 });
  ctx.strokeStyle = '#A84824';
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(n0.x, n0.y); ctx.lineTo(n1.x, n1.y); ctx.stroke();
  ctx.fillStyle = '#A84824';
  ctx.font = '700 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const nLbl = P({ x: 0, y: 3.9, z: 0.02 });
  ctx.fillText('N', nLbl.x, nLbl.y);

  // 2. Solar cast shadow polygon on z = 0.02
  if (at.up && at.polygon && at.polygon.length >= 4) {
    const shPts = at.polygon.map((pt) => P({ x: pt.x, y: pt.y, z: 0.02 }));
    drawPoly(ctx, shPts, 'rgba(34, 28, 22, 0.34)');
  }

  // 3. Depth-sorted scene actors: 5 raised crop beds + the screen object
  const actors: { depth: number; draw: () => void }[] = [];

  for (let i = 0; i < BED_DISTANCES_M.length; i++) {
    const dist = BED_DISTANCES_M[i];
    const lit = at.lit[i];
    const by = -dist;
    const depth = P({ x: 0, y: by, z: 0.2 }).depth;
    actors.push({
      depth,
      draw: () => {
        // Timber border + rich topsoil
        drawBox(ctx, P, 0, by, 0, 4.0, 1.0, 0.22, '#4A3623', '#6E5035', '#5C432B', 'rgba(38,27,16,0.35)');
        drawPoly(
          ctx,
          [
            P({ x: -1.86, y: by - 0.38, z: 0.23 }),
            P({ x: 1.86, y: by - 0.38, z: 0.23 }),
            P({ x: 1.86, y: by + 0.38, z: 0.23 }),
            P({ x: -1.86, y: by + 0.38, z: 0.23 }),
          ],
          lit ? '#3A2B1B' : '#261D13'
        );
        // 7 x 2 leafy crops lighting up in direct sun vs cool shade
        for (let c = 0; c < 7; c++) {
          const px = -1.5 + c * 0.5;
          for (const pyOff of [-0.2, 0.2]) {
            const cp = P({ x: px, y: by + pyOff, z: 0.34 });
            const r = Math.max(3.5, scale * 0.19);
            ctx.fillStyle = lit ? '#4E9426' : '#354836';
            ctx.beginPath();
            ctx.arc(cp.x, cp.y, r, 0, Math.PI * 2);
            ctx.fill();
            if (lit) {
              ctx.fillStyle = '#8CD058';
              ctx.beginPath();
              ctx.arc(cp.x - r * 0.25, cp.y - r * 0.25, r * 0.48, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
        // Metre badge neatly outside right/east edge of beds (clear of wall)
        const tagP = P({ x: 2.35, y: by, z: 0.14 });
        ctx.fillStyle = lit ? '#2D5E12' : '#42474D';
        ctx.font = '700 11px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${dist} m ${lit ? 'SUN' : 'SHADE'}`, tagP.x, tagP.y);
      },
    });
  }

  // Screen object at y = 0: visually changes between 2m hedge, 3m brick wall, 5m tree row!
  actors.push({
    depth: P({ x: 0, y: 0, z: heightM * 0.5 }).depth,
    draw: () => {
      if (heightM <= 2.1) {
        // 2m dense hedge row
        for (let k = -3.6; k <= 3.6; k += 0.9) {
          drawBox(ctx, P, k, 0, 0, 0.96, 0.72, heightM, '#4A8224', '#315C16', '#254710', 'rgba(20,38,10,0.3)');
        }
      } else if (heightM <= 3.1) {
        // 3m terracotta masonry wall + coping stone
        drawBox(ctx, P, 0, 0, 0, SCREEN_LENGTH_M, 0.26, heightM, '#C27452', '#AE5B38', '#8F4628', 'rgba(38,27,16,0.35)');
        drawBox(ctx, P, 0, 0, heightM, SCREEN_LENGTH_M + 0.14, 0.34, 0.12, '#3D352E', '#2A241E', '#1F1A16');
      } else {
        // 5m windbreak tree row (5 tall sculptural trunks + overlapping emerald canopy blocks)
        for (let k = -3.2; k <= 3.2; k += 1.6) {
          drawBox(ctx, P, k, 0, 0, 0.26, 0.26, 2.2, '#5C4028', '#4A331F', '#392616');
          drawBox(ctx, P, k, 0, 2.0, 1.8, 1.4, heightM - 2.0, '#5A9632', '#3D701E', '#2F5816', 'rgba(18,36,10,0.3)');
        }
      }
    },
  });

  actors.sort((a, b) => b.depth - a.depth);
  for (const a of actors) a.draw();

  // 4. Translucent 3D Solar Sky Dome Arcs (all 3 seasons for comparison + active sun & hour ticks)
  const skyR = 9.8;
  const skyCenter = { x: 0, y: -2.0, z: 0 };
  const seasonArcs: { key: ShadeDayKey; decl: number; col: string }[] = [
    { key: 'december', decl: -23.4393, col: 'rgba(184, 58, 24, 0.72)' },
    { key: 'equinox', decl: 0, col: 'rgba(92, 63, 134, 0.68)' },
    { key: 'june', decl: 23.4393, col: 'rgba(28, 90, 158, 0.72)' },
  ];

  for (const sa of seasonArcs) {
    const isSel = sa.key === dayKey;
    ctx.save();
    ctx.strokeStyle = sa.col;
    ctx.globalAlpha = isSel ? 0.92 : 0.25;
    ctx.lineWidth = isSel ? 2.6 : 1.3;
    if (!isSel) ctx.setLineDash([3, 4]);
    ctx.beginPath();
    let pen = false;
    for (let i = 0; i <= 48; i++) {
      const hr = 5 + (14 * i) / 48;
      const pos = sunPosition(latDeg, sa.decl, hourAngleOf(hr));
      if (pos.altitudeDeg <= 0) continue;
      const ar = pos.altitudeDeg * DEG;
      const azr = pos.azimuthDeg * DEG;
      const sp = P({
        x: skyCenter.x + Math.cos(ar) * Math.sin(azr) * skyR,
        y: skyCenter.y + Math.cos(ar) * Math.cos(azr) * skyR,
        z: Math.sin(ar) * skyR,
      });
      if (!pen) { ctx.moveTo(sp.x, sp.y); pen = true; } else ctx.lineTo(sp.x, sp.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Hour tick beads (09:00, 12:00, 15:00) on the active 3D solar arc
  for (const hrTick of [9, 12, 15]) {
    if (hrTick <= dayResult.riseHour || hrTick >= dayResult.setHour) continue;
    const posT = sunPosition(latDeg, dayResult.declDeg, hourAngleOf(hrTick));
    if (posT.altitudeDeg <= 0) continue;
    const arT = posT.altitudeDeg * DEG;
    const azrT = posT.azimuthDeg * DEG;
    const tp = P({
      x: skyCenter.x + Math.cos(arT) * Math.sin(azrT) * skyR,
      y: skyCenter.y + Math.cos(arT) * Math.cos(azrT) * skyR,
      z: Math.sin(arT) * skyR,
    });
    ctx.fillStyle = 'rgba(255, 252, 244, 0.9)';
    ctx.strokeStyle = 'rgba(38, 27, 16, 0.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(tp.x, tp.y, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  if (at.up) {
    const ar = altDeg * DEG;
    const azr = azDeg * DEG;
    const sx = skyCenter.x + Math.cos(ar) * Math.sin(azr) * skyR;
    const sy = skyCenter.y + Math.cos(ar) * Math.cos(azr) * skyR;
    const sz = Math.sin(ar) * skyR;
    const sun2d = P({ x: sx, y: sy, z: sz });
    const wallTopL = P({ x: -SCREEN_LENGTH_M * 0.5, y: 0, z: heightM });
    const wallTopC = P({ x: 0, y: 0, z: heightM });
    const wallTopR = P({ x: SCREEN_LENGTH_M * 0.5, y: 0, z: heightM });

    // Subtle warm golden light-cone frustum onto the screen crest
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(sun2d.x, sun2d.y);
    ctx.lineTo(wallTopL.x, wallTopL.y);
    ctx.lineTo(wallTopR.x, wallTopR.y);
    ctx.closePath();
    ctx.fillStyle = `rgba(245, 188, 66, ${(0.07 + sunLift * 0.08).toFixed(3)})`;
    ctx.fill();
    ctx.restore();

    // Sightline ray showing shadow geometry
    ctx.strokeStyle = `rgba(232, 168, 46, ${(0.42 + sunLift * 0.35).toFixed(2)})`;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(sun2d.x, sun2d.y);
    ctx.lineTo(wallTopC.x, wallTopC.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draggable sun aura, corona ring & disc
    ctx.fillStyle = 'rgba(242, 186, 62, 0.30)';
    ctx.beginPath(); ctx.arc(sun2d.x, sun2d.y, 20, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255, 250, 235, 0.9)';
    ctx.lineWidth = 2;
    ctx.fillStyle = '#F5B832';
    ctx.beginPath(); ctx.arc(sun2d.x, sun2d.y, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }

  // Interactive hint pill bottom-right
  const pillW = Math.min(w - 20, 248);
  ctx.fillStyle = 'rgba(24, 34, 24, 0.76)';
  ctx.beginPath();
  ctx.roundRect(w - pillW - 10, h - 34, pillW, 24, 999);
  ctx.fill();
  ctx.fillStyle = '#F3EDDE';
  ctx.font = '600 10.5px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Drag sun on arc · drag ground to orbit', w - pillW / 2 - 10, h - 22);
}

/** Hit-test the 3D solar arc & sun sphere so dragging the sun scrubs local solar time directly in 3D. */
export function hitSunArc3D(
  localX: number,
  localY: number,
  w: number,
  h: number,
  latDeg: number,
  dayResult: ShadeDay,
  hour: number,
  cam: OrbitCamera
): { nearSun: boolean; nearestHour: number; minDistPx: number } {
  const cx = w * 0.5;
  const cy = h * 0.56;
  const scale = Math.min(w, h) * 0.052;
  const P = (p: Pt3) => project(p, cam.yawDeg, cam.pitchDeg, cx, cy, scale);
  const skyR = 9.8;
  const skyCenter = { x: 0, y: -2.0, z: 0 };

  const curPos = sunPosition(latDeg, dayResult.declDeg, hourAngleOf(hour));
  let nearSun = false;
  if (curPos.altitudeDeg > 0) {
    const ar = curPos.altitudeDeg * DEG;
    const azr = curPos.azimuthDeg * DEG;
    const sun2d = P({
      x: skyCenter.x + Math.cos(ar) * Math.sin(azr) * skyR,
      y: skyCenter.y + Math.cos(ar) * Math.cos(azr) * skyR,
      z: Math.sin(ar) * skyR,
    });
    nearSun = Math.hypot(localX - sun2d.x, localY - sun2d.y) <= 28;
  }

  let bestHour = hour;
  let bestD = Infinity;
  const SAMPLES = 96;
  for (let i = 0; i <= SAMPLES; i++) {
    const hr = dayResult.riseHour + ((dayResult.setHour - dayResult.riseHour) * i) / SAMPLES;
    const pos = sunPosition(latDeg, dayResult.declDeg, hourAngleOf(hr));
    if (pos.altitudeDeg <= 0) continue;
    const ar = pos.altitudeDeg * DEG;
    const azr = pos.azimuthDeg * DEG;
    const sp = P({
      x: skyCenter.x + Math.cos(ar) * Math.sin(azr) * skyR,
      y: skyCenter.y + Math.cos(ar) * Math.cos(azr) * skyR,
      z: Math.sin(ar) * skyR,
    });
    const d = Math.hypot(localX - sp.x, localY - sp.y);
    if (d < bestD) {
      bestD = d;
      bestHour = hr;
    }
  }
  return { nearSun, nearestHour: bestHour, minDistPx: bestD };
}
