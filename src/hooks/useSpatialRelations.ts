import { useEffect, useMemo, useRef, useState } from 'react'
import * as turf from '@turf/turf'
import type { Feature, FeatureCollection } from 'geojson'
import type { SkyddatomradeFeature, BeslutFeature, DelomradeFeature } from '../types'

export interface SpatialRelations {
  skyddatomraden: SkyddatomradeFeature[]
  beslut: BeslutFeature[]
  delomraden: DelomradeFeature[]
  loading: boolean
}

type BBox4 = [number, number, number, number]

// Module-level caches shared across all hook instances
let _skyddsCache: SkyddatomradeFeature[] | null = null
let _beslutCache: BeslutFeature[] | null = null
let _delomradeCache: DelomradeFeature[] | null = null
let _skyddsBboxes: BBox4[] | null = null
let _beslutBboxes: BBox4[] | null = null
let _delomradeBboxes: BBox4[] | null = null
let _loadPromise: Promise<void> | null = null

// Result cache keyed by feature id
const _resultCache = new Map<string, { skyddatomraden: SkyddatomradeFeature[]; beslut: BeslutFeature[]; delomraden: DelomradeFeature[] }>()

function safeBbox(f: Feature): BBox4 {
  try { return turf.bbox(f) as BBox4 } catch { return [-180, -90, 180, 90] }
}

function bboxOverlaps(a: BBox4, b: BBox4): boolean {
  return b[2] >= a[0] && b[0] <= a[2] && b[3] >= a[1] && b[1] <= a[3]
}

function intersects(a: Feature, b: Feature): boolean {
  try { return turf.booleanIntersects(a, b) } catch { return false }
}

function loadAll(): Promise<void> {
  if (_skyddsCache && _beslutCache && _delomradeCache) return Promise.resolve()
  if (_loadPromise) return _loadPromise
  _loadPromise = Promise.all([
    fetch('/data/skyddatomraden.geojson').then(r => r.json()),
    fetch('/data/beslut.geojson').then(r => r.json()),
    fetch('/data/delomraden.geojson').then(r => r.json()),
  ]).then(([rawSkydds, rawBeslut, rawDelomrade]) => {
    _skyddsCache    = (rawSkydds    as FeatureCollection).features as SkyddatomradeFeature[]
    _beslutCache    = (rawBeslut    as FeatureCollection).features as BeslutFeature[]
    _delomradeCache = (rawDelomrade as FeatureCollection).features as DelomradeFeature[]
    // Pre-compute bboxes once at load time
    _skyddsBboxes    = _skyddsCache.map(safeBbox)
    _beslutBboxes    = _beslutCache.map(safeBbox)
    _delomradeBboxes = _delomradeCache.map(safeBbox)
  })
  return _loadPromise
}

export function useSpatialData(): {
  skyddatomraden: SkyddatomradeFeature[]
  beslut: BeslutFeature[]
  delomraden: DelomradeFeature[]
  loading: boolean
} {
  const [loaded, setLoaded] = useState(() => !!(_skyddsCache && _beslutCache && _delomradeCache))
  useEffect(() => {
    if (loaded) return
    loadAll().then(() => setLoaded(true))
  }, [loaded])
  return useMemo(() => ({
    skyddatomraden: _skyddsCache    ?? [],
    beslut:         _beslutCache    ?? [],
    delomraden:     _delomradeCache ?? [],
    loading: !loaded,
  }), [loaded])
}

// ── Generic related-features hook for non-fastigheter ─────────────────────────

export type RelatedResult = {
  skyddatomraden: SkyddatomradeFeature[]
  beslut: BeslutFeature[]
  delomraden: DelomradeFeature[]
}

const _relatedCache = new Map<string, RelatedResult>()

