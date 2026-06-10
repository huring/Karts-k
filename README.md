# Kartsök — DINO-prototyp

Interaktiv kartprototyp för kartsökning i DINO, byggd med React + TypeScript + Mapbox GL JS.

## Kom igång

```bash
# Installera beroenden
npm install

# Skapa en .env-fil (kopiera från .env.example)
cp .env.example .env
# Fyll i din Mapbox-token: VITE_MAPBOX_TOKEN=pk.eyJ1...

# Starta dev-server
npm run dev
```

Öppna `http://localhost:5173` i webbläsaren.

## DINO-komponentbiblioteket

Det finns inget publicerat NPM-paket. Komponenter byggs manuellt utifrån
[Figma-specen](https://www.figma.com/design/jjiph99LYQaG7hw8DJjNdX/DINO-komponentbibliotek)
och dokumenteras i [`DESIGNSYSTEM.md`](./DESIGNSYSTEM.md).

### Tillgängliga komponenter

| Komponent | Fil | Varianter |
|---|---|---|
| `Button` | `src/components/ui/Button.tsx` | `primary`, `secondary`, `ghost` · storlek `md`, `sm` |
| `Input` | `src/components/ui/Input.tsx` | med `label`-prop, focus-ring |
| `Badge` | `src/components/ui/Badge.tsx` | `default`, `success`, `warning`, `error`, `neutral` · storlek `s`, `m`, `l` |

### Lägga till en ny komponent

1. Läs komponentspecen i `DESIGNSYSTEM.md` (padding, höjd, hover-states m.m.)
2. Skapa `src/components/ui/MinKomponent.tsx` och `MinKomponent.module.css`
3. Använd alltid CSS-variablerna från `src/index.css` — aldrig hårdkodade hex-värden
4. Exportera komponenten och lägg till den i tabellen ovan

**Regler:**
- Spacing enbart via `--space-*`-variablerna (8px-grid)
- Border-radius: `--radius-sm` (4px knappar), `--radius-md` (8px inputs/kort), `--radius-full` (100px chips)
- Typsnitt: Inter via `font-family: 'Inter', sans-serif`
- Ikoner: Material Symbols Outlined (klass `material-symbols-outlined`)

## Projektstruktur

```
src/
├── components/
│   ├── ui/          ← DINO-baskomponenter (Button, Input, Badge)
│   ├── Map.tsx      ← Mapbox-kartcontainer
│   ├── LayerToggle  ← Lagerväxlare
│   └── ComponentDemo← Komponentdemonstration (tas bort efter prototypfas)
├── hooks/
│   ├── useMap.ts        ← Mapbox-karta + MapboxDraw-instans
│   ├── useMapLayers.ts  ← GeoJSON-lager och synlighet
│   └── useDrawTools.ts  ← Lyssnare för ritade geometrier (area/längd)
├── types/index.ts   ← TypeScript-typer (Fastighet, Byggnad, Avtal m.m.)
└── index.css        ← Fullständiga DINO CSS-variabler + Material Symbols
```

## Miljövariabler

| Variabel | Beskrivning |
|---|---|
| `VITE_MAPBOX_TOKEN` | Mapbox public token (börjar med `pk.`) |
