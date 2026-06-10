import { useState, useEffect } from 'react'
import * as turf from '@turf/turf'
import type { Feature } from 'geojson'
import type { FastighetProperties, ByggnadsProperties, Avtal, Nyttjanderatt, Aktor } from '../types'
import type { SelectedLayer } from '../hooks/useSelectedFeature'
import { useRelatedObjects } from '../hooks/useRelatedObjects'
import { Badge, statusVariant } from './ui/Badge'
import styles from './ObjectPanel.module.css'

// Navigation stack entries (F4-3)
type PanelView =
  | { kind: 'feature' }
  | { kind: 'avtal'; id: string }
  | { kind: 'nyttjanderatt'; id: string }
  | { kind: 'aktor'; id: string }

export interface ObjectPanelProps {
  feature: Feature | null
  layer: SelectedLayer | null
  onClose: () => void
  onFlyTo: (feature: Feature) => void
}

// --- Formatters ---

function formatArea(m2: number): string {
  return m2 >= 10000
    ? `${(m2 / 10000).toFixed(1)} ha`
    : `${Math.round(m2).toLocaleString('sv-SE')} m²`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('sv-SE')
}

const STATUS_LABEL: Record<string, string> = {
  aktiv: 'Aktiv', vilande: 'Vilande', avslutad: 'Avslutad', riven: 'Riven',
}

const MARKSLAG_LABEL: Record<string, string> = {
  skog: 'Skog', åker: 'Åker', impediment: 'Impediment', vatten: 'Vatten', övrigt: 'Övrigt',
}

const NR_TYPE_LABEL: Record<string, string> = {
  jakt: 'Jakt', arrende: 'Arrende', servitut: 'Servitut', väg: 'Väg', övrigt: 'Övrigt',
}

// --- Main export ---

export function ObjectPanel({ feature, layer, onClose, onFlyTo }: ObjectPanelProps) {
  const [stack, setStack] = useState<PanelView[]>([{ kind: 'feature' }])

  // Reset navigation stack whenever the selected feature changes
  useEffect(() => { setStack([{ kind: 'feature' }]) }, [feature])

  const fastighetId: string | null = feature
    ? (layer === 'fastigheter'
        ? (feature.properties as FastighetProperties).id
        : (feature.properties as ByggnadsProperties).fastighet_id)
    : null

  const { avtal, nyttjanderatter, relevantAktorer, getAktor, loading } = useRelatedObjects(fastighetId)

  const current   = stack[stack.length - 1]
  const canGoBack = stack.length > 1

  const navigate = (view: PanelView) => setStack(prev => [...prev.slice(-4), view])
  const goBack   = () => setStack(prev => prev.slice(0, -1))

  const viewLabel = (v: PanelView): string => {
    switch (v.kind) {
      case 'feature': {
        if (!feature) return 'Objekt'
        const p = feature.properties as FastighetProperties & ByggnadsProperties
        return p.beteckning ?? p.byggnadstyp ?? p.id
      }
      case 'avtal': {
        const a = avtal.find(x => x.id === v.id)
        return a ? a.avtalstyp : 'Avtal'
      }
      case 'nyttjanderatt': {
        const nr = nyttjanderatter.find(x => x.id === v.id)
        return nr ? (NR_TYPE_LABEL[nr.rattighetstyp] ?? nr.rattighetstyp) : 'Nyttjanderätt'
      }
      case 'aktor': {
        return getAktor(v.id)?.namn ?? 'Aktör'
      }
    }
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
          <div className={styles.headerTitle}>
            {current.kind === 'feature' && feature && (
              <FeatureTitle feature={feature} layer={layer} />
            )}
            {current.kind === 'avtal'         && <span className={styles.titleText}>Avtal</span>}
            {current.kind === 'nyttjanderatt' && <span className={styles.titleText}>Nyttjanderätt</span>}
            {current.kind === 'aktor'         && <span className={styles.titleText}>Aktör</span>}
          </div>
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
            avtal={avtal}
            nyttjanderatter={nyttjanderatter}
            aktorer={relevantAktorer}
            loading={loading}
            onNavigate={navigate}
            onFlyTo={onFlyTo}
          />
        )}
        {current.kind === 'avtal' && (
          <AvtalContent
            avtal={avtal.find(a => a.id === current.id) ?? null}
            getAktor={getAktor}
            onNavigate={navigate}
          />
        )}
        {current.kind === 'nyttjanderatt' && (
          <NrContent
            nr={nyttjanderatter.find(n => n.id === current.id) ?? null}
            getAktor={getAktor}
            onNavigate={navigate}
          />
        )}
        {current.kind === 'aktor' && (
          <AktorContent aktor={getAktor(current.id) ?? null} />
        )}
      </div>
    </div>
  )
}

