import { useEffect, useMemo, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import * as turf from '@turf/turf'
import type { Feature, FeatureCollection, Point, Polygon, MultiPolygon } from 'geojson'
import type { FastighetProperties, SkyddsomradeProperties, BeslutProperties } from '../types'
import type { SearchResult } from './useSearch'

export type ToolMode = 'none' | 'distance' | 'area' | 'spatial-search' | 'buffer'

const EMPTY_FC: FeatureCollection = { type: 'FeatureCollection', features: [] }

function setSourceData(map: mapboxgl.Map, id: string, data: object) {
  const src = map.getSource(id) as mapboxgl.GeoJSONSource | undefined
  src?.setData(data as Parameters<mapboxgl.GeoJSONSource['setData']>[0])
}

export function useMapTools(
  mapRef: React.RefObject<mapboxgl.Map | null>,
  drawRef: React.RefObject<MapboxDraw | null>,
  isLoaded: boolean,
) {
  const [activeTool, setActiveTool] = useState<ToolMode>('none')
  const [distancePoints, setDistancePoints] = useState<[number, number][]>([])
  const [areaM2, setAreaM2] = useState<number | null>(null)
  const [spatialResults, setSpatialResults] = useState<SearchResult[]>([])
  const [searchPolygonDrawn, setSearchPolygonDrawn] = useState(false)
  const [bufferCenter, setBufferCenter] = useState<Feature | null>(null)
  const [bufferRadiusM, setBufferRadiusM] = useState(500)
  const [bufferResults, setBufferResults] = useState<SearchResult[]>([])

  const activeToolRef    = useRef<ToolMode>('none')
  const distancePointsRef = useRef<[number, number][]>([])
  const allFeaturesRef   = useRef<SearchResult[]>([])

  useEffect(() => { activeToolRef.current = activeTool }, [activeTool])
  useEffect(() => { distancePointsRef.current = distancePoints }, [distancePoints])

  // Load all GeoJSON sources for spatial queries
  useEffect(() => {
    Promise.all([
      fetch('/data/fastigheter.geojson').then(r => r.json()),
      fetch('/data/skyddsomraden.geojson').then(r => r.json()),
      fetch('/data/beslut.geojson').then(r => r.json()),
      fetch('/data/byggnader.json').then(r => r.json()),
    ]).then(([rawFast, rawSkydds, rawBeslut, rawByggnader]) => {
      const fast   = rawFast   as FeatureCollection
      const skydds = rawSkydds as FeatureCollection
      const beslut = rawBeslut as FeatureCollection
      const bgData = rawByggnader as { byggnader: Array<{ id: string; fastighets_id: string; namn: string; anvandning: string; skick: string }> }

      // Build centroid lookup from fastigheter (for placing building points)
      const centroidById = new Map<string, [number, number]>()
      fast.features.forEach(f => {
        const id = (f.properties as { id?: string }).id
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
    })
  }, [])

  // Add measure/search/buffer Mapbox sources and layers
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return
    const map = mapRef.current

    const sources: string[] = ['measure-line', 'measure-preview', 'measure-points', 'search-area', 'buffer']
    sources.forEach(id => map.addSource(id, { type: 'geojson', data: EMPTY_FC }))

    map.addLayer({ id: 'measure-line-layer',    type: 'line',   source: 'measure-line',
      paint: { 'line-color': '#E63935', 'line-width': 2 } })
    map.addLayer({ id: 'measure-preview-layer', type: 'line',   source: 'measure-preview',
      paint: { 'line-color': '#E63935', 'line-width': 1.5, 'line-dasharray': [4, 3] } })
    map.addLayer({ id: 'measure-points-layer',  type: 'circle', source: 'measure-points',
      paint: { 'circle-color': '#E63935', 'circle-radius': 5, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } })
    map.addLayer({ id: 'search-area-fill', type: 'fill', source: 'search-area',
      paint: { 'fill-color': '#5CA3EC', 'fill-opacity': 0.12 } })
    map.addLayer({ id: 'search-area-line', type: 'line', source: 'search-area',
      paint: { 'line-color': '#1B88E8', 'line-width': 2, 'line-dasharray': [5, 3] } })
    map.addLayer({ id: 'buffer-fill', type: 'fill', source: 'buffer',
      paint: { 'fill-color': '#638C2F', 'fill-opacity': 0.12 } })
    map.addLayer({ id: 'buffer-line', type: 'line', source: 'buffer',
      paint: { 'line-color': '#638C2F', 'line-width': 2 } })

    return () => {
      const m = mapRef.current
      if (!m) return
      ['measure-line-layer', 'measure-preview-layer', 'measure-points-layer',
        'search-area-fill', 'search-area-line', 'buffer-fill', 'buffer-line',
      ].forEach(id => { if (m.getLayer(id)) m.removeLayer(id) })
      sources.forEach(id => { if (m.getSource(id)) m.removeSource(id) })
    }
  }, [isLoaded, mapRef])

  // Set up event listeners for the active tool
  useEffect(() => {
    const map = mapRef.current
    const draw = drawRef.current
    if (!map || !draw || !isLoaded) return

    map.getCanvas().style.cursor = activeTool !== 'none' ? 'crosshair' : ''

    const onDistanceClick = (e: mapboxgl.MapMouseEvent) => {
      const pt: [number, number] = [e.lngLat.lng, e.lngLat.lat]
      setDistancePoints(prev => { const next = [...prev, pt]; distancePointsRef.current = next; return next })
    }

    const onDistanceMouseMove = (e: mapboxgl.MapMouseEvent) => {
      const pts = distancePointsRef.current
      if (pts.length === 0) return
      setSourceData(map, 'measure-preview', turf.lineString([pts[pts.length - 1], [e.lngLat.lng, e.lngLat.lat]]))
    }

    const onDrawCreate = (e: object) => {
      const feature = (e as { features: Feature[] }).features[0]
      if (!feature?.geometry || feature.geometry.type !== 'Polygon') return
      const polygon = feature as Feature<Polygon>

      if (activeToolRef.current === 'area') {
        setAreaM2(turf.area(polygon))
      } else if (activeToolRef.current === 'spatial-search') {
        setSourceData(map, 'search-area', turf.featureCollection([polygon]))
        draw.deleteAll()
        draw.changeMode('simple_select')
        setSpatialResults(runIntersection(polygon))
        setSearchPolygonDrawn(true)
      }
    }

    const onBufferClick = (e: mapboxgl.MapMouseEvent) => {
      const feats = map.queryRenderedFeatures(e.point, {
        layers: ['fastigheter-fill', 'skyddsomraden-fill', 'beslut-circle'],
      })
      if (feats.length === 0) return
      const f = feats[0]
      setBufferCenter({ type: 'Feature', geometry: f.geometry, properties: f.properties })
    }

    if (activeTool === 'distance') {
      map.on('click', onDistanceClick)
      map.on('mousemove', onDistanceMouseMove)
    }
    if (activeTool === 'area' || activeTool === 'spatial-search') {
      draw.changeMode('draw_polygon')
      map.on('draw.create', onDrawCreate as (e: object) => void)
    }
    if (activeTool === 'buffer') map.on('click', onBufferClick)

    return () => {
      map.getCanvas().style.cursor = ''
      map.off('click', onDistanceClick)
      map.off('mousemove', onDistanceMouseMove)
      map.off('draw.create', onDrawCreate as (e: object) => void)
      map.off('click', onBufferClick)
      if (activeTool === 'area' || activeTool === 'spatial-search') draw.changeMode('simple_select')
    }
  }, [activeTool, mapRef, drawRef, isLoaded])

  // Sync measure line/points sources when distancePoints changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.getSource('measure-line')) return
    if (distancePoints.length >= 2) {
      setSourceData(map, 'measure-line', turf.lineString(distancePoints))
    } else {
      setSourceData(map, 'measure-line', EMPTY_FC)
      setSourceData(map, 'measure-preview', EMPTY_FC)
    }
    setSourceData(map, 'measure-points',
      distancePoints.length > 0
        ? turf.featureCollection(distancePoints.map(p => turf.point(p)))
        : EMPTY_FC,
    )
  }, [distancePoints, mapRef])

  const distanceTotalM = useMemo(() => {
    if (distancePoints.length < 2) return 0
    return turf.length(turf.lineString(distancePoints), { units: 'kilometers' }) * 1000
  }, [distancePoints])

  function runIntersection(polygon: Feature<Polygon>): SearchResult[] {
    return allFeaturesRef.current.filter(item => {
      const geom = item.feature.geometry
      if (!geom) return false
      if (geom.type === 'Point') return turf.booleanPointInPolygon(item.feature as Feature<Point>, polygon)
      return turf.booleanIntersects(item.feature, polygon)
    })
  }

  function clearAllSources(map: mapboxgl.Map) {
    ['measure-line', 'measure-preview', 'measure-points', 'search-area', 'buffer']
      .forEach(id => setSourceData(map, id, EMPTY_FC))
  }

  function selectTool(tool: ToolMode) {
    const next = activeTool === tool ? 'none' : tool
    const map  = mapRef.current
    const draw = drawRef.current
    if (map) clearAllSources(map)
    if (draw) draw.deleteAll()
    setDistancePoints([])
    distancePointsRef.current = []
    setAreaM2(null)
    setSpatialResults([])
    setSearchPolygonDrawn(false)
    setBufferCenter(null)
    setBufferResults([])
    setActiveTool(next)
  }

  function undoLastPoint() { setDistancePoints(prev => prev.slice(0, -1)) }

  function newArea() {
    const draw = drawRef.current
    if (draw) { draw.deleteAll(); draw.changeMode('draw_polygon') }
    setAreaM2(null)
  }

  function clearSearch() {
    const map  = mapRef.current
    const draw = drawRef.current
    if (map)  setSourceData(map, 'search-area', EMPTY_FC)
    if (draw) draw.changeMode('draw_polygon')
    setSpatialResults([])
    setSearchPolygonDrawn(false)
  }

  function applyBuffer() {
    if (!bufferCenter || !mapRef.current) return
    const buffered = turf.buffer(bufferCenter, bufferRadiusM / 1000, { units: 'kilometers' })
    if (!buffered) return
    setSourceData(mapRef.current, 'buffer', buffered)
    const poly = buffered as Feature<Polygon | MultiPolygon>
    const hits = allFeaturesRef.current.filter(item => {
      const geom = item.feature.geometry
      if (!geom) return false
      if (geom.type === 'Point') return turf.booleanPointInPolygon(item.feature as Feature<Point>, poly as Feature<Polygon>)
      return turf.booleanIntersects(item.feature, poly)
    })
    setBufferResults(hits)
  }

  function clearBuffer() {
    const map = mapRef.current
    if (map) setSourceData(map, 'buffer', EMPTY_FC)
    setBufferCenter(null)
    setBufferResults([])
  }

  return {
    activeTool, selectTool,
    distanceTotalM, distancePointCount: distancePoints.length, undoLastPoint,
    areaM2, newArea,
    spatialResults, searchPolygonDrawn, clearSearch,
    bufferCenter, bufferRadiusM, setBufferRadiusM, applyBuffer, bufferResults, clearBuffer,
  }
}
