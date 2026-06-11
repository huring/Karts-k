import { useEffect } from 'react'
import mapboxgl from 'mapbox-gl'
import { centroid, bbox, booleanPointInPolygon, point } from '@turf/turf'
import type { Feature, FeatureCollection, Polygon, MultiPolygon } from 'geojson'
import type { ObjectTypeKey, AttributeFilters } from './useFilters'

const NO_MATCH: mapboxgl.Expression = ['in', ['get', 'id'], ['literal', []]]

// Cache beslut polygon features by id — used by useMap.flyToFeature for correct bounds
const _beslutById = new Map<string, Feature>()
export function getBeslutFeatureById(id: string): Feature | null {
  return _beslutById.get(id) ?? null
}

// Cache fastigheter features by id — used when opening panel from a building map click
const _fastighetById = new Map<string, Feature>()
export function getFastighetById(id: string): Feature | null {
  return _fastighetById.get(id) ?? null
}

function buildFilter(
  statusVal: string | null,
  extra: mapboxgl.Expression[],
): mapboxgl.Expression {
  const exprs: mapboxgl.Expression[] = []
  if (statusVal) exprs.push(['==', ['get', 'status'], statusVal] as mapboxgl.Expression)
  exprs.push(...extra)
  if (exprs.length === 0) return ['literal', true] as mapboxgl.Expression
  if (exprs.length === 1) return exprs[0]
  return ['all', ...exprs] as mapboxgl.Expression
}

export type HoveredFeature = { id: string; layer: 'fastigheter' | 'skyddsomraden' | 'beslut' } | null

