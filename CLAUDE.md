# CLAUDE.md — Kartsök-prototyp (DINO)

Det här är en interaktiv kartprototyp för ny kartsökning i DINO, byggt med
React + TypeScript. Läs hela filen innan du börjar koda.

---

## Projektsyfte

Prototypen ska demonstrera en ny kartsökningsfunktion för handläggare på
Naturvårdsverket och Länsstyrelsen. Den ska:

- ersätta beroendet av externa kartverktyg (Google Maps, QGIS m.m.)
- låta användare söka och filtrera DINO-objekt direkt i kartan
- stödja rumsliga verktyg: sökning inom område, avståndsmätning, arealberäkning
- använda skarp GeoJSON-data exporterad från den skarpa DINO-applikationen

Backlog och stories finns i Confluence:
https://metria-nv.atlassian.net/wiki/spaces/~712020533370cabcce4033b7592badf7c5e8e3/pages/877002770/Backlog+karts%C3%B6k

---

## Teknikstack

| Paket | Syfte |
|---|---|
| React 18 + TypeScript | UI och komponentlogik |
| Vite | Dev-server och byggverktyg |
| Mapbox GL JS | Kartrendering och lagerhantering |
| @mapbox/mapbox-gl-draw | Ritverktyg (polygon, linje, punkt) i kartan |
| @turf/turf | Geografiska beräkningar (areal, avstånd, intersection) |

**Miljövariabler** — lägg i `.env` (committas ej):
```
VITE_MAPBOX_TOKEN=<din token>
```

---

## Mappstruktur

```
/
├── CLAUDE.md                  ← den här filen
├── DESIGNSYSTEM.md            ← färger, typografi, komponentspecar från Figma
├── KONVERTERA_DATA.md         ← instruktioner för att konvertera DINO-exporter
├── .env                       ← miljövariabler (ej i git)
├── scripts/
│   └── convert_dino_export.py ← konverterar DINO ZIP-exporter till GeoJSON
├── exports/                   ← lägg ZIP-exporter från DINO här (ej i git)
├── data/                      ← genereras av convert_dino_export.py (ej i git)
│   ├── fastigheter.geojson
│   ├── skyddsomraden.geojson
│   └── beslut.geojson
└── src/
    ├── App.tsx                ← rot, håller global state
    ├── components/
    │   ├── Map.tsx            ← Mapbox-kartan
    │   ├── SearchBar.tsx      ← fritextsökning
    │   ├── FilterPanel.tsx    ← objekttyp- och attributfilter
    │   ├── ResultsList.tsx    ← träfflista till vänster om kartan
    │   ├── ObjectPanel.tsx    ← sidopanel vid klick på objekt
    │   └── MapToolbar.tsx     ← verktygspanel för rumsliga verktyg
    ├── hooks/
    │   ├── useMap.ts          ← kartreferens och grundfunktioner
    │   ├── useMapLayers.ts    ← laddning och hantering av GeoJSON-lager
    │   ├── useSearch.ts       ← söktillstånd och sökning
    │   ├── useFilters.ts      ← filtertillstånd (objekttyp + attribut)
    │   ├── useMapTools.ts     ← aktivt verktyg, ritning, mätresultat
    │   └── useRelatedObjects.ts ← kopplar fastighet → skyddsomrade → beslut
    ├── types/
    │   └── index.ts           ← TypeScript-typer för alla domänobjekt
    └── data/                  ← symlink eller kopia av /data (för Vite)
```

---

## Data — hur det fungerar

**Data committas aldrig till Git.** Arbetsflödet är:

1. Exportera ett eller flera ärenden från DINO som ZIP (shapefile-format)
2. Lägg ZIP-filerna i `/exports/`
3. Kör konverteringsskriptet (se `KONVERTERA_DATA.md`):
   ```bash
   python scripts/convert_dino_export.py exports/*.zip
   ```
4. Scriptet skriver tre GeoJSON-filer till `/data/`
5. Starta om prototypen: `npm run dev`

**Koordinatsystem:** DINO exporterar i SWEREF99 TM (EPSG:3006).
Scriptet konverterar automatiskt till WGS84 (EPSG:4326) som Mapbox kräver.
Lägg aldrig in SWEREF99-koordinater direkt i prototypen.

