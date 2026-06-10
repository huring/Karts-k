import { useEffect, useMemo, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import * as turf from '@turf/turf'
import type { Feature, FeatureCollection, Point, Polygon, MultiPolygon } from 'geojson'
import type { FastighetProperties, ByggnadsProperties } from '../types'
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

  // Refs for use in event callbacks to avoid stale closures
  const activeToolRef = useRef<ToolMode>('none')
  const distancePointsRef = useRef<[number, number][]>([])
  const allFeaturesRef = useRef<SearchResult[]>([])

  useEffect(() => { activeToolRef.current = activeTool }, [activeTool])
  useEffect(() => { distancePointsRef.current = distancePoints }, [distancePoints])

  // Load GeoJSON features once for spatial intersection queries
  useEffect(() => {
    Promise.all([
      fetch('/data/fastigheter.geojson').then(r => r.json()),
      fetch('/data/byggnader.geojson').then(r => r.json()),
    ]).then(([rawFast, rawBygg]) => {
      const fast = rawFast as FeatureCollection
      const bygg = rawBygg as FeatureCollection
      const fastItems: SearchResult[] = fast.features.map(f => {
        const p = f.properties as FastighetProperties
        return { id: p.id, label: p.beteckning, subLabel: p.namn ?? p.markslag, layer: 'fastigheter', feature: f }
      })
      const byggItems: SearchResult[] = bygg.features.map(f => {
        const p = f.properties as ByggnadsProperties
        return { id: p.id, label: p.id, subLabel: p.byggnadstyp, layer: 'byggnader', feature: f }
      })
      allFeaturesRef.current = [...fastItems, ...byggItems]
    })
  }, [])

  // Add measure/search/buffer Mapbox sources and layers
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return
    const map = mapRef.current

    const sources: [string][] = [
      ['measure-line'], ['measure-preview'], ['measure-points'],
      ['search-area'], ['buffer'],
    ]
    sources.forEach(([id]) => map.addSource(id, { type: 'geojson', data: EMPTY_FC }))

    map.addLayer({ id: 'measure-line-layer', type: 'line', source: 'measure-line',
      paint: { 'line-color': '#E63935', 'line-width': 2 } })
    map.addLayer({ id: 'measure-preview-layer', type: 'line', source: 'measure-preview',
      paint: { 'line-color': '#E63935', 'line-width': 1.5, 'line-dasharray': [4, 3] } })
    map.addLayer({ id: 'measure-points-layer', type: 'circle', source: 'measure-points',
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
      sources.forEach(([id]) => { if (m.getSource(id)) m.removeSource(id) })
    }
  }, [isLoaded, mapRef])

  // Set up / tear down event listeners for the active tool
  useEffect(() => {
    const map = mapRef.current
    const draw = drawRef.current
    if (!map || !draw || !isLoaded) return

    map.getCanvas().style.cursor = activeTool !== 'none' ? 'crosshair' : ''

    const onDistanceClick = (e: mapboxgl.MapMouseEvent) => {
      const pt: [number, number] = [e.lngLat.lng, e.lngLat.lat]
      setDistancePoints(prev => {
        const next = [...prev, pt]
        distancePointsRef.current = next
        return next
      })
    }

    const onDistanceMouseMove = (e: mapboxgl.MapMouseEvent) => {
      const pts = distancePointsRef.current
      if (pts.length === 0) return
      const preview = turf.lineString([pts[pts.length - 1], [e.lngLat.lng, e.lngLat.lat]])
      setSourceData(map, 'measure-preview', preview)
    }

    const onDrawCreate = (e: object) => {
      const evt = e as { features: Feature[] }
      const feature = evt.features[0]
      if (!feature?.geometry || feature.geometry.type !== 'Polygon') return
      const polygon = feature as Feature<Polygon>

      if (activeToolRef.current === 'area') {
        setAreaM2(turf.area(polygon))
        // Keep the polygon in Draw for visual reference; user can clear with "Rita ny yta"
      } else if (activeToolRef.current === 'spatial-search') {
        // Move polygon from Draw to custom styled source
        setSourceData(map, 'search-area', turf.featureCollection([polygon]))
        draw.deleteAll()
        draw.changeMode('simple_select')

        const hits = runIntersection(polygon)
        setSpatialResults(hits)
        setSearchPolygonDrawn(true)
      }
    }

    const onBufferClick = (e: mapboxgl.MapMouseEvent) => {
      const feats = map.queryRenderedFeatures(e.point, {
        layers: ['fastigheter-fill', 'byggnader-circle'],
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
    if (activeTool === 'buffer') {
      map.on('click', onBufferClick)
    }

    return () => {
      map.getCanvas().style.cursor = ''
      map.off('click', onDistanceClick)
      map.off('mousemove', onDistanceMouseMove)
      map.off('draw.create', onDrawCreate as (e: object) => void)
      map.off('click', onBufferClick)
      if (activeTool === 'area' || activeTool === 'spatial-search') {
        draw.changeMode('simple_select')
      }
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

    if (distancePoints.length > 0) {
      setSourceData(map, 'measure-points',
        turf.featureCollection(distancePoints.map(p => turf.point(p))))
    } else {
      setSourceData(map, 'measure-points', EMPTY_FC)
    }
  }, [distancePoints, mapRef])

  const distanceTotalM = useMemo(() => {
    if (distancePoints.length < 2) return 0
    return turf.length(turf.lineString(distancePoints), { units: 'kilometers' }) * 1000
  }, [distancePoints])

  function runIntersection(polygon: Feature<Polygon>): SearchResult[] {
    return allFeaturesRef.current.filter(item => {
      const geom = item.feature.geometry
      if (!geom) return false
      if (geom.type === 'Point') {
        return turf.booleanPointInPolygon(item.feature as Feature<Point>, polygon)
      }
      return turf.booleanIntersects(item.feature, polygon)
    })
  }

  function clearAllSources(map: mapboxgl.Map) {
    ['measure-line', 'measure-preview', 'measure-points', 'search-area', 'buffer']
      .forEach(id => setSourceData(map, id, EMPTY_FC))
  }

  function selectTool(tool: ToolMode) {
    const next = activeTool === tool ? 'none' : tool

    const map = mapRef.current
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

  function undoLastPoint() {
    setDistancePoints(prev => prev.slice(0, -1))
  }

  function newArea() {
    const draw = drawRef.current
    if (draw) { draw.deleteAll(); draw.changeMode('draw_polygon') }
    setAreaM2(null)
  }

  function clearSearch() {
    const map = mapRef.current
    const draw = drawRef.current
    if (map) setSourceData(map, 'search-area', EMPTY_FC)
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
      if (geom.type === 'Point') {
        return turf.booleanPointInPolygon(
          item.feature as Feature<Point>,
          poly as Feature<Polygon>,
        )
      }
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
