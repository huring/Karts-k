export type FastighetProperties = {
  id: string
  beteckning: string
  namn?: string
  markslag: 'skog' | 'åker' | 'impediment' | 'vatten' | 'övrigt'
  status: 'aktiv' | 'vilande' | 'avslutad'
  areal_m2?: number
}

export type ByggnadsProperties = {
  id: string
  fastighet_id: string
  byggnadstyp: string
  areal_m2?: number
  byggar?: number
  status: 'aktiv' | 'riven'
}

export type Avtal = {
  id: string
  fastighet_id: string
  avtalstyp: string
  status: 'aktiv' | 'vilande' | 'avslutad'
  giltig_fran: string
  giltig_till?: string
  part_id: string
}

export type Nyttjanderatt = {
  id: string
  fastighet_id: string
  rattighetstyp: 'jakt' | 'arrende' | 'servitut' | 'väg' | 'övrigt'
  innehavare_id: string
  status: 'aktiv' | 'avslutad'
}

export type Aktor = {
  id: string
  typ: 'person' | 'organisation'
  namn: string
  organisationsnummer?: string
}
