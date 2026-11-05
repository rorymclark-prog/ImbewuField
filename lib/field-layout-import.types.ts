export type FieldLayoutCoordinate = readonly [longitude: number, latitude: number];
export interface FieldLayoutKmlCandidate {
  readonly id: string;
  readonly name: string;
  /** Closed longitude/latitude ring. No label or KML ID grants field authority. */
  readonly ring: readonly FieldLayoutCoordinate[];
}
export interface FieldLayoutKmlParsed {
  readonly status: 'parsed';
  readonly candidates: readonly FieldLayoutKmlCandidate[];
  readonly excludedPlacemarkCount: number;
}
export type FieldLayoutKmlParseResult = FieldLayoutKmlParsed | {
  readonly status: 'held'; readonly reason: string;
};
export type FieldLayoutCoordinateParseResult = {
  readonly status: 'parsed'; readonly ring: readonly FieldLayoutCoordinate[];
} | { readonly status: 'held'; readonly reason: string };
