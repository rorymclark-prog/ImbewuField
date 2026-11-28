export const FRAME_SPAN = 1.72;
export const FRAME_HEIGHT = Math.sqrt(2 * 2 - (FRAME_SPAN / 2) ** 2);
export const CROSSBAR_FRACTION = .53;
export const CROSSBAR_HALF_SPAN = FRAME_SPAN * (1 - CROSSBAR_FRACTION) / 2;
export const TURN_LIMIT = 34;
export const TURN_STEP = .5;
export const TOTAL_PEGS = 5;

// The threshold belongs to this exercise's controls. The recorded peg itself is placed at equal height.
const GAME_ALIGNMENT_MARGIN = .014;
const radians = Math.PI / 180;
export type GroundPoint = { x: number; y: number; z: number };
export type FramePose = { free: GroundPoint; rise: number; reading: number; aligned: boolean };

function contourOffset(x: number): number {
  return .43 * Math.sin(.64 * x + .27) + .15 * Math.sin(.99 * x - .36);
}

export function practiceHeight(x: number, z: number): number {
  const distance = z - contourOffset(x);
  return -.28 * distance + .12 * Math.sin(distance * 1.13) * Math.sin(x * .71);
}

export function pegBesideFoot(foot: GroundPoint): GroundPoint {
  // Give the pole and peg room while keeping the marker on the same level line.
  const x = foot.x - .13;
  return { x, y: foot.y, z: foot.z + contourOffset(x) - contourOffset(foot.x) };
}

export function initialPeg(): GroundPoint {
  const x = -4.12;
  return { x, z: contourOffset(x), y: 0 };
}

export function startingTurn(placed: number): number {
  return [20, -19, -17, 24][placed - 1] ?? 0;
}

export function limitTurn(turn: number): number {
  return Math.max(-TURN_LIMIT, Math.min(TURN_LIMIT, turn));
}

export function framePose(pivot: GroundPoint, turn: number): FramePose {
  return frameAtHeading(pivot, limitTurn(turn) * radians);
}

export function frameAtHeading(pivot: GroundPoint, heading: number): FramePose {
  const dx = Math.cos(heading);
  const dz = Math.sin(heading);
  // Swing the free leg on the ground while keeping the rigid frame's span fixed in 3D.
  let low = 0, high = FRAME_SPAN;
  for (let i = 0; i < 26; i++) {
    const reach = (low + high) / 2;
    const rise = practiceHeight(pivot.x + dx * reach, pivot.z + dz * reach) - pivot.y;
    if (reach ** 2 + rise ** 2 > FRAME_SPAN ** 2) high = reach;
    else low = reach;
  }
  const reach = (low + high) / 2;
  const x = pivot.x + dx * reach;
  const z = pivot.z + dz * reach;
  const y = practiceHeight(x, z);
  const rise = y - pivot.y;
  // Project gravity onto the crossbar's axis. In the frame's plane, a tilt of θ
  // moves the crossing point by the height above the bar times tan(θ).
  const reading = -FRAME_HEIGHT * (1 - CROSSBAR_FRACTION) * rise / reach;
  return { free: { x, y, z }, rise, reading, aligned: Math.abs(rise) <= GAME_ALIGNMENT_MARGIN };
}

export function nextPracticePeg(pivot: GroundPoint, turn: number): GroundPoint | null {
  if (!framePose(pivot, turn).aligned) return null;
  let uphill = -TURN_LIMIT;
  let downhill = TURN_LIMIT;
  for (let i = 0; i < 28; i++) {
    const middle = (uphill + downhill) / 2;
    if (framePose(pivot, middle).rise > 0) uphill = middle;
    else downhill = middle;
  }
  return framePose(pivot, (uphill + downhill) / 2).free;
}
