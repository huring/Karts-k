import { useEffect, useRef, useState } from 'react'
import type * as mapboxgl from 'mapbox-gl'
import type { Feature } from 'geojson'

export type SelectedLayer = 'fastigheter' | 'skyddatomraden' | 'beslut' | 'delomraden'

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
    const onSkyddsClick       = makeClickHandler('skyddatomraden')
    const onBeslutClick       = makeClickHandler('beslut')
    const onDelomradeClick    = makeClickHandler('delomraden')

    const { onEnter: onFastEnter,    onLeave: onFastLeave    } = makeHoverHandlers('fastigheter')
    const { onEnter: onSkyddsEnter,  onLeave: onSkyddsLeave  } = makeHoverHandlers('skyddatomraden')
    const { onEnter: onBeslutEnter,  onLeave: onBeslutLeave  } = makeHoverHandlers('beslut')
    const { onEnter: onDelomEnter,   onLeave: onDelomLeave   } = makeHoverHandlers('delomraden')

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
    map.on('click', 'skyddatomraden-fill', onSkyddsClick)
    map.on('click', 'beslut-circle',       onBeslutClick)
    map.on('click', 'delomraden-fill',     onDelomradeClick)
    map.on('click', 'byggnader-circle',    onByggnadsClick)

    map.on('mouseenter', 'fastigheter-fill',    onFastEnter)
    map.on('mouseleave', 'fastigheter-fill',    onFastLeave)
    map.on('mouseenter', 'skyddatomraden-fill', onSkyddsEnter)
    map.on('mouseleave', 'skyddatomraden-fill', onSkyddsLeave)
    map.on('mouseenter', 'beslut-circle',       onBeslutEnter)
    map.on('mouseleave', 'beslut-circle',       onBeslutLeave)
    map.on('mouseenter', 'delomraden-fill',     onDelomEnter)
    map.on('mouseleave', 'delomraden-fill',     onDelomLeave)
    map.on('mouseenter', 'byggnader-circle',    onByggnadsEnter)
    map.on('mouseleave', 'byggnader-circle',    onByggnadsLeave)

    return () => {
      map.off('click', 'fastigheter-fill',    onFastighetClick)
      map.off('click', 'skyddatomraden-fill', onSkyddsClick)
      map.off('click', 'beslut-circle',       onBeslutClick)
      map.off('click', 'delomraden-fill',     onDelomradeClick)
      map.off('click', 'byggnader-circle',    onByggnadsClick)

      map.off('mouseenter', 'fastigheter-fill',    onFastEnter)
      map.off('mouseleave', 'fastigheter-fill',    onFastLeave)
      map.off('mouseenter', 'skyddatomraden-fill', onSkyddsEnter)
      map.off('mouseleave', 'skyddatomraden-fill', onSkyddsLeave)
      map.off('mouseenter', 'beslut-circle',       onBeslutEnter)
      map.off('mouseleave', 'beslut-circle',       onBeslutLeave)
      map.off('mouseenter', 'delomraden-fill',     onDelomEnter)
      map.off('mouseleave', 'delomraden-fill',     onDelomLeave)
      map.off('mouseenter', 'byggnader-circle',    onByggnadsEnter)
      map.off('mouseleave', 'byggnader-circle',    onByggnadsLeave)
    }
  }, [isLoaded, mapRef])

  return { selected, setSelected, clearSelected: () => setSelected(null) }
}
