import { Badge, statusVariant, skickVariant } from './ui/Badge'
import styles from './ResultsList.module.css'
import type { SearchResult, SearchResultLayer } from '../hooks/useSearch'
import type { GeocodeResult } from '../hooks/useGeocode'

const LAYER_LABELS: Record<SearchResultLayer, string> = {
  fastigheter:   'Fastighet',
  skyddsomraden: 'Skyddsvärtområde',
  beslut:        'Beslut',
  byggnader:     'Byggnad',
}

const LAYER_ICONS: Record<SearchResultLayer, string> = {
  fastigheter:   'landscape',
  skyddsomraden: 'nature',
  beslut:        'gavel',
  byggnader:     'home_work',
}

type GroupedResult = { parent: SearchResult; children: SearchResult[] }

function groupResults(results: SearchResult[]): { groups: GroupedResult[]; orphans: SearchResult[] } {
  const fastigheter   = results.filter(r => r.layer === 'fastigheter')
  const byggnader     = results.filter(r => r.layer === 'byggnader')
  const skyddsomraden = results.filter(r => r.layer === 'skyddsomraden')
  const beslut        = results.filter(r => r.layer === 'beslut')

  // byggnader keyed by fastighets_id
  const byggnaderByFid = new Map<string, SearchResult[]>()
  byggnader.forEach(b => {
    const fid = (b.feature.properties as { fastighets_id?: string }).fastighets_id
    if (!fid) return
    const list = byggnaderByFid.get(fid) ?? []
    list.push(b)
    byggnaderByFid.set(fid, list)
  })

  // beslut keyed by soid
  const beslutBySoid = new Map<string, SearchResult[]>()
  beslut.forEach(b => {
    const soid = (b.feature.properties as { soid?: string }).soid
    if (!soid) return
    const list = beslutBySoid.get(soid) ?? []
    list.push(b)
    beslutBySoid.set(soid, list)
  })

  const attachedByggnader = new Set<string>()
  const attachedBeslut    = new Set<string>()
  const groups: GroupedResult[] = []

  fastigheter.forEach(f => {
    const children = byggnaderByFid.get(f.id) ?? []
    children.forEach(c => attachedByggnader.add(c.id))
    groups.push({ parent: f, children })
  })

  skyddsomraden.forEach(s => {
    const soid = (s.feature.properties as { soid?: string }).soid ?? ''
    const children = beslutBySoid.get(soid) ?? []
    children.forEach(c => attachedBeslut.add(c.id))
    groups.push({ parent: s, children })
  })

  const orphans: SearchResult[] = [
    ...byggnader.filter(b => !attachedByggnader.has(b.id)),
    ...beslut.filter(b => !attachedBeslut.has(b.id)),
  ]

  return { groups, orphans }
}

interface ResultsListProps {
  results: SearchResult[]
  geocodeResults: GeocodeResult[]
  hasQuery: boolean
  onResultClick: (result: SearchResult) => void
  onResultHover: (result: SearchResult) => void
  onResultLeave: () => void
  onGeoResultClick: (result: GeocodeResult) => void
}

