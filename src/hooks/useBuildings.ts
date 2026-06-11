import { useEffect, useMemo, useState } from 'react'
import type { Byggnad } from '../types'

let _cache: Byggnad[] | null = null
let _promise: Promise<void> | null = null

function load(): Promise<void> {
  if (_cache) return Promise.resolve()
  if (_promise) return _promise
  _promise = fetch('/data/byggnader.json')
    .then(r => r.json())
    .then((data: { byggnader: Byggnad[] }) => { _cache = data.byggnader })
  return _promise
}

export function useBuildings() {
  const [loaded, setLoaded] = useState(() => !!_cache)
  useEffect(() => {
    if (loaded) return
    load().then(() => setLoaded(true))
  }, [loaded])

  return useMemo(() => {
    const all = _cache ?? []
    const byFastighetId = new Map<string, Byggnad[]>()
    all.forEach(b => {
      const list = byFastighetId.get(b.fastighets_id) ?? []
      list.push(b)
      byFastighetId.set(b.fastighets_id, list)
    })
    return {
      loading: !loaded,
      getByFastighetId: (id: string) => byFastighetId.get(id) ?? [],
      getById: (id: string) => all.find(b => b.id === id) ?? null,
    }
  }, [loaded])
}
