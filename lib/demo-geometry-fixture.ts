import type { Feature, FeatureCollection } from 'geojson';

type Point = [number, number];
type ProjectPoint = (xM: number, yM: number) => Point;

export const DEMO_BOUNDARY_METRES: Point[] = [
  [-0.5, 0.4], [39.6, 1.3], [40.4, 27.2], [0.8, 26.7],
];

// Stepped and concave by design: smoothing or cropping cannot look "close enough".
export const DEMO_HOUSE_METRES: Point[] = [
  [18, 4], [34, 4], [34, 10], [30, 10],
  [30, 16], [24, 16], [24, 12], [18, 12],
];

// A closed paved area with a narrow entrance and broad apron, not a centreline.
export const DEMO_DRIVEWAY_METRES: Point[] = [
  [15, 0.8], [19, 0.8], [19, 3.2], [36, 3.2],
  [36, 6], [34, 6], [34, 4.5], [17, 4.5], [17, 10], [15, 10],
];

function closedRing(points: Point[], project: ProjectPoint): Point[] {
  const ring = points.map(([xM, yM]) => project(xM, yM));
  ring.push(ring[0]);
  return ring;
}

/** Real map-storage shape contract used by both the sample farm and its regression test. */
export function buildDemoGeometryLockFixture(siteId: string, project: ProjectPoint): FeatureCollection {
  const polygon = (id: string, name: string, hatchIdx: number, points: Point[]): Feature => ({
    type: 'Feature',
    id,
    properties: { featureType: 'site', siteId, hatchIdx, name },
    geometry: { type: 'Polygon', coordinates: [closedRing(points, project)] },
  });

  return {
    type: 'FeatureCollection',
    features: [
      polygon('demo-boundary', 'Ubhejane plot', 0, DEMO_BOUNDARY_METRES),
      polygon('demo-house', 'Main house roof', 1, DEMO_HOUSE_METRES),
      polygon('demo-driveway', 'Tarred driveway', 2, DEMO_DRIVEWAY_METRES),
    ],
  };
}