export function useMapLayers(
  mapRef: React.RefObject<mapboxgl.Map | null>,
  isLoaded: boolean,
  activeTypes: Record<ObjectTypeKey, boolean>,
  attributes: AttributeFilters,
  highlightIds: string[] = [],
  selectedId: string | null = null,
  hoveredFeature: HoveredFeature = null,
  selectedBuildingId: string | null = null,
) {
  // Add all sources and layers once on map load
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return
    const map = mapRef.current

    map.addSource('fastigheter',      { type: 'geojson', data: '/data/fastigheter.geojson' })
    map.addSource('skyddsomraden',    { type: 'geojson', data: '/data/skyddsomraden.geojson' })
    map.addSource('beslut',           { type: 'geojson', data: '/data/beslut.geojson' })
    map.addSource('beslut-centroids', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    map.addSource('byggnader',        { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })

    // Populate polygon cache (for flyTo bounds) and centroid source
    fetch('/data/beslut.geojson')
      .then(r => r.json())
      .then((gj: FeatureCollection) => {
        _beslutById.clear()
        gj.features.forEach((f: Feature) => {
          const id = (f.properties as { id?: string }).id
          if (id) _beslutById.set(id, f)
        })
        const src = map.getSource('beslut-centroids') as mapboxgl.GeoJSONSource | undefined
        if (!src) return
        src.setData({
          type: 'FeatureCollection',
          features: gj.features.map((f: Feature) => ({ ...centroid(f), properties: f.properties })),
        })
      })

    // Build building point features — spread within each fastighet polygon
    Promise.all([
      fetch('/data/fastigheter.geojson').then(r => r.json() as Promise<FeatureCollection>),
      fetch('/data/byggnader.json').then(r => r.json() as Promise<{ byggnader: Array<{ id: string; fastighets_id: string }> }>),
    ]).then(([fastGJ, bgData]) => {
      _fastighetById.clear()
      const centroidById = new Map<string, [number, number]>()
      fastGJ.features.forEach((f: Feature) => {
        const id = (f.properties as { id?: string }).id
        if (!id) return
        if (!_fastighetById.has(id)) {
          _fastighetById.set(id, f)
          const c = centroid(f)
          centroidById.set(id, c.geometry.coordinates as [number, number])
        }
      })

      // Group buildings by fastighet, then assign spread positions within the polygon
      const byFastighet = new Map<string, Array<{ id: string; fastighets_id: string }>>()
      bgData.byggnader.forEach(b => {
        const list = byFastighet.get(b.fastighets_id) ?? []
        list.push(b)
        byFastighet.set(b.fastighets_id, list)
      })

      const positionById = new Map<string, [number, number]>()
      byFastighet.forEach((buildings, fastighetId) => {
        const feat = _fastighetById.get(fastighetId)
        const center = centroidById.get(fastighetId)
        if (!feat || !center) return
        const n = buildings.length
        if (n === 1) { positionById.set(buildings[0].id, center); return }
        const [minLng, minLat, maxLng, maxLat] = bbox(feat)
        const w = maxLng - minLng
        const h = maxLat - minLat
        buildings.forEach((b, i) => {
          let placed = false
          for (let frac = 0.3; frac >= 0.02 && !placed; frac -= 0.05) {
            const angle = (i / n) * 2 * Math.PI
            const coords: [number, number] = [
              center[0] + Math.cos(angle) * w * frac,
              center[1] + Math.sin(angle) * h * frac,
            ]
            if (booleanPointInPolygon(point(coords), feat as Feature<Polygon | MultiPolygon>)) {
              positionById.set(b.id, coords)
              placed = true
            }
          }
          if (!placed) positionById.set(b.id, center)
        })
      })

      const bySrc = map.getSource('byggnader') as mapboxgl.GeoJSONSource | undefined
      if (!bySrc) return
      bySrc.setData({
        type: 'FeatureCollection',
        features: bgData.byggnader
          .filter(b => positionById.has(b.id))
          .map(b => ({
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: positionById.get(b.id)! },
            properties: { ...b, feature_type: 'byggnad' },
          })),
      })
    }).catch(err => console.error('[useMapLayers] Failed to load building data:', err))

    // ── Fastigheter ──────────────────────────────────────────────────────────
    map.addLayer({ id: 'fastigheter-fill',      type: 'fill', source: 'fastigheter',
      paint: { 'fill-color': '#405D1A', 'fill-opacity': 0.35 } })
    map.addLayer({ id: 'fastigheter-outline',   type: 'line', source: 'fastigheter',
      paint: { 'line-color': '#013264', 'line-width': 1, 'line-opacity': 0.6 } })
    map.addLayer({ id: 'fastigheter-hover',      type: 'line', source: 'fastigheter',
      paint: { 'line-color': '#1B88E8', 'line-width': 2, 'line-dasharray': [3, 2] }, filter: NO_MATCH })
    map.addLayer({ id: 'fastigheter-highlight', type: 'line', source: 'fastigheter',
      paint: { 'line-color': '#1B88E8', 'line-width': 3 }, filter: NO_MATCH })
    map.addLayer({ id: 'fastigheter-selected',  type: 'fill', source: 'fastigheter',
      paint: { 'fill-color': '#0E4C83', 'fill-opacity': 0.3 }, filter: NO_MATCH })

    // ── Skyddsvärtområden ────────────────────────────────────────────────────
    map.addLayer({ id: 'skyddsomraden-fill',      type: 'fill', source: 'skyddsomraden',
      paint: { 'fill-color': '#F4E28B', 'fill-opacity': 0.4 } })
    map.addLayer({ id: 'skyddsomraden-outline',   type: 'line', source: 'skyddsomraden',
      paint: { 'line-color': '#B8A000', 'line-width': 1.5, 'line-opacity': 0.8 } })
    map.addLayer({ id: 'skyddsomraden-hover',      type: 'line', source: 'skyddsomraden',
      paint: { 'line-color': '#1B88E8', 'line-width': 2, 'line-dasharray': [3, 2] }, filter: NO_MATCH })
    map.addLayer({ id: 'skyddsomraden-highlight', type: 'line', source: 'skyddsomraden',
      paint: { 'line-color': '#1B88E8', 'line-width': 3 }, filter: NO_MATCH })
    map.addLayer({ id: 'skyddsomraden-selected',  type: 'fill', source: 'skyddsomraden',
      paint: { 'fill-color': '#0E4C83', 'fill-opacity': 0.25 }, filter: NO_MATCH })

    // ── Byggnader — punkter (visas från zoom 13) ─────────────────────────────
    map.addLayer({ id: 'byggnader-circle', type: 'circle', source: 'byggnader',
      minzoom: 11,
      paint: {
        'circle-color': '#E3A480',
        'circle-radius': 9,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#FFFFFF',
      },
    })
    map.addLayer({ id: 'byggnader-circle-selected', type: 'circle', source: 'byggnader',
      minzoom: 11,
      paint: {
        'circle-color': '#0E4C83',
        'circle-radius': 9,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#FFFFFF',
      },
      filter: NO_MATCH,
    })

    // Per-type canvas icons — rendered asynchronously after font loads
    const BYGGNAD_ICONS: Array<{ anvandning: string; text: string; name: string }> = [
      { anvandning: 'Bostadsändamål',         text: 'home',        name: 'bgg-home'        },
      { anvandning: 'Kontor/administration',  text: 'business',    name: 'bgg-business'    },
      { anvandning: 'Industriell verksamhet', text: 'factory',     name: 'bgg-factory'     },
      { anvandning: 'Lager/förråd',           text: 'warehouse',   name: 'bgg-warehouse'   },
      { anvandning: 'Lantbruk/stall',         text: 'agriculture', name: 'bgg-agriculture' },
      { anvandning: 'Kulturändamål',          text: 'museum',      name: 'bgg-museum'      },
      { anvandning: 'Besöksanläggning',       text: 'hotel',       name: 'bgg-hotel'       },
      { anvandning: 'Teknisk anläggning',     text: 'bolt',        name: 'bgg-bolt'        },
      { anvandning: '__default__',            text: 'home_work',   name: 'bgg-default'     },
    ]
    document.fonts.load('20px "Material Symbols Outlined"').then(() => {
      if (!map.getSource('byggnader')) return
      const size = 20
      BYGGNAD_ICONS.forEach(({ text, name }) => {
        if (map.hasImage(name)) return
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.fillStyle = '#ffffff'
        ctx.font = `${size}px "Material Symbols Outlined"`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(text, size / 2, size / 2)
        map.addImage(name, ctx.getImageData(0, 0, size, size))
      })
      if (!map.getLayer('byggnader-symbol')) {
        const matchExpr = [
          'match', ['get', 'anvandning'],
          ...BYGGNAD_ICONS.slice(0, -1).flatMap(({ anvandning, name }) => [anvandning, name]),
          'bgg-default',
        ]
        map.addLayer({
          id: 'byggnader-symbol',
          type: 'symbol',
          source: 'byggnader',
          minzoom: 11,
          layout: {
            'icon-image': matchExpr,
            'icon-size': 0.65,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          },
        })
        const baseVis = map.getLayer('byggnader-circle')
          ? map.getLayoutProperty('byggnader-circle', 'visibility')
          : 'visible'
        if (baseVis === 'none') {
          map.setLayoutProperty('byggnader-symbol', 'visibility', 'none')
        }
      }
    })

    // ── Beslut — polygon overlay (visas vid highlight och selected) ──────────
    map.addLayer({ id: 'beslut-area-hover',         type: 'fill', source: 'beslut',
      paint: { 'fill-color': '#638C2F', 'fill-opacity': 0.18 }, filter: NO_MATCH })
    map.addLayer({ id: 'beslut-area-hover-outline', type: 'line', source: 'beslut',
      paint: { 'line-color': '#405D1A', 'line-width': 2, 'line-dasharray': [4, 2] }, filter: NO_MATCH })
    map.addLayer({ id: 'beslut-area-highlight',         type: 'fill', source: 'beslut',
      paint: { 'fill-color': '#1B88E8', 'fill-opacity': 0.12 }, filter: NO_MATCH })
    map.addLayer({ id: 'beslut-area-highlight-outline', type: 'line', source: 'beslut',
      paint: { 'line-color': '#1B88E8', 'line-width': 2 }, filter: NO_MATCH })
    map.addLayer({ id: 'beslut-area-selected',          type: 'fill', source: 'beslut',
      paint: { 'fill-color': '#0E4C83', 'fill-opacity': 0.25 }, filter: NO_MATCH })
    map.addLayer({ id: 'beslut-area-selected-outline',  type: 'line', source: 'beslut',
      paint: { 'line-color': '#013264', 'line-width': 2.5 }, filter: NO_MATCH })

    // ── Beslut — punkt-ikon (alltid synlig) ──────────────────────────────────
    map.addLayer({ id: 'beslut-circle-highlight', type: 'circle', source: 'beslut-centroids',
      paint: {
        'circle-color': 'rgba(0,0,0,0)',
        'circle-radius': 14,
        'circle-stroke-width': 3,
        'circle-stroke-color': '#1B88E8',
      },
      filter: NO_MATCH,
    })
    map.addLayer({ id: 'beslut-circle', type: 'circle', source: 'beslut-centroids',
      paint: {
        'circle-color': '#638C2F',
        'circle-radius': 10,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#FFFFFF',
      },
    })
    map.addLayer({ id: 'beslut-circle-selected', type: 'circle', source: 'beslut-centroids',
      paint: {
        'circle-color': '#0E4C83',
        'circle-radius': 10,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#FFFFFF',
      },
      filter: NO_MATCH,
    })

    // ── Beslut — gavel-ikon via Material Symbols canvas (asynk) ─────────────
    document.fonts.load('16px "Material Symbols Outlined"').then(() => {
      if (!map.getSource('beslut-centroids')) return
      const size = 24
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.fillStyle = '#ffffff'
      ctx.font = `${size}px "Material Symbols Outlined"`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('', size / 2, size / 2)
      if (!map.hasImage('beslut-gavel')) {
        map.addImage('beslut-gavel', ctx.getImageData(0, 0, size, size))
      }
      if (!map.getLayer('beslut-symbol')) {
        map.addLayer({
          id: 'beslut-symbol',
          type: 'symbol',
          source: 'beslut-centroids',
          layout: {
            'icon-image': 'beslut-gavel',
            'icon-size': 0.7,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          },
        })
        // Sync visibility with current beslut toggle state
        const baseVis = map.getLayer('beslut-circle')
          ? map.getLayoutProperty('beslut-circle', 'visibility')
          : 'visible'
        if (baseVis === 'none') {
          map.setLayoutProperty('beslut-symbol', 'visibility', 'none')
        }
      }
    })

    return () => {
      const m = mapRef.current
      if (!m) return
      const layers = [
        'fastigheter-fill', 'fastigheter-outline', 'fastigheter-hover', 'fastigheter-highlight', 'fastigheter-selected',
        'skyddsomraden-fill', 'skyddsomraden-outline', 'skyddsomraden-hover', 'skyddsomraden-highlight', 'skyddsomraden-selected',
        'byggnader-circle', 'byggnader-circle-selected', 'byggnader-symbol',
        'beslut-area-hover', 'beslut-area-hover-outline',
        'beslut-area-highlight', 'beslut-area-highlight-outline',
        'beslut-area-selected', 'beslut-area-selected-outline',
        'beslut-circle-highlight', 'beslut-circle', 'beslut-circle-selected', 'beslut-symbol',
      ]
      layers.forEach(id => { if (m.getLayer(id)) m.removeLayer(id) })
      if (m.hasImage('beslut-gavel')) m.removeImage('beslut-gavel')
      ;['bgg-home','bgg-business','bgg-factory','bgg-warehouse','bgg-agriculture','bgg-museum','bgg-hotel','bgg-bolt','bgg-default']
        .forEach(name => { if (m.hasImage(name)) m.removeImage(name) })
      ;['fastigheter', 'skyddsomraden', 'beslut', 'beslut-centroids', 'byggnader']
        .forEach(id => { if (m.getSource(id)) m.removeSource(id) })
    }
  }, [isLoaded, mapRef])

  // Layer visibility controlled by type chips
  useEffect(() => {
    const map = mapRef.current
    if (!map || !isLoaded) return
    const setVis = (ids: string[], on: boolean) => {
      const v = on ? 'visible' : 'none'
      ids.forEach(id => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', v) })
    }
    setVis(['fastigheter-fill', 'fastigheter-outline', 'fastigheter-hover', 'fastigheter-highlight'],       activeTypes.fastigheter)
    setVis(['skyddsomraden-fill', 'skyddsomraden-outline', 'skyddsomraden-hover', 'skyddsomraden-highlight'], activeTypes.skyddsomraden)
    setVis(['byggnader-circle', 'byggnader-circle-selected', 'byggnader-symbol'], activeTypes.byggnader)
    setVis([
      'beslut-area-hover', 'beslut-area-hover-outline',
      'beslut-area-highlight', 'beslut-area-highlight-outline',
      'beslut-area-selected', 'beslut-area-selected-outline',
      'beslut-circle-highlight', 'beslut-circle', 'beslut-circle-selected', 'beslut-symbol',
    ], activeTypes.beslut)
  }, [activeTypes.fastigheter, activeTypes.skyddsomraden, activeTypes.beslut, activeTypes.byggnader, mapRef, isLoaded])

  // Attribute filters applied to base layers
  useEffect(() => {
    const map = mapRef.current
    if (!map || !isLoaded) return

    const kommunExpr: mapboxgl.Expression[] = attributes.kommunnamn
      ? [['==', ['get', 'kommunnamn'], attributes.kommunnamn] as mapboxgl.Expression] : []
    const skyddstypExpr: mapboxgl.Expression[] = attributes.skyddstyp
      ? [['==', ['get', 'skyddstyp'], attributes.skyddstyp] as mapboxgl.Expression] : []

    const fastFilter   = buildFilter(attributes.status, kommunExpr)
    const skyddsFilter = buildFilter(attributes.status, skyddstypExpr)
    const beslutFilter = buildFilter(attributes.status, [])

    ;(['fastigheter-fill', 'fastigheter-outline'] as const).forEach(id => {
      if (map.getLayer(id)) map.setFilter(id, fastFilter)
    })
    ;(['skyddsomraden-fill', 'skyddsomraden-outline'] as const).forEach(id => {
      if (map.getLayer(id)) map.setFilter(id, skyddsFilter)
    })
    if (map.getLayer('beslut-circle')) map.setFilter('beslut-circle', beslutFilter)
  }, [attributes.status, attributes.skyddstyp, attributes.kommunnamn, mapRef, isLoaded])

  // Search / spatial highlight
  useEffect(() => {
    const map = mapRef.current
    if (!map || !isLoaded) return
    const filter: mapboxgl.Expression = highlightIds.length > 0
      ? ['in', ['get', 'id'], ['literal', highlightIds]]
      : NO_MATCH
    ;[
      'fastigheter-highlight', 'skyddsomraden-highlight',
      'beslut-area-highlight', 'beslut-area-highlight-outline', 'beslut-circle-highlight',
    ].forEach(id => { if (map.getLayer(id)) map.setFilter(id, filter) })
  }, [highlightIds, mapRef, isLoaded])

  // Selected feature highlight
  useEffect(() => {
    const map = mapRef.current
    if (!map || !isLoaded) return
    const filter: mapboxgl.Expression = selectedId
      ? (['==', ['get', 'id'], selectedId] as mapboxgl.Expression)
      : NO_MATCH
    ;[
      'fastigheter-selected', 'skyddsomraden-selected',
      'beslut-area-selected', 'beslut-area-selected-outline', 'beslut-circle-selected',
    ].forEach(id => { if (map.getLayer(id)) map.setFilter(id, filter) })
  }, [selectedId, mapRef, isLoaded])

  // Hover outline for all layers
  useEffect(() => {
    const map = mapRef.current
    if (!map || !isLoaded) return

    const fastFilter  = hoveredFeature?.layer === 'fastigheter'
      ? (['==', ['get', 'id'], hoveredFeature.id] as mapboxgl.Expression) : NO_MATCH
    const skyddsFilter = hoveredFeature?.layer === 'skyddsomraden'
      ? (['==', ['get', 'id'], hoveredFeature.id] as mapboxgl.Expression) : NO_MATCH
    const beslutFilter = hoveredFeature?.layer === 'beslut'
      ? (['==', ['get', 'id'], hoveredFeature.id] as mapboxgl.Expression) : NO_MATCH

    if (map.getLayer('fastigheter-hover'))        map.setFilter('fastigheter-hover', fastFilter)
    if (map.getLayer('skyddsomraden-hover'))      map.setFilter('skyddsomraden-hover', skyddsFilter)
    if (map.getLayer('beslut-area-hover'))        map.setFilter('beslut-area-hover', beslutFilter)
    if (map.getLayer('beslut-area-hover-outline')) map.setFilter('beslut-area-hover-outline', beslutFilter)
  }, [hoveredFeature, mapRef, isLoaded])

  // Selected building highlight
  useEffect(() => {
    const map = mapRef.current
    if (!map || !isLoaded) return
    const filter: mapboxgl.Expression = selectedBuildingId
      ? (['==', ['get', 'id'], selectedBuildingId] as mapboxgl.Expression)
      : NO_MATCH
    if (map.getLayer('byggnader-circle-selected')) map.setFilter('byggnader-circle-selected', filter)
  }, [selectedBuildingId, mapRef, isLoaded])
}
