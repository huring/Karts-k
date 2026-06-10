import { Chip } from './ui/Chip'
import { Select } from './ui/Select'
import styles from './FilterPanel.module.css'
import type { ObjectTypeKey, AttributeFilters } from '../hooks/useFilters'

const TYPE_CONFIG: Array<{ key: ObjectTypeKey; label: string; icon: string }> = [
  { key: 'fastigheter',    label: 'Fastigheter',     icon: 'landscape'   },
  { key: 'byggnader',      label: 'Byggnader',        icon: 'home'        },
  { key: 'avtal',          label: 'Avtal',            icon: 'description' },
  { key: 'nyttjanderatter',label: 'Nyttjanderätter',  icon: 'key'         },
  { key: 'aktorer',        label: 'Aktörer',          icon: 'person'      },
]

const STATUS_OPTIONS = [
  { value: 'aktiv',    label: 'Aktiv'    },
  { value: 'vilande',  label: 'Vilande'  },
  { value: 'avslutad', label: 'Avslutad' },
]

const MARKSLAG_OPTIONS = [
  { value: 'skog',       label: 'Skog'       },
  { value: 'åker',       label: 'Åker'       },
  { value: 'impediment', label: 'Impediment' },
  { value: 'vatten',     label: 'Vatten'     },
  { value: 'övrigt',     label: 'Övrigt'     },
]

interface FilterPanelProps {
  activeTypes: Record<ObjectTypeKey, boolean>
  attributes: AttributeFilters
  onToggleType: (key: ObjectTypeKey) => void
  onSetAttribute: <K extends keyof AttributeFilters>(key: K, value: AttributeFilters[K]) => void
  onReset: () => void
  hasActiveFilters: boolean
}

export function FilterPanel({
  activeTypes,
  attributes,
  onToggleType,
  onSetAttribute,
  onReset,
  hasActiveFilters,
}: FilterPanelProps) {
  return (
    <div className={styles.panel}>
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabel}>Visa objekt</span>
          {hasActiveFilters && (
            <button className={styles.resetBtn} onClick={onReset} type="button">
              Återställ
            </button>
          )}
        </div>
        <div className={styles.chips}>
          {TYPE_CONFIG.map(({ key, label, icon }) => (
            <Chip
              key={key}
              active={activeTypes[key]}
              icon={icon}
              onClick={() => onToggleType(key)}
            >
              {label}
            </Chip>
          ))}
        </div>
      </div>

      <div className={styles.divider} />

      <div className={styles.section}>
        <span className={styles.sectionLabel}>Attributfilter</span>
        <div className={styles.filters}>
          <Select
            label="Status"
            options={STATUS_OPTIONS}
            value={attributes.status ?? ''}
            onChange={val => onSetAttribute('status', val || null)}
          />
          <Select
            label="Markslag"
            options={MARKSLAG_OPTIONS}
            value={attributes.markslag ?? ''}
            onChange={val => onSetAttribute('markslag', val || null)}
            disabled={!activeTypes.fastigheter}
          />
        </div>
      </div>
    </div>
  )
}
