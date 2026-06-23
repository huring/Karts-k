import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import * as turf from '@turf/turf'
import type { Feature, FeatureCollection } from 'geojson'
import type { FastighetProperties, SkyddatomradeProperties, BeslutProperties, DelomradeProperties, FastighetMeta } from '../types'
import type { ObjectTypeKey, AttributeFilters } from './useFilters'

export type SearchResultLayer = 'fastigheter' | 'skyddatomraden' | 'beslut' | 'delomraden' | 'byggnader'

export type SearchResult = {
  id: string
  label: string
  subLabel: string
  layer: SearchResultLayer
  feature: Feature
}

export type FilterOptions = {
  status:     string[]
  typ:        string[]
  kommunnamn: string[]
  skick:      string[]
  anvandning: string[]
}

export type SearchTypeCounts = Record<'fastigheter' | 'skyddatomraden' | 'beslut' | 'delomraden' | 'byggnader', number>

function deduplicateById(items: SearchResult[]): SearchResult[] {
  const seen = new Set<string>()
  return items.filter(item => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

function unique(vals: (string | null | undefined)[]): string[] {
  return [...new Set(vals.filter((v): v is string => typeof v === 'string' && v.length > 0))].sort()
}

export function computeFilterOptions(items: SearchResult[]): FilterOptions {
  return {
    status: unique([
      ...items.filter(i => i.layer === 'skyddatomraden').map(i => (i.feature.properties as SkyddatomradeProperties).status),
      ...items.filter(i => i.layer === 'beslut').map(i => (i.feature.properties as BeslutProperties).status),
      ...items.filter(i => i.layer === 'delomraden').map(i => (i.feature.properties as DelomradeProperties).status),
      ...items.filter(i => i.layer === 'fastigheter').map(i => (i.feature.properties as FastighetProperties).status ?? ''),
    ]),
    typ:        unique(items.filter(i => i.layer === 'skyddatomraden').map(i => (i.feature.properties as SkyddatomradeProperties).typ)),
    kommunnamn: unique(items.filter(i => i.layer === 'fastigheter').map(i => (i.feature.properties as FastighetProperties).kommunnamn)),
    skick:      unique(items.filter(i => i.layer === 'byggnader').map(i => (i.feature.properties as Record<string, string>).skick)),
    anvandning: unique(items.filter(i => i.layer === 'byggnader').map(i => (i.feature.properties as Record<string, string>).anvandning)),
  }
}

function matchesText(item: SearchResult, q: string): boolean {
  const p = item.feature.properties as Record<string, unknown>
  const fields: (string | undefined | null)[] =
    item.layer === 'fastigheter'
      ? [p.beteckning as string, p.trakt as string, p.kommunnamn as string, p.blockenhet as string]
    : item.layer === 'skyddatomraden'
      ? [p.namn as string, p.id as string, p.typ as string, p.status as string]
    : item.layer === 'beslut'
      ? [p.id as string, p.status as string]
    : item.layer === 'delomraden'
      ? [p.id as string, p.status as string]
    : [p.namn as string, p.anvandning as string, p.skick as string, p.id as string]
  return fields.some(v => v?.toLowerCase().includes(q))
}

export function useSearch(
  mapRef: React.RefObject<mapboxgl.Map | null>,
  activeTypes: Record<ObjectTypeKey, boolean>,
  attributes: AttributeFilters,
) {
  const [query, setQueryState] = useState('')
  const [committedQuery, setCommittedQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [suggestions, setSuggestions] = useState<SearchResult[]>([])
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ status: [], typ: [], kommunnamn: [], skick: [], anvandning: [] })
  const [typeCounts, setTypeCounts] = useState<SearchTypeCounts | null>(null)
  const allFeaturesRef = useRef<SearchResult[]>([])
  const [dataLoaded, setDataLoaded] = useState(false)

  const setQuery = (q: string) => {
    setQueryState(q)
    if (!q.trim()) setCommittedQuery('')
  }

  const commitSearch = () => setCommittedQuery(query)

  useEffect(() => {
    Promise.all([
      fetch('/data/fastigheter.geojson').then(r => r.json()),
      fetch('/data/skyddatomraden.geojson').then(r => r.json()),
      fetch('/data/beslut.geojson').then(r => r.json()),
      fetch('/data/delomraden.geojson').then(r => r.json()),
      fetch('/data/byggnader.json').then(r => r.json()),
      fetch('/data/fastigheter_meta.json').then(r => r.json()),
    ]).then(([rawFast, rawSkydds, rawBeslut, rawDelomrade, rawByggnader, rawMeta]) => {
      const fast        = rawFast        as FeatureCollection
      const skydds      = rawSkydds      as FeatureCollection
      const beslut      = rawBeslut      as FeatureCollection
      const delomrade   = rawDelomrade   as FeatureCollection
      const bgData      = rawByggnader   as { byggnader: Array<{ id: string; fastighets_id: string; namn: string; anvandning: string; skick: string }> }
      const metaMap     = (rawMeta as { meta: Record<string, FastighetMeta> }).meta

      fast.features.forEach((f: Feature) => {
        const id = (f.properties as FastighetProperties).id
        const m = id ? metaMap[id] : null
        if (m && f.properties) Object.assign(f.properties, m)
      })

      const centroidById = new Map<string, [number, number]>()
      fast.features.forEach(f => {
        const id = (f.properties as FastighetProperties).id
        if (id && !centroidById.has(id)) {
          const c = turf.centroid(f)
          centroidById.set(id, c.geometry.coordinates as [number, number])
        }
      })

      const fastItems: SearchResult[] = fast.features.map(f => {
        const p = f.properties as FastighetProperties
        return { id: p.id, label: p.beteckning, subLabel: `${p.trakt} · ${p.kommunnamn}`, layer: 'fastigheter' as const, feature: f }
      })
      const skyddsItems: SearchResult[] = skydds.features.map(f => {
        const p = f.properties as SkyddatomradeProperties
        return { id: p.id, label: p.namn, subLabel: `${p.id} · ${p.typ}`, layer: 'skyddatomraden' as const, feature: f }
      })
      const beslutItems: SearchResult[] = beslut.features.map(f => {
        const p = f.properties as BeslutProperties
        return { id: p.id, label: p.id, subLabel: p.status, layer: 'beslut' as const, feature: f }
      })
      const delomradeItems: SearchResult[] = delomrade.features.map(f => {
        const p = f.properties as DelomradeProperties
        return { id: p.id, label: p.id, subLabel: p.status, layer: 'delomraden' as const, feature: f }
      })
      const byggnadItems: SearchResult[] = bgData.byggnader
        .filter(b => centroidById.has(b.fastighets_id))
        .map(b => ({
          id: b.id,
          label: b.namn,
          subLabel: `${b.anvandning} · ${b.skick}`,
          layer: 'byggnader' as const,
          feature: {
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: centroidById.get(b.fastighets_id)! },
            properties: { ...b, feature_type: 'byggnad' },
          },
        }))

      allFeaturesRef.current = [
        ...deduplicateById(fastItems),
        ...deduplicateById(skyddsItems),
        ...deduplicateById(beslutItems),
        ...deduplicateById(delomradeItems),
        ...byggnadItems,
      ]
      setFilterOptions(computeFilterOptions(allFeaturesRef.current))
      setDataLoaded(true)
    })
  }, [])

  useEffect(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2 || !dataLoaded) { setSuggestions([]); return }
    const matches = allFeaturesRef.current.filter(item => matchesText(item, q))
    setSuggestions(matches.slice(0, 6))
  }, [query, dataLoaded])

  useEffect(() => {
    if (allFeaturesRef.current.length === 0) return

    const q = committedQuery.trim().toLowerCase()

    if (!q) {
      setResults([])
      setTypeCounts(null)
      setFilterOptions(computeFilterOptions(allFeaturesRef.current))
      return
    }

    const textItems = allFeaturesRef.current.filter(item => matchesText(item, q))

    setTypeCounts({
      fastigheter:    textItems.filter(i => i.layer === 'fastigheter').length,
      skyddatomraden: textItems.filter(i => i.layer === 'skyddatomraden').length,
      beslut:         textItems.filter(i => i.layer === 'beslut').length,
      delomraden:     textItems.filter(i => i.layer === 'delomraden').length,
      byggnader:      textItems.filter(i => i.layer === 'byggnader').length,
    })

    const items = textItems.filter(item => activeTypes[item.layer])
    setFilterOptions(computeFilterOptions(items))
    setResults(items)
  }, [committedQuery, activeTypes])

  useEffect(() => {
    if (!results.length || !mapRef.current || committedQuery.trim().length < 2) return
    const timer = setTimeout(() => {
      const [minLng, minLat, maxLng, maxLat] = turf.bbox(turf.featureCollection(results.map(r => r.feature)))
      mapRef.current?.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 80, maxZoom: 13, duration: 500 })
    }, 300)
    return () => clearTimeout(timer)
  }, [results, committedQuery, mapRef])

  const hasActiveQuery = committedQuery.trim().length > 0

  return { query, setQuery, results, suggestions, hasActiveQuery, filterOptions, typeCounts, commitSearch, allFeaturesRef }
}