---

## Datamodell

Alla tre GeoJSON-filer genereras av `scripts/convert_dino_export.py` och har
ett stabilt, normaliserat schema. Fältnamnen nedan är de som faktiskt finns
i filerna — använd exakt dessa namn i all kod.

### `data/fastigheter.geojson`

```typescript
type FastighetProperties = {
  feature_type: 'fastighet';
  id: string;            // UUID — primärnyckel
  beteckning: string;    // t.ex. "SÄRNABYN 3:6" (rensat från Lantmäteriets råformat)
  trakt: string;         // t.ex. "SÄRNABYN"
  blockenhet: string;    // t.ex. "3:6"
  omrnr: number;         // delgeometri-index — samma fastighet kan ha flera polygoner
  kommunkod: string;     // t.ex. "2039"
  kommunnamn: string;    // t.ex. "ÄLVDALEN"
  adat: string;          // ISO 8601 datetime, t.ex. "2024-12-05T09:29:00Z"
  detaljtyp: string;     // t.ex. "FASTIGHET"
  ytkval: number;
  _externid: string;     // råformat från Lantmäteriet, t.ex. "2039>SÄRNABYN>3:6>1>>>>1"
  _objectid: number;
  _source_file: string;  // vilket shapefile-lager featuren kom från
}
```

**Viktigt om fastigheter med flera polygoner:**
En fastighet med `omrnr > 1` har diskontinuerlig mark — samma `id` men
separata geometrier med `omrnr: 1`, `omrnr: 2` osv. Visa dem som ett
objekt i ResultsList men rita alla polygoner på kartan.

### `data/skyddsomraden.geojson`

```typescript
type SkyddsomradeProperties = {
  feature_type: 'skyddsomrade';
  id: string;            // t.ex. "SKO-1200132"
  soid: string;          // t.ex. "NVR-2048018" — kopplingsnyckel mot beslut
  gid: number;
  namn: string;          // t.ex. "Ögan"
  skyddstyp: string;     // t.ex. "NR" (naturreservat)
  status: string;        // t.ex. "UTREDNING"
  area_ha: number;       // alltid number (normaliserat)
  _source_file: string;
}
```

### `data/beslut.geojson`

```typescript
type BeslutProperties = {
  feature_type: 'beslut';
  id: string;            // t.ex. "BESLUT-166876"
  soid: string;          // t.ex. "NVR-2048018" — kopplingsnyckel mot skyddsomrade
  gid: number;
  namn: string;
  typ: string;           // t.ex. "NR"
  status: string;        // t.ex. "GALLANDE"
  area_ha: number;
  beslut_dat: string;    // ISO-datum "ÅÅÅÅ-MM-DD"
  lagakr_dat: string;    // ISO-datum "ÅÅÅÅ-MM-DD"
  status_dbt: string | null;
  _source_file: string;
}
```

### Kopplingsnyckel mellan objekttyper

`soid` är nyckeln som binder ihop skyddsomrade och beslut:
- `skyddsomrade.soid === beslut.soid` → de tillhör samma skyddsobjekt
- Fastigheter saknar direkt `soid` — de kopplas **rumsligt** (via geometri)
  eller **kontextuellt** (de exporterades tillsammans med ett skyddsobjekt)

Använd `turf.booleanIntersects()` för att avgöra om en fastighet
överlappar med ett skyddsomrade eller beslut.

### Identifiera feature_type i kod

Använd alltid `feature_type`-fältet för att avgöra typ — aldrig filnamn
eller andra fält:

```typescript
const type = feature.properties.feature_type;
// 'fastighet' | 'skyddsomrade' | 'beslut'
```

---

## Kartlager och färgsättning

Alla kartfärger är hämtade ur DINO:s officiella palett (se `DESIGNSYSTEM.md`).

| Lager | Mapbox source | Fill | Opacity | CSS-variabel |
|---|---|---|---|---|
| Fastigheter | fastigheter | `#405D1A` | 0.35 | `--dino-green-700` |
| Skyddsvärtområden (utredning) | skyddsomraden | `#F4E28B` | 0.4 | `--dino-yellow-400` |
| Beslut (gallande) | beslut | `#638C2F` | 0.4 | `--dino-green-500` |
| Highlight (valt objekt) | dynamic | — | — | stroke `--dino-darkblue-500`, width 3 |
| Rumslig sökning | draw | `#5CA3EC` | 0.15 | *(blue/400)*, streckad kontur |
| Mätlinje | dynamic | — | — | stroke `--dino-red-500`, dasharray |
| Buffertzon | dynamic | `#E3A480` | 0.12 | `--dino-orange-400` |

