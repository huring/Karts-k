import { useState } from 'react'
import type { SearchResult, SearchResultLayer } from '../hooks/useSearch'
import type { GeocodeResult } from '../hooks/useGeocode'
import styles from './SearchBar.module.css'

const LAYER_ICONS: Record<SearchResultLayer, string> = {
  fastigheter:    'landscape',
  skyddatomraden: 'nature',
  beslut:         'gavel',
  delomraden:     'layers',
  byggnader:      'home_work',
}

interface SearchBarProps {
  query: string
  onChange: (q: string) => void
  onCommit?: () => void
  suggestions?: SearchResult[]
  onSuggestionClick?: (r: SearchResult) => void
  geocodeResults?: GeocodeResult[]
  onGeoResultClick?: (r: GeocodeResult) => void
}

export function SearchBar({
  query,
  onChange,
  onCommit,
  suggestions = [],
  onSuggestionClick,
  geocodeResults = [],
  onGeoResultClick,
}: SearchBarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const hasItems = suggestions.length > 0 || geocodeResults.length > 0
  const showDropdown = dropdownOpen && hasItems

  const handleCommit = () => {
    setDropdownOpen(false)
    onCommit?.()
  }

  const handleSuggestionClick = (r: SearchResult) => {
    setDropdownOpen(false)
    onSuggestionClick?.(r)
  }

  const handleGeoClick = (r: GeocodeResult) => {
    setDropdownOpen(false)
    onGeoResultClick?.(r)
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.inputRow}>
        <span className={`material-symbols-outlined ${styles.searchIcon}`}>search</span>
        <input
          className={styles.input}
          type="text"
          placeholder="Sök fastighetsbeteckning, namn eller ort…"
          value={query}
          onChange={e => { onChange(e.target.value); setDropdownOpen(e.target.value.trim().length >= 2) }}
          onKeyDown={e => { if (e.key === 'Enter') handleCommit() }}
          aria-label="Sök fastighetsbeteckning, namn eller ort"
          autoComplete="off"
        />
        {query && (
          <button
            className={styles.clearBtn}
            onClick={() => { onChange(''); setDropdownOpen(false) }}
            aria-label="Rensa sökning"
            type="button"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        )}
      </div>

      {showDropdown && (
        <div className={styles.dropdown}>
          {suggestions.length > 0 && (
            <>
              <div className={styles.dropdownSection}>Objekt</div>
              {suggestions.map(r => (
                <button
                  key={`${r.layer}-${r.id}`}
                  type="button"
                  className={styles.dropdownItem}
                  onClick={() => handleSuggestionClick(r)}
                >
                  <span className={`material-symbols-outlined ${styles.dropdownItemIcon}`}>
                    {LAYER_ICONS[r.layer]}
                  </span>
                  <span className={styles.dropdownItemContent}>
                    <span className={styles.dropdownItemLabel}>{r.label}</span>
                    {r.subLabel && <span className={styles.dropdownItemSub}>{r.subLabel}</span>}
                  </span>
                </button>
              ))}
            </>
          )}

          {geocodeResults.length > 0 && (
            <>
              {suggestions.length > 0 && <div className={styles.dropdownDivider} />}
              <div className={styles.dropdownSection}>Platser</div>
              {geocodeResults.map(r => (
                <button
                  key={r.id}
                  type="button"
                  className={styles.dropdownItem}
                  onClick={() => handleGeoClick(r)}
                >
                  <span className={`material-symbols-outlined ${styles.dropdownItemIcon}`}>location_on</span>
                  <span className={styles.dropdownItemContent}>
                    <span className={styles.dropdownItemLabel}>{r.name}</span>
                    <span className={styles.dropdownItemSub}>{r.placeName}</span>
                  </span>
                </button>
              ))}
            </>
          )}

          <div className={styles.dropdownDivider} />
          <button
            type="button"
            className={`${styles.dropdownItem} ${styles.dropdownCommit}`}
            onClick={handleCommit}
          >
            <span className={`material-symbols-outlined ${styles.dropdownItemIcon}`}>search</span>
            <span>Sök på &ldquo;{query}&rdquo;</span>
          </button>
        </div>
      )}
    </div>
  )
}
