import { useEffect, useMemo, useState } from 'react'
import * as turf from '@turf/turf'
import type { Feature, FeatureCollection } from 'geojson'
import type { SkyddsomradeFeature, BeslutFeature, SkyddsomradeProperties, BeslutProperties } from '../types'

export interface SpatialRelations {
  skyddsomraden: SkyddsomradeFeature[]
  beslut: BeslutFeature[]
  loading: boolean
}

// Module-level cache shared across all hook instances
let _skyddsCache: SkyddsomradeFeature[] | null = null
let _beslutCache: BeslutFeature[] | null = null
let _loadPromise: Promise<void> | null = null

function loadAll(): Promise<void> {
  if (_skyddsCache && _beslutCache) return Promise.resolve()
  if (_loadPromise) return _loadPromise
  _loadPromise = Promise.all([
    fetch('/data/skyddsomraden.geojson').then(r => r.json()),
    fetch('/data/beslut.geojson').then(r => r.json()),
  ]).then(([rawSkydds, rawBeslut]) => {
    _skyddsCache = (rawSkydds as FeatureCollection).features as SkyddsomradeFeature[]
    _beslutCache = (rawBeslut as FeatureCollection).features as BeslutFeature[]
  })
  return _loadPromise
}

// soid can be comma-separated (e.g. 'NVR-1, NVR-2, NVR-3')
export function parseSoids(soidStr: string | null | undefined): string[] {
  if (!soidStr) return []
  return soidStr.split(',').map(s => s.trim()).filter(Boolean)
}

// Returns the full data caches — useful for cross-type lookups
export function useSpatialData(): {
  skyddsomraden: SkyddsomradeFeature[]
  beslut: BeslutFeature[]
  loading: boolean
} {
  const [loaded, setLoaded] = useState(() => !!(_skyddsCache && _beslutCache))
  useEffect(() => {
    if (loaded) return
    loadAll().then(() => setLoaded(true))
  }, [loaded])
  return useMemo(() => ({
    skyddsomraden: _skyddsCache ?? [],
    beslut: _beslutCache ?? [],
    loading: !loaded,
  }), [loaded])
}

export function useSpatialRelations(feature: Feature | null): SpatialRelations {
  const [loaded, setLoaded] = useState(() => !!(_skyddsCache && _beslutCache))

  useEffect(() => {
    if (loaded) return
    loadAll().then(() => setLoaded(true))
  }, [loaded])

  return useMemo<SpatialRelations>(() => {
    if (!feature || !loaded || !_skyddsCache || !_beslutCache) {
      return { skyddsomraden: [], beslut: [], loading: !loaded }
    }

    const overlappingSkyddsomraden = _skyddsCache.filter(s => {
      try { return turf.booleanIntersects(feature, s) } catch { return false }
    })

    // Beslut related by soid match (handles multi-value soid) OR geometric overlap
    const relatedBeslut = _beslutCache.filter(b => {
      const bSoid = (b.properties as BeslutProperties).soid
      if (overlappingSkyddsomraden.some(s =>
        parseSoids((s.properties as SkyddsomradeProperties).soid).includes(bSoid)
      )) return true
      try { return turf.booleanIntersects(feature, b) } catch { return false }
    })

    return { skyddsomraden: overlappingSkyddsomraden, beslut: relatedBeslut, loading: false }
  }, [feature, loaded])
}
