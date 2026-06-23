import { useState } from 'react'
import { Chip } from './ui/Chip'
import styles from './FilterPanel.module.css'
import type { ObjectTypeKey, AttributeFilters } from '../hooks/useFilters'
import type { FilterOptions, SearchTypeCounts } from '../hooks/useSearch'

const TYPE_CONFIG: Array<{ key: ObjectTypeKey; label: string; icon: string }> = [
  { key: 'fastigheter',    label: 'Fastigheter',     icon: 'landscape'  },
  { key: 'skyddatomraden', label: 'Skyddade områden', icon: 'nature'     },
  { key: 'delomraden',     label: 'Delområden',       icon: 'layers'     },
  { key: 'beslut',         label: 'Beslut',           icon: 'gavel'      },
  { key: 'byggnader',      label: 'Byggnader',        icon: 'home_work'  },
]

interface AttrGroupConfig {
  key: keyof AttributeFilters
  label: string
  isAvailable: (opts: FilterOptions, types: Record<ObjectTypeKey, boolean>) => boolean
}

const ATTR_GROUPS: AttrGroupConfig[] = [
  { key: 'status',     label: 'Status',       isAvailable: (o, t) => o.status.length > 0 && (t.skyddatomraden || t.beslut || t.delomraden) },
  { key: 'typ',        label: 'Skyddstyp',    isAvailable: (o, t) => o.typ.length > 0 && t.skyddatomraden },
  { key: 'skick',      label: 'Byggnadsskick', isAvailable: (o, t) => o.skick.length > 0 && t.byggnader },
  { key: 'anvandning', label: 'Användning',    isAvailable: (o, t) => o.anvandning.length > 0 && t.byggnader },
]

interface FilterPanelProps {
  activeTypes: Record<ObjectTypeKey, boolean>
  attributes: AttributeFilters
  filterOptions: FilterOptions
  typeCounts: SearchTypeCounts | null
  onToggleType: (key: ObjectTypeKey) => void
  onToggleAttributeValue: (key: keyof AttributeFilters, value: string) => void
  onReset: () => void
  hasActiveFilters: boolean
}

export function FilterPanel({
  activeTypes,
  attributes,
  filterOptions,
  typeCounts,
  onToggleType,
  onToggleAttributeValue,
  onReset,
  hasActiveFilters,
}: FilterPanelProps) {
  const [attrOpen, setAttrOpen] = useState(false)

  const hasAttrFilter = Object.values(attributes).some(arr => arr.length > 0)
  const availableGroups = ATTR_GROUPS.filter(g => g.isAvailable(filterOptions, activeTypes))

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
          {TYPE_CONFIG.map(({ key, label, icon }) => {
            const count = typeCounts ? typeCounts[key] : undefined
            const dimmed = count !== undefined && count === 0
            return (
              <Chip
                key={key}
                active={activeTypes[key]}
                dimmed={dimmed}
                count={count}
                icon={icon}
                onClick={() => onToggleType(key)}
              >
                {label}
              </Chip>
            )
          })}
        </div>
      </div>

      <div className={styles.divider} />

      <div className={styles.section}>
        <button
          type="button"
          className={styles.attrToggle}
          onClick={() => setAttrOpen(o => !o)}
          aria-expanded={attrOpen}
        >
          <span className={styles.sectionLabel}>Attributfilter</span>
          {hasAttrFilter && <span className={styles.attrBadge} />}
          <span className={`material-symbols-outlined ${styles.attrChevron}`}>
            {attrOpen ? 'expand_less' : 'expand_more'}
          </span>
        </button>

        {attrOpen && (
          <div className={styles.filters}>
            {availableGroups.length === 0 && (
              <p className={styles.noFilters}>Inga filter tillgängliga för de valda objekttyperna</p>
            )}
            {availableGroups.map(({ key, label }) => (
              <div key={key} className={styles.checkGroup}>
                <span className={styles.checkGroupLabel}>{label}</span>
                {filterOptions[key].map(value => (
                  <label key={value} className={styles.checkItem}>
                    <input
                      type="checkbox"
                      className={styles.checkInput}
                      checked={attributes[key].includes(value)}
                      onChange={() => onToggleAttributeValue(key, value)}
                    />
                    <span className={styles.checkLabel}>{value}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
