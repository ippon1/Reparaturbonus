# Analyseprojekt zur Preisentwicklung bei Fahrradservices in Wien im Kontext des Reparaturbonus

Da die Sinnhaftigkeit des Reparaturbonus in Foren immer wieder diskutiert wird, habe ich mir gedacht, einen eigenen Beitrag zum Diskurs zu leisten. Dafür habe ich die Websites von Fahrradwerkstätten sowie deren archivierte Versionen untersucht, um herauszufinden, ob die Preise stärker gestiegen sind als die Inflation. Wie ich zu den Daten gekommen bin, ist im Abschnitt Datensammlung beschrieben. Grundsätzlich habe ich einen Preis vor der Einführung des Reparaturbonus mit einem Preis nach der Einführung verglichen. Dabei habe ich mich ausschließlich auf Fahrradwerkstätten konzentriert, da hier die Datenerhebung deutlich transparenter war. Dieses Projekt untersucht, ob Fahrradwerkstätten den seit 2020 ([Wien](https://mein.wien.gv.at/wienerreparaturbon/#/)) bzw. seit dem 26. April 2022 ([bundesweit](https://www.reparaturbonus.at/)) geltenden Reparaturbonus genutzt haben, um Preise überdurchschnittlich stark anzuheben.

**Visualizierung [here](https://ippon1.github.io/Reparaturbonus/browser/).**

---

## Zielsetzung

- Vergleich von Fahrradservice-Preisen mit allgemeinen Inflationsdaten
- Identifikation von überproportionalen Preissteigerungen seit Einführung des Reparaturbonus
- Transparente Datenbasis für Medien, Forschung und Konsumentenschutz

---

## Einschränkungen

* Die in diesem Projekt dargestellten Ergebnisse und Beobachtungen basieren auf stichprobenartigen Recherchen und Annahmen und erheben keinen Anspruch auf Vollständigkeit oder wissenschaftliche Genauigkeit.
* Viele Websites von Fahrradgeschäften sind veraltet oder unübersichtlich gestaltet.
* Die Daten erlauben **keinen qualitativen Vergleich** zwischen den Anbietern, sondern dienen ausschließlich der zeitlichen Preisentwicklung innerhalb eines Anbieters.

---

## Methodik

1. **Datensammlung**
   - Geschäftsauswahl: Fahrradwerkstätten in Österreich wurden automatisiert über **OpenStreetMap-Daten** identifiziert (Tag: `shop=bicycle`).
     - [ ] include `contact:website` for website
     - [ ] only the ones that offer service/repair
     - [ ] remove the buisness that closed
   - Preiserhebung:
     - **Aktuelle Preise**: Direkt von den Websites der Anbieter, sofern öffentlich verfügbar
     - **Historische Preise**: Über die [Wayback Machine](https://web.archive.org/) – bevorzugt vor Einführung des bundesweiten Reparaturbonus (April 2022)
     - **Auswahl der Servicepakete**: Falls mehrere Pakete angeboten wurden, wurden zwei ausgewählt, die in Umfang und Inhalt möglichst vergleichbar sind.
     - **Stundensätze**: Falls keine Pauschalpreise angegeben waren, wurde stattdessen der **Stundensatz** herangezogen und dokumentiert.
     - **Inflationsdaten**: Die inflationsbereinigten Vergleiche erfolgen mit dem [offiziellen Währungsrechner](https://finanzbildung.oenb.at/docroot/waehrungsrechner/#/) der Österreichischen Nationalbank.

2. **Datenaufbereitung**
  - Inflationsbereinigung (reale Preise)
  - Prozentuale Differenz zwischen historischem und heutigem Preis

3. **Visualisierung**

Es wurden von Preisen vor und nach 2022 durchgeführt. Dabei wurde die inflationsbereinigte Preisänderung berechnet.
Im Histogramm ist ersichtlich, in welchen Bereichen die inflationsbereinigten Preisänderungen (in Prozent) zwischen aktuellem und historischem Preis liegen.
Zusätzlich habe ich untersucht, ob es Korrelationen zwischen den Standorten der Radgeschäfte und den prozentualen Preisänderungen gibt.
Darüber hinaus wurde geprüft, ob ein Zusammenhang zwischen dem Preisdelta und dem Zeitpunkt des historischen Preises Existiert.

  - [x] Histogramm 
  - [x] Scatterplott
  - [x] Kartenansicht (Map)
    - [x] Darstellung der Standorte aller analysierten Fahrradservices
    - [x] Anzeige besonders hoher Preise oder auffälliger Preissteigerungen
    - [x] Analyse geografischer Trends
  - [x] Filterfunktionen
    - [x] Nach Zeitraum:
      - [x] Vor Einführung des Wiener Reparaturbonus (Herbst 2020)
      - [x] Vor Einführung des bundesweiten Reparaturbonus (April 2022)
    - [ ] Nach Verfügbarkeit:
      - [ ] Nur Betriebe anzeigen, die aktuell noch existieren
    - [ ] Nach Preisart:
      - [ ] Pauschalpreise
      - [ ] Stundensätze

## Technologie-Stack

### Frontend (Webapp)
- **Angular 19.2** - Modernes Angular mit Standalone Components, Signals und Server-Side Rendering (SSR)
- **TypeScript 5.7** - Typisierte JavaScript-Programmierung
- **D3.js 7.9** - Datenvisualisierung (Histogramme, Scatterplots)
- **Leaflet 1.9.4** - Interaktive Kartenvisualisierung
- **RxJS 7.8** - Reaktive Programmierung
- **Express 4.18** - SSR Server

### Backend / Datenverarbeitung
- **Python 3** - Scraping und Datenanalyse
- **Pandas** - Datenmanipulation und -analyse
- **Requests** - HTTP-Anfragen an APIs (OpenStreetMap, Wayback Machine)

---

## Voraussetzungen

### Für die Webapp
- **Node.js** >= 18.x (empfohlen: aktuelle LTS-Version)
- **npm** >= 9.x (wird mit Node.js installiert)

### Für die Daten-Scripts
- **Python** >= 3.8
- **pip** (Python Package Manager)

---

## Installation

### Webapp einrichten

1. **Repository klonen:**
```bash
git clone https://github.com/ippon1/Reparaturbonus.git
cd Reparaturbonus
```

2. **In das Webapp-Verzeichnis wechseln:**
```bash
cd webapp
```

3. **Abhängigkeiten installieren:**
```bash
npm install
```

4. **Entwicklungsserver starten:**
```bash
npm start
# oder
npx ng serve
```

Die Anwendung ist dann unter `http://localhost:4200/` erreichbar.

5. **Produktions-Build erstellen (für GitHub Pages):**
```bash
ng build --base-href "https://ippon1.github.io/Reparaturbonus/browser/"
```

Die Build-Artefakte werden im Verzeichnis `docs/browser/` abgelegt.

### Python-Scripts einrichten

1. **Benötigte Python-Pakete installieren:**
```bash
pip install requests pandas
```

2. **Scraper ausführen (Fahrradshops von OpenStreetMap abrufen):**
```bash
cd scripts
python bike_shops_vienna_scraper.py
```

Erzeugt die Datei `fahrradshops_wien.tsv` mit Geschäftsdaten und Wayback Machine-Archivierungsdaten.

3. **Analyzer ausführen (Preisentwicklung analysieren):**
```bash
python analyser.py
```

Liest die TSV-Datei, berechnet inflationsbereinigte Preise und gibt Statistiken aus.

---

## Projektstruktur

```
fahrradservice-analyse/
│
├── data/                     # Rohdaten
│   └── bicycle_repair_shops_vienna.tsv
│
├── docs/
│   └── browser/              # GitHub Page here
│
├── scritps/                  # For generating the data
│   ├── bike_shops_vienna_scraper.py
│   └── analyser.py
│
├── webapp/                   # angular Project
│
├── README.md
└── .gitignore
```

## Lizenz
* TODO

## Mitmachen
Sollten Ihnen Fehler auffallen oder Sie Anregungen zur Verbesserung haben, freue ich mich über entsprechende Rückmeldungen auf der GitHub-Seite des Projekts.
Falls Sie Quellen für alte oder aktuelle Preislisten von Fahrradservices (z. B. in Form von Screenshots, PDFs oder Fotos) zur Verfügung stellen möchten, eröffnen Sie bitte einen Pull Request.
