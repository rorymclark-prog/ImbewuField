'use client'

import type { FeatureCollection } from 'geojson'
import type { SavedPlace as Place } from './saved-places'
import { WATER_POINT_CATEGORIES, type WaterPoint } from './water-points'
import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { getFirebase } from '@/lib/firebase/init'
import { isSampleMode } from './sample-mode'

export interface SharedSiteData {
  geojson: FeatureCollection
  places: Place[]
  waterPoints: WaterPoint[]
  mapCenter: [number, number]
  mapZoom: number
  label?: string
}

const CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const GENERATED_CODE_LENGTH = 8

export function normaliseShareCode(value: string): string | null {
  const code = value.trim().toUpperCase()
  return /^[A-Z0-9]{6,12}$/.test(code) ? code : null
}

export function generateShareCode(): string {
  const bytes = new Uint8Array(GENERATED_CODE_LENGTH)
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes)
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256)
    }
  }
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('')
}

export async function chooseAvailableShareCode(
  exists: (code: string) => Promise<boolean>,
  generate: () => string = generateShareCode,
  attempts = 8,
): Promise<string> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const code = normaliseShareCode(generate())
    if (code && !(await exists(code))) return code
  }
  throw new Error('Could not reserve a unique share code')
}

type UnknownRecord = Record<string, unknown>

function record(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function text(value: unknown): value is string {
  return typeof value === 'string'
}

function validPosition(value: unknown): boolean {
  return Array.isArray(value) && value.length >= 2
    && finite(value[0]) && value[0] >= -180 && value[0] <= 180
    && finite(value[1]) && value[1] >= -90 && value[1] <= 90
    && value.slice(2).every(finite)
}

function validCoordinates(value: unknown): boolean {
  if (!Array.isArray(value) || value.length === 0) return false
  return typeof value[0] === 'number' ? validPosition(value) : value.every(validCoordinates)
}

function validGeometry(value: unknown): boolean {
  if (!record(value) || !text(value.type)) return false
  if (value.type === 'GeometryCollection') {
    return Array.isArray(value.geometries) && value.geometries.every(validGeometry)
  }
  if (!['Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon'].includes(value.type)) {
    return false
  }
  return validCoordinates(value.coordinates)
}

function validFeatureCollection(value: unknown): value is FeatureCollection {
  return record(value) && value.type === 'FeatureCollection' && Array.isArray(value.features)
    && value.features.every((feature) => (
      record(feature) && feature.type === 'Feature'
      && validGeometry(feature.geometry)
      && (feature.properties === null || record(feature.properties))
      && (feature.id === undefined || text(feature.id) || finite(feature.id))
    ))
}

function validPlace(value: unknown): value is Place {
  if (!record(value)) return false
  return text(value.id) && value.id.length > 0 && text(value.name)
    && finite(value.lat) && value.lat >= -90 && value.lat <= 90
    && finite(value.lon) && value.lon >= -180 && value.lon <= 180
    && text(value.biome) && finite(value.rainfall) && finite(value.elevation)
    && text(value.savedAt) && Number.isFinite(Date.parse(value.savedAt))
    && (value.updatedAt === undefined || (finite(value.updatedAt) && value.updatedAt >= 0))
    && (value.label === undefined || ['home', 'field', 'water', 'other'].includes(String(value.label)))
    && (value.color === undefined || text(value.color))
    && (value.notes === undefined || text(value.notes))
}

function validWaterPoint(value: unknown): value is WaterPoint {
  if (!record(value)) return false
  const categories = new Set(WATER_POINT_CATEGORIES.map((row) => row.v))
  return text(value.id) && value.id.length > 0 && text(value.name)
    && (value.category === '' || categories.has(value.category as never))
    && finite(value.lat) && value.lat >= -90 && value.lat <= 90
    && finite(value.lon) && value.lon >= -180 && value.lon <= 180
    && text(value.createdAt) && Number.isFinite(Date.parse(value.createdAt))
    && (value.updatedAt === undefined || (finite(value.updatedAt) && value.updatedAt >= 0))
}

export function normaliseSharedSiteData(value: unknown): SharedSiteData | null {
  let clean: unknown
  try {
    clean = JSON.parse(JSON.stringify(value))
  } catch {
    return null
  }
  if (!record(clean) || !validFeatureCollection(clean.geojson)
      || !Array.isArray(clean.places) || !clean.places.every(validPlace)
      || !Array.isArray(clean.waterPoints) || !clean.waterPoints.every(validWaterPoint)
      || !Array.isArray(clean.mapCenter) || clean.mapCenter.length !== 2
      || !finite(clean.mapCenter[0]) || clean.mapCenter[0] < -180 || clean.mapCenter[0] > 180
      || !finite(clean.mapCenter[1]) || clean.mapCenter[1] < -90 || clean.mapCenter[1] > 90
      || !finite(clean.mapZoom) || clean.mapZoom < 0 || clean.mapZoom > 24
      || (clean.label !== undefined && !text(clean.label))) return null
  return clean as unknown as SharedSiteData
}

export async function saveSharedSite(data: SharedSiteData): Promise<string> {
  // Sample-mode gate (safety layer 2, lib/sample-mode.ts): sharing writes a public
  // shared_sites doc — the demo must not publish anything.
  if (isSampleMode()) throw new Error('Sharing is switched off in the sample farm.')
  const fb = getFirebase()
  if (!fb) throw new Error('Firestore unavailable')
  const firestore = fb.db
  const safe = normaliseSharedSiteData(data)
  if (!safe) throw new Error('Invalid site data')

  return runTransaction(firestore, async (transaction) => {
    const code = await chooseAvailableShareCode(async (candidate) => {
      const snap = await transaction.get(doc(firestore, 'shared_sites', candidate))
      return snap.exists()
    })
    transaction.set(doc(firestore, 'shared_sites', code), {
      code,
      ...safe,
      createdAt: serverTimestamp(),
    })
    return code
  })
}

export async function loadSharedSite(code: string): Promise<SharedSiteData | null> {
  const safeCode = normaliseShareCode(code)
  if (!safeCode) return null
  const fb = getFirebase()
  if (!fb) throw new Error('Firestore unavailable')
  const firestore = fb.db

  const snap = await getDoc(doc(firestore, 'shared_sites', safeCode))
  if (!snap.exists()) return null
  const { code: _code, createdAt: _ts, ...data } = snap.data()
  return normaliseSharedSiteData(data)
}
