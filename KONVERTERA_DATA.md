# Konvertera DINO-exporter till prototypdata

## Vad scriptet gör

`scripts/convert_dino_export.py` tar en eller flera ZIP-exporter från DINO
och producerar tre färdiga GeoJSON-filer i `/data`:

| Output | Innehåll |
|---|---|
| `data/fastigheter.geojson` | Fastighetspolygoner, WGS84, normaliserat schema |
| `data/skyddsomraden.geojson` | Skyddsvärtområden (utredning) |
| `data/beslut.geojson` | Beslutade skyddsgeometrier |

Scriptet:
- Konverterar automatiskt **SWEREF99 TM → WGS84** (Mapbox-kompatibelt)
- Identifierar shapefile-typ på **fältnamn**, inte filnamn
- Normaliserar `area_ha` till `number` (inte sträng)
- Deduplicerar på `id` om samma objekt finns i flera exporter — senaste vinner
- Fungerar med en eller flera ZIPar samtidigt

---

## Installera beroenden (första gången)

```bash
pip install pyshp pyproj
```

---

## Köra scriptet

### En export
```bash
python scripts/convert_dino_export.py exports/Underlag__Ögan_SKO-1200132.zip
```

### Flera exporter samtidigt (slås ihop automatiskt)
```bash
python scripts/convert_dino_export.py \
  exports/Underlag__Ögan_SKO-1200132.zip \
  exports/Bildandebeslut_10_juni_2026.zip
```

### Alla ZIPar i en mapp
```bash
python scripts/convert_dino_export.py exports/*.zip
```

Starta sedan om prototypen:
```bash
npm run dev
```

---

## Claude Code-prompt

Klistra in följande när du vill att Claude Code kör konverteringen:

---

```
Kör konverteringsskriptet för DINO-exporter. Scriptet ligger i
scripts/convert_dino_export.py.

Jag har lagt följande ZIP-exporter i mappen exports/:
[lista filnamnen här, t.ex. "Underlag__Ögan_SKO-1200132__2026-06-10.zip"]

Gör följande:
1. Kör: python scripts/convert_dino_export.py exports/<filnamn>.zip
   (eller flera filer separerade med mellanslag om det är fler ZIPar)
2. Kontrollera att scriptet körde utan fel
3. Berätta hur många features som skrevs till varje GeoJSON-fil
4. Om det uppstod fel — visa felmeddelandet och föreslå åtgärd

Om pyshp eller pyproj saknas, installera dem först:
  pip install pyshp pyproj
```

---

## Om scriptet inte känner igen en shapefile-typ

Scriptet identifierar typ baserat på fältnamn:
- `objekt_id` + `blockenhet` → **fastighet**
- `skyddstyp` + `soid` → **skyddsomrade**
- `soid` + `beslut_dat` → **beslut**

Om en ny exporttyp från DINO inte matchar något av ovanstående skrivs
den till `data/okanda.geojson` med råfälten bevarade, och en varning
visas i terminalen.

### Claude Code-prompt för ny exporttyp:

```
Scriptet scripts/convert_dino_export.py känner inte igen en ny
shapefile-typ från DINO. Den skrevs till data/okanda.geojson.

Här är fältnamnen från den okända shapefileen:
[klistra in fältlistan från terminalutskriften]

Här är ett exempelrecord:
[klistra in exempelvärden från terminalutskriften]

Lägg till stöd för den här typen i scriptet:
1. Lägg till en identifieringsregel i funktionen identify_type()
2. Skapa en normalize_*()-funktion med ett konsistent schema
3. Registrera den i NORMALIZERS-dictionaryn
4. Lägg till en output-fil i type_to_file-mappningen i merge_and_write()
5. Uppdatera CLAUDE.md:s datamodell-sektion med det nya schemat
```

---

## Datamodell — output-scheman

### fastigheter.geojson
```typescript
{
  feature_type: "fastighet",
  id: string,          // UUID — primärnyckel, matchar mot avtal/aktorer
  beteckning: string,  // t.ex. "SÄRNABYN 3:6"
  trakt: string,
  blockenhet: string,  // t.ex. "3:6"
  omrnr: number,       // delgeometri-index för fastigheter med flera polygoner
  kommunkod: string,
  kommunnamn: string,
  adat: string,        // ISO 8601 datetime
  detaljtyp: string,
  ytkval: number,
  _externid: string,   // råformat från Lantmäteriet
  _objectid: number,
  _source_file: string
}
```

### skyddsomraden.geojson
```typescript
{
  feature_type: "skyddsomrade",
  id: string,          // t.ex. "SKO-1200132"
  soid: string,        // t.ex. "NVR-2048018" — kopplingsnyckel mot beslut
  gid: number,
  namn: string,
  skyddstyp: string,   // t.ex. "NR"
  status: string,      // t.ex. "UTREDNING"
  area_ha: number,     // alltid number (normaliserat från sträng)
  _source_file: string
}
```

### beslut.geojson
```typescript
{
  feature_type: "beslut",
  id: string,          // t.ex. "BESLUT-166876"
  soid: string,        // t.ex. "NVR-2048018" — kopplingsnyckel mot skyddsomrade
  gid: number,
  namn: string,
  typ: string,         // t.ex. "NR"
  status: string,      // t.ex. "GALLANDE"
  area_ha: number,
  beslut_dat: string,  // ISO-datum "ÅÅÅÅ-MM-DD"
  lagakr_dat: string,
  status_dbt: string | null,
  _source_file: string
}
```

### Kopplingsnyckel

`soid` binder ihop alla tre typerna:
- Ett **skyddsomrade** (utredning) har ett `soid`
- Ett eller flera **beslut** pekar på samma `soid`
- **Fastigheter** saknar direkt `soid` — de kopplas rumsligt (de exporteras
  tillsammans med det skyddsobjekt de tillhör, och `_source_file` indikerar
  sammanhanget)
