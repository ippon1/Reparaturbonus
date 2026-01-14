import requests
import pandas as pd

# Overpass API-Endpunkt
url = "https://overpass-api.de/api/interpreter"

# Overpass Query: alle Fahrradläden in Wien
query = """
[out:json][timeout:25];
area["name"="Wien"]["boundary"="administrative"]["admin_level"="6"]->.searchArea;
(
  node["shop"="bicycle"](area.searchArea);
  way["shop"="bicycle"](area.searchArea);
  relation["shop"="bicycle"](area.searchArea);
);
out center;
"""

# Anfrage senden
response = requests.post(url, data={"data": query})
data = response.json()

# Elemente extrahieren
elements = data.get("elements", [])

# Liste für Pandas-DataFrame vorbereiten
rows = []
for el in elements:
    tags = el.get("tags", {})
    name = tags.get("name", "")
    website = tags.get("website", "")
    street = tags.get("addr:street", "")
    housenumber = tags.get("addr:housenumber", "")
    postcode = tags.get("addr:postcode", "")
    city = tags.get("addr:city", "")
    lats = tags.get("lattude", "")
    lons = tags.get("longitude", "")
    address = f"{street} {housenumber}, {postcode} {city}".strip(", ").strip()

    rows.append({
        "name": name,
        "address": address,
        "lats": lats,
        "lons": lons,
        "website": website
    })

# DataFrame erzeugen
df = pd.DataFrame(rows)

def get_oldest_and_newest_archive_date(url):
    if not url:
        return None, None

    api_url = "https://web.archive.org/cdx/search/cdx"
    params = {
        "url": url,
        "output": "json"
    }

    try:
        response = requests.get(api_url, params=params, timeout=10)
        if response.status_code != 200:
            return None, None

        data = response.json()
        if len(data) < 2:
            return None, None

        # Header ist data[0], Einträge ab data[1]
        timestamps = [entry[1] for entry in data[1:]]
        timestamps.sort()
        oldest = timestamps[0]
        newest = timestamps[-1]

        oldest_date = f"{oldest[:4]}-{oldest[4:6]}-{oldest[6:8]}"
        newest_date = f"{newest[:4]}-{newest[4:6]}-{newest[6:8]}"
        return oldest_date, newest_date

    except Exception as e:
        print(f"Fehler bei URL {url}: {e}")
        return None, None

# Neue Spalten für Archivierungsdaten einfügen
df["archive_oldest"] = ""
df["archive_newest"] = ""

for idx, row in df.iterrows():
    website = row["website"]
    oldest, newest = get_oldest_and_newest_archive_date(website)
    df.at[idx, "archive_oldest"] = oldest
    df.at[idx, "archive_newest"] = newest

# Ausgabe als TSV-Datei
df.to_csv("fahrradshops_wien.tsv", sep="\t", index=False)

# Optional: GeoJSON speichern
# geojson = {
#     "type": "FeatureCollection",
#     "features": [
#         {
#             "type": "Feature",
#             "geometry": {"type": "Point", "coordinates": [el.get("lon") or el.get("center", {}).get("lon"),
#                                                           el.get("lat") or el.get("center", {}).get("lat")]},
#             "properties": {
#                 "name": row["name"],
#                 "address": row["address"],
#                 "website": row["website"]
#             }
#         } for el, row in zip(elements, rows)
#     ]
# }

# with open("fahrradshops_wien.geojson", "w", encoding="utf-8") as f:
#     json.dump(geojson, f, ensure_ascii=False, indent=2)

print(f"{len(df)} Fahrradläden mit Adresse, Name und Website gespeichert.")
