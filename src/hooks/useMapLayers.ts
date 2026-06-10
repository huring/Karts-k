import { useEffect } from 'react'
import mapboxgl from 'mapbox-gl'
import type { ObjectTypeKey, AttributeFilters } from './useFilters'

const MARKSLAG_COLOR = [
  'match',
  ['get', 'markslag'],
  'skog',       '#405D1A',
  'åker',       '#F4E28B',
  'impediment', '#B7B7B7',
  'vatten',     '#B8D8FB',
  '#9E9E9E',
] as mapboxgl.Expression

const MARKSLAG_OPACITY = [
  'match',
  ['get', 'markslag'],
  'skog',       0.4,
  'åker',       0.5,
  'impediment', 0.4,
  'vatten',     0.5,
  0.4,
] as mapboxgl.Expression

// Filter that matches nothing — default for highlight/selected layers
const NO_MATCH: mapboxgl.Expression = ['in', ['get', 'id'], ['literal', []]]

export function useMapLayers(
  mapRef: React.RefObject<mapboxgl.Map | null>,
  isLoaded: boolean,
  activeTypes: Record<ObjectTypeKey, boolean>,
  attributes: AttributeFilters,
  highlightIds: string[] = [],
  selectedId: string | null = null,
) {
  // Add all sources and layers on load
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return
    const map = mapRef.current

    map.addSource('fastigheter', { type: 'geojson', data: '/data/fastigheter.geojson' })
    map.addSource('byggnader',   { type: 'geojson', data: '/data/byggnader.geojson'   })

    map.addLayer({
      id: 'fastigheter-fill',
      type: 'fill',
      source: 'fastigheter',
      paint: { 'fill-color': MARKSLAG_COLOR, 'fill-opacity': MARKSLAG_OPACITY },
    })

    map.addLayer({
      id: 'fastigheter-outline',
      type: 'line',
      source: 'fastigheter',
      paint: { 'line-color': '#013264', 'line-width': 1, 'line-opacity': 0.6 },
    })

    map.addLayer({
      id: 'fastigheter-highlight',
      type: 'line',
      source: 'fastigheter',
      paint: { 'line-color': '#1B88E8', 'line-width': 3, 'line-opacity': 1 },
      filter: NO_MATCH,
    })

    // Selected feature — rendered on top with a distinct fill
    map.addLayer({
      id: 'fastigheter-selected',
      type: 'fill',
      source: 'fastigheter',
      paint: { 'fill-color': '#0E4C83', 'fill-opacity': 0.3 },
      filter: NO_MATCH,
    })

    map.addLayer({
      id: 'byggnader-circle',
      type: 'circle',
      source: 'byggnader',
      paint: {
        'circle-color': '#E3A480',
        'circle-opacity': 0.7,
        'circle-radius': 6,
        'circle-stroke-color': '#B87040',
        'circle-stroke-width': 1,
      },
    })

    map.addLayer({
      id: 'byggnader-highlight',
      type: 'circle',
      source: 'byggnader',
      paint: {
        'circle-color': '#1B88E8',
        'circle-opacity': 0.9,
        'circle-radius': 9,
        'circle-stroke-color': '#013264',
        'circle-stroke-width': 2,
      },
      filter: NO_MATCH,
    })

    // Selected building — larger circle with darker color
    map.addLayer({
      id: 'byggnader-selected',
      type: 'circle',
      source: 'byggnader',
      paint: {
        'circle-color': '#013264',
        'circle-opacity': 1,
        'circle-radius': 12,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
      },
      filter: NO_MATCH,
    })

    return () => {
      const m = mapRef.current
      if (!m) return
      const layers = [
        'fastigheter-fill', 'fastigheter-outline', 'fastigheter-highlight', 'fastigheter-selected',
        'byggnader-circle', 'byggnader-highlight', 'byggnader-selected',
      ]
      layers.forEach(id => { if (m.getLayer(id)) m.removeLayer(id) })
      ;['fastigheter', 'byggnader'].forEach(id => { if (m.getSource(id)) m.removeSource(id) })
    }
  }, [isLoaded, mapRef])

  // Layer visibility controlled by type chips
  useEffect(() => {
    const map = mapRef.current
    if (!map || !isLoaded) return
    const setVis = (layerIds: string[], visible: boolean) => {
      const vis = visible ? 'visible' : 'none'
      layerIds.forEach(id => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis) })
    }
    setVis(['fastigheter-fill', 'fastigheter-outline', 'fastigheter-highlight'], activeTypes.fastigheter)
    setVis(['byggnader-circle', 'byggnader-highlight'], activeTypes.byggnader)
  }, [activeTypes.fastigheter, activeTypes.byggnader, mapRef, isLoaded])

  // Attribute filter expressions applied to base layers
  useEffect(() => {
    const map = mapRef.current
    if (!map || !isLoaded) return

    const exprs: mapboxgl.Expression[] = []
    if (attributes.status)   exprs.push(['==', ['get', 'status'],   attributes.status])
    if (attributes.markslag) exprs.push(['==', ['get', 'markslag'], attributes.markslag])

    const fastigheterFilter: mapboxgl.Expression =
      exprs.length === 0 ? (['literal', true] as mapboxgl.Expression) :
      exprs.length === 1 ? exprs[0] :
      (['all', ...exprs] as mapboxgl.Expression)

    const byggFilter: mapboxgl.Expression = attributes.status
      ? (['==', ['get', 'status'], attributes.status] as mapboxgl.Expression)
      : (['literal', true] as mapboxgl.Expression)

    if (map.getLayer('fastigheter-fill'))    map.setFilter('fastigheter-fill',    fastigheterFilter)
    if (map.getLayer('fastigheter-outline')) map.setFilter('fastigheter-outline', fastigheterFilter)
    if (map.getLayer('byggnader-circle'))    map.setFilter('byggnader-circle',    byggFilter)
  }, [attributes.status, attributes.markslag, mapRef, isLoaded])

  // Highlight filter updated when search results change
  useEffect(() => {
    const map = mapRef.current
    if (!map || !isLoaded) return
    const filter: mapboxgl.Expression = highlightIds.length > 0
      ? ['in', ['get', 'id'], ['literal', highlightIds]]
      : NO_MATCH
    if (map.getLayer('fastigheter-highlight')) map.setFilter('fastigheter-highlight', filter)
    if (map.getLayer('byggnader-highlight'))   map.setFilter('byggnader-highlight',   filter)
  }, [highlightIds, mapRef, isLoaded])

  // Selected feature highlight
  useEffect(() => {
    const map = mapRef.current
    if (!map || !isLoaded) return
    const filter: mapboxgl.Expression = selectedId
      ? (['==', ['get', 'id'], selectedId] as mapboxgl.Expression)
      : NO_MATCH
    if (map.getLayer('fastigheter-selected')) map.setFilter('fastigheter-selected', filter)
    if (map.getLayer('byggnader-selected'))   map.setFilter('byggnader-selected',   filter)
  }, [selectedId, mapRef, isLoaded])
}