export function useRelatedFeatures(feature: Feature | null): RelatedResult & { loading: boolean } {
  const [loaded, setLoaded] = useState(() => !!(_skyddsCache && _beslutCache && _delomradeCache))
  const [state, setState] = useState<RelatedResult & { loading: boolean }>({
    loading: false, skyddatomraden: [], beslut: [], delomraden: [],
  })
  const computedForIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (loaded) return
    loadAll().then(() => setLoaded(true))
  }, [loaded])

  useEffect(() => {
    const featureType = (feature?.properties as Record<string, string> | null)?.feature_type ?? ''
    if (!feature || !featureType || featureType === 'fastighet') {
      computedForIdRef.current = null
      setState({ loading: false, skyddatomraden: [], beslut: [], delomraden: [] })
      return
    }
    if (!loaded || !_skyddsCache || !_beslutCache || !_delomradeCache || !_skyddsBboxes || !_beslutBboxes || !_delomradeBboxes) {
      setState(prev => ({ ...prev, loading: true }))
      return
    }
    const featureId = (feature.properties as Record<string, string>)?.id ?? ''
    const cacheKey = `${featureType}:${featureId}`
    if (cacheKey && _relatedCache.has(cacheKey)) {
      computedForIdRef.current = cacheKey
      setState({ ..._relatedCache.get(cacheKey)!, loading: false })
      return
    }
    setState(prev => ({ ...prev, loading: true }))
    const timer = setTimeout(() => {
      const fBbox = safeBbox(feature)
      let result: RelatedResult
      if (featureType === 'skyddatomrade') {
        result = {
          skyddatomraden: [],
          beslut:    _beslutCache!.filter((b, i) => bboxOverlaps(fBbox, _beslutBboxes![i]) && intersects(feature, b)),
          delomraden: _delomradeCache!.filter((d, i) => bboxOverlaps(fBbox, _delomradeBboxes![i]) && intersects(feature, d)),
        }
      } else {
        // beslut and delomrade both just look up parent skyddatomraden
        result = {
          skyddatomraden: _skyddsCache!.filter((s, i) => bboxOverlaps(fBbox, _skyddsBboxes![i]) && intersects(feature, s)),
          beslut: [],
          delomraden: [],
        }
      }
      if (cacheKey) {
        _relatedCache.set(cacheKey, result)
        computedForIdRef.current = cacheKey
      }
      setState({ ...result, loading: false })
    }, 0)
    return () => clearTimeout(timer)
  }, [feature, loaded])

  // Synchronous loading detection — same pattern as useSpatialRelations
  const featureType = (feature?.properties as Record<string, string> | null)?.feature_type ?? ''
  const featureId   = (feature?.properties as Record<string, string> | null)?.id ?? null
  const typedKey    = featureId && featureType && featureType !== 'fastighet' ? `${featureType}:${featureId}` : null
  const syncLoading = typedKey !== null && typedKey !== computedForIdRef.current && !_relatedCache.has(typedKey)

  return { ...state, loading: state.loading || syncLoading }
}

// ── Spatial relations for fastigheter ─────────────────────────────────────────

export function useSpatialRelations(feature: Feature | null): SpatialRelations {
  const [loaded, setLoaded] = useState(() => !!(_skyddsCache && _beslutCache && _delomradeCache))
  const [relations, setRelations] = useState<SpatialRelations>({
    skyddatomraden: [], beslut: [], delomraden: [], loading: false,
  })
  // Tracks which feature id was last fully computed — used for synchronous loading detection
  const computedForIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (loaded) return
    loadAll().then(() => setLoaded(true))
  }, [loaded])

  useEffect(() => {
    if (!feature) {
      computedForIdRef.current = null
      setRelations({ skyddatomraden: [], beslut: [], delomraden: [], loading: false })
      return
    }
    if (!loaded || !_skyddsCache || !_beslutCache || !_delomradeCache || !_skyddsBboxes || !_beslutBboxes || !_delomradeBboxes) {
      setRelations(prev => ({ ...prev, loading: true }))
      return
    }

    const cacheKey = (feature.properties as Record<string, string> | null)?.id ?? ''
    if (cacheKey && _resultCache.has(cacheKey)) {
      computedForIdRef.current = cacheKey
      setRelations({ ..._resultCache.get(cacheKey)!, loading: false })
      return
    }

    setRelations(prev => ({ ...prev, loading: true }))

    const timer = setTimeout(() => {
      const fBbox = safeBbox(feature)
      const result = {
        skyddatomraden: _skyddsCache!.filter((s, i) => bboxOverlaps(fBbox, _skyddsBboxes![i]) && intersects(feature, s)),
        beslut:         _beslutCache!.filter((b, i) => bboxOverlaps(fBbox, _beslutBboxes![i]) && intersects(feature, b)),
        delomraden:     _delomradeCache!.filter((d, i) => bboxOverlaps(fBbox, _delomradeBboxes![i]) && intersects(feature, d)),
      }
      if (cacheKey) {
        _resultCache.set(cacheKey, result)
        computedForIdRef.current = cacheKey
      }
      setRelations({ ...result, loading: false })
    }, 0)

    return () => clearTimeout(timer)
  }, [feature, loaded])

  // Derive loading synchronously during render: true whenever the current feature
  // hasn't been computed yet AND isn't in cache. This prevents the 1-frame flash
  // where loading=false briefly before the effect fires.
  const featureId = (feature?.properties as Record<string, string> | null)?.id ?? null
  const syncLoading = featureId !== null &&
    featureId !== computedForIdRef.current &&
    !_resultCache.has(featureId)

  return { ...relations, loading: relations.loading || syncLoading }
}
