## TODO prototyp kartsök — Strukturerade stories

| ID | Titel | Prioritet |
|---|---|---|
| KART-2 | Tydligare hover-indikation på kartgeometrier | Hög |
| KART-4 | Visa alla objekt inom viewport vid hög zoom-nivå | Hög |
| KART-1 | Ta bort verktygslisten på höger sida | Medium |
| KART-5 | Statusindikator med ikon på skyddade områden | Medium |
| KART-8 | Nyttjanderätter som sökbart/filtrerbart objekt | Medium |
| KART-3 | Ikoner för arrenden och anläggningar | Låg |
| KART-6 | Visa objekt som pins vid låg zoom-nivå | Låg |
| KART-7 | Spara sökningar med filter | Låg |

---

### KART-1 — Ta bort verktygslisten på höger sida

**Prioritet:** Medium  
**Syfte:** Förenkla kartgränssnittet. Den vertikala verktygspanelen på höger sida tar upp plats och stör visuellt.

**Acceptanskriterier:**
- Verktygslistan (`MapToolbar`) på höger sida är borttagen
- De fyra verktygen (rumslig sökning, avstånd, areal, buffert) är fortfarande åtkomliga via kompakta flytande ikonknappar uppe till höger i kartan
- Varje verktygsknapp är en kvadratisk 36×36px-knapp med Material Symbols-ikon och tooltip på hover
- Aktivt verktyg markeras med primärfärg (`--dino-blue-800`)
- Resultatpanelen för aktiva verktyg (mätresultat, buffertinställning, söktall) visas som ett kompakt flytande kort direkt under knapparna
- Knappar förflyttar sig inte när `ObjectPanel` öppnas (ingen `wrapperPanelOpen`-logik behövs)

**Tekniska noter:**
- `src/components/MapToolbar.tsx` och `MapToolbar.module.css` — skriv om `.wrapper` och `.toolstrip` till ett litet floating `<div>` med `position: absolute; top: var(--space-4); right: var(--space-4)` och `flex-direction: column; gap: var(--space-1)`
- Ta bort `.wrapperPanelOpen`-klassen och `panelOpen`-prop helt
- Behåll all logik för verktygspanelerna (distance/area/spatial/buffer) — flytta bara layouten

**Claude Code-prompt:**
```
I MapToolbar-komponenten (src/components/MapToolbar.tsx och MapToolbar.module.css) vill jag ta bort den nuvarande
verktygslisten på höger sida och ersätta den med en kompakt grupp av flytande ikonknappar.

Nytt beteende:
- Knapparna ligger i en vertikal stack, absolut positionerade uppe till höger i kartan (top: 16px, right: 16px)
- Varje knapp är 36x36px, border-radius var(--radius-sm), med Material Symbols-ikon centrerad
- Inaktiv knapp: bakgrund var(--color-bg), border 1px solid var(--color-border), ikon i var(--color-text-muted)
- Aktiv knapp: bakgrund var(--dino-blue-800), ingen border, ikon i vit
- Tooltip (title-attribut) på varje knapp
- Ta bort prop panelOpen och all wrapperPanelOpen-logik
- Behåll resultatpanelerna för aktiva verktyg (mätresultat, etc.) som absolut positionerade kort
  direkt under knappstacken, med max-width: 220px och box-shadow
- Uppdatera App.tsx för att ta bort panelOpen-propen från MapToolbar
```

---

### KART-5 — Statusindikator med ikon på skyddade områden

**Prioritet:** Medium  
**Syfte:** Handläggare ska direkt kunna se skyddsstatus utan att öppna detaljpanelen. En färgad statuspunkt eller ikon på kartan och i träfflistan ger snabb överblick.

**Acceptanskriterier:**
- I träfflistan visas en färgad badge/punkt bredvid varje skyddsomrade som indikerar status (GALLANDE = grön, UTREDNING = gul, AVSKRIVET = grå)
- I kartans skyddatomraden-lager används fill-color baserat på status-attributet (tre distinkta nyanser)
- I `ObjectPanel` är statuspinnen redan synlig via `<Badge>` — verifiera att färgkodningen stämmer med DESIGNSYSTEM.md

