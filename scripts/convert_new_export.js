#!/usr/bin/env node
// Converts the raw PostgreSQL JSON exports from DINO to standard WGS84 GeoJSON.
//
// Input files (dist/data/):
//   gv_skyddatomrade_yta_*.json  → public/data/skyddatomraden.geojson
//   gv_beslut_yta_*.json         → public/data/beslut.geojson
//   gv_delomrade_yta_*.json      → public/data/delomraden.geojson
//
// Usage:
//   node scripts/convert_new_export.js

import { readFileSync, writeFileSync, readdirSync } from 'fs'
import { join } from 'path'

// ── SWEREF99TM → WGS84 ────────────────────────────────────────────────────────
// Inverse Transverse Mercator using GRS80 ellipsoid parameters.
// Accurate to sub-meter level for Swedish coordinates.

const TM = {
  a:       6378137.0,           // semi-major axis (GRS80)
  f:       1 / 298.257222101,   // flattening
  k0:      0.9996,              // scale factor
  E0:      500000.0,            // false easting
  N0:      0.0,                 // false northing
  lambda0: 15.0 * Math.PI / 180, // central meridian
}

function sweref99tmToWGS84(easting, northing) {
  const { a, f, k0, E0, N0, lambda0 } = TM
  const e2 = 2 * f - f * f
  const e4 = e2 * e2
  const e6 = e2 * e4

  const x = easting - E0
  const y = northing - N0

  const M = y / k0
  const mu = M / (a * (1 - e2 / 4 - 3 * e4 / 64 - 5 * e6 / 256))

  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2))

  const phi1 = mu
    + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu)
    + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
    + (151 * e1 ** 3 / 96) * Math.sin(6 * mu)
    + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu)

  const sinPhi1 = Math.sin(phi1)
  const cosPhi1 = Math.cos(phi1)
  const tanPhi1 = Math.tan(phi1)

  const N1 = a / Math.sqrt(1 - e2 * sinPhi1 ** 2)
  const T1 = tanPhi1 ** 2
  const C1 = (e2 / (1 - e2)) * cosPhi1 ** 2
  const R1 = a * (1 - e2) / (1 - e2 * sinPhi1 ** 2) ** 1.5
  const D = x / (N1 * k0)

  const lat = phi1 - (N1 * tanPhi1 / R1) * (
    D ** 2 / 2
    - (5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * e2 / (1 - e2)) * D ** 4 / 24
    + (61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * e2 / (1 - e2) - 3 * C1 ** 2) * D ** 6 / 720
  )

  const lon = lambda0 + (
    D
    - (1 + 2 * T1 + C1) * D ** 3 / 6
    + (5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * e2 / (1 - e2) + 24 * T1 ** 2) * D ** 5 / 120
  ) / cosPhi1

  return [
    Math.round(lon * 180 / Math.PI * 1e7) / 1e7,
    Math.round(lat * 180 / Math.PI * 1e7) / 1e7,
  ]
}

function reprojectRing(ring) {
  return ring.map(([e, n]) => sweref99tmToWGS84(e, n))
}

function reprojectGeometry(geom) {
  if (geom.type === 'Polygon') {
    return { ...geom, coordinates: geom.coordinates.map(reprojectRing) }
  }
  if (geom.type === 'MultiPolygon') {
    return { ...geom, coordinates: geom.coordinates.map(poly => poly.map(reprojectRing)) }
  }
  return geom
}

// ── Parsing ───────────────────────────────────────────────────────────────────

function parseExport(filePath) {
  const raw = JSON.parse(readFileSync(filePath, 'utf8'))
  const key = Object.keys(raw)[0]
  return raw[key]
}

function findFile(dir, prefix) {
  const files = readdirSync(dir).filter(f => f.startsWith(prefix) && f.endsWith('.json'))
  if (files.length === 0) throw new Error(`No file matching ${prefix}* in ${dir}`)
  if (files.length > 1) console.warn(`  ⚠ Multiple matches for ${prefix}*, using ${files[0]}`)
  return join(dir, files[0])
}

function buildFeatureCollection(rows, featureType, propExtractor) {
  // Deduplicate by id + geometry string
  const seen = new Set()
  const features = []

  for (const row of rows) {
    const key = `${row.id}|${row.st_asgeojson}`
    if (seen.has(key)) continue
    seen.add(key)

    const rawGeom = JSON.parse(row.st_asgeojson)
    const geom = reprojectGeometry(rawGeom)

    features.push({
      type: 'Feature',
      geometry: geom,
      properties: {
        feature_type: featureType,
        ...propExtractor(row),
      },
    })
  }

  return { type: 'FeatureCollection', features }
}

// ── Main ──────────────────────────────────────────────────────────────────────

const INPUT_DIR  = 'dist/data'
const OUTPUT_DIR = 'public/data'

console.log('Converting DINO exports to WGS84 GeoJSON...\n')

// gv_skyddatomrade_yta → skyddatomraden.geojson
{
  const file = findFile(INPUT_DIR, 'gv_skyddatomrade_yta')
  console.log(`Reading ${file}`)
  const rows = parseExport(file)
  const fc = buildFeatureCollection(rows, 'skyddatomrade', row => ({
    id:          row.id,
    namn:        row.namn,
    typ:         row.typ,
    status:      row.status,
    beskrivning: row.beskrivning ?? null,
    area_ha:     row.area_ha,
  }))
  const outPath = join(OUTPUT_DIR, 'skyddatomraden.geojson')
  writeFileSync(outPath, JSON.stringify(fc))
  console.log(`  → ${outPath}  (${fc.features.length} features from ${rows.length} rows)\n`)
}

// gv_beslut_yta → beslut.geojson
{
  const file = findFile(INPUT_DIR, 'gv_beslut_yta')
  console.log(`Reading ${file}`)
  const rows = parseExport(file)
  const fc = buildFeatureCollection(rows, 'beslut', row => ({
    id:      row.id,
    status:  row.status,
    area_ha: row.area_ha,
  }))
  const outPath = join(OUTPUT_DIR, 'beslut.geojson')
  writeFileSync(outPath, JSON.stringify(fc))
  console.log(`  → ${outPath}  (${fc.features.length} features from ${rows.length} rows)\n`)
}

// gv_delomrade_yta → delomraden.geojson
{
  const file = findFile(INPUT_DIR, 'gv_delomrade_yta')
  console.log(`Reading ${file}`)
  const rows = parseExport(file)
  const fc = buildFeatureCollection(rows, 'delomrade', row => ({
    id:      row.id,
    status:  row.status,
    area_ha: row.area_ha,
  }))
  const outPath = join(OUTPUT_DIR, 'delomraden.geojson')
  writeFileSync(outPath, JSON.stringify(fc))
  console.log(`  → ${outPath}  (${fc.features.length} features from ${rows.length} rows)\n`)
}

console.log('Done.')
