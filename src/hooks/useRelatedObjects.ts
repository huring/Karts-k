import { useEffect, useState } from 'react'
import type { Avtal, Nyttjanderatt, Aktor } from '../types'

interface AllData { avtal: Avtal[]; nyttjanderatter: Nyttjanderatt[]; aktorer: Aktor[] }

let _cache: AllData | null = null
let _promise: Promise<AllData> | null = null

function loadAll(): Promise<AllData> {
  if (_cache) return Promise.resolve(_cache)
  if (_promise) return _promise
  _promise = Promise.all([
    fetch('/data/avtal.json').then(r => r.json()) as Promise<Avtal[]>,
    fetch('/data/nyttjanderatter.json').then(r => r.json()) as Promise<Nyttjanderatt[]>,
    fetch('/data/aktorer.json').then(r => r.json()) as Promise<Aktor[]>,
  ]).then(([avtal, nyttjanderatter, aktorer]) => {
    _cache = { avtal, nyttjanderatter, aktorer }
    return _cache
  })
  return _promise
}

export interface RelatedData {
  avtal: Avtal[]
  nyttjanderatter: Nyttjanderatt[]
  relevantAktorer: Aktor[]
  getAktor: (id: string) => Aktor | undefined
  loading: boolean
}

export function useRelatedObjects(fastighet_id: string | null): RelatedData {
  const [avtal, setAvtal] = useState<Avtal[]>([])
  const [nyttjanderatter, setNyttjanderatter] = useState<Nyttjanderatt[]>([])
  const [relevantAktorer, setRelevantAktorer] = useState<Aktor[]>([])
  const [allAktorer, setAllAktorer] = useState<Aktor[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!fastighet_id) {
      setAvtal([]); setNyttjanderatter([]); setRelevantAktorer([]); setAllAktorer([])
      return
    }
    setLoading(true)
    loadAll().then(data => {
      const myAvtal = data.avtal.filter(a => a.fastighet_id === fastighet_id)
      const myNr    = data.nyttjanderatter.filter(n => n.fastighet_id === fastighet_id)
      const refIds  = new Set([...myAvtal.map(a => a.part_id), ...myNr.map(n => n.innehavare_id)])
      setAvtal(myAvtal)
      setNyttjanderatter(myNr)
      setRelevantAktorer(data.aktorer.filter(a => refIds.has(a.id)))
      setAllAktorer(data.aktorer)
      setLoading(false)
    })
  }, [fastighet_id])

  const getAktor = (id: string): Aktor | undefined => allAktorer.find(a => a.id === id)

  return { avtal, nyttjanderatter, relevantAktorer, getAktor, loading }
}