// --- Sub-components ---

function FeatureTitle({ feature, layer }: { feature: Feature; layer: SelectedLayer | null }) {
  const p = feature.properties as FastighetProperties & ByggnadsProperties
  return (
    <>
      <span className={styles.titleText}>{p.beteckning ?? p.id}</span>
      <Badge variant={layer === 'fastigheter' ? 'default' : 'warning'} size="s">
        {layer === 'fastigheter' ? 'Fastighet' : 'Byggnad'}
      </Badge>
    </>
  )
}

interface FeatureContentProps {
  feature: Feature
  layer: SelectedLayer | null
  avtal: Avtal[]
  nyttjanderatter: Nyttjanderatt[]
  aktorer: Aktor[]
  loading: boolean
  onNavigate: (v: PanelView) => void
  onFlyTo: (feature: Feature) => void
}

function FeatureContent({
  feature, layer, avtal, nyttjanderatter, aktorer, loading, onNavigate, onFlyTo,
}: FeatureContentProps) {
  const p    = feature.properties as FastighetProperties & ByggnadsProperties
  // F4-4: Calculate area dynamically with Turf.js
  const area = feature.geometry ? turf.area(feature) : null

  return (
    <>
      <PropList>
        <PropRow label="Status">
          <Badge variant={statusVariant(p.status)} size="s">{STATUS_LABEL[p.status] ?? p.status}</Badge>
        </PropRow>
        {layer === 'fastigheter' && p.markslag && (
          <PropRow label="Markslag">{MARKSLAG_LABEL[p.markslag] ?? p.markslag}</PropRow>
        )}
        {layer === 'byggnader' && p.byggnadstyp && (
          <PropRow label="Byggnadstyp">{p.byggnadstyp}</PropRow>
        )}
        {layer === 'byggnader' && p.fastighet_id && (
          <PropRow label="Tillhör fastighet">{p.fastighet_id}</PropRow>
        )}
        {layer === 'byggnader' && p.byggar && (
          <PropRow label="Byggår">{p.byggar}</PropRow>
        )}
        {area !== null && (
          <PropRow label="Areal">
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

      {loading && <p className={styles.loadingText}>Hämtar kopplade objekt…</p>}

      {!loading && avtal.length > 0 && (
        <RelatedSection title="Avtal" count={avtal.length} icon="description">
          {avtal.map(a => (
            <RelatedRow
              key={a.id}
              label={a.avtalstyp}
              subLabel={
                a.giltig_till
                  ? `${formatDate(a.giltig_fran)} – ${formatDate(a.giltig_till)}`
                  : `Fr.o.m. ${formatDate(a.giltig_fran)}`
              }
              badge={
                <Badge variant={statusVariant(a.status)} size="s">
                  {STATUS_LABEL[a.status] ?? a.status}
                </Badge>
              }
              onClick={() => onNavigate({ kind: 'avtal', id: a.id })}
            />
          ))}
        </RelatedSection>
      )}

      {!loading && nyttjanderatter.length > 0 && (
        <RelatedSection title="Nyttjanderätter" count={nyttjanderatter.length} icon="key">
          {nyttjanderatter.map(nr => {
            const innehavare = aktorer.find(a => a.id === nr.innehavare_id)
            return (
              <RelatedRow
                key={nr.id}
                label={NR_TYPE_LABEL[nr.rattighetstyp] ?? nr.rattighetstyp}
                subLabel={innehavare?.namn ?? nr.innehavare_id}
                badge={
                  <Badge variant={nr.status === 'aktiv' ? 'success' : 'neutral'} size="s">
                    {STATUS_LABEL[nr.status] ?? nr.status}
                  </Badge>
                }
                onClick={() => onNavigate({ kind: 'nyttjanderatt', id: nr.id })}
              />
            )
          })}
        </RelatedSection>
      )}

      {!loading && aktorer.length > 0 && (
        <RelatedSection title="Aktörer" count={aktorer.length} icon="person">
          {aktorer.map(a => (
            <RelatedRow
              key={a.id}
              label={a.namn}
              subLabel={a.typ === 'organisation' ? (a.organisationsnummer ?? 'Organisation') : 'Person'}
              onClick={() => onNavigate({ kind: 'aktor', id: a.id })}
            />
          ))}
        </RelatedSection>
      )}

      {!loading && avtal.length === 0 && nyttjanderatter.length === 0 && aktorer.length === 0 && (
        <p className={styles.emptyRelated}>Inga kopplade objekt hittades</p>
      )}
    </>
  )
}

interface AvtalContentProps {
  avtal: Avtal | null
  getAktor: (id: string) => Aktor | undefined
  onNavigate: (v: PanelView) => void
}

function AvtalContent({ avtal, getAktor, onNavigate }: AvtalContentProps) {
  if (!avtal) return <p className={styles.emptyRelated}>Avtalet hittades inte</p>
  const part = getAktor(avtal.part_id)
  return (
    <>
      <PropList>
        <PropRow label="Typ">{avtal.avtalstyp}</PropRow>
        <PropRow label="Status">
          <Badge variant={statusVariant(avtal.status)} size="s">{STATUS_LABEL[avtal.status] ?? avtal.status}</Badge>
        </PropRow>
        <PropRow label="Giltig fr.o.m.">{formatDate(avtal.giltig_fran)}</PropRow>
        {avtal.giltig_till && (
          <PropRow label="Giltig t.o.m.">{formatDate(avtal.giltig_till)}</PropRow>
        )}
      </PropList>
      {part && (
        <RelatedSection title="Part" count={1} icon="person">
          <RelatedRow
            label={part.namn}
            subLabel={part.typ === 'organisation' ? (part.organisationsnummer ?? 'Organisation') : 'Person'}
            onClick={() => onNavigate({ kind: 'aktor', id: part.id })}
          />
        </RelatedSection>
      )}
    </>
  )
}

interface NrContentProps {
  nr: Nyttjanderatt | null
  getAktor: (id: string) => Aktor | undefined
  onNavigate: (v: PanelView) => void
}

function NrContent({ nr, getAktor, onNavigate }: NrContentProps) {
  if (!nr) return <p className={styles.emptyRelated}>Nyttjanderätten hittades inte</p>
  const innehavare = getAktor(nr.innehavare_id)
  return (
    <>
      <PropList>
        <PropRow label="Typ">{NR_TYPE_LABEL[nr.rattighetstyp] ?? nr.rattighetstyp}</PropRow>
        <PropRow label="Status">
          <Badge variant={nr.status === 'aktiv' ? 'success' : 'neutral'} size="s">
            {STATUS_LABEL[nr.status] ?? nr.status}
          </Badge>
        </PropRow>
      </PropList>
      {innehavare && (
        <RelatedSection title="Innehavare" count={1} icon="person">
          <RelatedRow
            label={innehavare.namn}
            subLabel={innehavare.typ === 'organisation' ? (innehavare.organisationsnummer ?? 'Organisation') : 'Person'}
            onClick={() => onNavigate({ kind: 'aktor', id: innehavare.id })}
          />
        </RelatedSection>
      )}
    </>
  )
}

function AktorContent({ aktor }: { aktor: Aktor | null }) {
  if (!aktor) return <p className={styles.emptyRelated}>Aktören hittades inte</p>
  return (
    <PropList>
      <PropRow label="Namn">{aktor.namn}</PropRow>
      <PropRow label="Typ">{aktor.typ === 'organisation' ? 'Organisation' : 'Person'}</PropRow>
      {aktor.organisationsnummer && (
        <PropRow label="Org.nr">{aktor.organisationsnummer}</PropRow>
      )}
    </PropList>
  )
}

// --- Primitive layout helpers ---

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
  title: string
  count: number
  icon: string
  children: React.ReactNode
}

function RelatedSection({ title, count, icon, children }: RelatedSectionProps) {
  const [expanded, setExpanded] = useState(true)
  return (
    <div className={styles.relatedSection}>
      <button
        type="button"
        className={styles.sectionHeader}
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
      >
        <span className={`material-symbols-outlined ${styles.sectionIcon}`}>{icon}</span>
        <span className={styles.sectionTitle}>{title}</span>
        <span className={styles.sectionCount}>{count}</span>
        <span className={`material-symbols-outlined ${styles.expandIcon}`}>
          {expanded ? 'expand_less' : 'expand_more'}
        </span>
      </button>
      {expanded && <div className={styles.sectionItems}>{children}</div>}
    </div>
  )
}

interface RelatedRowProps {
  label: string
  subLabel?: string
  badge?: React.ReactNode
  onClick: () => void
}

function RelatedRow({ label, subLabel, badge, onClick }: RelatedRowProps) {
  return (
    <button type="button" className={styles.relatedRow} onClick={onClick}>
      <div className={styles.relatedContent}>
        <span className={styles.relatedLabel}>{label}</span>
        {subLabel && <span className={styles.relatedSubLabel}>{subLabel}</span>}
      </div>
      {badge && <div className={styles.relatedBadge}>{badge}</div>}
      <span className={`material-symbols-outlined ${styles.chevronIcon}`}>chevron_right</span>
    </button>
  )
}
