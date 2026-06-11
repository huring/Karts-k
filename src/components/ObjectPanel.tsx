import { useState, useEffect, useMemo } from 'react'
import * as turf from '@turf/turf'
import type { Feature } from 'geojson'
import type {
  FastighetProperties,
  SkyddsomradeProperties,
  BeslutProperties,
  SkyddsomradeFeature,
  BeslutFeature,
  Byggnad,
  Anlaggning,
  Avtal,
} from '../types'
import { isFastighet, isSkyddsomrade, isBeslut } from '../types'
import type { SelectedLayer } from '../hooks/useSelectedFeature'
import { useSpatialRelations, useSpatialData, parseSoids } from '../hooks/useSpatialRelations'
import { useBuildings } from '../hooks/useBuildings'
import { useAnlaggningar } from '../hooks/useAnlaggningar'
import { useAvtal } from '../hooks/useAvtal'
import { useFastighetMeta } from '../hooks/useFastighetMeta'
import { Badge, statusVariant, skickVariant } from './ui/Badge'
import styles from './ObjectPanel.module.css'

// Navigation stack
type PanelView =
  | { kind: 'feature' }
  | { kind: 'skyddsomrade'; id: string }
  | { kind: 'beslut'; id: string }
  | { kind: 'byggnad'; id: string }

export interface ObjectPanelProps {
  feature: Feature | null
  layer: SelectedLayer | null
  initialBuildingId?: string | null
  onClose: () => void
  onFlyTo: (feature: Feature) => void
}

// ── Formatters ────────────────────────────────────────────────────────────────

function formatArea(m2: number): string {
  return m2 >= 10000
    ? `${(m2 / 10000).toFixed(1)} ha`
    : `${Math.round(m2).toLocaleString('sv-SE')} m²`
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '–'
  try { return new Date(iso).toLocaleDateString('sv-SE') } catch { return iso }
}

// ── Main export ───────────────────────────────────────────────────────────────

