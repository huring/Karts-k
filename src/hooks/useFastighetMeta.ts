import { useEffect, useMemo, useState } from 'react'
import type { FastighetMeta } from '../types'

let _cache: Record<string, FastighetMeta> | null = null
let _promise: Promise<void> | null = null

function load(): Promise<void> {
  if (_cache) return Promise.resolve()
  if (_promise) return _promise
  _promise = fetch('/data/fastigheter_meta.json')
    .then(r => r.json())
    .then((data: { meta: Record<string, FastighetMeta> }) => { _cache = data.meta })
  return _promise
}

export function useFastighetMeta() {
  const [loaded, setLoaded] = useState(() => !!_cache)
  useEffect(() => {
    if (loaded) return
    load().then(() => setLoaded(true))
  }, [loaded])

  return useMemo(() => ({
    loading: !loaded,
    getById: (id: string): FastighetMeta | null => (_cache ?? {})[id] ?? null,
  }), [loaded])
}