export function ResultsList({
  results,
  geocodeResults,
  hasQuery,
  onResultClick,
  onResultHover,
  onResultLeave,
  onGeoResultClick,
}: ResultsListProps) {
  const hasAnything = results.length > 0 || geocodeResults.length > 0

  if (!hasQuery) {
    return (
      <div className={styles.empty}>
        <span className={`material-symbols-outlined ${styles.emptyIcon}`}>search</span>
        <p className={styles.emptyText}>Sök eller filtrera för att se matchande objekt</p>
      </div>
    )
  }

  if (!hasAnything) {
    return (
      <div className={styles.empty}>
        <span className={`material-symbols-outlined ${styles.emptyIcon}`}>search_off</span>
        <p className={styles.emptyText}>Inga träffar</p>
      </div>
    )
  }

  const { groups, orphans } = groupResults(results)

  return (
    <div className={styles.container}>
      {results.length > 0 && (
        <>
          <div className={styles.header}>
            <span className={styles.count}>
              {results.length} träff{results.length !== 1 ? 'ar' : ''}
            </span>
          </div>
          <ul className={styles.list}>
            {groups.map(({ parent, children }) => (
              <ResultGroup
                key={`${parent.layer}-${parent.id}`}
                parent={parent}
                children={children}
                onResultClick={onResultClick}
                onResultHover={onResultHover}
                onResultLeave={onResultLeave}
              />
            ))}
            {orphans.map(result => (
              <ResultItem
                key={`${result.layer}-${result.id}`}
                result={result}
                onResultClick={onResultClick}
                onResultHover={onResultHover}
                onResultLeave={onResultLeave}
              />
            ))}
          </ul>
        </>
      )}

      {geocodeResults.length > 0 && (
        <>
          <div className={styles.header}>
            <span className={styles.count}>Platser</span>
          </div>
          <ul className={styles.list}>
            {geocodeResults.map(result => (
              <li key={result.id}>
                <button
                  type="button"
                  className={`${styles.item} ${styles.geoItem}`}
                  onClick={() => onGeoResultClick(result)}
                >
                  <span className={`material-symbols-outlined ${styles.layerIcon} ${styles.geoIcon}`}>
                    location_on
                  </span>
                  <span className={styles.content}>
                    <span className={styles.label}>{result.name}</span>
                    <span className={styles.meta}>
                      <span className={styles.layerLabel}>{result.placeName}</span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

interface ResultGroupProps {
  parent: SearchResult
  children: SearchResult[]
  onResultClick: (r: SearchResult) => void
  onResultHover: (r: SearchResult) => void
  onResultLeave: () => void
}

function ResultGroup({ parent, children, onResultClick, onResultHover, onResultLeave }: ResultGroupProps) {
  return (
    <>
      <ResultItem
        result={parent}
        onResultClick={onResultClick}
        onResultHover={onResultHover}
        onResultLeave={onResultLeave}
      />
      {children.length > 0 && (
        <li className={styles.childGroup}>
          <ul className={styles.list}>
            {children.map(child => (
              <ResultItem
                key={`${child.layer}-${child.id}`}
                result={child}
                onResultClick={onResultClick}
                onResultHover={onResultHover}
                onResultLeave={onResultLeave}
                isChild
              />
            ))}
          </ul>
        </li>
      )}
    </>
  )
}

interface ResultItemProps {
  result: SearchResult
  onResultClick: (r: SearchResult) => void
  onResultHover: (r: SearchResult) => void
  onResultLeave: () => void
  isChild?: boolean
}

function ResultItem({ result, onResultClick, onResultHover, onResultLeave, isChild }: ResultItemProps) {
  const props = result.feature.properties as Record<string, string> | null
  const status = result.layer !== 'byggnader' ? props?.status : null
  const skick  = result.layer === 'byggnader'  ? props?.skick  : null

  return (
    <li>
      <button
        type="button"
        className={`${styles.item} ${isChild ? styles.childItem : ''}`}
        onClick={() => onResultClick(result)}
        onMouseEnter={() => onResultHover(result)}
        onMouseLeave={() => onResultLeave()}
      >
        <span className={`material-symbols-outlined ${styles.layerIcon}`}>
          {LAYER_ICONS[result.layer]}
        </span>
        <span className={styles.content}>
          <span className={styles.label}>{result.label}</span>
          <span className={styles.meta}>
            <span className={styles.layerLabel}>{LAYER_LABELS[result.layer]}</span>
            {status && <Badge variant={statusVariant(status)} size="s">{status}</Badge>}
            {skick  && <Badge variant={skickVariant(skick)}   size="s">{skick}</Badge>}
          </span>
        </span>
        <span className={`material-symbols-outlined ${styles.chevron}`}>chevron_right</span>
      </button>
    </li>
  )
}
