import styles from './SearchBar.module.css'

interface SearchBarProps {
  query: string
  onChange: (q: string) => void
}

export function SearchBar({ query, onChange }: SearchBarProps) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.inputRow}>
        <span className={`material-symbols-outlined ${styles.searchIcon}`}>search</span>
        <input
          className={styles.input}
          type="text"
          placeholder="Sök fastighetsbeteckning eller namn…"
          value={query}
          onChange={e => onChange(e.target.value)}
          aria-label="Sök fastighetsbeteckning eller namn"
          autoComplete="off"
        />
        {query && (
          <button
            className={styles.clearBtn}
            onClick={() => onChange('')}
            aria-label="Rensa sökning"
            type="button"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        )}
      </div>
    </div>
  )
}
