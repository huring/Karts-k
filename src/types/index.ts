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

export type SkyddatomradeProperties = {
  feature_type: 'skyddatomrade'
  id: string       // "NVR-2013488"
  namn: string
  typ: string      // "NR" | "NP" | "NM" | "KR" | "OBO" | "NVO" | "DVO" | "VSO" | "LBSO" | "IF"
  status: string   // "GALLANDE" | "BESLUTAT" | "OVERKLAGAT"
  beskrivning: string | null
  area_ha: number
}

export type BeslutProperties = {
  feature_type: 'beslut'
  id: string       // "BESLUT-2201458"
  status: string   // "FORSLAG"
  area_ha: number
}

export type DelomradeProperties = {
  feature_type: 'delomrade'
  id: string       // "DO-140845"
  status: string   // "AVFORT" | "AVTALAT" | "PAGAR" | "PLANERAT"
  area_ha: number
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

export type FastighetFeature      = Feature<Geometry, FastighetProperties>
export type SkyddatomradeFeature  = Feature<Geometry, SkyddatomradeProperties>
export type BeslutFeature         = Feature<Geometry, BeslutProperties>
export type DelomradeFeature      = Feature<Geometry, DelomradeProperties>
export type DinoFeature           = FastighetFeature | SkyddatomradeFeature | BeslutFeature | DelomradeFeature

// ── Type guards ───────────────────────────────────────────────────────────────

export function isFastighet(f: Feature): f is FastighetFeature {
  return (f.properties as { feature_type?: string } | null)?.feature_type === 'fastighet'
}

export function isSkyddatomrade(f: Feature): f is SkyddatomradeFeature {
  return (f.properties as { feature_type?: string } | null)?.feature_type === 'skyddatomrade'
}

export function isBeslut(f: Feature): f is BeslutFeature {
  return (f.properties as { feature_type?: string } | null)?.feature_type === 'beslut'
}

export function isDelomrade(f: Feature): f is DelomradeFeature {
  return (f.properties as { feature_type?: string } | null)?.feature_type === 'delomrade'
}
