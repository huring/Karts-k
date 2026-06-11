import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import * as turf from '@turf/turf'
import type { Feature } from 'geojson'
import { getBeslutFeatureById } from './useMapLayers'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string

// Mitt i Norrbotten — visar hela länet
const INITIAL_CENTER: [number, number] = [21.0, 66.8]
const INITIAL_ZOOM = 6.5

export function useMap(containerRef: React.RefObject<HTMLDivElement | null>) {
  const mapRef  = useRef<mapboxgl.Map | null>(null)
  const drawRef = useRef<MapboxDraw | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    mapboxgl.accessToken = MAPBOX_TOKEN

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
    })

    map.addControl(new mapboxgl.NavigationControl(), 'top-right')
    map.addControl(new mapboxgl.ScaleControl({ unit: 'metric' }), 'bottom-left')

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        line_string: true,
        point: true,
        trash: true,
      },
      defaultMode: 'simple_select',
    })
    map.addControl(draw, 'top-left')

    map.on('load', () => setIsLoaded(true))

    mapRef.current  = map
    drawRef.current = draw

    return () => {
      drawRef.current = null
      map.remove()
      mapRef.current = null
      setIsLoaded(false)
    }
  }, [containerRef])

  function flyToFeature(feature: Feature) {
    const map = mapRef.current
    if (!map) return
    // For beslut the selected feature has Point geometry (centroid) — look up the polygon for correct bounds
    let target = feature
    if (feature.properties?.feature_type === 'beslut' && feature.geometry?.type === 'Point') {
      const polygon = getBeslutFeatureById(feature.properties.id as string)
      if (polygon) target = polygon
    }
    const [minLng, minLat, maxLng, maxLat] = turf.bbox(target)
    map.fitBounds([[minLng, minLat], [maxLng, maxLat]], {
      padding: 80,
      maxZoom: 15,
      duration: 600,
    })
  }

  return { mapRef, drawRef, isLoaded, flyToFeature }
}
