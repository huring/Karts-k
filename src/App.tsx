import { useRef } from 'react'
import { Map } from './components/Map'
import { SearchBar } from './components/SearchBar'
import { FilterPanel } from './components/FilterPanel'
import { ResultsList } from './components/ResultsList'
import { MapToolbar } from './components/MapToolbar'
import { ObjectPanel } from './components/ObjectPanel'
import { useMap } from './hooks/useMap'
import { useMapLayers } from './hooks/useMapLayers'
import { useDrawTools } from './hooks/useDrawTools'
import { useSearch } from './hooks/useSearch'
import { useFilters } from './hooks/useFilters'
import { useMapTools } from './hooks/useMapTools'
import { useSelectedFeature } from './hooks/useSelectedFeature'
import styles from './App.module.css'

function App() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { mapRef, drawRef, isLoaded, flyToFeature } = useMap(containerRef)

  const {
    activeTypes, attributes,
    toggleType, setAttributeFilter,
    resetFilters, hasActiveFilters,
  } = useFilters()

  const { query, setQuery, results, highlightIds, hasActiveQuery } = useSearch(
    mapRef, activeTypes, attributes,
  )

  const {
    activeTool, selectTool,
    distanceTotalM, distancePointCount, undoLastPoint,
    areaM2, newArea,
    spatialResults, searchPolygonDrawn, clearSearch,
    bufferCenter, bufferRadiusM, setBufferRadiusM, applyBuffer, bufferResults, clearBuffer,
  } = useMapTools(mapRef, drawRef, isLoaded)

  const { selected, clearSelected } = useSelectedFeature(
    mapRef, isLoaded, activeTool !== 'none',
  )

  const selectedId = (selected?.feature.properties as { id?: string } | null)?.id ?? null

  useMapLayers(mapRef, isLoaded, activeTypes, attributes, highlightIds, selectedId)
  useDrawTools(mapRef, isLoaded)

  // When a spatial tool has results, show those in the sidebar instead of text search
  const showSpatialResults = activeTool === 'spatial-search' && searchPolygonDrawn
  const showBufferResults  = activeTool === 'buffer' && bufferCenter !== null

  const displayResults  = showSpatialResults ? spatialResults
    : showBufferResults  ? bufferResults
    : results

  const displayHasQuery = showSpatialResults || showBufferResults || hasActiveQuery

  return (
    <div className="app">
      <aside className={styles.sidebar}>
        <SearchBar query={query} onChange={setQuery} />
        <FilterPanel
          activeTypes={activeTypes}
          attributes={attributes}
          onToggleType={toggleType}
          onSetAttribute={setAttributeFilter}
          onReset={resetFilters}
          hasActiveFilters={hasActiveFilters}
        />
        <ResultsList
          results={displayResults}
          hasQuery={displayHasQuery}
          onResultClick={result => flyToFeature(result.feature)}
        />
      </aside>

      <Map containerRef={containerRef}>
        <MapToolbar
          activeTool={activeTool}
          onSelectTool={selectTool}
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
          onClose={clearSelected}
          onFlyTo={flyToFeature}
        />
      </Map>
    </div>
  )
}

export default App
