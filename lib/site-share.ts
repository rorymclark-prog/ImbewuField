'use client'

import type { FeatureCollection } from 'geojson'
import type { SavedPlace as Place } from './saved-places'
import type { WaterPoint } from './water-points'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { getFirebase } from '@/lib/firebase/init'

export interface SharedSiteData {
  geojson: FeatureCollection
  places: Place[]
  waterPoints: WaterPoint[]
  mapCenter: [number, number]
  mapZoom: number
  label?: string
}

function generateCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

export async function saveSharedSite(data: SharedSiteData): Promise<string> {
  const fb = getFirebase()
  if (!fb) throw new Error('Firestore unavailable')
  const firestore = fb.db

  const code = generateCode()
  await setDoc(doc(firestore, 'shared_sites', code), {
    code,
    ...data,
    createdAt: serverTimestamp(),
  })
  return code
}

export async function loadSharedSite(code: string): Promise<SharedSiteData | null> {
  const fb = getFirebase()
  if (!fb) throw new Error('Firestore unavailable')
  const firestore = fb.db

  const snap = await getDoc(doc(firestore, 'shared_sites', code))
  if (!snap.exists()) return null
  const { code: _code, createdAt: _ts, ...data } = snap.data()
  return data as SharedSiteData
}
