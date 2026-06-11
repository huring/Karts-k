import { useEffect, useMemo, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import * as turf from '@turf/turf'
import type { Feature, FeatureCollection } from 'geojson'
import type { FastighetProperties, SkyddsomradeProperties, BeslutProperties } from '../types'
import type { ObjectTypeKey, AttributeFilters } from './useFilters'

export type SearchResultLayer = 'fastigheter' | 'skyddsomraden' | 'beslut' | 'byggnader'

export type SearchResult = {
  id: string
  label: string
  subLabel: string
  layer: SearchResultLayer
  feature: Feature
}

export type FilterOptions = {
  status:      string[]
  skyddstyp:   string[]
  kommunnamn:  string[]
  skick:       string[]
  anvandning:  string[]
}

// Per-type hit counts from the current text query (before type/attribute filters)
export type SearchTypeCounts = Record<'fastigheter' | 'skyddsomraden' | 'beslut' | 'byggnader', number>

function unique(vals: (string | null | undefined)[]): string[] {
  return [...new Set(vals.filter((v): v is string => typeof v === 'string' && v.length > 0))].sort()
}

function computeFilterOptions(items: SearchResult[]): FilterOptions {
  return {
    status: unique([
      ...items.filter(i => i.layer === 'skyddsomraden').map(i => (i.feature.properties as SkyddsomradeProperties).status),
      ...items.filter(i => i.layer === 'beslut').map(i => (i.feature.properties as BeslutProperties).status),
    ]),
    skyddstyp:  unique(items.filter(i => i.layer === 'skyddsomraden').map(i => (i.feature.properties as SkyddsomradeProperties).skyddstyp)),
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
    : item.layer === 'skyddsomraden'
      ? [p.namn as string, p.id as string, p.skyddstyp as string, p.status as string]
    : item.layer === 'byggnader'
      ? [p.namn as string, p.anvandning as string, p.skick as string, p.id as string]
    : [p.namn as string, p.id as string, p.typ as string, p.status as string]
  return fields.some(v => v?.toLowerCase().includes(q))
}

export function useSearch(
  mapRef: React.RefObject<mapboxgl.Map | null>,
  activeTypes: Record<ObjectTypeKey, boolean>,
  attributes: AttributeFilters,
) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ status: [], skyddstyp: [], kommunnamn: [], skick: [], anvandning: [] })
  const [typeCounts, setTypeCounts] = useState<SearchTypeCounts | null>(null)
  const allFeaturesRef = useRef<SearchResult[]>([])

  useEffect(() => {
    Promise.all([
      fetch('/data/fastigheter.geojson').then(r => r.json()),
      fetch('/data/skyddsomraden.geojson').then(r => r.json()),
      fetch('/data/beslut.geojson').then(r => r.json()),
      fetch('/data/byggnader.json').then(r => r.json()),
    ]).then(([rawFast, rawSkydds, rawBeslut, rawByggnader]) => {
      const fast       = rawFast       as FeatureCollection
      const skydds     = rawSkydds     as FeatureCollection
      const beslut     = rawBeslut     as FeatureCollection
      const bgData     = rawByggnader  as { byggnader: Array<{ id: string; fastighets_id: string; namn: string; anvandning: string; skick: string }> }

      // Build centroid lookup for placing building points
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
        const p = f.properties as SkyddsomradeProperties
        return { id: p.id, label: p.namn, subLabel: `${p.id} · ${p.skyddstyp}`, layer: 'skyddsomraden' as const, feature: f }
      })
      const beslutItems: SearchResult[] = beslut.features.map(f => {
        const p = f.properties as BeslutProperties
        return { id: p.id, label: p.namn, subLabel: `${p.id} · ${p.typ}`, layer: 'beslut' as const, feature: f }
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

      allFeaturesRef.current = [...fastItems, ...skyddsItems, ...beslutItems, ...byggnadItems]
      setFilterOptions(computeFilterOptions(allFeaturesRef.current))
    })
  }, [])

  useEffect(() => {
    if (allFeaturesRef.current.length === 0) return

    const q = query.trim().toLowerCase()
    const hasAttributeFilter = Object.values(attributes).some(arr => arr.length > 0)

    if (!q && !hasAttributeFilter) {
      setResults([])
      setTypeCounts(null)
      setFilterOptions(computeFilterOptions(allFeaturesRef.current))
      return
    }

    // Stage 1: text filter across all types
    const textItems = q
      ? allFeaturesRef.current.filter(item => matchesText(item, q))
      : allFeaturesRef.current

    // Type counts before type-toggle filter — drives chip badges and dimming
    setTypeCounts({
      fastigheter:   textItems.filter(i => i.layer === 'fastigheter').length,
      skyddsomraden: textItems.filter(i => i.layer === 'skyddsomraden').length,
      beslut:        textItems.filter(i => i.layer === 'beslut').length,
      byggnader:     textItems.filter(i => i.layer === 'byggnader').length,
    })

    // Stage 2: type toggle filter
    let items = textItems.filter(item => activeTypes[item.layer])

    // Dynamic attribute options — only values present in text+type filtered set
    setFilterOptions(computeFilterOptions(items))

    // Stage 3: attribute filters (each is an OR within the group, skipped if empty)
    if (attributes.status.length > 0) {
      const set = attributes.status
      items = items.filter(item =>
        !['skyddsomraden', 'beslut'].includes(item.layer) ||
        set.includes((item.feature.properties as Record<string, string>).status),
      )
    }
    if (attributes.skyddstyp.length > 0) {
      const set = attributes.skyddstyp
      items = items.filter(item =>
        item.layer !== 'skyddsomraden' ||
        set.includes((item.feature.properties as SkyddsomradeProperties).skyddstyp),
      )
    }
    if (attributes.kommunnamn.length > 0) {
      const set = attributes.kommunnamn
      items = items.filter(item =>
        item.layer !== 'fastigheter' ||
        set.includes((item.feature.properties as FastighetProperties).kommunnamn),
      )
    }
    if (attributes.skick.length > 0) {
      const set = attributes.skick
      items = items.filter(item =>
        item.layer !== 'byggnader' ||
        set.includes((item.feature.properties as Record<string, string>).skick),
      )
    }
    if (attributes.anvandning.length > 0) {
      const set = attributes.anvandning
      items = items.filter(item =>
        item.layer !== 'byggnader' ||
        set.includes((item.feature.properties as Record<string, string>).anvandning),
      )
    }

    setResults(items)
  }, [query, activeTypes, attributes])

  // Zoom to bounding box of results (debounced 300 ms)
  useEffect(() => {
    if (!results.length || !mapRef.current || query.trim().length < 2) return
    const timer = setTimeout(() => {
      const [minLng, minLat, maxLng, maxLat] = turf.bbox(turf.featureCollection(results.map(r => r.feature)))
      mapRef.current?.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 80, maxZoom: 13, duration: 500 })
    }, 300)
    return () => clearTimeout(timer)
  }, [results, query, mapRef])

  const highlightIds = useMemo(() => results.map(r => r.id), [results])

  const hasActiveQuery =
    query.trim().length > 0 ||
    Object.values(attributes).some(arr => arr.length > 0)

  return { query, setQuery, results, highlightIds, hasActiveQuery, filterOptions, typeCounts }
}
