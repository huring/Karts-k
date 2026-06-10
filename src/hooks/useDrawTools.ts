import { useEffect } from 'react'
import mapboxgl from 'mapbox-gl'
import * as turf from '@turf/turf'
import type { Feature } from 'geojson'

type DrawCreateEvent = { features: Feature[] }

export function useDrawTools(
  mapRef: React.RefObject<mapboxgl.Map | null>,
  isLoaded: boolean,
) {
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return
    const map = mapRef.current

    const onDrawCreate = (e: DrawCreateEvent) => {
      const feature = e.features[0]
      if (!feature?.geometry) return

      if (
        feature.geometry.type === 'Polygon' ||
        feature.geometry.type === 'MultiPolygon'
      ) {
        const areaM2 = turf.area(feature)
        const formatted =
          areaM2 >= 10000
            ? `${(areaM2 / 10000).toFixed(1)} ha`
            : `${Math.round(areaM2)} m²`
        console.log(`[useDrawTools] Ritad areal: ${formatted}`)
      } else if (feature.geometry.type === 'LineString') {
        const lengthKm = turf.length(feature)
        const formatted =
          lengthKm >= 1
            ? `${lengthKm.toFixed(1)} km`
            : `${Math.round(lengthKm * 1000)} m`
        console.log(`[useDrawTools] Ritad sträcka: ${formatted}`)
      }
    }

    map.on('draw.create', onDrawCreate as (e: object) => void)
    return () => {
      map.off('draw.create', onDrawCreate as (e: object) => void)
    }
  }, [isLoaded, mapRef])
}
