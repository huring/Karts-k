import { useRef, useState } from 'react'
import { Map } from './components/Map'
import { SearchBar } from './components/SearchBar'
import { FilterPanel } from './components/FilterPanel'
import { ResultsList } from './components/ResultsList'
import { MapToolbar } from './components/MapToolbar'
import { ObjectPanel } from './components/ObjectPanel'
import { useMap } from './hooks/useMap'
import { useMapLayers, getFastighetById } from './hooks/useMapLayers'
import { useDrawTools } from './hooks/useDrawTools'
import { useSearch } from './hooks/useSearch'
import { useFilters } from './hooks/useFilters'
import { useMapTools } from './hooks/useMapTools'
import { useSelectedFeature } from './hooks/useSelectedFeature'
import { useGeocode } from './hooks/useGeocode'
import type { GeocodeResult } from './hooks/useGeocode'
import type { HoveredFeature } from './hooks/useMapLayers'
import styles from './App.module.css'

function App() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { mapRef, drawRef, isLoaded, flyToFeature } = useMap(containerRef)

  const [hoveredFeature, setHoveredFeature] = useState<HoveredFeature>(null)

  const {
    activeTypes, attributes,
    toggleType, toggleAttributeValue,
    resetFilters, hasActiveFilters,
  } = useFilters()

  const { query, setQuery, results, highlightIds, hasActiveQuery, filterOptions, typeCounts } = useSearch(
    mapRef, activeTypes, attributes,
  )

  const { results: geocodeResults } = useGeocode(query)

  const {
    activeTool, selectTool,
    distanceTotalM, distancePointCount, undoLastPoint,
    areaM2, newArea,
    spatialResults, searchPolygonDrawn, clearSearch,
    bufferCenter, bufferRadiusM, setBufferRadiusM, applyBuffer, bufferResults, clearBuffer,
  } = useMapTools(mapRef, drawRef, isLoaded)

  const { selected, setSelected, clearSelected } = useSelectedFeature(
    mapRef, isLoaded, activeTool !== 'none',
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

  useMapLayers(mapRef, isLoaded, activeTypes, attributes, highlightIds, selectedId, hoveredFeature, selectedBuildingId)
  useDrawTools(mapRef, isLoaded)

  const showSpatialResults = activeTool === 'spatial-search' && searchPolygonDrawn
  const showBufferResults  = activeTool === 'buffer' && bufferCenter !== null

  const displayResults  = (showSpatialResults ? spatialResults
    : showBufferResults  ? bufferResults
    : results).filter(r => activeTypes[r.layer])

  const displayHasQuery = showSpatialResults || showBufferResults || hasActiveQuery

  const panelOpen = selected !== null

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
      <aside className={styles.sidebar}>
        <SearchBar query={query} onChange={setQuery} />
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
        <ResultsList
          results={displayResults}
          geocodeResults={geocodeResults}
          hasQuery={displayHasQuery || geocodeResults.length > 0}
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
          onGeoResultClick={onGeoResultClick}
        />
      </aside>

      <Map containerRef={containerRef}>
        <MapToolbar
          activeTool={activeTool}
          onSelectTool={selectTool}
          panelOpen={panelOpen}
          distance={{ totalM: distanceTotalM, pointCount: distancePointCount, onUndo: undoLastPoint }}
          area={{ m2: areaM2, onNew: newArea }}
          spatialSearch={{ resultCount: spatialResults.length, polygonDrawn: searchPolygonDrawn, onClear: clearSearch }}
          buffer={{
            center: bufferCenter,
            radiusM: bufferRadiusM,
            onSetRadius: setBufferRadiusM,
            onApply: applyBuffer,
            resultCount: bufferResults.length,
            onClear: clearBuffer,
          }}
        />
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
