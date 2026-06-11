#!/usr/bin/env python3
"""
convert_dino_export.py
======================
Konverterar DINO shapefile-exporter (ZIP) till WGS84 GeoJSON för
användning i kartprototypen.

Identifierar automatiskt shapefile-typ baserat på fältnamn:
  - fastighetsområden  → data/fastigheter.geojson
  - skyddsvärtområde   → data/skyddsomraden.geojson
  - beslut             → data/beslut.geojson

Koordinatsystem: SWEREF99 TM (EPSG:3006) → WGS84 (EPSG:4326)

Användning:
  python scripts/convert_dino_export.py path/to/export.zip [path/to/export2.zip ...]

Kräver: pyshp, pyproj
  pip install pyshp pyproj
"""

import sys
import os
import json
import zipfile
import tempfile
import glob
import re
from pathlib import Path

try:
    import shapefile
except ImportError:
    sys.exit("Saknar pyshp. Kör: pip install pyshp")

try:
    from pyproj import Transformer
except ImportError:
    sys.exit("Saknar pyproj. Kör: pip install pyproj")


# ── Projektionsomvandlare SWEREF99 TM → WGS84 ───────────────────────────────

transformer = Transformer.from_crs("EPSG:3006", "EPSG:4326", always_xy=True)


def transform_coords(coords):
    """Rekursivt omvandla koordinater från SWEREF99 TM till WGS84."""
    if not coords:
        return coords
    if isinstance(coords[0], (int, float)):
        lon, lat = transformer.transform(coords[0], coords[1])
        return [round(lon, 8), round(lat, 8)]
    return [transform_coords(c) for c in coords]


def shp_to_geojson_geometry(shape):
    """Konvertera pyshp shape till GeoJSON-geometri med koordinatomvandling."""
    if shape.shapeType == 5:  # Polygon
        rings = []
        # pyshp returnerar parts-index för att separera rings
        parts = list(shape.parts) + [len(shape.points)]
        for i in range(len(parts) - 1):
            ring = [[p[0], p[1]] for p in shape.points[parts[i]:parts[i+1]]]
            rings.append(transform_coords(ring))
        if len(rings) == 1:
            return {"type": "Polygon", "coordinates": rings}
        else:
            return {"type": "Polygon", "coordinates": rings}
    elif shape.shapeType == 3:  # Polyline
        parts = list(shape.parts) + [len(shape.points)]
        lines = []
        for i in range(len(parts) - 1):
            line = [[p[0], p[1]] for p in shape.points[parts[i]:parts[i+1]]]
            lines.append(transform_coords(line))
        if len(lines) == 1:
            return {"type": "LineString", "coordinates": lines[0]}
        return {"type": "MultiLineString", "coordinates": lines}
    elif shape.shapeType == 1:  # Point
        lon, lat = transformer.transform(shape.points[0][0], shape.points[0][1])
        return {"type": "Point", "coordinates": [round(lon, 8), round(lat, 8)]}
    else:
        return None


# ── Typidentifiering baserat på fältnamn ─────────────────────────────────────

def identify_type(fields):
    """
    Identifiera shapefile-typ från fältnamn.
    Returnerar: 'fastighet' | 'skyddsomrade' | 'beslut' | 'okänd'
    """
    field_set = set(f.lower() for f in fields)

    if "objekt_id" in field_set and "blockenhet" in field_set:
        return "fastighet"
    if "skyddstyp" in field_set and "soid" in field_set:
        return "skyddsomrade"
    if "soid" in field_set and "beslut_dat" in field_set:
        return "beslut"
    return "okänd"


# ── Normalisering per typ ────────────────────────────────────────────────────

