import styles from './MapLayerControl.module.css'
import type { ObjectTypeKey } from '../hooks/useFilters'

const LAYERS: Array<{ key: ObjectTypeKey; label: string; icon: string }> = [
  { key: 'fastigheter',    label: 'Fastigheter',  icon: 'landscape' },
  { key: 'skyddatomraden', label: 'Skyddade om.', icon: 'nature' },
  { key: 'delomraden',     label: 'Delområden',   icon: 'layers' },
  { key: 'beslut',         label: 'Beslut',       icon: 'gavel' },
  { key: 'byggnader',      label: 'Byggnader',    icon: 'home_work' },
]

interface Props {
  activeTypes: Record<ObjectTypeKey, boolean>
  onToggle: (key: ObjectTypeKey) => void
}

export function MapLayerControl({ activeTypes, onToggle }: Props) {
  return (
    <div className={styles.layerControl}>
      <span className={styles.layerLabel}>Visa på kartan</span>
      <div className={styles.chips}>
        {LAYERS.map(({ key, label, icon }) => (
          <button
            key={key}
            type="button"
            className={`${styles.chip} ${activeTypes[key] ? styles.chipActive : ''}`}
            onClick={() => onToggle(key)}
            aria-pressed={activeTypes[key]}
            title={label}
          >
            <span className={`material-symbols-outlined ${styles.chipIcon}`}>{icon}</span>
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
