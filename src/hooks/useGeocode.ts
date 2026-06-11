import { useEffect, useRef, useState } from 'react'

export type GeocodeResult = {
  id: string
  name: string
  placeName: string
  center: [number, number]  // [lng, lat]
  bbox?: [number, number, number, number]  // [minLng, minLat, maxLng, maxLat]
}

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string

export function useGeocode(query: string): { results: GeocodeResult[] } {
  const [results, setResults] = useState<GeocodeResult[]>([])
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setResults([]); return }

    const timer = setTimeout(() => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${TOKEN}&language=sv&country=se&limit=5`
      fetch(url, { signal: controller.signal })
        .then(r => r.json())
        .then((data: { features: Array<{
          id: string
          text: string
          place_name: string
          center: [number, number]
          bbox?: [number, number, number, number]
        }> }) => {
          setResults((data.features ?? []).map(f => ({
            id: f.id,
            name: f.text,
            placeName: f.place_name,
            center: f.center,
            bbox: f.bbox,
          })))
        })
        .catch(() => {})  // AbortError from cancelled requests is expected
    }, 400)

    return () => {
      clearTimeout(timer)
      abortRef.current?.abort()
    }
  }, [query])

  return { results }
}
