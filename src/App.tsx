import { useRef, useMemo, useState, useEffect } from 'react'
import * as turf from '@turf/turf'
import { Map } from './components/Map'
import { SearchBar } from './components/SearchBar'
import { FilterPanel } from './components/FilterPanel'
import { ResultsList } from './components/ResultsList'
import { MapToolbar } from './components/MapToolbar'
import { MapLayerControl } from './components/MapLayerControl'
import { ObjectPanel } from './components/ObjectPanel'
import { useMap } from './hooks/useMap'
import { useMapLayers, getFastighetById } from './hooks/useMapLayers'

import { useDrawTools } from './hooks/useDrawTools'
import { useSearch } from './hooks/useSearch'
import { useFilters } from './hooks/useFilters'
import { useMapTools } from './hooks/useMapTools'
import type { ToolMode } from './hooks/useMapTools'
import { useSelectedFeature } from './hooks/useSelectedFeature'
import { useGeocode } from './hooks/useGeocode'
import type { GeocodeResult } from './hooks/useGeocode'
import type { SearchResult, SearchResultLayer } from './hooks/useSearch'
import { computeFilterOptions } from './hooks/useSearch'
import type { AttributeFilters } from './hooks/useFilters'
import type { SkyddatomradeProperties } from './types'

function applyAttributeFilters(items: SearchResult[], attrs: AttributeFilters): SearchResult[] {
  let out = items
  if (attrs.status.length > 0) {
    out = out.filter(item =>
      !(['skyddatomraden', 'beslut', 'delomraden'] as SearchResultLayer[]).includes(item.layer) ||
      attrs.status.includes((item.feature.properties as Record<string, string>).status),
    )
  }
  if (attrs.typ.length > 0) {
    out = out.filter(item =>
      item.layer !== 'skyddatomraden' ||
      attrs.typ.includes((item.feature.properties as SkyddatomradeProperties).typ),
    )
  }
  if (attrs.skick.length > 0) {
    out = out.filter(item =>
      item.layer !== 'byggnader' ||
      attrs.skick.includes((item.feature.properties as Record<string, string>).skick),
    )
  }
  if (attrs.anvandning.length > 0) {
    out = out.filter(item =>
      item.layer !== 'byggnader' ||
      attrs.anvandning.includes((item.feature.properties as Record<string, string>).anvandning),
    )
  }
  return out
}
import type { HoveredFeature } from './hooks/useMapLayers'
import styles from './App.module.css'