---

## Designsystem och komponenter

Full specifikation finns i **`DESIGNSYSTEM.md`** i projektets rot — läs den
innan du skapar eller ändrar någon komponent. Nedan är en snabbreferens.

DINO:s komponentbibliotek är definierat i Figma — det finns inget publicerat
NPM-paket. I prototypen bygger vi komponenterna manuellt utifrån Figma-specen.

**Regler:**
- Hårdkoda aldrig färger, radier eller spacing — använd alltid CSS-variablerna nedan
- Typsnitt: **Inter** (Google Fonts), importeras i `index.css`
- Spacing: **8px-grid** — använd multiplar av 4px/8px för all spacing
- Se `DESIGNSYSTEM.md` för fullständiga komponentspecar (padding, höjd, hover-states m.m.)

**Komponenter att bygga och återanvända:**
- `Button` — variant: primary (blå, fylld), secondary (outline), ghost (ingen border)
- `Input` — med label ovanför (14px semibold), border-radius 8px, höjd 42px
- `Chip` — S/M/L, används som statusindikator i tabeller (M) och filterväljare
- `ListItem` — rad i resultatlista
- `Drawer` / `SidePanel` — slidar in från höger

**CSS-variabler — klistra in i `src/index.css`:**

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

:root {
  /* Primär (darkblue) */
  --dino-darkblue-300: #6D88AA;  /* primary hover */
  --dino-darkblue-500: #013264;  /* sekundärknapp text, ghost text */
  --dino-darkblue-800: #001837;

  /* Blå */
  --dino-blue-800:  #0E4C83;  /* primary button bakgrund */
  --dino-blue-link: #1B88E8;  /* länkfärg, info, focus-ring */

  /* Neutraler (slategrey) */
  --dino-slategrey-50:  #F2F2F2;  /* sidabakgrund */
  --dino-slategrey-200: #B7B7B7;  /* border disabled, placeholder */
  --dino-slategrey-300: #8C8C8C;  /* muted text */
  --dino-slategrey-500: #3D3D3D;  /* primär textfärg (dino/black) */
  --dino-slategrey-900: #0F0F0F;  /* input-labels */

  /* Darkgreen */
  --dino-darkgreen-500: #1E4606;
  --dino-darkgreen-700: #122B05;

  /* Green */
  --dino-green-500: #638C2F;
  --dino-green-700: #405D1A;

  /* Yellow */
  --dino-yellow-400: #F4E28B;

  /* Orange */
  --dino-orange-400: #E3A480;

  /* Red */
  --dino-red-500: #E63935;  /* error / destructive */

  /* Semantiska */
  --dino-white:   #FFFFFF;
  --dino-black:   #3D3D3D;
  --dino-info:    #1B88E8;
  --dino-warning: #FFDF20;
  --dino-alert:   #FF8376;

  /* Applikationsalias — använd dessa i komponentkod */
  --color-bg:           var(--dino-white);
  --color-bg-secondary: var(--dino-slategrey-50);
  --color-text:         var(--dino-slategrey-500);
  --color-text-muted:   var(--dino-slategrey-300);
  --color-border:       #D9D9D9;
  --color-border-muted: var(--dino-slategrey-200);
  --color-primary:      var(--dino-blue-800);
  --color-primary-hover: var(--dino-darkblue-300);
  --color-link:         var(--dino-blue-link);
  --color-error:        var(--dino-red-500);
  --color-warning:      var(--dino-warning);
  --color-info:         var(--dino-info);

  /* Border radius */
  --radius-sm:   4px;    /* knappar */
  --radius-md:   8px;    /* inputs, kort */
  --radius-full: 100px;  /* chips, pills */

  /* Spacing (8px-grid) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
}
```

---

## Rumsliga verktyg — beteendekrav

### Avståndsmätning
- Mätdata (punkter, linjer, resultat) lagras **enbart i React-state**
- Rensas när verktyget stängs eller byts — inget sparas
- Visa total sträcka löpande: `< 1000 m` → visa i meter, `≥ 1000 m` → visa i km med en decimal
- Rita linjen som ett Mapbox-lager i realtid

### Arealberäkning
- Rita polygon med Mapbox Draw
- Beräkna med `turf.area()` när polygonen stängs
- `< 10 000 m²` → visa i m² (heltal), `≥ 10 000 m²` → visa i ha med en decimal
- Rensas när verktyget stängs — inget sparas

### Rumslig sökning
- Använd `turf.booleanIntersects()` för polygoner och `turf.booleanPointInPolygon()` för punktobjekt
- Visa träffar i ResultsList grupperade per `feature_type`
- Den ritade sökytan ligger kvar tills användaren klickar "rensa" eller byter verktyg

---

## Kodkonventioner

- **Hooks för all logik** — komponenter renderar bara, logik lever i hooks
- **Inga direkta Mapbox-anrop i komponenter** — gå alltid via `useMap` eller `useMapLayers`
- **TypeScript strict mode** — inga `any`, inga `!` non-null assertions utan kommentar
- **Namngivning**: komponenter PascalCase, hooks camelCase med `use`-prefix, filer samma namn som export
- **Inga inline-stilar** — använd CSS-moduler (`.module.css`) och CSS-variablerna från `index.css`
- **Inga hårdkodade färger** — använd alltid `var(--dino-*)` eller applikationsalias `var(--color-*)`
- **Följ DESIGNSYSTEM.md** — kontrollera alltid komponentspecen (padding, höjd, hover) innan du implementerar en ny komponent
- **Identifiera alltid objekttyp via `feature_type`** — aldrig via filnamn, source-namn eller andra fält
- **Kommentera varför, inte vad** — koden ska vara självförklarande, kommentarer förklarar beslut

---

## Hur man jobbar med stories från backloggen

Varje story i backloggen har ett ID (t.ex. `F2-3`) och en färdig Claude Code-prompt.

**Normalt arbetsflöde:**
1. Hitta storyn i Confluence-backloggen
2. Klistra in Claude Code-prompten
3. Lägg till relevant kontext om befintlig kod om det behövs: *"useFilters-hooken ser just nu ut så här: ..."*
4. Kör, testa, uppdatera status i Confluence till "Pågående" / "Klar"

**Ändringar i befintlig kod:**
> "I den befintliga implementationen av [komponent/hook], gör följande ändring: ..."

**Felsökning:**
> "Den här koden ger följande fel i konsolen: [klistra in fel]. Här är den relevanta koden: [klistra in kod]"

---

## Vad som inte är implementerat (ännu)

- Autentisering — prototypen kör utan inloggning
- Skrivoperationer — ingen data sparas tillbaka till DINO
- Externa API:er (Byggnad Direkt, Rättighet Direkt från Lantmäteriet) — används inte i prototyp v1
- Mobilanpassning — prototypen är optimerad för desktop
- Direktkoppling fastighet↔skyddsobjekt via attribut — kopplas rumsligt i prototypen

---

## Länkar

| Resurs | URL |
|---|---|
| Backlog (Confluence) | https://metria-nv.atlassian.net/wiki/spaces/~712020533370cabcce4033b7592badf7c5e8e3/pages/877002770 |
| Prototypplan | https://metria-nv.atlassian.net/wiki/spaces/~712020533370cabcce4033b7592badf7c5e8e3/pages/877658128 |
| Discovery | https://metria-nv.atlassian.net/wiki/spaces/FOG/pages/706674691 |
| Sökbara objekt och attribut | https://metria-nv.atlassian.net/wiki/spaces/FOG/pages/710377475 |
| DINO Komponentbibliotek (Figma) | https://www.figma.com/design/jjiph99LYQaG7hw8DJjNdX/DINO-komponentbibliotek |
| DINO Skydd (Figma) | https://www.figma.com/design/IMioEZEb0yKfPvjvqXaEl5/DINO-Skydd |
| Koncept 1 (Figma Make) | https://www.figma.com/make/YyAOVV2R64serRYU1yMHCe/Map-Object-Search-Feature |
