// Keeping one outlier from flattening a whole chart.
//
// Found by looking at the real thing rather than at a test: on the sample farm's
// cash-flow chart, one R6 600 setup cost in September sat beside eleven months of
// R100–R450 trading. Drawn to a shared linear scale — which is the honest way to
// draw it — that one bar took 93% of the height and every other month in the year
// became a two-pixel sliver. The chart was arithmetically perfect and told the
// farmer nothing about eleven twelfths of their year.
//
// This is a real distribution, not a quirk of the demo data: a smallholder makes
// many small sales and a few large purchases. So the fix cannot be to pretend the
// outlier is smaller.
//
// A capped axis IS honest, but only on two conditions, and both are the caller's
// responsibility to keep:
//   1. THE CUT MUST BE VISIBLE. A bar drawn to the cap gets a break mark, so it
//      never reads as a bar that happens to reach the top of the chart.
//   2. THE TRUE VALUE MUST STILL BE STATED. `clipped` names which points were cut
//      so the card can print them in full. A cut bar with its real number nowhere
//      on screen is not a capped axis, it is a wrong one.
//
// The cap is set from the SECOND largest value, not a percentile: the case being
// solved is one lone spike, and second-largest × 1.25 leaves every other bar its
// full proportion while giving the spike a visible margin to be cut in.

export interface CappedScale {
  /** The top of the drawn axis. Equal to the real maximum when nothing was cut. */
  max: number;
  /** True when at least one value exceeds `max` and is drawn short. */
  capped: boolean;
  /** Draw this instead of the raw value. */
  draw: (value: number) => number;
  /** Was this particular value cut? Drives the break mark. */
  isClipped: (value: number) => boolean;
}

/**
 * How many times bigger than its runner-up a value has to be before it counts as a
 * spike rather than simply a good month. Below this the tallest bar is just the
 * tallest bar and capping it would be flattening real variation.
 */
const SPIKE_RATIO = 3.5;

/** Headroom above the runner-up, so a cut bar is visibly taller than every other. */
const HEADROOM = 1.25;

/** Fewer points than this and there is no "typical" to protect. */
const MIN_POINTS = 4;

export function cappedScale(values: readonly number[]): CappedScale {
  const positive = values.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => b - a);
  const trueMax = positive[0] ?? 0;

  const uncapped: CappedScale = {
    max: trueMax,
    capped: false,
    draw: (v) => (Number.isFinite(v) && v > 0 ? v : 0),
    isClipped: () => false,
  };

  if (positive.length < MIN_POINTS) return uncapped;
  const second = positive[1];
  if (!(second > 0) || trueMax <= second * SPIKE_RATIO) return uncapped;

  const max = second * HEADROOM;
  return {
    max,
    capped: true,
    draw: (v) => (Number.isFinite(v) && v > 0 ? Math.min(v, max) : 0),
    isClipped: (v) => Number.isFinite(v) && v > max,
  };
}