function App() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { mapRef, drawRef, isLoaded, flyToFeature } = useMap(containerRef)

  const [hoveredFeature, setHoveredFeature] = useState<HoveredFeature>(null)
  const [zoom, setZoom] = useState<number | null>(null)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !isLoaded) return
    setZoom(Math.round(map.getZoom() * 10) / 10)
    const onZoom = () => setZoom(Math.round(map.getZoom() * 10) / 10)
    map.on('zoom', onZoom)
    return () => { map.off('zoom', onZoom) }
  }, [isLoaded, mapRef])

  const {
    activeTypes, attributes,
    toggleType, toggleAttributeValue,
    resetFilters, hasActiveFilters,
  } = useFilters()

  const { query, setQuery, results, suggestions, hasActiveQuery, commitSearch, allFeaturesRef } = useSearch(
    mapRef, activeTypes, attributes,
  )

  const { results: geocodeResults } = useGeocode(query)

  const {
    activeTool, selectTool,
    distanceTotalM, distancePointCount, undoLastPoint,
    areaM2, newArea,
    spatialResults, searchPolygonDrawn, dismissPolygon, clearSearch,
    bufferCenter, bufferRadiusM, setBufferRadiusM, applyBuffer, bufferResults, clearBuffer,
  } = useMapTools(mapRef, drawRef, isLoaded)

  const selectionDisabled =
    activeTool === 'distance' ||
    activeTool === 'area' ||
    (activeTool === 'spatial-search' && !searchPolygonDrawn) ||
    (activeTool === 'buffer' && bufferCenter === null)

  const { selected, setSelected, clearSelected } = useSelectedFeature(
    mapRef, isLoaded, selectionDisabled,
    (id, layer) => setHoveredFeature(id && layer ? { id, layer } : null),
    (byggnadId, fastighetId) => {
      const ft = getFastighetById(fastighetId)
      if (ft) {
        flyToFeature(ft)
        setSelected({ feature: ft, layer: 'fastigheter', buildingId: byggnadId })
      }
    },
  )

  const selectedId = (selected?.feature.properties as { id?: string } | null)?.id ?? null
  const selectedBuildingId = selected?.buildingId ?? null

  const [frozenResults, setFrozenResults] = useState<SearchResult[]>([])

  const [nearbyActive, setNearbyActive] = useState(false)
  const [nearbyResults, setNearbyResults] = useState<SearchResult[]>([])

  const activateNearby = () => {
    const map = mapRef.current
    if (!map) return
    const b = map.getBounds()
    const vp = turf.bboxPolygon([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()])
    const hits = allFeaturesRef.current.filter(item => {
      try { return turf.booleanIntersects(vp, item.feature) } catch { return false }
    })
    setNearbyResults(hits)
    setNearbyActive(true)
  }

  const clearNearby = () => {
    setNearbyActive(false)
    setNearbyResults([])
  }

  const handleSelectTool = (tool: ToolMode) => {
    if (activeTool === 'spatial-search' && spatialResults.length > 0) {
      setFrozenResults(spatialResults)
    } else if (activeTool === 'buffer' && bufferResults.length > 0) {
      setFrozenResults(bufferResults)
    }
    selectTool(tool)
  }

  const handleDismissPolygon = () => {
    setFrozenResults(spatialResults)
    dismissPolygon()
  }

  const showSpatialResults  = activeTool === 'spatial-search' && searchPolygonDrawn
  const showBufferResults   = activeTool === 'buffer' && bufferCenter !== null
  const hasExternalSearch   = showSpatialResults || showBufferResults || hasActiveQuery || frozenResults.length > 0 || nearbyActive

  // Base results = current search scope, type-filtered only (drives map visibility)
  const baseResults = (
    showSpatialResults       ? spatialResults :
    showBufferResults        ? bufferResults  :
    hasActiveQuery           ? results        :
    frozenResults.length > 0 ? frozenResults  :
    nearbyActive             ? nearbyResults  :
    []
  ).filter(r => activeTypes[r.layer])

  // Display results = base results narrowed by attribute filters (drives the list only)
  const displayResults = applyAttributeFilters(baseResults, attributes)

  const isLayerActive  = hasExternalSearch   // drives map layer visibility
  const isSearchActive = hasExternalSearch   // drives sidebar + overlay
  const visibleIds     = displayResults.map(r => r.id)

  const filterOptions = useMemo(() => computeFilterOptions(baseResults), [baseResults])
  const typeCounts = useMemo(() => ({
    fastigheter:    baseResults.filter(r => r.layer === 'fastigheter').length,
    skyddatomraden: baseResults.filter(r => r.layer === 'skyddatomraden').length,
    beslut:         baseResults.filter(r => r.layer === 'beslut').length,
    delomraden:     baseResults.filter(r => r.layer === 'delomraden').length,
    byggnader:      baseResults.filter(r => r.layer === 'byggnader').length,
  }), [baseResults])

  useMapLayers(mapRef, isLoaded, activeTypes, attributes, visibleIds, isLayerActive, selectedId, hoveredFeature, selectedBuildingId)
  useDrawTools(mapRef, isLoaded)

  const panelOpen = selected !== null

  const onSuggestionClick = (result: SearchResult) => {
    if (result.layer === 'byggnader') {
      const fid = (result.feature.properties as { fastighets_id?: string }).fastighets_id
      const ft = fid ? getFastighetById(fid) : null
      if (ft) {
        flyToFeature(ft)
        setSelected({ feature: ft, layer: 'fastigheter', buildingId: result.id })
      }
      return
    }
    flyToFeature(result.feature)
    setSelected({ feature: result.feature, layer: result.layer })
  }

  const onGeoResultClick = (result: GeocodeResult) => {
    const map = mapRef.current
    if (!map) return
    if (result.bbox) {
      map.fitBounds(
        [[result.bbox[0], result.bbox[1]], [result.bbox[2], result.bbox[3]]],
        { padding: 80, duration: 500 },
      )
    } else {
      map.flyTo({ center: result.center, zoom: 12, duration: 500 })
    }
  }

  return (
    <div className="app">
      {isSearchActive ? (
        <aside className={styles.sidebar}>
          <SearchBar
            query={query}
            onChange={setQuery}
            onCommit={commitSearch}
            suggestions={suggestions}
            onSuggestionClick={onSuggestionClick}
            geocodeResults={geocodeResults}
            onGeoResultClick={onGeoResultClick}
          />
          <div className={styles.scrollArea}>
            <FilterPanel
              activeTypes={activeTypes}
              attributes={attributes}
              filterOptions={filterOptions}
              typeCounts={typeCounts}
              onToggleType={toggleType}
              onToggleAttributeValue={toggleAttributeValue}
              onReset={resetFilters}
              hasActiveFilters={hasActiveFilters}
            />
            <div className={styles.nearbyBar}>
              <button
                type="button"
                className={`${styles.nearbyBtn} ${nearbyActive ? styles.nearbyBtnActive : ''}`}
                onClick={activateNearby}
              >
                <span className="material-symbols-outlined">crop_free</span>
                {nearbyActive ? 'Uppdatera i området' : 'Visa i området'}
              </button>
              {nearbyActive && (
                <button type="button" className={styles.nearbyClear} onClick={clearNearby} aria-label="Rensa">
                  <span className="material-symbols-outlined">close</span>
                </button>
              )}
            </div>
            <ResultsList
              results={displayResults}
              hasQuery={true}
              isNearbyMode={nearbyActive && !hasActiveQuery && !showSpatialResults && !showBufferResults && frozenResults.length === 0}
              onResultClick={result => {
                if (result.layer === 'byggnader') {
                  const fid = (result.feature.properties as { fastighets_id?: string }).fastighets_id
                  const ft = fid ? getFastighetById(fid) : null
                  if (ft) {
                    flyToFeature(ft)
                    setSelected({ feature: ft, layer: 'fastigheter', buildingId: result.id })
                  }
                  return
                }
                flyToFeature(result.feature)
                setSelected({ feature: result.feature, layer: result.layer })
              }}
              onResultHover={result => {
                if (result.layer !== 'byggnader') {
                  setHoveredFeature({ id: result.id, layer: result.layer })
                }
              }}
              onResultLeave={() => setHoveredFeature(null)}
            />
          </div>
        </aside>
      ) : null}

      <Map containerRef={containerRef}>
        {!isSearchActive && (
          <div className={styles.searchOverlay}>
            <SearchBar
              query={query}
              onChange={setQuery}
              onCommit={commitSearch}
              suggestions={suggestions}
              onSuggestionClick={onSuggestionClick}
              geocodeResults={geocodeResults}
              onGeoResultClick={onGeoResultClick}
            />
            <MapLayerControl activeTypes={activeTypes} onToggle={toggleType} />
            <div className={styles.nearbyBar}>
              <button
                type="button"
                className={styles.nearbyBtn}
                onClick={activateNearby}
              >
                <span className="material-symbols-outlined">crop_free</span>
                Visa i området
              </button>
            </div>
          </div>
        )}
        <MapToolbar
          activeTool={activeTool}
          onSelectTool={handleSelectTool}
          panelOpen={panelOpen}
          distance={{ totalM: distanceTotalM, pointCount: distancePointCount, onUndo: undoLastPoint }}
          area={{ m2: areaM2, onNew: newArea }}
          spatialSearch={{ resultCount: spatialResults.length, polygonDrawn: searchPolygonDrawn, onClear: handleDismissPolygon }}
          buffer={{
            center: bufferCenter,
            radiusM: bufferRadiusM,
            onSetRadius: setBufferRadiusM,
            onApply: applyBuffer,
            resultCount: bufferResults.length,
            onClear: clearBuffer,
          }}
        />
        {zoom !== null && (
          <div className={styles.zoomDebug}>zoom {zoom.toFixed(1)}</div>
        )}
        <ObjectPanel
          feature={selected?.feature ?? null}
          layer={selected?.layer ?? null}
          initialBuildingId={selected?.buildingId ?? null}
          onClose={clearSelected}
          onFlyTo={flyToFeature}
        />
      </Map>
    </div>
  )
}

export default App
