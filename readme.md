# Führt der Reparaturbonus zu einer Inflation bei Fahrradservicepreisen?

**Analyseprojekt zur Preisentwicklung bei Fahrradservices in Österreich im Kontext des Reparaturbonus**

Dieses Projekt untersucht, ob Fahrradwerkstätten den seit 2020 ([Wien](https://mein.wien.gv.at/wienerreparaturbon/#/)) / 26. April 2022 ([Nationaler](https://www.reparaturbonus.at/)) geltenden Reparaturbonus nutzen, um Preise überdurchschnittlich stark anzuheben.

Visualization [here](https://simonreisinger.github.io/Reparaturbonus/webapp/).

---

## Zielsetzung

- Vergleich von Fahrradservice-Preisen mit allgemeinen Inflationsdaten
- Identifikation von überproportionalen Preissteigerungen seit Einführung des Reparaturbonus
- Transparente Datenbasis für Medien, Forschung und Konsumentenschutz

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

> *Die Daten erlauben **keinen qualitativen Vergleich** zwischen den Anbietern, sondern dienen ausschließlich der zeitlichen Preisentwicklung innerhalb eines Anbieters.*

2. **Datenaufbereitung**
  - Normalisierung der Leistungen (z. B. Standardservice vs. Komplettservice)
  - Inflationsbereinigung (reale Preise)

3. **Analyse**
  - Zeitreihenvergleich: Vor und nach 2022
  - Tendenzanalysen & statistische Tests

4. **Visualisierung**

  - [ ] Kartenansicht (Map)
    - [ ] Darstellung der Standorte aller analysierten Fahrradservices
    - [ ] Anzeige besonders hoher Preise oder auffälliger Preissteigerungen
    - [ ] Analyse geografischer Trends (z. B. Ballungsräume vs. ländliche Gebiete)
  - [ ] Filterfunktionen
    - [ ] Nach Zeitraum:
      - [ ] Vor Einführung des Wiener Reparaturbonus (Herbst 2020)
      - [ ] Vor Einführung des bundesweiten Reparaturbonus (April 2022)
    - [ ] Nach Verfügbarkeit:
      - [ ] Nur Betriebe anzeigen, die aktuell noch existieren
    - [ ] Nach Preisart:
      - [ ] Pauschalpreise
      - [ ] Stundensätze

## Technologie-Stack

- Python: Scraping, Datenanalyse (`requests`, `pandas`)

---

## [ ] Projektstruktur

```
fahrradservice-analyse/
│
├── data/                     # Rohdaten (Scraping, Archiv, Crowd)
│   └── bicycle_repair_shops_vienna.tsv
│
├── code/                     # Quellcode
│   ├── bike_shops_vienna_scraper.py
│   └── analyser.py
│
├── webapp/
│   ├── data/
│   ├── bike_shops_vienna_scraper.py
│   └── index.html
│
├── README.md
└── .gitignore
```

## [ ] Findings
OMG es gibt so viele hässliche und veraltete Websites von Radgeschäften
Ich habe nicht genau mitgezählt, aber ich habe einige läden gefunden die nach dem Reparaturbonus Rad services angeboten haben

##  Disclaimer
Die in diesem Projekt dargestellten Ergebnisse und Beobachtungen basieren auf **stichprobenartigen Recherchen und Annahmen**. Sie erheben keinen Anspruch auf Vollständigkeit oder wissenschaftliche Genauigkeit.

## [ ] Lizenz
* TODO

## Mitmachen

Wenn du alte oder neue Preislisten von Fahrradservices (Screenshots, PDFs, Fotos etc.) hast öffne einen Pull Request.