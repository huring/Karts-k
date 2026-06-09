# DESIGNSYSTEM.md — DINO

Källa: [DINO Komponentbibliotek (Figma)](https://www.figma.com/design/jjiph99LYQaG7hw8DJjNdX/DINO-komponentbibliotek)
och [DINO Skydd (Figma)](https://www.figma.com/design/IMioEZEb0yKfPvjvqXaEl5/DINO-Skydd)

Den här filen är källan till sanning för hur komponenter ska se ut och bete sig
i prototypen. Använd alltid värdena härifrån — hårdkoda inga färger, storlekar
eller radier direkt i komponentkod.

---

## Typsnitt

**Familj:** Inter (Google Fonts)

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
```

### Typskala

| Token                  | Storlek | Vikt | Användning                        |
|------------------------|---------|------|-----------------------------------|
| `text-xxs/font-medium` | 10px    | 500  | Mikrolabels, badges               |
| `text-xxs/font-bold`   | 10px    | 700  | Chips small                       |
| `text-xs/font-normal`  | 12px    | 400  | Hjälptext, metadata               |
| `text-xs/font-medium`  | 12px    | 500  | Sekundära labels                  |
| `text-xs/font-semibold`| 12px    | 600  | Chips S                           |
| `text-sm/font-normal`  | 14px    | 400  | Knappar, chips M/L, brödtext      |
| `text-sm/font-medium`  | 14px    | 500  | Navigeringslänkar                 |
| `text-sm/font-semibold`| 14px    | 600  | Inputlabels, formlabels           |
| `text-sm/font-bold`    | 14px    | 700  | —                                 |
| `text-base/font-normal`| 16px    | 400  | Brödtext, inputplaceholder        |
| `text-base/font-medium`| 16px    | 500  | Underrubriker                     |
| `text-base/font-bold`  | 16px    | 700  | Sidotitlar                        |
| `text-lg/font-semibold`| 18px    | 600  | Sektionsrubriker                  |
| `text-xl/font-normal`  | 20px    | 400  | —                                 |
| `text-xl/font-medium`  | 20px    | 500  | Feature-headers                   |
| `text-xl/font-bold`    | 20px    | 700  | Sidrubriker                       |
| `text-2xl/font-semibold`| 24px   | 600  | Dokumenttitlar, stora rubriker    |

---

## Färgpalett

Alla färger är hämtade direkt från Figma-bibliotekets variabler.
Använd CSS-variabelnamnen i all komponentkod.

### CSS-variabler (lägg i `src/index.css`)

```css
:root {
  /* === Darkblue (primär varumärkesfärg) === */
  --dino-darkblue-50:  #EDF2F9;
  --dino-darkblue-100: #D2DCE8;
  --dino-darkblue-200: #A0B3CB;
  --dino-darkblue-300: #6D88AA;  /* hover-state primary */
  --dino-darkblue-400: #375A84;
  --dino-darkblue-500: #013264;  /* primär textfärg på sekundärknapp */
  --dino-darkblue-600: #002853;
  --dino-darkblue-700: #031F3F;
  --dino-darkblue-800: #001837;
  --dino-darkblue-900: #000D22;
  --dino-darkblue-950: #000412;

  /* === Blue === */
  --dino-blue-50:  #F0F6FC;
  --dino-blue-100: #DDEDFF;
  --dino-blue-200: #B8D8FB;
  --dino-blue-300: #8FBFF3;
  --dino-blue-400: #5CA3EC;
  --dino-blue-link: #1B88E8;    /* länkfärg, info */
  --dino-blue-600: #1170C2;
  --dino-blue-700: #07599D;
  --dino-blue-800: #0E4C83;     /* primary button bg */
  --dino-blue-900: #062F54;
  --dino-blue-950: #021B35;

  /* === Darkgreen === */
  --dino-darkgreen-50:  #EFF3ED;
  --dino-darkgreen-100: #D5DED1;
  --dino-darkgreen-200: #A9BBA2;
  --dino-darkgreen-300: #7B9571;
  --dino-darkgreen-400: #4A6B3D;
  --dino-darkgreen-500: #1E4606;  /* mörkgrön accent */
  --dino-darkgreen-600: #143701;
  --dino-darkgreen-700: #122B05;
  --dino-darkgreen-800: #0A2400;
  --dino-darkgreen-900: #051400;
  --dino-darkgreen-950: #010800;

  /* === Green === */
  --dino-green-50:  #F3F7F0;
  --dino-green-100: #E3EBDD;
  --dino-green-200: #C6D8B6;
  --dino-green-300: #A6BE8F;
  --dino-green-400: #84A561;
  --dino-green-500: #638C2F;
  --dino-green-600: #517227;
  --dino-green-700: #405D1A;
  --dino-green-800: #354E13;
  --dino-green-900: #21310E;
  --dino-green-950: #101D03;

  /* === Slategrey (neutraler) === */
  --dino-slategrey-50:  #F2F2F2;  /* bakgrundsyta */
  --dino-slategrey-100: #DBDBDB;
  --dino-slategrey-200: #B7B7B7;  /* border secondary, disabled */
  --dino-slategrey-300: #8C8C8C;
  --dino-slategrey-400: #636363;
  --dino-slategrey-500: #3D3D3D;  /* dino/black — primär textfärg */
  --dino-slategrey-600: #303030;
  --dino-slategrey-700: #262626;
  --dino-slategrey-800: #1F1F1F;
  --dino-slategrey-900: #0F0F0F;
  --dino-slategrey-950: #070707;

  /* === Red === */
  --dino-red-50:  #FCF3F1;
  --dino-red-100: #FFE4E0;
  --dino-red-200: #FCC0B8;
  --dino-red-300: #FB988D;
  --dino-red-400: #F26A5F;
  --dino-red-500: #E63935;  /* error/destructive */
  --dino-red-600: #BE2F2C;
  --dino-red-700: #9E2320;
  --dino-red-800: #831A19;
  --dino-red-900: #55110F;
  --dino-red-950: #320605;

  /* === Orange === */
  --dino-orange-400: #E3A480;
  --dino-orange-500: #D98C61;
  --dino-orange-600: #B6734D;
  --dino-orange-700: #915E40;

  /* === Yellow === */
  --dino-yellow-400: #F4E28B;
  --dino-yellow-500: #F3DB65;
  --dino-yellow-600: #CCB857;

  /* === Lilac === */
  --dino-lilac-100: #F2ECF2;
  --dino-lilac-500: #B998B9;
  --dino-lilac-600: #997F9A;

  /* === Semantiska alias === */
  --dino-white:   #FFFFFF;
  --dino-black:   #3D3D3D;   /* = slategrey/500 */
  --dino-info:    #1B88E8;   /* = blue/link */
  --dino-warning: #FFDF20;
  --dino-alert:   #FF8376;

  /* === Applikationsalias (använd dessa i komponentkod) === */
  --color-bg:              var(--dino-white);
  --color-bg-secondary:    var(--dino-slategrey-50);
  --color-text:            var(--dino-slategrey-500);
  --color-text-muted:      var(--dino-slategrey-300);
  --color-border:          #D9D9D9;
  --color-border-secondary: var(--dino-slategrey-200);
  --color-primary:         var(--dino-blue-800);
  --color-primary-hover:   var(--dino-darkblue-300);
  --color-link:            var(--dino-blue-link);
  --color-error:           var(--dino-red-500);
  --color-warning:         var(--dino-warning);
  --color-info:            var(--dino-info);

  /* === Border radius === */
  --radius-sm:  4px;   /* knappar */
  --radius-md:  8px;   /* inputs, kort */
  --radius-full: 100px; /* chips, pills */

  /* === Spacing (8px-grid) === */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
}
```

### Färgbetydelse

| Färg | Ramp | Användning |
|---|---|---|
| Primär | darkblue/500 + blue/800 | Primärknapp, aktiva navigeringslänkar |
| Länk / info | blue/link `#1B88E8` | Klickbara länktexter, info-tillstånd |
| Neutraler | slategrey | Bakgrunder, borders, disabled, brödtext |
| Error | red/500 | Felmeddelanden, destructive actions |
| Warning | `#FFDF20` | Varningsmeddelanden |
| Alert | `#FF8376` | Mjukare varning, notiser |
| Natur / mark | darkgreen, green | Kartfärger, fastighetslager |

---

## Komponenter

### Button — primary

**Bakgrund:** `#0E4C83` (blue/800)  
**Hover:** `#6D88AA` (darkblue/300)  
**Text:** white, 14px regular  
**Padding:** 8px 12px  
**Border-radius:** 4px  
**Höjd:** 33px (standard), 24px (small)

```css
.btn-primary {
  background: var(--dino-blue-800);
  color: var(--dino-white);
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  font-weight: 400;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 33px;
}
.btn-primary:hover {
  background: var(--dino-darkblue-300);
}
```

---

### Button — secondary

**Bakgrund:** transparent (default), `#D9D9D9` (hover)  
**Border:** 0.5px solid `#787878` (default), `#B7B7B7` (hover)  
**Text:** `#013264` (darkblue/500), 14px regular  
**Padding:** 8px 14px  
**Border-radius:** 4px

```css
.btn-secondary {
  background: transparent;
  color: var(--dino-darkblue-500);
  font-size: 14px;
  font-weight: 400;
  padding: 8px 14px;
  border-radius: var(--radius-sm);
  border: 0.5px solid #787878;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 33px;
}
.btn-secondary:hover {
  background: #D9D9D9;
  border-color: var(--dino-slategrey-200);
}
```

---

### Button — ghost

Identisk med secondary men utan border i default-state. Samma text- och hoverfärg.

```css
.btn-ghost {
  background: transparent;
  color: var(--dino-darkblue-500);
  font-size: 14px;
  font-weight: 400;
  padding: 8px 14px;
  border-radius: var(--radius-sm);
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 33px;
}
.btn-ghost:hover {
  color: #062B66;
}
```

---

### Input — textfält

**Border:** 1px solid `#D9D9D9`  
**Border-radius:** 8px  
**Höjd:** 42px  
**Padding:** 0 13px  
**Placeholder:** slategrey/200 `#B7B7B7`, 16px regular  
**Label:** ovanför fältet, 14px semibold, slategrey/900 `#0F0F0F`

```css
.input-field {
  height: 42px;
  width: 100%;
  padding: 0 13px;
  border: 1px solid #D9D9D9;
  border-radius: var(--radius-md);
  font-size: 16px;
  font-weight: 400;
  color: var(--color-text);
  background: var(--color-bg);
  outline: none;
}
.input-field::placeholder {
  color: var(--dino-slategrey-200);
}
.input-field:focus {
  border-color: var(--dino-blue-link);
  box-shadow: 0 0 0 2px rgba(27, 136, 232, 0.15);
}

.input-label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--dino-slategrey-900);
  margin-bottom: 4px;
}
```

**Varianter:** Empty, Fill (med inmatad text), Dropdown (med pil-ikon), Datepicker (med kalender-ikon + format `ÅÅÅÅ - MM - DD`)

---

### Chips

Används som statusindikator i tabeller (M), filterväljare, eller taggar.

| Variant | Storlek | Padding | Border-radius | Font |
|---|---|---|---|---|
| S | 12px | 3px 8px | 28px | regular |
| M | 14px | 4px 12px | 100px | regular |
| L | 14px | 4px 12px | 100px | regular |

**Bakgrund:** white  
**Text:** `#212121`

```css
.chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--dino-white);
  color: #212121;
  font-family: 'Inter', sans-serif;
  white-space: nowrap;
}
.chip-s { font-size: 12px; padding: 3px 8px; border-radius: 28px; }
.chip-m { font-size: 14px; padding: 4px 12px; border-radius: 100px; }
.chip-l { font-size: 14px; padding: 4px 12px; border-radius: 100px; }
```

> **Notering:** Chips M används specifikt som statuschips i tabeller enligt Figma-dokumentationen.

---

### Navigering (sidomeny)

Baserat på DINO Skydds sidoMenustruktur:

- Navigeringslänkar i sidomenyn är **14px medium**, blå (`var(--dino-blue-link)`)
- Ikon + text i rad med 8px gap
- Aktiv/vald länk: mörkare blå, ev. en vänster-border-accent
- Dividers (`<hr>`) används för att gruppera sektioner i menyn

---

### Kartspecifika färger

Används i prototypens GeoJSON-lager — matchar DINO:s naturvårdskontext:

| Objekt | Fyllning | Opacity | Beskrivning |
|---|---|---|---|
| Fastighet — skog | `#405D1A` (darkgreen/700) | 0.4 | Skogsmark |
| Fastighet — åker | `#F4E28B` (yellow/400) | 0.5 | Jordbruksmark |
| Fastighet — impediment | `#B7B7B7` (slategrey/200) | 0.4 | Impediment/övrigt |
| Fastighet — vatten | `#B8D8FB` (blue/200) | 0.5 | Vattenmark |
| Byggnad | `#E3A480` (orange/400) | 0.7 | Byggnader |
| Highlight | `#013264` (darkblue/500) | — | Valt objekt, kontur 3px |
| Rumslig sökning | `#5CA3EC` (blue/400) | 0.15 | Ritad sökyta |
| Mätlinje | `#E63935` (red/500) | — | Avståndsmätning, dashad |
| Buffert | `#638C2F` (green/500) | 0.12 | Buffertzon runt objekt |

---

## Spacing och layout

DINO använder ett **8px-grid**. Allt spacing är multiplar av 4px/8px.

```
4px  — gap inom komponenter (ikon + text i knapp)
8px  — inre padding, gap mellan nära element
12px — padding i knappar (horisontellt)
16px — standard komponentpadding, kortpadding
24px — sektionsavstånd
32px — stora sektionsmellanrum
```

**Sidolayout (DINO Skydd):**
- Vänster sidomeny: ~240px bred
- Innehållsyta: resten av bredden
- Header: 40px (System), 56px (Document), 70px (Feature)

---

## Ikonografi

DINO använder **Material Symbols** (Google). Ikoner visas som 24×24px.
Ikon + text har alltid `gap: 4–8px`.

Vanliga ikoner i navigering (från DINO Skydd):
- `grid_view` / `dashboard` — Översikt
- `location_on` / `place` — Fastighetsområden / kartobjekt
- `home_work` — Byggnader & Anläggningar
- `handshake` / `description` — Avtal
- `sell` — Värderingar
- `payments` — Ekonomi
- `gavel` — Nyttjanderätter / Servitut
- `folder` / `folder_open` — Dokument
- `edit_note` — Anteckningar
- `history` — Historik
- `calendar_month` — Datepicker
- `add` — Lägg till
- `download` — Ladda ned

---

## Dos and don'ts

**Gör:**
- Använd alltid CSS-variablerna ovan, aldrig hårdkodade hex-värden
- Håll knappar på 33px höjd (standard) eller 24px (small)
- Använd Inter som typsnitt i alla vikter
- Följ 8px-grid för all spacing
- Visa inputlabels ovanför fältet, aldrig inuti (placeholder ersätter inte label)

**Gör inte:**
- Blanda button-varianterna — primary för primär åtgärd per vy, secondary och ghost för sekundära
- Använd inte andra border-radius-värden än 4px (knappar), 8px (inputs/kort), 100px (chips)
- Ändra inte färger i Figma-paletten — alla 10 ramps är definierade och ska användas som de är
- Sätt inte text direkt på mörkblå bakgrund utan att kontrollera kontrasten mot dino/white

---

## Figma-resurser

| Fil | Länk |
|---|---|
| Komponentbibliotek | https://www.figma.com/design/jjiph99LYQaG7hw8DJjNdX/DINO-komponentbibliotek |
| DINO Skydd | https://www.figma.com/design/IMioEZEb0yKfPvjvqXaEl5/DINO-Skydd |