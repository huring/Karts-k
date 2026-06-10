import { Badge, statusVariant } from './ui/Badge'
import styles from './ResultsList.module.css'
import type { SearchResult, SearchResultLayer } from '../hooks/useSearch'

const LAYER_LABELS: Record<SearchResultLayer, string> = {
  fastigheter: 'Fastighet',
  byggnader:   'Byggnad',
}

const LAYER_ICONS: Record<SearchResultLayer, string> = {
  fastigheter: 'landscape',
  byggnader:   'home',
}

interface ResultsListProps {
  results: SearchResult[]
  hasQuery: boolean
  onResultClick: (result: SearchResult) => void
}

export function ResultsList({ results, hasQuery, onResultClick }: ResultsListProps) {
  if (!hasQuery) {
    return (
      <div className={styles.empty}>
        <span className={`material-symbols-outlined ${styles.emptyIcon}`}>search</span>
        <p className={styles.emptyText}>Sök eller filtrera för att se matchande objekt</p>
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className={styles.empty}>
        <span className={`material-symbols-outlined ${styles.emptyIcon}`}>search_off</span>
        <p className={styles.emptyText}>Inga träffar</p>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.count}>
          {results.length} träff{results.length !== 1 ? 'ar' : ''}
        </span>
      </div>
      <ul className={styles.list}>
        {results.map(result => {
          const status = (result.feature.properties as Record<string, string>)?.status
          return (
            <li key={result.id}>
              <button
                type="button"
                className={styles.item}
                onClick={() => onResultClick(result)}
              >
                <span className={`material-symbols-outlined ${styles.layerIcon}`}>
                  {LAYER_ICONS[result.layer]}
                </span>
                <span className={styles.content}>
                  <span className={styles.label}>{result.label}</span>
                  <span className={styles.meta}>
                    <span className={styles.layerLabel}>{LAYER_LABELS[result.layer]}</span>
                    {status && (
                      <Badge variant={statusVariant(status)} size="s">{status}</Badge>
                    )}
                  </span>
                </span>
                <span className={`material-symbols-outlined ${styles.chevron}`}>
                  chevron_right
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