def normalize_fastighet(record, fields):
    """Normalisera ett fastighetsrecord till ett konsistent schema."""
    r = dict(zip(fields, record))

    # Rensa tomma strängar till None
    r = {k: (v if v != "" else None) for k, v in r.items()}

    # Bygg läsbar fastighetsbeteckning (ta bort ">N" suffix från fastighet-fältet)
    beteckning_raw = r.get("fastighet") or ""
    beteckning = re.sub(r">(\d+)$", "", beteckning_raw).strip()

    return {
        "feature_type": "fastighet",
        # Primärnyckel
        "id": r.get("objekt_id"),
        # Läsbar beteckning
        "beteckning": beteckning,
        "trakt": r.get("trakt"),
        "blockenhet": r.get("blockenhet"),
        "omrnr": int(r["omrnr"]) if r.get("omrnr") is not None else None,
        # Geografi
        "kommunkod": r.get("kommunkod"),
        "kommunnamn": r.get("kommunnamn"),
        # Metadata
        "adat": r.get("adat"),
        "detaljtyp": r.get("detaljtyp"),
        "ytkval": int(r["ytkval"]) if r.get("ytkval") is not None else None,
        # Råfält för referens
        "_externid": r.get("externid"),
        "_objectid": int(r["objectid"]) if r.get("objectid") is not None else None,
        "_source_file": None,  # fylls i av anroparen
    }


def normalize_skyddsomrade(record, fields):
    """Normalisera ett skyddsvärtområde-record."""
    r = dict(zip(fields, record))
    r = {k: (v if v != "" else None) for k, v in r.items()}

    # area_ha kan vara sträng (skyddsvärtområde) eller tal (beslut) — normalisera till float
    area_ha = r.get("area_ha")
    if area_ha is not None:
        try:
            area_ha = float(area_ha)
        except (ValueError, TypeError):
            area_ha = None

    _mapped = {"id", "soid", "gid", "namn", "skyddstyp", "status", "area_ha"}

    result = {
        "feature_type": "skyddsomrade",
        "id": r.get("id"),        # t.ex. SKO-1200132
        "soid": r.get("soid"),    # t.ex. NVR-2048018 — kopplingsnyckel mot beslut
        "gid": int(r["gid"]) if r.get("gid") is not None else None,
        "namn": r.get("namn"),
        "skyddstyp": r.get("skyddstyp"),
        "status": r.get("status"),
        "area_ha": area_ha,
        "_source_file": None,
    }
    # Pass through any extra fields from richer exports (beslmyndig, forvaltare, etc.)
    for k, v in r.items():
        if k.lower() not in _mapped:
            result[k] = v
    return result


def normalize_beslut(record, fields):
    """Normalisera ett besluts-record."""
    r = dict(zip(fields, record))
    r = {k: (v if v != "" else None) for k, v in r.items()}

    area_ha = r.get("area_ha")
    if area_ha is not None:
        try:
            area_ha = float(area_ha)
        except (ValueError, TypeError):
            area_ha = None

    _mapped = {"id", "soid", "gid", "namn", "typ", "status", "area_ha", "beslut_dat", "lagakr_dat", "status_dbt"}

    result = {
        "feature_type": "beslut",
        "id": r.get("id"),         # t.ex. BESLUT-166876
        "soid": r.get("soid"),     # t.ex. NVR-2048018 — kopplingsnyckel
        "gid": int(r["gid"]) if r.get("gid") is not None else None,
        "namn": r.get("namn"),
        "typ": r.get("typ"),
        "status": r.get("status"),
        "area_ha": area_ha,
        "beslut_dat": r.get("beslut_dat"),
        "lagakr_dat": r.get("lagakr_dat"),
        "status_dbt": r.get("status_dbt"),
        "_source_file": None,
    }
    # Pass through any extra fields from richer exports (beslmyndig, forvaltare, föreskrifter, etc.)
    for k, v in r.items():
        if k.lower() not in _mapped:
            result[k] = v
    return result


NORMALIZERS = {
    "fastighet":    normalize_fastighet,
    "skyddsomrade": normalize_skyddsomrade,
    "beslut":       normalize_beslut,
}


# ── Shapefile-läsning ────────────────────────────────────────────────────────

