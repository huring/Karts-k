import type { LayerId } from '../hooks/useMapLayers'
import styles from './LayerToggle.module.css'

const LAYERS: { id: LayerId; label: string; color: string }[] = [
  { id: 'fastigheter', label: 'Fastigheter', color: '#405D1A' },
  { id: 'byggnader',   label: 'Byggnader',   color: '#E3A480' },
]

interface LayerToggleProps {
  visibility: Record<LayerId, boolean>
  onToggle: (id: LayerId) => void
}

export function LayerToggle({ visibility, onToggle }: LayerToggleProps) {
  return (
    <div className={styles.panel}>
      <div className={styles.title}>Lager</div>
      {LAYERS.map(({ id, label, color }) => (
        <label key={id} className={styles.item}>
          <input
            type="checkbox"
            className={styles.checkbox}
            checked={visibility[id]}
            onChange={() => onToggle(id)}
          />
          <span className={styles.dot} style={{ background: color }} />
          <span className={styles.label}>{label}</span>
        </label>
      ))}
    </div>
  )
}