**Tekniska noter:**
- I `useMapLayers.ts`: ersätt fast `fill-color: '#F4E28B'` med ett Mapbox data-driven expression:
  ```js
  'fill-color': ['match', ['get', 'status'],
    'GALLANDE',  '#638C2F',
    'UTREDNING', '#F4E28B',
    'AVSKRIVET', '#8C8C8C',
    '#F4E28B'  // default
  ]
  ```
- I `ResultsList.tsx`: lägg till en liten färgad `<Badge>` på varje `skyddatomrade`-rad
- Statusfärg-mapping: GALLANDE → `--dino-green-500`, UTREDNING → `--dino-yellow-400`, AVSKRIVET → `--dino-slategrey-300`

**Claude Code-prompt:**
```
Uppdatera kartan och träfflistan för att visa status-information visuellt på skyddade områden.

1. I src/hooks/useMapLayers.ts — ändra skyddatomraden-fill-lagret:
Ersätt fill-color '#F4E28B' med ett data-driven expression:
['match', ['get', 'status'], 'GALLANDE', '#638C2F', 'UTREDNING', '#F4E28B', '#8C8C8C']

2. I src/components/ResultsList.tsx — importera Badge-komponenten och lägg till en Badge
bredvid varje träff med layer === 'skyddatomraden'. Hämta status från item.feature.properties.status
och använd statusVariant-funktionen från ObjectPanel (flytta ut den till en delad util om behövs,
annars duplicera den).

3. Verifiera att statusVariant i src/components/ui/Badge.tsx (eller ObjectPanel.tsx) mappar:
GALLANDE → 'success', UTREDNING → 'warning', AVSKRIVET/annat → 'default'
```

---

### KART-8 — Nyttjanderätter som sökbart/filtrerbart objekt

**Prioritet:** Medium  
**Syfte:** Nyttjanderätter (arrenden, servitut, ledningsrätt m.m.) är centrala i ärendehandläggning men saknas idag. De ska kunna visas, sökas och filtreras precis som övriga objekt.

**Acceptanskriterier:**
- Nyttjanderätter kan laddas från `/data/nyttjanderatter.geojson` (genereras av konverteringsskriptet)
- Typen `nyttjanderatter` visas som ett chip i FilterPanel ("Nyttjanderätter", ikon `assignment`)
- Nyttjanderätter visas på kartan med fill-color `#6D88AA` (dino-darkblue-300), opacity 0.35
- De är sökbara på: `id`, `typ`, `status`, `fastighet_id`
- De visas i träfflistan med samma struktur som övriga objekt
- I detaljpanelen för en fastighet visas kopplade nyttjanderätter i en ny sektion "Nyttjanderätter" (rumslig koppling)

**Tekniska noter:**
- Lägg till `'nyttjanderatter'` i `ObjectTypeKey` i `src/hooks/useFilters.ts`
- Ny typ `NyttjanderattProperties` i `src/types/index.ts`
- `useMapLayers.ts`: lägg till source `nyttjanderatter` och fill/outline/hover/highlight-lager
- `useSearch.ts`: lägg till fetch av `/data/nyttjanderatter.geojson` i Promise.all
- `ObjectPanel.tsx`: lägg till `NyttjanderatterSection` i `FeatureContent` för fastigheter
- Konverteringsskriptet `scripts/convert_dino_export.py` behöver uppdateras för att hantera eventuellt nyttjanderätts-shapefile

