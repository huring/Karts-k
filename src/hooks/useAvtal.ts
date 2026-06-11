import { useEffect, useMemo, useState } from 'react'
import type { Avtal } from '../types'

let _cache: Avtal[] | null = null
let _promise: Promise<void> | null = null

function load(): Promise<void> {
  if (_cache) return Promise.resolve()
  if (_promise) return _promise
  _promise = fetch('/data/avtal.json')
    .then(r => r.json())
    .then((data: { avtal: Avtal[] }) => { _cache = data.avtal })
  return _promise
}

export function useAvtal() {
  const [loaded, setLoaded] = useState(() => !!_cache)
  useEffect(() => {
    if (loaded) return
    load().then(() => setLoaded(true))
  }, [loaded])

  return useMemo(() => {
    const all = _cache ?? []
    const byFastighetId = new Map<string, Avtal[]>()
    all.forEach(a => {
      const list = byFastighetId.get(a.fastighets_id) ?? []
      list.push(a)
      byFastighetId.set(a.fastighets_id, list)
    })
    return {
      loading: !loaded,
      getByFastighetId: (id: string) => byFastighetId.get(id) ?? [],
    }
  }, [loaded])
}
