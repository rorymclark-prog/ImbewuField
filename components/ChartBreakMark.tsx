// The cut mark on a bar that has been drawn short.
//
// lib/chart-scale.ts caps an axis when one value would otherwise flatten every
// other bar to a sliver. That is only honest if the cut is VISIBLE — a bar drawn
// to the cap with no mark reads as a bar that happens to reach the top of the
// chart, which is a chart that lies. This is that mark, shared by every capped
// chart so they cut the same way.
//
// Two strokes in the card colour, drawn inside the bar's own end, so the bar
// visibly stops rather than ending flat.

const CARD = '#FFFEFA';

/** SVG variant. `y` is the bar's end; `down` points the strokes into the bar. */
export function BreakMark({ x, y, w, down = false }: { x: number; y: number; w: number; down?: boolean }) {
  const d = down ? 1 : -1;
  return (
    <g stroke={CARD} strokeWidth="1.4" fill="none">
      <path d={`M ${x - 0.5} ${y + d * 2.5} l ${w + 1} ${d * -2}`} />
      <path d={`M ${x - 0.5} ${y + d * 5.5} l ${w + 1} ${d * -2}`} />
    </g>
  );
}

/** HTML variant, for the bullet bars: a striped cut at the right-hand end. */
export function BreakEdge() {
  return (
    <span
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: 7,
        height: '100%',
        borderRadius: 3,
        background: `repeating-linear-gradient(115deg, ${CARD} 0 1.5px, transparent 1.5px 4px)`,
      }}
    />
  );
}