**Claude Code-prompt:**
```
Lägg till nyttjanderätter som en ny objekttyp i prototypen. Följ exakt samma mönster som
delomraden är implementerat.

1. src/hooks/useFilters.ts — lägg till 'nyttjanderatter' i ObjectTypeKey och i defaultState

2. src/types/index.ts — lägg till:
   type NyttjanderattProperties = {
     feature_type: 'nyttjanderatt'; id: string; typ: string; status: string;
     fastighet_id: string; area_ha: number; _source_file: string
   }
   Lägg till isNyttjanderatt type guard.

3. src/hooks/useMapLayers.ts:
   - Lägg till source 'nyttjanderatter' med data: '/data/nyttjanderatter.geojson'
   - Lägg till fill (color: '#6D88AA', opacity: 0.35), outline, hover, highlight, selected-lager
   - Inkludera i filter-uppdaterings-useEffect på samma vis som övriga lager

4. src/hooks/useSearch.ts:
   - Lägg till fetch av '/data/nyttjanderatter.geojson' i Promise.all
   - Mappa features till SearchResult med layer: 'nyttjanderatter'
   - matchesText: sök på id, typ, status

5. src/components/FilterPanel.tsx:
   - Lägg till { key: 'nyttjanderatter', label: 'Nyttjanderätter', icon: 'assignment' } i TYPE_CONFIG

6. src/components/ObjectPanel.tsx:
   - Lägg till en NyttjanderatterSection i FeatureContent (för fastigheter), liknande ByggnaderSection,
     som visar nyttjanderätter kopplade rumsligt (turf.booleanIntersects) till fastigheten
```

---

### KART-3 — Ikoner för arrenden och anläggningar i träfflista och detaljvy

**Prioritet:** Låg  
**Syfte:** Konsekvens — alla objekt i träfflistan och detaljpanelen ska ha en igenkänningsbar Material Symbols-ikon.

**Acceptanskriterier:**
- I `ObjectPanel` — sektionsrubriken för Anläggningar visar `construction`-ikonen, sektionen för Avtal visar `handshake`-ikonen (dessa kan redan finnas — verifiera)
- Arrenden-sektionen visar en passande ikon (`assignment`)
- Ikonerna är konsekvent 16px och färg `--color-primary` i sektionsrubriker

**Tekniska noter:**
- Kontrollera `RelatedSection`-komponenten i `ObjectPanel.tsx` — den tar redan in en `icon`-prop
- `AvtalSection` använder `handshake`, `AnlaggningarSection` använder `construction` — verifiera att de inte saknas i den renderade UI:n
- Om arrenden inte finns som sektionstyp ännu, lägg till som placeholder redo för KART-8

**Claude Code-prompt:**
```
Verifiera i src/components/ObjectPanel.tsx att sektionsrubrikerna för Anläggningar (icon="construction"),
Avtal (icon="handshake") och Byggnader (icon="home_work") renderas korrekt med ikonerna synliga.

Om någon ikon saknas i den renderade UI:n (t.ex. om sectionIcon-klassen inte ger rätt storlek/färg),
justera .sectionIcon i ObjectPanel.module.css till:
  font-size: 16px;
  color: var(--color-primary);

Lägg dessutom till en Arrenden-sektionstyp som placeholder i FeatureContent (för fastigheter),
direkt efter AvtalSection, med icon="assignment" och title="Arrenden". Visa sektionen bara om
en (ännu tom) arrendeList-array har längd > 0 — så strukturen finns redo för KART-8.
```

---

### KART-6 — Visa objekt som pins vid låg zoom-nivå

**Prioritet:** Låg  
**Syfte:** Zoomar man ut långt ser polygoner antingen ut som obegripliga fläckar eller försvinner helt. En pin/ikon centrerad i objektets tyngdpunkt ger bättre orientering.

**Acceptanskriterier:**
- Vid zoom < 10 visas varje synligt objekt som en cirkulär pin på centroiden — ingen polygon/linje
- Vid zoom ≥ 10 visas full geometri som vanligt
- Pins är färgkodade efter objekttyp (samma färger som polygon-fill)
- Klick på en pin öppnar detaljpanelen precis som klick på en polygon
- Gäller fastigheter, skyddatomraden, beslut, delomraden

**Tekniska noter:**
- Mapbox-lager stöder `minzoom`/`maxzoom` — använd det
- För varje typ, lägg till ett `circle`-lager med `maxzoom: 10` på ett centroid-source (samma princip som befintliga `beslut-centroids`-källan)
- Befintliga polygon-fill/outline-lager får `minzoom: 10`
- Centroid-sources: bygg GeoJSON med centroider vid data-laddning (samma mönster som `beslut-centroids` i `useMapLayers.ts`)
- Klick-hantering: befintlig `map.on('click')` i `useSelectedFeature.ts` behöver också lyssna på de nya circle-lagrens ID:n