def read_shapefile(shp_path):
    """
    Läs en shapefile och returnera (typ, [feature, ...]).
    Varje feature är ett GeoJSON Feature-objekt.
    """
    sf = shapefile.Reader(shp_path, encoding="utf-8")
    fields = [f[0] for f in sf.fields[1:]]
    feature_type = identify_type(fields)
    normalizer = NORMALIZERS.get(feature_type)
    source_name = Path(shp_path).stem

    features = []
    for shape_rec in sf.iterShapeRecords():
        geom = shp_to_geojson_geometry(shape_rec.shape)
        if geom is None:
            print(f"  ⚠️  Okänd geometrityp i {source_name}, hoppar över feature")
            continue

        if normalizer:
            props = normalizer(shape_rec.record, fields)
            props["_source_file"] = source_name
        else:
            # Okänd typ — behåll råfält men lägg till feature_type
            props = dict(zip(fields, shape_rec.record))
            props = {k: (v if v != "" else None) for k, v in props.items()}
            props["feature_type"] = "okänd"
            props["_source_file"] = source_name
            print(f"  ⚠️  Okänd shapefile-typ i '{source_name}' (fält: {fields})")

        features.append({
            "type": "Feature",
            "geometry": geom,
            "properties": props,
        })

    return feature_type, features


# ── ZIP-hantering ────────────────────────────────────────────────────────────

def process_zip(zip_path, tmpdir):
    """
    Extrahera och processa alla shapefiles i en ZIP.
    Returnerar dict: { feature_type: [features] }
    """
    results = {}
    zip_path = Path(zip_path)

    print(f"\n📦 Processar: {zip_path.name}")

    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extractall(tmpdir)

    shp_files = glob.glob(os.path.join(tmpdir, "**", "*.shp"), recursive=True)

    if not shp_files:
        print(f"  ⚠️  Inga shapefiles hittades i {zip_path.name}")
        return results

    for shp_path in sorted(shp_files):
        stem = Path(shp_path).stem
        print(f"  📄 {stem}")
        feature_type, features = read_shapefile(shp_path)
        print(f"     → typ: {feature_type}, {len(features)} feature(r)")

        if feature_type not in results:
            results[feature_type] = []
        results[feature_type].extend(features)

    return results


# ── Sammanslagning och skrivning ─────────────────────────────────────────────

def merge_and_write(all_results, output_dir):
    """
    Slå ihop features från alla ZIPar per typ och skriv GeoJSON-filer.
    Deduplicerar på id-fältet — senaste vinner om samma id förekommer
    i flera exporter.
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    type_to_file = {
        "fastighet":    "fastigheter.geojson",
        "skyddsomrade": "skyddsomraden.geojson",
        "beslut":       "beslut.geojson",
        "okänd":        "okanda.geojson",
    }

    written = []

    for feature_type, filename in type_to_file.items():
        features = all_results.get(feature_type, [])
        if not features:
            continue

        # Deduplicera på id — sista vinner (nyare export)
        seen = {}
        for f in features:
            fid = f["properties"].get("id") or f["properties"].get("_objectid") or id(f)
            seen[fid] = f
        deduped = list(seen.values())

        if len(deduped) < len(features):
            print(f"\n  ℹ️  {feature_type}: deduplicerade {len(features) - len(deduped)} dubbletter")

        geojson = {
            "type": "FeatureCollection",
            "features": deduped,
        }

        out_path = output_dir / filename
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(geojson, f, ensure_ascii=False, indent=2)

        written.append((filename, len(deduped)))
        print(f"\n✅ {filename} — {len(deduped)} feature(r) → {out_path}")

    return written


# ── Huvud ────────────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    zip_paths = sys.argv[1:]
    output_dir = Path("public/data")

    # Validera att alla filer finns
    for p in zip_paths:
        if not Path(p).exists():
            sys.exit(f"Filen hittades inte: {p}")
        if not p.lower().endswith(".zip"):
            sys.exit(f"Förväntar ZIP-fil, fick: {p}")

    all_results = {}

    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmpdir:
        for zip_path in zip_paths:
            results = process_zip(zip_path, tmpdir)
            for feature_type, features in results.items():
                if feature_type not in all_results:
                    all_results[feature_type] = []
                all_results[feature_type].extend(features)

    print(f"\n{'─'*50}")
    print(f"Skriver till /{output_dir}/")
    written = merge_and_write(all_results, output_dir)

    print(f"\n{'─'*50}")
    print("Sammanfattning:")
    for filename, count in written:
        print(f"  {filename:<30} {count} feature(r)")
    print("\nKlart. Starta om prototypen med: npm run dev")


if __name__ == "__main__":
    main()
