import { Button } from './ui/Button'
import styles from './MapToolbar.module.css'
import type { ToolMode } from '../hooks/useMapTools'
import type { Feature } from 'geojson'

const TOOLS: Array<{ mode: Exclude<ToolMode, 'none'>; label: string; icon: string }> = [
  { mode: 'spatial-search', label: 'Rumslig sökning', icon: 'pentagon'     },
  { mode: 'distance',       label: 'Mät avstånd',     icon: 'straighten'   },
  { mode: 'area',           label: 'Beräkna areal',   icon: 'square_foot'  },
  { mode: 'buffer',         label: 'Buffertzon',       icon: 'adjust'       },
]

function formatDistance(m: number): string {
  if (m === 0) return 'Klicka på kartan för att mäta'
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`
}

function formatArea(m2: number | null): string {
  if (m2 === null) return 'Rita en polygon på kartan'
  return m2 >= 10000
    ? `${(m2 / 10000).toFixed(1)} ha`
    : `${Math.round(m2).toLocaleString('sv-SE')} m²`
}

function featureName(f: Feature): string {
  const p = f.properties as Record<string, string> | null
  return p?.beteckning ?? p?.namn ?? p?.id ?? 'Okänt objekt'
}

interface MapToolbarProps {
  activeTool: ToolMode
  onSelectTool: (tool: ToolMode) => void
  panelOpen: boolean
  distance: { totalM: number; pointCount: number; onUndo: () => void }
  area: { m2: number | null; onNew: () => void }
  spatialSearch: { resultCount: number; polygonDrawn: boolean; onClear: () => void }
  buffer: {
    center: Feature | null
    radiusM: number
    onSetRadius: (r: number) => void
    onApply: () => void
    resultCount: number
    onClear: () => void
  }
}

export function MapToolbar({
  activeTool, onSelectTool, panelOpen,
  distance, area, spatialSearch, buffer,
}: MapToolbarProps) {
  const hasPanel = activeTool !== 'none'

  return (
    <div className={`${styles.wrapper} ${panelOpen ? styles.wrapperPanelOpen : ''}`}>
      <div className={styles.toolstrip}>
        {TOOLS.map(t => (
          <button
            key={t.mode}
            type="button"
            className={`${styles.toolBtn} ${activeTool === t.mode ? styles.active : ''}`}
            onClick={() => onSelectTool(t.mode)}
            title={t.label}
            aria-pressed={activeTool === t.mode}
          >
            <span className="material-symbols-outlined">{t.icon}</span>
          </button>
        ))}
      </div>

      {hasPanel && (
        <div className={styles.panel}>
          {activeTool === 'distance' && (
            <>
              <div className={styles.panelLabel}>
                <span className={`material-symbols-outlined ${styles.panelIcon}`}>straighten</span>
                <span className={styles.panelValue}>{formatDistance(distance.totalM)}</span>
              </div>
              <div className={styles.panelActions}>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={distance.onUndo}
                  disabled={distance.pointCount === 0}
                >
                  Ångra punkt
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onSelectTool('none')}>
                  Stäng
                </Button>
              </div>
            </>
          )}

          {activeTool === 'area' && (
            <>
              <div className={styles.panelLabel}>
                <span className={`material-symbols-outlined ${styles.panelIcon}`}>square_foot</span>
                <span className={styles.panelValue}>{formatArea(area.m2)}</span>
              </div>
              <div className={styles.panelActions}>
                {area.m2 !== null && (
                  <Button size="sm" variant="secondary" onClick={area.onNew}>
                    Rita ny yta
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => onSelectTool('none')}>
                  Stäng
                </Button>
              </div>
            </>
          )}

          {activeTool === 'spatial-search' && (
            <>
              <div className={styles.panelLabel}>
                <span className={`material-symbols-outlined ${styles.panelIcon}`}>pentagon</span>
                <span className={styles.panelValue}>
                  {spatialSearch.polygonDrawn
                    ? `${spatialSearch.resultCount} objekt funna`
                    : 'Rita en sökpolygon på kartan'}
                </span>
              </div>
              <div className={styles.panelActions}>
                {spatialSearch.polygonDrawn && (
                  <Button size="sm" variant="secondary" onClick={spatialSearch.onClear}>
                    Rensa sökyta
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => onSelectTool('none')}>
                  Stäng
                </Button>
              </div>
            </>
          )}

          {activeTool === 'buffer' && (
            <>
              <div className={styles.panelLabel}>
                <span className={`material-symbols-outlined ${styles.panelIcon}`}>adjust</span>
                <span className={styles.panelValue}>
                  {buffer.center
                    ? featureName(buffer.center)
                    : 'Klicka på en fastighet eller byggnad'}
                </span>
              </div>

              {buffer.center && buffer.resultCount === 0 && (
                <div className={styles.bufferInput}>
                  <input
                    type="number"
                    className={styles.radiusInput}
                    value={buffer.radiusM}
                    min={50}
                    max={50000}
                    step={50}
                    onChange={e => buffer.onSetRadius(Number(e.target.value))}
                    aria-label="Buffertavstånd i meter"
                  />
                  <span className={styles.radiusUnit}>m</span>
                  <Button size="sm" variant="primary" onClick={buffer.onApply}>
                    Beräkna
                  </Button>
                </div>
              )}

              {buffer.resultCount > 0 && (
                <div className={styles.panelValue}>
                  {buffer.resultCount} objekt inom buffert
                </div>
              )}

              <div className={styles.panelActions}>
                {(buffer.center || buffer.resultCount > 0) && (
                  <Button size="sm" variant="secondary" onClick={buffer.onClear}>
                    Rensa
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => onSelectTool('none')}>
                  Stäng
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
