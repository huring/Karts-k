import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import type { Feature } from 'geojson'

export type SelectedLayer = 'fastigheter' | 'byggnader'

export interface SelectedFeatureState {
  feature: Feature
  layer: SelectedLayer
}

export function useSelectedFeature(
  mapRef: React.RefObject<mapboxgl.Map | null>,
  isLoaded: boolean,
  isToolActive: boolean,
) {
  const [selected, setSelected] = useState<SelectedFeatureState | null>(null)
  const isToolActiveRef = useRef(isToolActive)
  useEffect(() => { isToolActiveRef.current = isToolActive }, [isToolActive])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !isLoaded) return

    const makeClickHandler = (layer: SelectedLayer) =>
      (e: mapboxgl.MapLayerMouseEvent) => {
        if (isToolActiveRef.current) return
        const f = e.features?.[0]
        if (!f) return
        setSelected({ feature: { type: 'Feature', geometry: f.geometry, properties: f.properties }, layer })
      }

    const onEnter = () => { if (!isToolActiveRef.current) map.getCanvas().style.cursor = 'pointer' }
    const onLeave = () => { if (!isToolActiveRef.current) map.getCanvas().style.cursor = '' }

    const onFastighetClick = makeClickHandler('fastigheter')
    const onByggnadClick   = makeClickHandler('byggnader')

    map.on('click', 'fastigheter-fill',  onFastighetClick)
    map.on('click', 'byggnader-circle',  onByggnadClick)
    map.on('mouseenter', 'fastigheter-fill',  onEnter)
    map.on('mouseleave', 'fastigheter-fill',  onLeave)
    map.on('mouseenter', 'byggnader-circle',  onEnter)
    map.on('mouseleave', 'byggnader-circle',  onLeave)

    return () => {
      map.off('click', 'fastigheter-fill',  onFastighetClick)
      map.off('click', 'byggnader-circle',  onByggnadClick)
      map.off('mouseenter', 'fastigheter-fill',  onEnter)
      map.off('mouseleave', 'fastigheter-fill',  onLeave)
      map.off('mouseenter', 'byggnader-circle',  onEnter)
      map.off('mouseleave', 'byggnader-circle',  onLeave)
    }
  }, [isLoaded, mapRef])

  return { selected, setSelected, clearSelected: () => setSelected(null) }
}
