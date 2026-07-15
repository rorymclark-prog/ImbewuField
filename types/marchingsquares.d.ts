// Minimal ambient typings for the `marchingsquares` package (no upstream @types package exists).
// Only the `isoLines` entry point used by app/api/contours/route.ts is declared.
declare module 'marchingsquares' {
  export interface IsoLinesOptions {
    successCallback?: (contours: number[][][], threshold: number) => void;
    noQuadTree?: boolean;
    verbose?: boolean;
    polygons?: boolean;
  }

  /**
   * Traces isolines (contour lines, not filled bands) through a 2D scalar grid.
   * `input[row][col]` is the scalar value at that cell.
   * Returns an array of paths; each path is an array of [col, row] points
   * (fractional coordinates in grid-cell space, not necessarily closed).
   */
  export function isoLines(
    input: number[][],
    threshold: number,
    options?: IsoLinesOptions
  ): number[][][];
}
