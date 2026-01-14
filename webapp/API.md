# API Dokumentation - Reparaturbonus Analyse

Diese Dokumentation beschreibt die Datenstrukturen, Services und Komponenten der Reparaturbonus-Analyse-Anwendung.

---

## Inhaltsverzeichnis

- [Datenstrukturen](#datenstrukturen)
  - [ShopRecord](#shoprecord)
  - [SelectionSettings](#selectionsettings)
- [Services](#services)
  - [DataService](#dataservice)
- [Wichtige Funktionen](#wichtige-funktionen)
  - [adjustForInflation](#adjustforinflation)
  - [parseDateLoose](#parsedateloose)
- [Komponenten](#komponenten)
  - [AppComponent](#appcomponent)
  - [HistogramComponent](#histogramcomponent)
  - [ScatterplotComponent](#scatterplotcomponent)
  - [MapPanelComponent](#mappanelcomponent)
  - [ShopsComponent](#shopscomponent)

---

## Datenstrukturen

### ShopRecord

Repräsentiert einen Fahrrad-Reparaturshop mit allen erfassten Preis- und Metadaten.

**Dateipfad:** `src/app/types.ts`

```typescript
interface ShopRecord {
  // Identifikationsdaten
  name: string;                              // Name des Geschäfts (erforderlich)
  address?: string;                          // Adresse (optional)
  website?: string;                          // Website-URL (optional)

  // Service-Fähigkeiten
  offersRepair?: boolean | null;             // Bietet Reparaturen an

  // Historische Preisdaten
  firstPriceDate?: string | null;            // Datum der ersten Preiserfassung (ISO-Format)
  firstPrice?: number | null;                // Ursprünglicher Preis in Euro
  firstPriceInflationAdjusted?: number | null; // Inflationsbereinigter Preis (auf 2025 angepasst)
  firstPriceSource?: string | null;          // Quelle (z.B. Wayback Machine URL)

  // Aktuelle Preisdaten
  currentPriceDate?: string | null;          // Datum der aktuellen Preiserfassung
  currentPrice?: number | null;              // Aktueller Preis in Euro
  currentPriceSource?: string | null;        // Quelle (z.B. Website-URL)

  // Geografische Daten
  lat?: number | null;                       // Breitengrad (WGS84)
  lon?: number | null;                       // Längengrad (WGS84)

  // Abgeleitete Metriken
  deltaVsFirstAdj?: number | null;           // Preisdifferenz: current - firstInflationAdjusted (€)
  deltaVsFirstAdjPercentage?: number | null; // Prozentualer Preisunterschied
}
```

**Berechnungslogik für abgeleitete Felder:**

- `firstPriceInflationAdjusted`: Wird mit der CPI-basierten Inflationsanpassung berechnet (siehe [adjustForInflation](#adjustforinflation))
- `deltaVsFirstAdj`: `currentPrice - firstPriceInflationAdjusted`
- `deltaVsFirstAdjPercentage`: `delta / currentPrice` (Prozentsatz relativ zum aktuellen Preis)

---

### SelectionSettings

Speichert alle Filtereinstellungen der Benutzeroberfläche.

**Dateipfad:** `src/app/types.ts`

```typescript
interface SelectionSettings {
  // Textsuche
  q: string;                      // Suchbegriff für Name/Adresse

  // Boolean-Filter
  onlyWithCurrent: boolean;       // Nur Shops mit aktuellem Preis anzeigen
  offersRepairYes: boolean;       // Shops anzeigen, die Reparatur anbieten
  offersRepairNo: boolean;        // Shops anzeigen, die keine Reparatur anbieten

  // Preisbereichsfilter
  firstPriceMin: number | null;   // Minimaler Erstpreis
  firstPriceMax: number | null;   // Maximaler Erstpreis
  currentPriceMin: number | null; // Minimaler aktueller Preis
  currentPriceMax: number | null; // Maximaler aktueller Preis

  // Datenvorhandensein-Filter
  hasFirstPrice: boolean;         // Nur Datensätze mit Erstpreis
  missingFirstPrice: boolean;     // Nur Datensätze ohne Erstpreis
  hasFirstAdj: boolean;           // Nur Datensätze mit inflationsbereinigtem Preis
  missingFirstAdj: boolean;       // Nur Datensätze ohne inflationsbereinigten Preis
  hasCurrentPrice: boolean;       // Nur Datensätze mit aktuellem Preis
  missingCurrentPrice: boolean;   // Nur Datensätze ohne aktuellen Preis

  // Datumsbereichsfilter (ISO-Format: yyyy-MM-dd)
  firstDateFrom: string | null;   // Frühestes Datum für Erstpreis
  firstDateTo: string | null;     // Spätestes Datum für Erstpreis
  currentDateFrom: string | null; // Frühestes Datum für aktuellen Preis
  currentDateTo: string | null;   // Spätestes Datum für aktuellen Preis
}
```

**Standardwerte:** `defaultSelectionSettings` in `types.ts`

---

## Services

### DataService

Zentraler Service zum Laden und Verarbeiten der Shop-Daten.

**Dateipfad:** `src/app/data.service.ts`

#### Öffentliche API

```typescript
@Injectable({providedIn: 'root'})
class DataService {
  // Readonly Signal mit allen Shop-Datensätzen
  readonly records: Signal<ShopRecord[]>;

  // Lädt Daten neu
  async reload(): Promise<void>;
}
```

#### Wichtige Private Methoden

**`loadRecords(): Promise<ShopRecord[]>`**
- Lädt die TSV-Datei von `/data/bicycle_repair_shops_vienna.tsv`
- Parst mit D3's `tsvParse`
- Berechnet inflationsbereinigte Preise
- Berechnet Preisdifferenzen

**`parsePrice(v: any): number | null`**
- Parst europäisches Zahlenformat (Komma als Dezimaltrennzeichen)
- Entfernt Währungssymbole (€)
- Behandelt Tausendertrennzeichen
- Beispiele:
  - `"€ 125,50"` → `125.5`
  - `"1.200,99"` → `1200.99`
  - `"NA"` → `null`

**`toBool(v: any): boolean | null`**
- Parst Boolean-Werte aus verschiedenen String-Formaten
- Unterstützt Deutsch und Englisch: `['ja', 'yes', 'y', '1', 'true']` → `true`

**`fixUrl(u?: string): string | undefined`**
- Normalisiert URLs mit `https://`-Präfix
- Behandelt URLs ohne Protokoll

---

## Wichtige Funktionen

### adjustForInflation

Passt einen historischen Preis an die Inflation an.

**Dateipfad:** `src/app/data.service.ts`

```typescript
function adjustForInflation(
  price: number,              // Ursprünglicher Preis
  baseYear: number,           // Jahr des ursprünglichen Preises
  targetYear: number = 2025,  // Zieljahr für Anpassung
  cpiTable: Record<number, number> = cpi2015Base // CPI-Tabelle
): number | null
```

**Formel:**
```
adjustedPrice = originalPrice × (CPI_target / CPI_base)
```

**Beispiel:**
```typescript
// Ein Service kostete 2020 €100
// CPI 2020: 108.2, CPI 2025: 136.78
adjustForInflation(100, 2020, 2025);
// Ergebnis: €126.42
```

**CPI-Daten (Basis 2015 = 100):**
```typescript
const cpi2015Base = {
  2015: 100.0,
  2016: 100.9,
  2017: 103.0,
  2018: 105.1,
  2019: 106.7,
  2020: 108.2,
  2021: 111.2,
  2022: 120.7,
  2023: 130.1,
  2024: 134.0,
  2025: 136.78
};
```

**Datenquellen:**
- Statistics Austria (2015-2024)
- Österreichische Nationalbank (2025)

---

### parseDateLoose

Parst Datumsstrings in verschiedenen Formaten zu Unix-Timestamps.

**Dateipfade:** `src/app/app.component.ts`, `src/app/shops/shops.component.ts`

```typescript
function parseDateLoose(s?: string | null): number | null
```

**Unterstützte Formate:**
1. ISO-Format: `YYYY-MM-DD` oder `YYYY/MM/DD`
2. Europäisches Format: `DD.MM.YYYY`
3. Sonstige von `Date.parse()` unterstützte Formate

**Beispiele:**
```typescript
parseDateLoose("2020-04-15");      // 1586908800000
parseDateLoose("15.04.2020");      // 1586908800000
parseDateLoose("2020/04/15");      // 1586908800000
parseDateLoose("invalid");         // null
```

---

## Komponenten

### AppComponent

Haupt-Komponente, die alle Filter und Visualisierungen koordiniert.

**Dateipfad:** `src/app/app.component.ts`

#### Wichtige Eigenschaften

```typescript
class AppComponent {
  // Filter-Status (zentrales Signal)
  selectionSettings: Signal<SelectionSettings>;

  // Gefilterte Datensätze (computed)
  filtered: Signal<ShopRecord[]>;

  // Histogramm-Daten (computed)
  histo: Signal<number[]>; // Array von Prozentsätzen

  // UI-Status
  collapsed_histogram: boolean;
  collapsed_map: boolean;
  collapsed_scatterplot: boolean;
}
```

#### Wichtige Methoden

**`resetFilters(): void`**
- Setzt alle Filter auf Standardwerte zurück

**`onChildValue(value: SelectionSettings): void`**
- Empfängt Filter-Updates von Kind-Komponenten
- Aktualisiert zentrale Filter-State

---

### HistogramComponent

D3-basierte Histogramm-Visualisierung.

**Dateipfad:** `src/app/histogram/histogram.component.ts`

#### Inputs

```typescript
@Input() values: Signal<number[]>;           // Prozentwerte zum Visualisieren
@Input() bins: Signal<number>;               // Anzahl der Bins
@Input() domain: [number, number] | null;    // Optionaler Wertebereich
@Input() margin: {top, right, bottom, left}; // Chart-Ränder
```

#### Besonderheiten

- **Symmetrische Bins:** Immer ungerade Anzahl, damit ein Bin bei 0% liegt
- **Responsive:** Nutzt ResizeObserver
- **Tooltips:** Zeigt Bin-Bereich und Anzahl bei Hover
- **Achsenbeschriftungen:**
  - X-Achse: "Δ Preis vs. Erstpreis (%)"
  - Y-Achse: "Häufigkeit"

---

### ScatterplotComponent

D3-basierte Scatterplot-Visualisierung.

**Dateipfad:** `src/app/scatterplot/scatterplot.component.ts`

#### Inputs

```typescript
@Input() records: Signal<ShopRecord[]>;      // Shop-Datensätze
@Input() margin: {top, right, bottom, left}; // Chart-Ränder
@Input() dotRadius: number;                  // Punktgröße (default: 3.5px)
```

#### Visualisierung

- **X-Achse:** Datum der ersten Preiserfassung
- **Y-Achse:** Prozentuale Preisänderung
- **Zweck:** Zeitliche Muster erkennen (korreliert der Erfassungszeitpunkt mit der Preisänderung?)
- **Tooltips:** Shop-Name und exakte Prozentsatzänderung

---

### MapPanelComponent

Leaflet-basierte Karten-Visualisierung.

**Dateipfad:** `src/app/map-panel/map-panel.component.ts`

#### Inputs

```typescript
@Input() records: Signal<ShopRecord[]>;  // Shop-Datensätze mit Koordinaten
@Input() selectedKeys: Set<string>;      // Ausgewählte Shop-Keys
```

#### Marker-Farben

```typescript
// Bestimmt durch Preisänderung
function getMarkerColor(delta: number | null): string {
  if (delta === null) return '#999';      // Grau: Keine Daten
  if (delta > 0) return '#cc0000';        // Rot: Preiserhöhung
  return '#2a6';                          // Grün: Preissenkung
}
```

#### Popup-Inhalt

- Shop-Name
- Adresse
- Website-Link
- Prozentuale Preisänderung

#### Kartenkonfiguration

- **Zentrum:** Wien (48.208°N, 16.373°E)
- **Zoom:** Auto-Fit beim ersten Laden
- **Tiles:** OpenStreetMap

---

### ShopsComponent

Tabellen-Komponente zur Anzeige aller Datensätze.

**Dateipfad:** `src/app/shops/shops.component.ts`

#### Inputs/Outputs

```typescript
@Input() records: Signal<ShopRecord[]>;
@Input() selectionSettings: Signal<SelectionSettings>;
@Output() valueChange: EventEmitter<SelectionSettings>;
```

#### Spalten

1. **Name** - Geschäftsname (sortierbar)
2. **Adresse** - Vollständige Adresse
3. **Erstpreis** - Ursprünglicher Preis
4. **Erstpreis (inflationsbereinigt)** - Auf 2025 angepasst
5. **Aktueller Preis** - Heutiger Preis
6. **Δ (absolut)** - Differenz in Euro (farbcodiert)
7. **Δ (%)** - Prozentualer Unterschied (farbcodiert)
8. **Quellen** - Links zu Wayback Machine / Website

#### Funktionen

**Sortierung:**
- Klick auf Spaltenüberschrift: Aufsteigend sortieren
- Erneuter Klick: Absteigend sortieren
- Aktuelles Sortierfeld wird visuell hervorgehoben

**Farbcodierung:**
- Grüne Zahlen: Positive Änderung (Preiserhöhung)
- Rote Zahlen: Negative Änderung (Preissenkung)

**Durchschnittliche Änderung:**
- Wird am Ende der Tabelle angezeigt
- Berechnet aus allen sichtbaren Datensätzen

---

## Verwendungsbeispiele

### Datensätze filtern

```typescript
// Filter setzen
const settings: SelectionSettings = {
  q: 'Wien',                    // Suche nach "Wien"
  firstDateFrom: '2020-01-01',  // Nur Preise ab 2020
  firstDateTo: '2022-04-01',    // Bis vor Reparaturbonus
  hasCurrentPrice: true,        // Nur mit aktuellem Preis
  missingCurrentPrice: false,
  // ... weitere Einstellungen
};

selectionSettings.set(settings);
```

### Inflationsanpassung berechnen

```typescript
import { adjustForInflation } from './data.service';

// Beispiel: €100 von 2020 auf 2025
const adjusted = adjustForInflation(100, 2020, 2025);
console.log(adjusted); // 126.42
```

### Datensätze programmatisch laden

```typescript
import { DataService } from './data.service';

// Service injizieren
constructor(private dataService: DataService) {
  // Zugriff auf Datensätze via Signal
  effect(() => {
    const records = this.dataService.records();
    console.log(`Geladen: ${records.length} Datensätze`);
  });
}

// Daten neu laden
await this.dataService.reload();
```

---

## Technische Hinweise

### Angular Signals

Die Anwendung nutzt Angular Signals für reaktive Datenflüsse:

```typescript
// Signal definieren
private _data = signal<ShopRecord[]>([]);

// Computed Signal (automatisch neu berechnet bei Änderungen)
filtered = computed(() => {
  return this._data().filter(/* ... */);
});

// Effect (führt Code bei Änderungen aus)
effect(() => {
  const data = this._data();
  console.log('Daten geändert:', data.length);
});
```

### Server-Side Rendering (SSR)

Komponenten prüfen die Plattform vor DOM-Operationen:

```typescript
ngAfterViewInit() {
  if (!isPlatformBrowser(this.platformId)) return;
  // Nur im Browser ausführen
  this.initChart();
}
```

### Performance-Optimierung

- **OnPush Change Detection:** Komponenten nutzen `ChangeDetectionStrategy.OnPush`
- **ResizeObserver:** Effiziente Chart-Größenanpassung
- **queueMicrotask:** Debouncing von Updates

---

## Datenquellen

1. **Shop-Daten:** OpenStreetMap (Overpass API)
2. **Historische Preise:** Internet Archive Wayback Machine
3. **Inflationsdaten:** Statistics Austria + Österreichische Nationalbank
4. **Kartendaten:** OpenStreetMap

---

## Lizenz

TODO - Siehe Projekt-README
