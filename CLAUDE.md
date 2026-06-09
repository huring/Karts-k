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
├── CLAUDE.md              ← den här filen
├── DESIGNSYSTEM.md        ← färger, typografi, komponentspecar från Figma
├── .env                   ← miljövariabler (ej i git)
├── src/
│   ├── App.tsx            ← rot, håller global state
│   ├── components/
│   │   ├── Map.tsx        ← Mapbox-kartan
│   │   ├── SearchBar.tsx  ← fritextsökning
│   │   ├── FilterPanel.tsx← objekttyp- och attributfilter
│   │   ├── ResultsList.tsx← träfflista till vänster om kartan
│   │   ├── ObjectPanel.tsx← sidopanel vid klick på objekt
│   │   └── MapToolbar.tsx ← verktygspanel för rumsliga verktyg
│   ├── hooks/
│   │   ├── useMap.ts      ← kartreferens och grundfunktioner
│   │   ├── useMapLayers.ts← laddning och hantering av GeoJSON-lager
│   │   ├── useSearch.ts   ← söktillstånd och sökning
│   │   ├── useFilters.ts  ← filtertillstånd (objekttyp + attribut)
│   │   ├── useMapTools.ts ← aktivt verktyg, ritning, mätresultat
│   │   └── useRelatedObjects.ts ← hämtar kopplade avtal/aktörer
│   ├── types/
│   │   └── index.ts       ← TypeScript-typer för alla domänobjekt
│   └── data/              ← symlink eller kopia av /data
└── data/
    ├── fastigheter.geojson
    ├── byggnader.geojson
    ├── avtal.json
    ├── nyttjanderatter.json
    └── aktorer.json
```

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

## Datamodell

### GeoJSON-features (fastigheter och byggnader)
```typescript
type FastighetProperties = {
  id: string;              // unik nyckel, matchar mot avtal/aktorer
  beteckning: string;      // t.ex. "Norrtälje Västra 1:23"
  namn?: string;
  markslag: 'skog' | 'åker' | 'impediment' | 'vatten' | 'övrigt';
  status: 'aktiv' | 'vilande' | 'avslutad';
  areal_m2?: number;       // om det finns, annars beräkna med Turf
}

type ByggnadsProperties = {
  id: string;
  fastighet_id: string;    // FK till fastighet
  byggnadstyp: string;     // t.ex. "bostad", "ekonomibyggnad", "dass"
  areal_m2?: number;
  byggar?: number;
  status: 'aktiv' | 'riven';
}
```

### JSON-filer (avtal, nyttjanderätter, aktörer)
```typescript
type Avtal = {
  id: string;
  fastighet_id: string;
  avtalstyp: string;
  status: 'aktiv' | 'vilande' | 'avslutad';
  giltig_fran: string;     // ISO-datum
  giltig_till?: string;
  part_id: string;         // FK till aktorer
}

type Nyttjanderatt = {
  id: string;
  fastighet_id: string;
  rattighetstyp: 'jakt' | 'arrende' | 'servitut' | 'väg' | 'övrigt';
  innehavare_id: string;
  status: 'aktiv' | 'avslutad';
}

type Aktor = {
  id: string;
  typ: 'person' | 'organisation';
  namn: string;
  organisationsnummer?: string;
}
```

---

## Kartlager och färgsättning

Alla kartfärger är hämtade ur DINO:s officiella palett (se `DESIGNSYSTEM.md`).

| Lager | Mapbox source | Fill | Opacity | CSS-variabel |
|---|---|---|---|---|
| Fastigheter — skog | fastigheter | `#405D1A` | 0.4 | `--dino-green-700` |
| Fastigheter — åker | fastigheter | `#F4E28B` | 0.5 | `--dino-yellow-400` |
| Fastigheter — impediment | fastigheter | `#B7B7B7` | 0.4 | `--dino-slategrey-200` |
| Fastigheter — vatten | fastigheter | `#B8D8FB` | 0.5 | *(blue/200)* |
| Byggnader | byggnader | `#E3A480` | 0.7 | `--dino-orange-400` |
| Highlight (valt objekt) | dynamic | — | — | stroke `--dino-darkblue-500`, width 3 |
| Rumslig sökning | draw | `#5CA3EC` | 0.15 | *(blue/400)*, streckad kontur |
| Mätlinje | dynamic | — | — | stroke `--dino-red-500`, dasharray |
| Buffertzon | dynamic | `#638C2F` | 0.12 | `--dino-green-500` |

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
- Visa träffar i ResultsList grupperade per objekttyp
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