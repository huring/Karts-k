import { useState, useEffect, useMemo } from 'react'
import * as turf from '@turf/turf'
import type { Feature } from 'geojson'
import type {
  FastighetProperties,
  SkyddatomradeProperties,
  BeslutProperties,
  DelomradeProperties,
  SkyddatomradeFeature,
  BeslutFeature,
  DelomradeFeature,
  Byggnad,
  Anlaggning,
  Avtal,
} from '../types'
import { isFastighet, isSkyddatomrade, isBeslut, isDelomrade } from '../types'
import type { SelectedLayer } from '../hooks/useSelectedFeature'
import { useSpatialRelations, useSpatialData, useRelatedFeatures } from '../hooks/useSpatialRelations'
import type { RelatedResult } from '../hooks/useSpatialRelations'
import { useBuildings } from '../hooks/useBuildings'
import { useAnlaggningar } from '../hooks/useAnlaggningar'
import { useAvtal } from '../hooks/useAvtal'
import { useFastighetMeta } from '../hooks/useFastighetMeta'
import { Badge, statusVariant, skickVariant } from './ui/Badge'
import styles from './ObjectPanel.module.css'

// Navigation stack
type PanelView =
  | { kind: 'feature' }
  | { kind: 'skyddatomrade'; id: string }
  | { kind: 'beslut'; id: string }
  | { kind: 'delomrade'; id: string }
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
  const { skyddatomraden, beslut, delomraden, loading } = useSpatialRelations(
    feature && isFastighet(feature) ? feature : null,
  )
  const { skyddatomraden: allSkydds, beslut: allBeslut, delomraden: allDelomraden } = useSpatialData()
  const buildings    = useBuildings()
  const anlaggningar = useAnlaggningar()
  const avtal        = useAvtal()
  const fastighetMeta = useFastighetMeta()

  const current   = stack[stack.length - 1]
  const canGoBack = stack.length > 1

  const navigate = (view: PanelView) => setStack(prev => [...prev.slice(-4), view])
  const goBack   = () => setStack(prev => prev.slice(0, -1))

  // Resolve the map feature for the current navigation step
  const flyToTarget: Feature | null =
    current.kind === 'feature' ? feature :
    current.kind === 'skyddatomrade' ? (allSkydds.find(s => s.properties.id === current.id) ?? null) :
    current.kind === 'beslut'        ? (allBeslut.find(b => b.properties.id === current.id) ?? null) :
    current.kind === 'delomrade'     ? (allDelomraden.find(d => d.properties.id === current.id) ?? null) :
    null

  // Async related features for all non-fastighet types
  const {
    loading: relatedLoading,
    skyddatomraden: relatedSkyddatomraden,
    beslut: relatedBeslut,
    delomraden: relatedDelomraden,
  } = useRelatedFeatures(flyToTarget)

  // Unified loading: fastigheter use useSpatialRelations, all others use useRelatedFeatures
  const isFastighetView = current.kind === 'feature' && feature !== null && isFastighet(feature)
  const panelIsLoading  = (isFastighetView && loading) || relatedLoading

  function viewLabel(v: PanelView): string {
    if (v.kind === 'feature') {
      if (!feature) return 'Objekt'
      const p = feature.properties as Record<string, string>
      return p.beteckning ?? p.namn ?? p.id ?? 'Objekt'
    }
    if (v.kind === 'skyddatomrade') {
      return allSkydds.find(s => s.properties.id === v.id)?.properties.namn ?? 'Skyddat område'
    }
    if (v.kind === 'beslut') {
      return allBeslut.find(b => b.properties.id === v.id)?.properties.id ?? 'Beslut'
    }
    if (v.kind === 'delomrade') {
      return allDelomraden.find(d => d.properties.id === v.id)?.properties.id ?? 'Delområde'
    }
    return buildings.getById(v.id)?.namn ?? 'Byggnad'
  }

  function headerContent() {
    if (current.kind === 'feature' && feature) return <FeatureTitle feature={feature} layer={layer} />
    if (current.kind === 'skyddatomrade') {
      const namn = allSkydds.find(s => s.properties.id === current.id)?.properties.namn ?? 'Skyddat område'
      return <span className={styles.titleText}>{namn}</span>
    }
    if (current.kind === 'beslut') {
      const id = allBeslut.find(b => b.properties.id === current.id)?.properties.id ?? 'Beslut'
      return <span className={styles.titleText}>{id}</span>
    }
    if (current.kind === 'delomrade') {
      const id = allDelomraden.find(d => d.properties.id === current.id)?.properties.id ?? 'Delområde'
      return <span className={styles.titleText}>{id}</span>
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
        <div className={styles.headerRight}>
          {flyToTarget && (
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => onFlyTo(flyToTarget)}
              aria-label="Visa på karta"
              title="Visa på karta"
            >
              <span className={`material-symbols-outlined ${styles.iconBtnIcon}`}>my_location</span>
            </button>
          )}
          <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Stäng">
            <span className={`material-symbols-outlined ${styles.iconBtnIcon}`}>close</span>
          </button>
        </div>
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
        {panelIsLoading ? (
          <div className={styles.panelLoader}>
            <div className={styles.loaderSpinner} />
            <p className={styles.loaderText}>Hämtar information…</p>
          </div>
        ) : (
          <>
            {current.kind === 'feature' && feature && (
              <FeatureContent
                feature={feature}
                layer={layer}
                skyddatomraden={skyddatomraden}
                beslut={beslut}
                delomraden={delomraden}
                related={{ skyddatomraden: relatedSkyddatomraden, beslut: relatedBeslut, delomraden: relatedDelomraden }}
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
            {current.kind === 'skyddatomrade' && (
              <SkyddatomradeDetail
                feature={allSkydds.find(s => s.properties.id === current.id) ?? null}
                relatedBeslut={relatedBeslut}
                relatedDelomraden={relatedDelomraden}
                onNavigate={navigate}
                onFlyTo={onFlyTo}
              />
            )}
            {current.kind === 'beslut' && (
              <BeslutDetail
                feature={allBeslut.find(b => b.properties.id === current.id) ?? null}
                linkedSkydds={relatedSkyddatomraden}
                onNavigate={navigate}
                onFlyTo={onFlyTo}
              />
            )}
            {current.kind === 'delomrade' && (
              <DelomradeDetail
                feature={allDelomraden.find(d => d.properties.id === current.id) ?? null}
                parentSkydds={relatedSkyddatomraden}
                onFlyTo={onFlyTo}
              />
            )}
            {current.kind === 'byggnad' && (
              <ByggnadsDetail building={buildings.getById(current.id)} />
            )}
          </>
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
    layer === 'fastigheter'    ? 'Fastighet' :
    layer === 'skyddatomraden' ? 'Skyddat område' :
    layer === 'beslut'         ? 'Beslut' :
    layer === 'delomraden'     ? 'Delområde' : ''
  const badgeVariant =
    layer === 'fastigheter'    ? 'default' :
    layer === 'skyddatomraden' ? 'warning' :
    layer === 'delomraden'     ? 'default' : 'success'
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
  skyddatomraden: SkyddatomradeFeature[]
  beslut: BeslutFeature[]
  delomraden: DelomradeFeature[]
  related: RelatedResult
  byggnader: Byggnad[]
  anlaggningar: Anlaggning[]
  avtal: Avtal[]
  meta: import('../types').FastighetMeta | null
  loading: boolean
  onNavigate: (v: PanelView) => void
  onFlyTo: (feature: Feature) => void
}

function FeatureContent({ feature, layer, skyddatomraden, beslut, delomraden, related, byggnader, anlaggningar, avtal, meta, loading, onNavigate, onFlyTo }: FeatureContentProps) {
  if (isSkyddatomrade(feature)) {
    return (
      <SkyddatomradeDetail
        feature={feature}
        relatedBeslut={related.beslut}
        relatedDelomraden={related.delomraden}
        onNavigate={onNavigate}
        onFlyTo={onFlyTo}
      />
    )
  }
  if (isBeslut(feature)) {
    return (
      <BeslutDetail
        feature={feature}
        linkedSkydds={related.skyddatomraden}
        onNavigate={onNavigate}
        onFlyTo={onFlyTo}
      />
    )
  }
  if (isDelomrade(feature)) {
    return (
      <DelomradeDetail
        feature={feature}
        parentSkydds={related.skyddatomraden}
        onFlyTo={onFlyTo}
      />
    )
  }

  // Fastighet
  const area = feature.geometry && feature.geometry.type !== 'Point' ? turf.area(feature) : null
  return (
    <>
      <SimpleAccordion title="Fastighetsuppgifter" icon="info" defaultOpen>
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
      </SimpleAccordion>
      {layer === 'fastigheter' && (
        <SkyddsstatusSection
          skyddatomraden={skyddatomraden}
          beslut={beslut}
          loading={loading}
          onNavigate={onNavigate}
          onFlyTo={onFlyTo}
        />
      )}
      {byggnader.length > 0 && (
        <ByggnaderSection byggnader={byggnader} onNavigate={onNavigate} />
      )}
      {anlaggningar.length > 0 && (
        <AnlaggningarSection anlaggningar={anlaggningar} onFlyTo={() => onFlyTo(feature)} />
      )}
      {avtal.length > 0 && (
        <AvtalSection avtal={avtal} />
      )}
      <MarkagareSection />
      <EkonomiskaVardenSection />
    </>
  )
}

// ── Skyddat område detail view ────────────────────────────────────────────────

interface SkyddatomradeDetailProps {
  feature: SkyddatomradeFeature | null
  relatedBeslut: BeslutFeature[]
  relatedDelomraden: DelomradeFeature[]
  onNavigate: (v: PanelView) => void
  onFlyTo: (feature: Feature) => void
}

function SkyddatomradeDetail({ feature, relatedBeslut, relatedDelomraden, onNavigate, onFlyTo }: SkyddatomradeDetailProps) {
  if (!feature) return <p className={styles.emptyRelated}>Skyddat område hittades inte</p>

  const p = feature.properties
  const area = feature.geometry && feature.geometry.type !== 'Point' ? turf.area(feature) : null

  return (
    <>
      <SimpleAccordion title="Områdesuppgifter" icon="info" defaultOpen>
        <PropList>
          <PropRow label="ID">{p.id}</PropRow>
          <PropRow label="Namn">{p.namn}</PropRow>
          <PropRow label="Skyddstyp">{p.typ}</PropRow>
          <PropRow label="Status">
            <Badge variant={statusVariant(p.status)} size="s">{p.status}</Badge>
          </PropRow>
          <PropRow label="Areal (attribut)">{p.area_ha} ha</PropRow>
          {area !== null && (
            <PropRow label="Areal (beräknad)">
              <span className={styles.propWithIcon}>
                <span className={`material-symbols-outlined ${styles.iconArea}`}>square_foot</span>
                {formatArea(area)}
              </span>
            </PropRow>
          )}
        </PropList>
      </SimpleAccordion>

      {p.beskrivning && (
        <CollapsibleText title="Beskrivning" icon="article" text={p.beskrivning} />
      )}

      {relatedBeslut.length > 0 && (
        <RelatedSection title="Beslut" count={relatedBeslut.length} icon="gavel">
          {relatedBeslut.map(b => (
            <RelatedRow
              key={b.properties.id}
              label={b.properties.id}
              subLabel={b.properties.status}
              badge={<Badge variant={statusVariant(b.properties.status)} size="s">{b.properties.status}</Badge>}
              onClick={() => onNavigate({ kind: 'beslut', id: b.properties.id })}
              onFlyTo={() => onFlyTo(b)}
            />
          ))}
        </RelatedSection>
      )}

      {relatedDelomraden.length > 0 && (
        <RelatedSection title="Delområden" count={relatedDelomraden.length} icon="layers">
          {relatedDelomraden.map(d => (
            <RelatedRow
              key={d.properties.id}
              label={d.properties.id}
              subLabel={d.properties.status}
              badge={<Badge variant={statusVariant(d.properties.status)} size="s">{d.properties.status}</Badge>}
              onClick={() => onNavigate({ kind: 'delomrade', id: d.properties.id })}
              onFlyTo={() => onFlyTo(d)}
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
  linkedSkydds: SkyddatomradeFeature[]
  onNavigate: (v: PanelView) => void
  onFlyTo: (feature: Feature) => void
}

function BeslutDetail({ feature, linkedSkydds, onNavigate, onFlyTo }: BeslutDetailProps) {
  if (!feature) return <p className={styles.emptyRelated}>Beslutet hittades inte</p>

  const p = feature.properties
  const area = feature.geometry && feature.geometry.type !== 'Point' ? turf.area(feature) : null

  return (
    <>
      <SimpleAccordion title="Beslutsuppgifter" icon="info" defaultOpen>
        <PropList>
          <PropRow label="ID">{p.id}</PropRow>
          <PropRow label="Status">
            <Badge variant={statusVariant(p.status)} size="s">{p.status}</Badge>
          </PropRow>
          <PropRow label="Areal (attribut)">{p.area_ha} ha</PropRow>
          {area !== null && (
            <PropRow label="Areal (beräknad)">
              <span className={styles.propWithIcon}>
                <span className={`material-symbols-outlined ${styles.iconArea}`}>square_foot</span>
                {formatArea(area)}
              </span>
            </PropRow>
          )}
        </PropList>
      </SimpleAccordion>

      {linkedSkydds.length > 0 && (
        <RelatedSection title="Skyddade områden" count={linkedSkydds.length} icon="nature">
          {linkedSkydds.map(s => (
            <RelatedRow
              key={s.properties.id}
              label={s.properties.namn}
              subLabel={`${s.properties.id} · ${s.properties.typ}`}
              badge={<Badge variant={statusVariant(s.properties.status)} size="s">{s.properties.status}</Badge>}
              onClick={() => onNavigate({ kind: 'skyddatomrade', id: s.properties.id })}
              onFlyTo={() => onFlyTo(s)}
            />
          ))}
        </RelatedSection>
      )}
    </>
  )
}

// ── Delområde detail view ─────────────────────────────────────────────────────

interface DelomradeDetailProps {
  feature: DelomradeFeature | null
  parentSkydds: SkyddatomradeFeature[]
  onFlyTo: (feature: Feature) => void
}

function DelomradeDetail({ feature, parentSkydds, onFlyTo }: DelomradeDetailProps) {
  if (!feature) return <p className={styles.emptyRelated}>Delområdet hittades inte</p>

  const p = feature.properties
  const area = feature.geometry && feature.geometry.type !== 'Point' ? turf.area(feature) : null

  return (
    <>
      <SimpleAccordion title="Delområdesuppgifter" icon="info" defaultOpen>
        <PropList>
          <PropRow label="ID">{p.id}</PropRow>
          <PropRow label="Status">
            <Badge variant={statusVariant(p.status)} size="s">{p.status}</Badge>
          </PropRow>
          <PropRow label="Areal (attribut)">{p.area_ha} ha</PropRow>
          {area !== null && (
            <PropRow label="Areal (beräknad)">
              <span className={styles.propWithIcon}>
                <span className={`material-symbols-outlined ${styles.iconArea}`}>square_foot</span>
                {formatArea(area)}
              </span>
            </PropRow>
          )}
        </PropList>
      </SimpleAccordion>

      {parentSkydds.length > 0 && (
        <RelatedSection title="Tillhör skyddat område" count={parentSkydds.length} icon="nature">
          {parentSkydds.map(s => (
            <RelatedRow
              key={s.properties.id}
              label={s.properties.namn}
              subLabel={`${s.properties.id} · ${s.properties.typ}`}
              badge={<Badge variant={statusVariant(s.properties.status)} size="s">{s.properties.status}</Badge>}
              onClick={() => {}}
              onFlyTo={() => onFlyTo(s)}
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

// ── Byggnader section ─────────────────────────────────────────────────────────

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
    <SimpleAccordion title="Byggnadsuppgifter" icon="info" defaultOpen>
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
    </SimpleAccordion>
  )
}

// ── Property row components ───────────────────────────────────────────────────

function FastighetRows({ p, meta }: { p: FastighetProperties; meta: import('../types').FastighetMeta | null }) {
  return (
    <>
      <PropRow label="Beteckning">{p.beteckning}</PropRow>
      <PropRow label="Trakt">{p.trakt}</PropRow>
      <PropRow label="Blockenhet">{p.blockenhet}</PropRow>
      {p.omrnr > 1 && <PropRow label="Del nr">{p.omrnr}</PropRow>}
      <PropRow label="Kommun">{p.kommunnamn}</PropRow>
      <PropRow label="Uppdaterad">{formatDate(p.adat)}</PropRow>
      {meta?.status && <PropRow label="Status">{meta.status}</PropRow>}
      {meta?.lan && <PropRow label="Län">{meta.lan}</PropRow>}
      {meta?.uppdragstagare && <PropRow label="Uppdragstagare">{meta.uppdragstagare}</PropRow>}
    </>
  )
}

// ── Skyddsstatus-sektion (fastigheter only) ───────────────────────────────────

interface SkyddsstatusSectionProps {
  skyddatomraden: SkyddatomradeFeature[]
  beslut: BeslutFeature[]
  loading: boolean
  onNavigate: (v: PanelView) => void
  onFlyTo: (f: import('geojson').Feature) => void
}

function SkyddsstatusSection({ skyddatomraden, beslut, loading, onNavigate, onFlyTo }: SkyddsstatusSectionProps) {
  if (loading) {
    return (
      <SimpleAccordion title="Skyddsstatus" icon="shield" defaultOpen>
        <p className={styles.loadingText}>Söker skyddsobjekt…</p>
      </SimpleAccordion>
    )
  }

  if (skyddatomraden.length === 0 && beslut.length === 0) {
    return (
      <SimpleAccordion title="Skyddsstatus" icon="shield" defaultOpen>
        <p className={styles.emptyRelated}>Inga registrerade skyddsobjekt</p>
      </SimpleAccordion>
    )
  }

  return (
    <RelatedSection title="Skyddsstatus" count={skyddatomraden.length} icon="shield">
      {skyddatomraden.map(s => {
        const sp = s.properties
        const relatedBeslut = beslut.filter(b => {
          try { return turf.booleanIntersects(s, b) } catch { return false }
        })
        return (
          <div key={sp.id}>
            <RelatedRow
              label={sp.namn}
              subLabel={`${sp.id} · ${sp.typ}`}
              badge={<Badge variant={statusVariant(sp.status)} size="s">{sp.status}</Badge>}
              onClick={() => onNavigate({ kind: 'skyddatomrade', id: sp.id })}
              onFlyTo={() => onFlyTo(s)}
            />
            {relatedBeslut.map(b => (
              <RelatedRow
                key={b.properties.id}
                label={`Beslut ${b.properties.id}`}
                subLabel={b.properties.status}
                badge={<Badge variant={statusVariant(b.properties.status)} size="s">{b.properties.status}</Badge>}
                onClick={() => onNavigate({ kind: 'beslut', id: b.properties.id })}
                onFlyTo={() => onFlyTo(b)}
                indent
              />
            ))}
          </div>
        )
      })}
    </RelatedSection>
  )
}

// ── Anläggningar section ──────────────────────────────────────────────────────

function AnlaggningarSection({ anlaggningar, onFlyTo }: { anlaggningar: Anlaggning[]; onFlyTo?: () => void }) {
  return (
    <RelatedSection title="Anläggningar" count={anlaggningar.length} icon="construction">
      {anlaggningar.map(a => (
        <div key={a.id} className={styles.relatedRow} style={{ cursor: 'default' }}>
          <div className={styles.relatedContent}>
            <span className={styles.relatedLabel}>{a.namn}</span>
            <span className={styles.relatedSubLabel}>{a.typ} · {a.skick}</span>
          </div>
          {onFlyTo && (
            <button
              type="button"
              className={styles.flyToIconBtn}
              title="Visa på karta"
              onClick={onFlyTo}
            >
              <span className="material-symbols-outlined">my_location</span>
            </button>
          )}
        </div>
      ))}
    </RelatedSection>
  )
}

// ── Avtal section ─────────────────────────────────────────────────────────────

function AvtalSection({ avtal }: { avtal: Avtal[] }) {
  return (
    <RelatedSection title="Avtal" count={avtal.length} icon="handshake">
      {avtal.map(a => (
        <div key={a.id} className={styles.relatedRow} style={{ cursor: 'default' }}>
          <div className={styles.relatedContent}>
            <span className={styles.relatedLabel}>{a.typ}</span>
            <span className={styles.relatedSubLabel}>{formatDate(a.datum)} · {a.belopp_kr.toLocaleString('sv-SE')} kr</span>
          </div>
          <Badge variant={statusVariant(a.status)} size="s">{a.status}</Badge>
        </div>
      ))}
    </RelatedSection>
  )
}

// ── Markägare section (dummy data) ───────────────────────────────────────────

function MarkagareSection() {
  return (
    <SimpleAccordion title="Markägare" icon="person">
      <div className={styles.markagareCard}>
        <div className={styles.markagareOrg}>Naturvårdsverket</div>
        <div className={styles.markagareRow}>
          <span className={`material-symbols-outlined ${styles.markagareIcon}`}>badge</span>
          <span>Anna Lindgren</span>
          <span className={styles.markagareRole}>Förvaltare</span>
        </div>
        <div className={styles.markagareRow}>
          <span className={`material-symbols-outlined ${styles.markagareIcon}`}>mail</span>
          <span>anna.lindgren@naturvardsverket.se</span>
        </div>
        <div className={styles.markagareRow}>
          <span className={`material-symbols-outlined ${styles.markagareIcon}`}>phone</span>
          <span>010-698 10 00</span>
        </div>
      </div>
      <button type="button" className={styles.sectionLink} onClick={() => {}}>
        <span>Visa fullständig ägarinformation</span>
        <span className={`material-symbols-outlined ${styles.sectionLinkIcon}`}>open_in_new</span>
      </button>
    </SimpleAccordion>
  )
}

// ── Ekonomiska värden section (dummy data) ────────────────────────────────────

function EkonomiskaVardenSection() {
  return (
    <SimpleAccordion title="Ekonomiska värden" icon="account_balance">
      <div className={styles.ekonomiGroup}>
        <div className={styles.ekonomiGroupTitle}>Intäkter</div>
        <div className={styles.ekonomiRow}>
          <span>Nyttjanderätter</span>
          <span>125 000 kr</span>
        </div>
        <div className={styles.ekonomiRow}>
          <span>Övriga intäkter</span>
          <span>120 000 kr</span>
        </div>
        <div className={`${styles.ekonomiRow} ${styles.ekonomiSubtotal}`}>
          <span>Summa intäkter</span>
          <span>245 000 kr/år</span>
        </div>
      </div>
      <div className={styles.ekonomiGroup}>
        <div className={styles.ekonomiGroupTitle}>Kostnader</div>
        <div className={styles.ekonomiRow}>
          <span>Anläggningar</span>
          <span>215 000 kr</span>
        </div>
        <div className={styles.ekonomiRow}>
          <span>Förvaltning och skötsel</span>
          <span>172 000 kr</span>
        </div>
        <div className={`${styles.ekonomiRow} ${styles.ekonomiSubtotal}`}>
          <span>Summa kostnader</span>
          <span>387 000 kr/år</span>
        </div>
      </div>
      <div className={`${styles.ekonomiRow} ${styles.ekonomiNetto} ${styles.ekonomiNegative}`}>
        <span>Netto</span>
        <span>−142 000 kr/år</span>
      </div>
      <button type="button" className={styles.sectionLink} onClick={() => {}}>
        <span>Visa fullständig ekonomisk redovisning</span>
        <span className={`material-symbols-outlined ${styles.sectionLinkIcon}`}>open_in_new</span>
      </button>
    </SimpleAccordion>
  )
}

// ── Collapsible text ──────────────────────────────────────────────────────────

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

// ── Accordion helpers ─────────────────────────────────────────────────────────

function SimpleAccordion({ title, icon, defaultOpen = false, children }: {
  title: string
  icon: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [expanded, setExpanded] = useState(defaultOpen)
  return (
    <div className={styles.relatedSection}>
      <button type="button" className={styles.sectionHeader} onClick={() => setExpanded(e => !e)} aria-expanded={expanded}>
        <span className={`material-symbols-outlined ${styles.sectionIcon}`}>{icon}</span>
        <span className={styles.sectionTitle}>{title}</span>
        <span className={`material-symbols-outlined ${styles.expandIcon}`}>{expanded ? 'expand_less' : 'expand_more'}</span>
      </button>
      {expanded && <div className={styles.sectionItems}>{children}</div>}
    </div>
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
  const [expanded, setExpanded] = useState(false)
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
  label: string; subLabel?: string; badge?: React.ReactNode; onClick: () => void; onFlyTo?: () => void; indent?: boolean
}
function RelatedRow({ label, subLabel, badge, onClick, onFlyTo, indent }: RelatedRowProps) {
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
      {onFlyTo && (
        <button
          type="button"
          className={styles.flyToIconBtn}
          title="Visa på karta"
          onClick={e => { e.stopPropagation(); onFlyTo() }}
        >
          <span className="material-symbols-outlined">my_location</span>
        </button>
      )}
      <span className={`material-symbols-outlined ${styles.chevronIcon}`}>chevron_right</span>
    </button>
  )
}