export function ObjectPanel({ feature, layer, initialBuildingId, onClose, onFlyTo }: ObjectPanelProps) {
  const [stack, setStack] = useState<PanelView[]>([{ kind: 'feature' }])
  useEffect(() => {
    setStack(initialBuildingId
      ? [{ kind: 'feature' }, { kind: 'byggnad', id: initialBuildingId }]
      : [{ kind: 'feature' }]
    )
  }, [feature, initialBuildingId])

  // Spatial relations for fastigheter only
  const { skyddsomraden, beslut, loading } = useSpatialRelations(
    feature && isFastighet(feature) ? feature : null,
  )
  // Full data caches — for breadcrumb labels and navigation lookups
  const { skyddsomraden: allSkydds, beslut: allBeslut } = useSpatialData()
  const buildings    = useBuildings()
  const anlaggningar = useAnlaggningar()
  const avtal        = useAvtal()
  const fastighetMeta = useFastighetMeta()

  const current   = stack[stack.length - 1]
  const canGoBack = stack.length > 1

  const navigate = (view: PanelView) => setStack(prev => [...prev.slice(-4), view])
  const goBack   = () => setStack(prev => prev.slice(0, -1))

  function viewLabel(v: PanelView): string {
    if (v.kind === 'feature') {
      if (!feature) return 'Objekt'
      const p = feature.properties as Record<string, string>
      return p.beteckning ?? p.namn ?? p.id ?? 'Objekt'
    }
    if (v.kind === 'skyddsomrade') {
      return allSkydds.find(s => s.properties.id === v.id)?.properties.namn ?? 'Skyddsvärtområde'
    }
    if (v.kind === 'beslut') {
      return allBeslut.find(b => b.properties.id === v.id)?.properties.namn ?? 'Beslut'
    }
    return buildings.getById(v.id)?.namn ?? 'Byggnad'
  }

  function headerContent() {
    if (current.kind === 'feature' && feature) return <FeatureTitle feature={feature} layer={layer} />
    if (current.kind === 'skyddsomrade') {
      const namn = allSkydds.find(s => s.properties.id === current.id)?.properties.namn ?? 'Skyddsvärtområde'
      return <span className={styles.titleText}>{namn}</span>
    }
    if (current.kind === 'beslut') {
      const namn = allBeslut.find(b => b.properties.id === current.id)?.properties.namn ?? 'Beslut'
      return <span className={styles.titleText}>{namn}</span>
    }
    if (current.kind === 'byggnad') {
      const b = buildings.getById(current.id)
      return (
        <>
          <span className={styles.titleText}>{b?.namn ?? 'Byggnad'}</span>
          {b && <Badge variant={skickVariant(b.skick)} size="s">{b.skick}</Badge>}
        </>
      )
    }
    return null
  }

  return (
    <div
      className={`${styles.panel} ${feature ? styles.open : ''}`}
      role="complementary"
      aria-label="Objektinformation"
    >
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          {canGoBack && (
            <button type="button" className={styles.iconBtn} onClick={goBack} aria-label="Tillbaka">
              <span className={`material-symbols-outlined ${styles.iconBtnIcon}`}>arrow_back</span>
            </button>
          )}
          <div className={styles.headerTitle}>{headerContent()}</div>
        </div>
        <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Stäng">
          <span className={`material-symbols-outlined ${styles.iconBtnIcon}`}>close</span>
        </button>
      </div>

      {canGoBack && (
        <div className={styles.breadcrumb}>
          {stack.map((v, i) => (
            <span key={i} className={styles.breadcrumbItem}>
              {i > 0 && <span className={styles.breadcrumbSep}>›</span>}
              <span className={styles.breadcrumbStep}>{viewLabel(v)}</span>
            </span>
          ))}
        </div>
      )}

      <div className={styles.content}>
        {current.kind === 'feature' && feature && (
          <FeatureContent
            feature={feature}
            layer={layer}
            skyddsomraden={skyddsomraden}
            beslut={beslut}
            byggnader={isFastighet(feature)
              ? buildings.getByFastighetId((feature.properties as FastighetProperties).id)
              : []}
            anlaggningar={isFastighet(feature)
              ? anlaggningar.getByFastighetId((feature.properties as FastighetProperties).id)
              : []}
            avtal={isFastighet(feature)
              ? avtal.getByFastighetId((feature.properties as FastighetProperties).id)
              : []}
            meta={isFastighet(feature)
              ? fastighetMeta.getById((feature.properties as FastighetProperties).id)
              : null}
            loading={loading}
            onNavigate={navigate}
            onFlyTo={onFlyTo}
          />
        )}
        {current.kind === 'skyddsomrade' && (
          <SkyddsomradeDetail
            feature={allSkydds.find(s => s.properties.id === current.id) ?? null}
            allBeslut={allBeslut}
            onNavigate={navigate}
            onFlyTo={onFlyTo}
          />
        )}
        {current.kind === 'beslut' && (
          <BeslutDetail
            feature={allBeslut.find(b => b.properties.id === current.id) ?? null}
            allSkydds={allSkydds}
            onNavigate={navigate}
            onFlyTo={onFlyTo}
          />
        )}
        {current.kind === 'byggnad' && (
          <ByggnadsDetail building={buildings.getById(current.id)} />
        )}
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FeatureTitle({ feature, layer }: { feature: Feature; layer: SelectedLayer | null }) {
  const p = feature.properties as Record<string, string>
  const title = p.beteckning ?? p.namn ?? p.id ?? '–'
  const badge =
    layer === 'fastigheter'   ? 'Fastighet' :
    layer === 'skyddsomraden' ? 'Skyddsvärtomr.' :
    layer === 'beslut'        ? 'Beslut' : ''
  const badgeVariant =
    layer === 'fastigheter'   ? 'default' :
    layer === 'skyddsomraden' ? 'warning' : 'success'
  return (
    <>
      <span className={styles.titleText}>{title}</span>
      {badge && <Badge variant={badgeVariant} size="s">{badge}</Badge>}
    </>
  )
}

interface FeatureContentProps {
  feature: Feature
  layer: SelectedLayer | null
  skyddsomraden: SkyddsomradeFeature[]
  beslut: BeslutFeature[]
  byggnader: Byggnad[]
  anlaggningar: Anlaggning[]
  avtal: Avtal[]
  meta: import('../types').FastighetMeta | null
  loading: boolean
  onNavigate: (v: PanelView) => void
  onFlyTo: (feature: Feature) => void
}

function FeatureContent({ feature, layer, skyddsomraden, beslut, byggnader, anlaggningar, avtal, meta, loading, onNavigate, onFlyTo }: FeatureContentProps) {
  if (isSkyddsomrade(feature)) {
    return <SkyddsomradeDetail feature={feature} allBeslut={[]} onNavigate={onNavigate} onFlyTo={onFlyTo} />
  }
  if (isBeslut(feature)) {
    return <BeslutDetail feature={feature} allSkydds={[]} onNavigate={onNavigate} onFlyTo={onFlyTo} />
  }

  // Fastighet
  const area = feature.geometry && feature.geometry.type !== 'Point' ? turf.area(feature) : null
  return (
    <>
      <PropList>
        <FastighetRows p={feature.properties as FastighetProperties} meta={meta} />
        {area !== null && (
          <PropRow label="Areal (beräknad)">
            <span className={styles.propWithIcon}>
              <span className={`material-symbols-outlined ${styles.iconArea}`}>square_foot</span>
              {formatArea(area)}
            </span>
          </PropRow>
        )}
      </PropList>
      <div className={styles.flyToRow}>
        <button type="button" className={styles.flyToBtn} onClick={() => onFlyTo(feature)}>
          <span className={`material-symbols-outlined ${styles.flyToBtnIcon}`}>my_location</span>
          Visa på karta
        </button>
      </div>
      {layer === 'fastigheter' && (
        <SkyddsstatusSection
          skyddsomraden={skyddsomraden}
          beslut={beslut}
          loading={loading}
          onNavigate={onNavigate}
        />
      )}
      {byggnader.length > 0 && (
        <ByggnaderSection byggnader={byggnader} onNavigate={onNavigate} />
      )}
      {anlaggningar.length > 0 && (
        <AnlaggningarSection anlaggningar={anlaggningar} />
      )}
      {avtal.length > 0 && (
        <AvtalSection avtal={avtal} />
      )}
    </>
  )
}

// ── Skyddsomrade detail view ──────────────────────────────────────────────────

interface SkyddsomradeDetailProps {
  feature: SkyddsomradeFeature | null
  allBeslut: BeslutFeature[]
  onNavigate: (v: PanelView) => void
  onFlyTo: (feature: Feature) => void
}

function SkyddsomradeDetail({ feature, allBeslut, onNavigate, onFlyTo }: SkyddsomradeDetailProps) {
  // Load full data if allBeslut was passed empty (direct-click scenario)
  const { beslut: cachedBeslut } = useSpatialData()
  const beslutPool = allBeslut.length > 0 ? allBeslut : cachedBeslut

  const relatedBeslut = useMemo(() => {
    if (!feature) return []
    const soIds = parseSoids(feature.properties.soid)
    return beslutPool.filter(b => soIds.includes(b.properties.soid))
  }, [feature?.properties.soid, beslutPool])

  if (!feature) return <p className={styles.emptyRelated}>Skyddsvärtområdet hittades inte</p>

  const p = feature.properties
  const area = feature.geometry && feature.geometry.type !== 'Point' ? turf.area(feature) : null

  return (
    <>
      <PropList>
        <SkyddsomradeRows p={p} />
        {area !== null && (
          <PropRow label="Areal (beräknad)">
            <span className={styles.propWithIcon}>
              <span className={`material-symbols-outlined ${styles.iconArea}`}>square_foot</span>
              {formatArea(area)}
            </span>
          </PropRow>
        )}
        {p.beslmyndig && <PropRow label="Beslutsmyndighet">{p.beslmyndig}</PropRow>}
        {p.forvaltare && <PropRow label="Förvaltare">{p.forvaltare}</PropRow>}
        {p.geo_status && <PropRow label="Geometristatus">{p.geo_status}</PropRow>}
      </PropList>

      <div className={styles.flyToRow}>
        <button type="button" className={styles.flyToBtn} onClick={() => onFlyTo(feature)}>
          <span className={`material-symbols-outlined ${styles.flyToBtnIcon}`}>my_location</span>
          Visa på karta
        </button>
      </div>

      {p.omr_besk && (
        <CollapsibleText title="Områdesbeskrivning" icon="article" text={p.omr_besk} />
      )}
      {hasForeskrifter(p) && <ForeskrifterSection p={p} />}

      {relatedBeslut.length > 0 && (
        <RelatedSection title="Beslut" count={relatedBeslut.length} icon="gavel">
          {relatedBeslut.map(b => (
            <RelatedRow
              key={b.properties.id}
              label={b.properties.namn}
              subLabel={`${b.properties.id} · ${formatDate(b.properties.beslut_dat)}`}
              badge={<Badge variant={statusVariant(b.properties.status)} size="s">{b.properties.status}</Badge>}
              onClick={() => onNavigate({ kind: 'beslut', id: b.properties.id })}
            />
          ))}
        </RelatedSection>
      )}
    </>
  )
}

// ── Beslut detail view ────────────────────────────────────────────────────────

interface BeslutDetailProps {
  feature: BeslutFeature | null
  allSkydds: SkyddsomradeFeature[]
  onNavigate: (v: PanelView) => void
  onFlyTo: (feature: Feature) => void
}

function BeslutDetail({ feature, allSkydds, onNavigate, onFlyTo }: BeslutDetailProps) {
  // Load full data if allSkydds was passed empty (direct-click scenario)
  const { skyddsomraden: cachedSkydds } = useSpatialData()
  const skyddsPool = allSkydds.length > 0 ? allSkydds : cachedSkydds

  const linkedSkyddsomraden = useMemo(() => {
    if (!feature) return []
    return skyddsPool.filter(s => parseSoids(s.properties.soid).includes(feature.properties.soid))
  }, [feature?.properties.soid, skyddsPool])

  if (!feature) return <p className={styles.emptyRelated}>Beslutet hittades inte</p>

  const p = feature.properties
  const area = feature.geometry && feature.geometry.type !== 'Point' ? turf.area(feature) : null

  return (
    <>
      <PropList>
        <BeslutRows p={p} />
        {area !== null && (
          <PropRow label="Areal (beräknad)">
            <span className={styles.propWithIcon}>
              <span className={`material-symbols-outlined ${styles.iconArea}`}>square_foot</span>
              {formatArea(area)}
            </span>
          </PropRow>
        )}
        {p.beslmyndig && <PropRow label="Beslutsmyndighet">{p.beslmyndig}</PropRow>}
        {p.forvaltare && <PropRow label="Förvaltare">{p.forvaltare}</PropRow>}
        {p.geo_status && <PropRow label="Geometristatus">{p.geo_status}</PropRow>}
      </PropList>

      <div className={styles.flyToRow}>
        <button type="button" className={styles.flyToBtn} onClick={() => onFlyTo(feature)}>
          <span className={`material-symbols-outlined ${styles.flyToBtnIcon}`}>my_location</span>
          Visa på karta
        </button>
      </div>

      {hasForeskrifter(p) && <ForeskrifterSection p={p} />}

      {linkedSkyddsomraden.length > 0 && (
        <RelatedSection title="Skyddsvärtområde" count={linkedSkyddsomraden.length} icon="nature">
          {linkedSkyddsomraden.map(s => (
            <RelatedRow
              key={s.properties.id}
              label={s.properties.namn}
              subLabel={`${s.properties.id} · ${s.properties.skyddstyp}`}
              badge={<Badge variant={statusVariant(s.properties.status)} size="s">{s.properties.status}</Badge>}
              onClick={() => onNavigate({ kind: 'skyddsomrade', id: s.properties.id })}
            />
          ))}
        </RelatedSection>
      )}
    </>
  )
}

// ── Building type → Material Symbol icon mapping ──────────────────────────────

function anvandningIcon(anvandning: string): string {
  switch (anvandning) {
    case 'Bostadsändamål':        return 'home'
    case 'Kontor/administration': return 'business'
    case 'Industriell verksamhet': return 'factory'
    case 'Lager/förråd':          return 'warehouse'
    case 'Lantbruk/stall':        return 'agriculture'
    case 'Kulturändamål':         return 'museum'
    case 'Besöksanläggning':      return 'hotel'
    case 'Teknisk anläggning':    return 'bolt'
    default:                      return 'home_work'
  }
}

// ── Byggnader section (fastighet → buildings) ─────────────────────────────────

function ByggnaderSection({ byggnader, onNavigate }: { byggnader: Byggnad[]; onNavigate: (v: PanelView) => void }) {
  return (
    <RelatedSection title="Byggnader" count={byggnader.length} icon="home_work">
      {byggnader.map(b => (
        <button
          key={b.id}
          type="button"
          className={styles.byggnadsRow}
          onClick={() => onNavigate({ kind: 'byggnad', id: b.id })}
        >
          <div className={styles.byggnadsThumbWrap}>
            <img src={b.bild} alt={b.namn} className={styles.byggnadsThumb} loading="lazy" />
          </div>
          <div className={styles.relatedContent}>
            <span className={styles.relatedLabel}>{b.namn}</span>
            <span className={styles.relatedSubLabel}>
              <span className={`material-symbols-outlined ${styles.subLabelIcon}`}>{anvandningIcon(b.anvandning)}</span>
              {b.anvandning}
            </span>
          </div>
          <Badge variant={skickVariant(b.skick)} size="s">{b.skick}</Badge>
          <span className={`material-symbols-outlined ${styles.chevronIcon}`}>chevron_right</span>
        </button>
      ))}
    </RelatedSection>
  )
}

// ── Byggnad detail view ───────────────────────────────────────────────────────

function ByggnadsDetail({ building }: { building: Byggnad | null }) {
  const [imgError, setImgError] = useState(false)
  if (!building) return <p className={styles.emptyRelated}>Byggnaden hittades inte</p>
  const icon = anvandningIcon(building.anvandning)
  return (
    <>
      <div className={styles.byggnadsImageWrap}>
        {!imgError ? (
          <img
            src={building.bild}
            alt={building.namn}
            className={styles.byggnadsImage}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className={styles.byggnadsImageFallback}>
            <span className={`material-symbols-outlined ${styles.byggnadsImageIcon}`}>{icon}</span>
          </div>
        )}
      </div>
      <PropList>
        <PropRow label="Namn">{building.namn}</PropRow>
        <PropRow label="Användningsområde">
          <span className={styles.propWithIcon}>
            <span className={`material-symbols-outlined ${styles.iconArea}`}>{icon}</span>
            {building.anvandning}
          </span>
        </PropRow>
        <PropRow label="Skick">
          <Badge variant={skickVariant(building.skick)} size="m">{building.skick}</Badge>
        </PropRow>
        {building.yta_m2 !== undefined && (
          <PropRow label="Yta">{building.yta_m2.toLocaleString('sv-SE')} m²</PropRow>
        )}
        {building.byggnad_ar !== undefined && (
          <PropRow label="Byggår">{building.byggnad_ar}</PropRow>
        )}
        <PropRow label="ID">{building.id}</PropRow>
      </PropList>
    </>
  )
}

// ── Property row components ───────────────────────────────────────────────────

function FastighetRows({ p }: { p: FastighetProperties }) {
  return (
    <>
      <PropRow label="Beteckning">{p.beteckning}</PropRow>
      <PropRow label="Trakt">{p.trakt}</PropRow>
      <PropRow label="Blockenhet">{p.blockenhet}</PropRow>
      {p.omrnr > 1 && <PropRow label="Del nr">{p.omrnr}</PropRow>}
      <PropRow label="Kommun">{p.kommunnamn}</PropRow>
      <PropRow label="Uppdaterad">{formatDate(p.adat)}</PropRow>
    </>
  )
}

function SkyddsomradeRows({ p }: { p: SkyddsomradeProperties }) {
  return (
    <>
      <PropRow label="Namn">{p.namn}</PropRow>
      <PropRow label="ID">{p.id}</PropRow>
      <PropRow label="Skyddstyp">{p.skyddstyp}</PropRow>
      <PropRow label="Status">
        <Badge variant={statusVariant(p.status)} size="s">{p.status}</Badge>
      </PropRow>
      <PropRow label="Areal (attribut)">{p.area_ha} ha</PropRow>
    </>
  )
}

function BeslutRows({ p }: { p: BeslutProperties }) {
  return (
    <>
      <PropRow label="Namn">{p.namn}</PropRow>
      <PropRow label="ID">{p.id}</PropRow>
      <PropRow label="Typ">{p.typ}</PropRow>
      <PropRow label="Status">
        <Badge variant={statusVariant(p.status)} size="s">{p.status}</Badge>
      </PropRow>
      <PropRow label="Beslutsdatum">{formatDate(p.beslut_dat)}</PropRow>
      <PropRow label="Lagakraft">{formatDate(p.lagakr_dat)}</PropRow>
      <PropRow label="Areal (attribut)">{p.area_ha} ha</PropRow>
    </>
  )
}

// ── Optional extended sections ────────────────────────────────────────────────

function hasForeskrifter(p: SkyddsomradeProperties | BeslutProperties): boolean {
  return !!(p.a_foresk || p.b_foresk || p.c_foresk || p.undantag)
}

function ForeskrifterSection({ p }: { p: SkyddsomradeProperties | BeslutProperties }) {
  const items = [
    { key: 'a_foresk' as const, label: 'A – Föreskrifter' },
    { key: 'b_foresk' as const, label: 'B – Föreskrifter' },
    { key: 'c_foresk' as const, label: 'C – Föreskrifter' },
    { key: 'undantag' as const, label: 'Undantag' },
  ].filter(({ key }) => !!p[key])

  const [open, setOpen] = useState(false)
  return (
    <div className={styles.relatedSection}>
      <button type="button" className={styles.sectionHeader} onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className={`material-symbols-outlined ${styles.sectionIcon}`}>rule</span>
        <span className={styles.sectionTitle}>Föreskrifter & undantag</span>
        <span className={styles.sectionCount}>{items.length}</span>
        <span className={`material-symbols-outlined ${styles.expandIcon}`}>{open ? 'expand_less' : 'expand_more'}</span>
      </button>
      {open && (
        <div className={styles.sectionItems}>
          {items.map(({ key, label }) => (
            <div key={key} className={styles.foreskriftBlock}>
              <div className={styles.foreskriftLabel}>{label}</div>
              <p className={styles.textBlock}>{String(p[key])}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CollapsibleText({ title, icon, text }: { title: string; icon: string; text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={styles.relatedSection}>
      <button type="button" className={styles.sectionHeader} onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className={`material-symbols-outlined ${styles.sectionIcon}`}>{icon}</span>
        <span className={styles.sectionTitle}>{title}</span>
        <span className={`material-symbols-outlined ${styles.expandIcon}`}>{open ? 'expand_less' : 'expand_more'}</span>
      </button>
      {open && (
        <div className={styles.sectionItems}>
          <p className={styles.textBlock}>{text}</p>
        </div>
      )}
    </div>
  )
}

// ── F4-2: Skyddsstatus-sektion (fastigheter only) ─────────────────────────────

interface SkyddsstatusSectionProps {
  skyddsomraden: SkyddsomradeFeature[]
  beslut: BeslutFeature[]
  loading: boolean
  onNavigate: (v: PanelView) => void
}

function SkyddsstatusSection({ skyddsomraden, beslut, loading, onNavigate }: SkyddsstatusSectionProps) {
  if (loading) return <p className={styles.loadingText}>Söker skyddsobjekt…</p>

  if (skyddsomraden.length === 0 && beslut.length === 0) {
    return (
      <div className={styles.relatedSection}>
        <div className={styles.sectionHeader} style={{ cursor: 'default' }}>
          <span className={`material-symbols-outlined ${styles.sectionIcon}`}>shield</span>
          <span className={styles.sectionTitle}>Skyddsstatus</span>
        </div>
        <p className={styles.emptyRelated}>Inga registrerade skyddsobjekt</p>
      </div>
    )
  }

  return (
    <RelatedSection title="Skyddsstatus" count={skyddsomraden.length} icon="shield">
      {skyddsomraden.map(s => {
        const p = s.properties
        // soid can be multi-value — use parseSoids for matching
        const soIds = parseSoids(p.soid)
        const relatedBeslut = beslut.filter(b => soIds.includes(b.properties.soid))
        return (
          <div key={p.id}>
            <RelatedRow
              label={p.namn}
              subLabel={`${p.id} · ${p.skyddstyp}`}
              badge={<Badge variant={statusVariant(p.status)} size="s">{p.status}</Badge>}
              onClick={() => onNavigate({ kind: 'skyddsomrade', id: p.id })}
            />
            {relatedBeslut.map(b => (
              <RelatedRow
                key={b.properties.id}
                label={`Beslut ${b.properties.id}`}
                subLabel={`${formatDate(b.properties.beslut_dat)} · lagakraft ${formatDate(b.properties.lagakr_dat)}`}
                badge={<Badge variant={statusVariant(b.properties.status)} size="s">{b.properties.status}</Badge>}
                onClick={() => onNavigate({ kind: 'beslut', id: b.properties.id })}
                indent
              />
            ))}
          </div>
        )
      })}
    </RelatedSection>
  )
}

// ── Primitive layout helpers ──────────────────────────────────────────────────

function PropList({ children }: { children: React.ReactNode }) {
  return <dl className={styles.propList}>{children}</dl>
}

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.propRow}>
      <dt className={styles.propLabel}>{label}</dt>
      <dd className={styles.propValue}>{children}</dd>
    </div>
  )
}

interface RelatedSectionProps {
  title: string; count: number; icon: string; children: React.ReactNode
}
function RelatedSection({ title, count, icon, children }: RelatedSectionProps) {
  const [expanded, setExpanded] = useState(true)
  return (
    <div className={styles.relatedSection}>
      <button type="button" className={styles.sectionHeader} onClick={() => setExpanded(e => !e)} aria-expanded={expanded}>
        <span className={`material-symbols-outlined ${styles.sectionIcon}`}>{icon}</span>
        <span className={styles.sectionTitle}>{title}</span>
        <span className={styles.sectionCount}>{count}</span>
        <span className={`material-symbols-outlined ${styles.expandIcon}`}>{expanded ? 'expand_less' : 'expand_more'}</span>
      </button>
      {expanded && <div className={styles.sectionItems}>{children}</div>}
    </div>
  )
}

interface RelatedRowProps {
  label: string; subLabel?: string; badge?: React.ReactNode; onClick: () => void; indent?: boolean
}
function RelatedRow({ label, subLabel, badge, onClick, indent }: RelatedRowProps) {
  return (
    <button
      type="button"
      className={`${styles.relatedRow} ${indent ? styles.relatedRowIndent : ''}`}
      onClick={onClick}
    >
      <div className={styles.relatedContent}>
        <span className={styles.relatedLabel}>{label}</span>
        {subLabel && <span className={styles.relatedSubLabel}>{subLabel}</span>}
      </div>
      {badge && <div className={styles.relatedBadge}>{badge}</div>}
      <span className={`material-symbols-outlined ${styles.chevronIcon}`}>chevron_right</span>
    </button>
  )
}
