import { useEffect, useRef, useState } from 'react'
import type * as mapboxgl from 'mapbox-gl'
import type { Feature } from 'geojson'

export type SelectedLayer = 'fastigheter' | 'skyddsomraden' | 'beslut'

export interface SelectedFeatureState {
  feature: Feature
  layer: SelectedLayer
  buildingId?: string
}

export function useSelectedFeature(
  mapRef: React.RefObject<mapboxgl.Map | null>,
  isLoaded: boolean,
  isToolActive: boolean,
  onHoverFeature?: (id: string | null, layer: SelectedLayer | null) => void,
  onBuildingClick?: (byggnadId: string, fastighetId: string) => void,
) {
  const [selected, setSelected] = useState<SelectedFeatureState | null>(null)
  const isToolActiveRef = useRef(isToolActive)
  const onHoverRef = useRef(onHoverFeature)
  const onBuildingClickRef = useRef(onBuildingClick)
  useEffect(() => { isToolActiveRef.current = isToolActive }, [isToolActive])
  useEffect(() => { onHoverRef.current = onHoverFeature }, [onHoverFeature])
  useEffect(() => { onBuildingClickRef.current = onBuildingClick }, [onBuildingClick])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !isLoaded) return

    const makeClickHandler = (layer: SelectedLayer) =>
      (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
        if (isToolActiveRef.current) return
        const f = e.features?.[0]
        if (!f) return
        setSelected({ feature: { type: 'Feature', geometry: f.geometry, properties: f.properties }, layer })
      }

    // Unified hover handler factory — extracts feature ID and propagates it with layer type
    const makeHoverHandlers = (layer: SelectedLayer) => {
      const onEnter = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
        if (isToolActiveRef.current) return
        map.getCanvas().style.cursor = 'pointer'
        const id = e.features?.[0]?.properties?.id as string | undefined
        if (id) onHoverRef.current?.(id, layer)
      }
      const onLeave = () => {
        if (isToolActiveRef.current) return
        map.getCanvas().style.cursor = ''
        onHoverRef.current?.(null, null)
      }
      return { onEnter, onLeave }
    }

    const onFastighetClick    = makeClickHandler('fastigheter')
    const onSkyddsomradeClick = makeClickHandler('skyddsomraden')
    const onBeslutClick       = makeClickHandler('beslut')

    const { onEnter: onFastEnter, onLeave: onFastLeave }   = makeHoverHandlers('fastigheter')
    const { onEnter: onSkyddsEnter, onLeave: onSkyddsLeave } = makeHoverHandlers('skyddsomraden')
    const { onEnter: onBeslutEnter, onLeave: onBeslutLeave } = makeHoverHandlers('beslut')

    const onByggnadsClick = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
      if (isToolActiveRef.current) return
      const props = e.features?.[0]?.properties as { id?: string; fastighets_id?: string } | undefined
      if (props?.id && props?.fastighets_id) {
        onBuildingClickRef.current?.(props.id, props.fastighets_id)
      }
    }
    const onByggnadsEnter = () => { if (!isToolActiveRef.current) map.getCanvas().style.cursor = 'pointer' }
    const onByggnadsLeave = () => { if (!isToolActiveRef.current) map.getCanvas().style.cursor = '' }

    map.on('click', 'fastigheter-fill',    onFastighetClick)
    map.on('click', 'skyddsomraden-fill',  onSkyddsomradeClick)
    map.on('click', 'beslut-circle',       onBeslutClick)
    map.on('click', 'byggnader-circle',    onByggnadsClick)
    map.on('mouseenter', 'fastigheter-fill',   onFastEnter)
    map.on('mouseleave', 'fastigheter-fill',   onFastLeave)
    map.on('mouseenter', 'skyddsomraden-fill', onSkyddsEnter)
    map.on('mouseleave', 'skyddsomraden-fill', onSkyddsLeave)
    map.on('mouseenter', 'beslut-circle',      onBeslutEnter)
    map.on('mouseleave', 'beslut-circle',      onBeslutLeave)
    map.on('mouseenter', 'byggnader-circle',   onByggnadsEnter)
    map.on('mouseleave', 'byggnader-circle',   onByggnadsLeave)

    return () => {
      map.off('click', 'fastigheter-fill',    onFastighetClick)
      map.off('click', 'skyddsomraden-fill',  onSkyddsomradeClick)
      map.off('click', 'beslut-circle',       onBeslutClick)
      map.off('click', 'byggnader-circle',    onByggnadsClick)
      map.off('mouseenter', 'fastigheter-fill',   onFastEnter)
      map.off('mouseleave', 'fastigheter-fill',   onFastLeave)
      map.off('mouseenter', 'skyddsomraden-fill', onSkyddsEnter)
      map.off('mouseleave', 'skyddsomraden-fill', onSkyddsLeave)
      map.off('mouseenter', 'beslut-circle',      onBeslutEnter)
      map.off('mouseleave', 'beslut-circle',      onBeslutLeave)
      map.off('mouseenter', 'byggnader-circle',   onByggnadsEnter)
      map.off('mouseleave', 'byggnader-circle',   onByggnadsLeave)
    }
  }, [isLoaded, mapRef])

  return { selected, setSelected, clearSelected: () => setSelected(null) }
}
