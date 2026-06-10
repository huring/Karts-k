import { useEffect, useMemo, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import * as turf from '@turf/turf'
import type { Feature, FeatureCollection } from 'geojson'
import type { FastighetProperties, ByggnadsProperties } from '../types'
import type { ObjectTypeKey, AttributeFilters } from './useFilters'

export type SearchResultLayer = 'fastigheter' | 'byggnader'

export type SearchResult = {
  id: string
  label: string
  subLabel: string
  layer: SearchResultLayer
  feature: Feature
}

export function useSearch(
  mapRef: React.RefObject<mapboxgl.Map | null>,
  activeTypes: Record<ObjectTypeKey, boolean>,
  attributes: AttributeFilters,
) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const allFeaturesRef = useRef<SearchResult[]>([])

  useEffect(() => {
    Promise.all([
      fetch('/data/fastigheter.geojson').then(r => r.json()),
      fetch('/data/byggnader.geojson').then(r => r.json()),
    ]).then(([rawFast, rawBygg]) => {
      const fast = rawFast as FeatureCollection
      const bygg = rawBygg as FeatureCollection

      const fastItems: SearchResult[] = fast.features.map((f: Feature) => {
        const p = f.properties as FastighetProperties
        return {
          id: p.id,
          label: p.beteckning,
          subLabel: p.namn ?? p.markslag,
          layer: 'fastigheter',
          feature: f,
        }
      })

      const byggItems: SearchResult[] = bygg.features.map((f: Feature) => {
        const p = f.properties as ByggnadsProperties
        return {
          id: p.id,
          label: p.id,
          subLabel: p.byggnadstyp,
          layer: 'byggnader',
          feature: f,
        }
      })

      allFeaturesRef.current = [...fastItems, ...byggItems]
    })
  }, [])

  useEffect(() => {
    const q = query.trim().toLowerCase()
    const hasAttributeFilter = attributes.status !== null || attributes.markslag !== null

    if (!q && !hasAttributeFilter) {
      setResults([])
      return
    }

    let items = allFeaturesRef.current

    // Type filter — only show results from enabled layers
    items = items.filter(item => activeTypes[item.layer])

    // Text search
    if (q) {
      items = items.filter(
        item =>
          item.label.toLowerCase().includes(q) ||
          item.subLabel.toLowerCase().includes(q),
      )
    }

    // Status attribute filter
    if (attributes.status) {
      const s = attributes.status
      items = items.filter(item => {
        const props = item.feature.properties as Record<string, unknown>
        return props.status === s
      })
    }

    // Markslag filter applies to fastigheter only
    if (attributes.markslag) {
      const m = attributes.markslag
      items = items.filter(item => {
        if (item.layer !== 'fastigheter') return true
        const props = item.feature.properties as Record<string, unknown>
        return props.markslag === m
      })
    }

    setResults(items)
  }, [query, activeTypes, attributes])

  // Zoom to bounding box of results (debounced 300ms)
  useEffect(() => {
    if (!results.length || !mapRef.current || query.trim().length < 2) return
    const timer = setTimeout(() => {
      const collection = turf.featureCollection(results.map(r => r.feature))
      const [minLng, minLat, maxLng, maxLat] = turf.bbox(collection)
      mapRef.current?.fitBounds([[minLng, minLat], [maxLng, maxLat]], {
        padding: 80,
        maxZoom: 13,
        duration: 500,
      })
    }, 300)
    return () => clearTimeout(timer)
  }, [results, query, mapRef])

  const highlightIds = useMemo(() => results.map(r => r.id), [results])

  const hasActiveQuery =
    query.trim().length > 0 ||
    attributes.status !== null ||
    attributes.markslag !== null

  return { query, setQuery, results, highlightIds, hasActiveQuery }
}
