import type { Feature, Geometry } from 'geojson'

// ── Feature property types ────────────────────────────────────────────────────

export type FastighetProperties = {
  feature_type: 'fastighet'
  id: string
  beteckning: string
  trakt: string
  blockenhet: string
  omrnr: number
  kommunkod: string
  kommunnamn: string
  adat: string
  detaljtyp: string
  ytkval: number
  _externid: string
  _objectid: number
  _source_file: string
  // Merged from fastigheter_meta.json at load time
  status?: string
  lan?: string
  uppdragstagare?: string
  processstatus?: string | null
}

export type SkyddsomradeProperties = {
  feature_type: 'skyddsomrade'
  id: string
  soid: string
  gid: number
  namn: string
  skyddstyp: string
  status: string
  area_ha: number
  _source_file: string
  // Optional extended fields from richer DINO exports
  omr_besk?: string | null
  beslmyndig?: string | null
  forvaltare?: string | null
  geo_status?: string | null
  a_foresk?: string | null
  b_foresk?: string | null
  c_foresk?: string | null
  undantag?: string | null
  [key: string]: unknown
}

export type BeslutProperties = {
  feature_type: 'beslut'
  id: string
  soid: string
  gid: number
  namn: string
  typ: string
  status: string
  area_ha: number
  beslut_dat: string
  lagakr_dat: string
  status_dbt: string | null
  _source_file: string
  // Optional extended fields from richer DINO exports
  beslmyndig?: string | null
  forvaltare?: string | null
  geo_status?: string | null
  a_foresk?: string | null
  b_foresk?: string | null
  c_foresk?: string | null
  undantag?: string | null
  [key: string]: unknown
}

// ── Byggnad (icke-geografisk, kopplad till fastighet) ─────────────────────────

export type ByggnadSkick = 'Bra' | 'Åtgärdsbehov' | 'Bristfällig'

export type Byggnad = {
  id: string
  fastighets_id: string
  namn: string
  anvandning: string
  skick: ByggnadSkick
  bild: string
  yta_m2?: number
  byggnad_ar?: number
}

// ── Anläggning (icke-geografisk, kopplad till fastighet) ──────────────────────

export type Anlaggning = {
  id: string
  fastighets_id: string
  namn: string
  typ: string
  skick: string
  bild: string
  ar?: number
}

// ── Avtal (kopplat till fastighet) ────────────────────────────────────────────

export type Avtal = {
  id: string
  fastighets_id: string
  typ: string
  datum: string
  belopp_kr: number
  status: string
}

// ── FastighetMeta (laddas separat, ej i GeoJSON) ──────────────────────────────

export type FastighetMeta = {
  status: string
  lan: string
  uppdragstagare: string
  processstatus: string | null
}

// ── Typed feature wrappers ────────────────────────────────────────────────────

export type FastighetFeature    = Feature<Geometry, FastighetProperties>
export type SkyddsomradeFeature = Feature<Geometry, SkyddsomradeProperties>
export type BeslutFeature       = Feature<Geometry, BeslutProperties>
export type DinoFeature         = FastighetFeature | SkyddsomradeFeature | BeslutFeature

// ── Type guards ───────────────────────────────────────────────────────────────

export function isFastighet(f: Feature): f is FastighetFeature {
  return (f.properties as { feature_type?: string } | null)?.feature_type === 'fastighet'
}

export function isSkyddsomrade(f: Feature): f is SkyddsomradeFeature {
  return (f.properties as { feature_type?: string } | null)?.feature_type === 'skyddsomrade'
}

export function isBeslut(f: Feature): f is BeslutFeature {
  return (f.properties as { feature_type?: string } | null)?.feature_type === 'beslut'
}