**Claude Code-prompt:**
```
I src/hooks/useMapLayers.ts, lägg till pin-visning vid låg zoom:

1. Skapa nya GeoJSON-källor för centroider: 'fastigheter-centroids', 'skyddatomraden-centroids', 'delomraden-centroids'
   (beslut-centroids finns redan). Populera dem vid data-laddning med turf.centroid() på samma sätt
   som befintlig beslut-centroids-logik.

2. Lägg till circle-lager för varje typ med maxzoom: 10 och passande circle-color (samma färg som fill).
   Exempelstruktur:
   map.addLayer({ id: 'fastigheter-pins', type: 'circle', source: 'fastigheter-centroids', maxzoom: 10,
     paint: { 'circle-color': '#405D1A', 'circle-radius': 7, 'circle-stroke-width': 2, 'circle-stroke-color': '#FFFFFF' }
   })

3. Sätt minzoom: 10 på alla polygon-fill och polygon-outline-lager (fastigheter-fill, fastigheter-outline, osv.)

4. I src/hooks/useSelectedFeature.ts — utöka listan med click-hanterade lager-ID:n med
   'fastigheter-pins', 'skyddatomraden-pins', 'delomraden-pins' (beslut-pins om det skapas).
   Klick på en pin ska fungera identiskt med klick på en polygon.

Filtrera centroid-sources på samma vis som polygon-lagrens filter (visibleIds) i den useEffect
som uppdaterar lagerfilter.
```

---

### KART-7 — Spara sökningar med filter

**Prioritet:** Låg  
**Syfte:** Handläggare återkommer till samma sökningar dagligen. En sparad sökning ska återställa exakt tillstånd: sökterm, aktiva objekttyper, attributfilter.

**Acceptanskriterier:**
- En "Spara sökning"-knapp visas i sidopanelen när en aktiv sökning pågår
- Klicka → dialog/popover för att namnge sökningen
- Sparade sökningar lagras i `localStorage` under nyckeln `kartsok-saved-searches`
- Listvy av sparade sökningar nås via en ikon/knapp i sökfältet
- Klick på en sparad sökning återställer: `query`, `activeTypes`, `attributes`
- Maxgräns: 10 sparade sökningar (äldsta raderas vid överskridning)
- En sparad sökning kan tas bort individuellt

**Tekniska noter:**
- Ny hook `useSavedSearches` i `src/hooks/useSavedSearches.ts`
- Sparar: `{ name: string, query: string, activeTypes: Record<ObjectTypeKey, boolean>, attributes: AttributeFilters, createdAt: string }`
- Ny UI-komponent `SavedSearchesPanel.tsx` — liten dropdown som triggas från en ikon i SearchBar
- Integration i `App.tsx`: lägg till `onSave` och `onLoad` callbacks

**Claude Code-prompt:**
```
Implementera sparade sökningar i tre steg:

1. Skapa src/hooks/useSavedSearches.ts:
   - Typ SavedSearch: { id: string; name: string; query: string; activeTypes: Record<ObjectTypeKey, boolean>; attributes: AttributeFilters; createdAt: string }
   - Läs/skriv mot localStorage nyckeln 'kartsok-saved-searches'
   - Exportera: { saved, saveSearch(name, query, activeTypes, attributes), deleteSearch(id), loadSearch(id) }
   - Max 10 sökningar — ta bort den äldsta (sort by createdAt) vid överskridning

2. Skapa src/components/SavedSearchesPanel.tsx:
   - En liten knapp (bookmark-ikon) som öppnar en dropdown-lista med sparade sökningar
   - Varje rad: namn, datum, och en soptunna-ikon för att ta bort
   - Klick på en rad anropar onLoad(search)
   - Tom lista: visa "Inga sparade sökningar"

3. Integrera i App.tsx + SearchBar.tsx:
   - Lägg till en "Spara"-knapp i sidopanelens sökfält (visas bara när isSearchActive är true)
   - Klick öppnar ett litet inline-formulär (input + "Spara"-knapp)
   - Lägg till SavedSearchesPanel i närheten av SearchBar
   - När en sparad sökning laddas: anropa setQuery, toggleType (för alla typer), toggleAttributeValue och commitSearch
```
