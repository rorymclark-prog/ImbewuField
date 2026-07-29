import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildDemoBoundaryFC,
  buildDemoSavedPlace,
  buildDemoWaterPoints,
  DEMO_SITE,
} from '../lib/demo-farm.ts'

class MemoryStorage {
  readonly rows = new Map<string, string>()
  getItem(key: string): string | null { return this.rows.get(key) ?? null }
  setItem(key: string, value: string): void { this.rows.set(key, value) }
  removeItem(key: string): void { this.rows.delete(key) }
}

const session = new MemoryStorage()
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: { sessionStorage: session },
})

const {
  chooseAvailableShareCode,
  generateShareCode,
  loadSharedSite,
  normaliseShareCode,
  normaliseSharedSiteData,
  saveSharedSite,
} = await import('../lib/site-share.ts')

function validShare() {
  return {
    geojson: buildDemoBoundaryFC(),
    places: [buildDemoSavedPlace()],
    waterPoints: buildDemoWaterPoints(),
    mapCenter: [DEMO_SITE.lon, DEMO_SITE.lat] as [number, number],
    mapZoom: 18,
    label: DEMO_SITE.name,
  }
}

test('share codes are path-safe, case-normalized and generated at a fixed safe shape', () => {
  assert.equal(normaliseShareCode(' ab12cd '), 'AB12CD')
  assert.equal(normaliseShareCode('ABC/DEF'), null)
  assert.equal(normaliseShareCode('../secret'), null)
  assert.equal(normaliseShareCode('short'), null)

  for (let index = 0; index < 100; index += 1) {
    assert.match(generateShareCode(), /^[A-Z0-9]{6,12}$/)
  }
})

test('code reservation retries collisions and never returns an occupied code', async () => {
  const candidates = ['ABCDEF', 'GHIJKL', 'MNOPQR']
  const occupied = new Set(['ABCDEF', 'GHIJKL'])
  const checked: string[] = []
  const chosen = await chooseAvailableShareCode(
    async (code) => {
      checked.push(code)
      return occupied.has(code)
    },
    () => candidates.shift() ?? 'MNOPQR',
  )

  assert.equal(chosen, 'MNOPQR')
  assert.deepEqual(checked, ['ABCDEF', 'GHIJKL', 'MNOPQR'])
})

test('code reservation fails rather than overwriting after repeated collisions', async () => {
  await assert.rejects(
    chooseAvailableShareCode(async () => true, () => 'ABCDEF', 3),
    /unique share code/,
  )
})

test('a complete share payload round-trips as a deep presentation copy', () => {
  const input = validShare()
  const copy = normaliseSharedSiteData(input)
  assert.deepEqual(copy, input)
  assert.notEqual(copy, input)
  assert.notEqual(copy?.geojson, input.geojson)

  copy!.mapCenter[0] = 0
  assert.equal(input.mapCenter[0], DEMO_SITE.lon)
})

test('malformed geometry, coordinates, zoom and records are rejected', () => {
  const base = validShare()
  const invalid: unknown[] = [
    { ...base, geojson: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: null }] } },
    { ...base, geojson: { ...base.geojson, features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [181, 0] } }] } },
    { ...base, mapCenter: [0, 91] },
    { ...base, mapZoom: Number.POSITIVE_INFINITY },
    { ...base, places: [{ ...base.places[0], lat: Number.NaN }] },
    { ...base, waterPoints: [{ ...base.waterPoints[0], category: 'River' }] },
  ]

  for (const value of invalid) assert.equal(normaliseSharedSiteData(value), null)
})

test('sample mode rejects a public write before touching Firebase', async () => {
  session.setItem('imbewu_sample_mode', '1')
  await assert.rejects(saveSharedSite(validShare()), /switched off in the sample farm/)
  session.removeItem('imbewu_sample_mode')
})

test('invalid query codes are ignored without a Firestore lookup', async () => {
  assert.equal(await loadSharedSite('../../farmer'), null)
  assert.equal(await loadSharedSite('bad'), null)
})
