import pandas as pd

# Beispielhaftes Einlesen der Datei (hier Pfad anpassen)
file_path = "../data/bicycle_repair_shops_vienna.tsv"
df = pd.read_csv(file_path, sep='\t')

# Source: https://www.statistik.at/en/statistics/national-economy-and-public-finance/prices-and-price-indices/consumer-price-index-cpi/-hicp
# Source (2025): https://finanzbildung.oenb.at/docroot/waehrungsrechner/#/
cpi_2015_base = {
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
}

def adjust_for_inflation(price, base_year, target_year=2025, cpi_table=cpi_2015_base):
    try:
        cpi_base = cpi_table[base_year]
        cpi_target = cpi_table[target_year]
        return round(price * (cpi_target / cpi_base), 2)
    except KeyError:
        return None


# Gruppierung nach "offers repair"
grouped_offers_repair = df.groupby("offers repair").size().reset_index(name="Count")


# Funktion zur Prüfung, ob ein Wert eine gültige Float-Zahl ist
def is_float(val):
    try:
        if pd.isna(val) or val == "" or val is None:
            return False
        float(val)
        return True
    except (ValueError, TypeError):
        return False


# Prüfen der Spalten auf gültige Float-Werte
df["First_Price_Valid"] = df["First Price"].apply(is_float)
df["Current_Price_Valid"] = df["Current Price"].apply(is_float)

# Zählen
both_valid = df[(df["First_Price_Valid"]) & (df["Current_Price_Valid"])].shape[0]
only_first_valid = df[(df["First_Price_Valid"]) & (~df["Current_Price_Valid"])].shape[0]
only_current_valid = df[(~df["First_Price_Valid"]) & (df["Current_Price_Valid"])].shape[0]
neither_valid = df[(~df["First_Price_Valid"]) & (~df["Current_Price_Valid"])].shape[0]

# Ergebnisse zusammenfassen
summary_price_validity = pd.DataFrame({
    "Category": ["Both prices valid", "Only first price", "Only current price", "Neither price"],
    "Count": [both_valid, only_first_valid, only_current_valid, neither_valid]
})

# Build categories
df["price_info"] = df.apply(
    lambda row: (
        "both" if row["First_Price_Valid"] and row["Current_Price_Valid"]
        else "only_first" if row["First_Price_Valid"]
        else "only_current" if row["Current_Price_Valid"]
        else "none"
    ),
    axis=1
)

# Now group by both: 'offers repair' and 'price_info'
overlap = df.groupby(["offers repair", "price_info"]).size().reset_index(name="count")

# Show the overlap matrix
overlap_pivot = overlap.pivot(index="offers repair", columns="price_info", values="count").fillna(0).astype(int)

# Summe der 'offers repair'-Gruppierung
offers_total = grouped_offers_repair['Count'].sum()

# Summe der Preis-Daten-Kategorisierung
price_data_total = summary_price_validity['Count'].sum()

yes_subset = df[df["offers repair"].str.lower().str.startswith("yes", na=False)]

# Datumsfelder in echte Timestamps umwandeln (falls noch nicht geschehen)
yes_subset["First Price Date"] = pd.to_datetime(yes_subset["First Price Date"], errors="coerce")
yes_subset["Current Price Date"] = pd.to_datetime(yes_subset["Current Price Date"], errors="coerce")

# Bedingungen definieren
condition_first_before_2021 = yes_subset["First Price Date"] < "2021-01-01"
condition_current_in_2025 = yes_subset["Current Price Date"].dt.year == 2025

# Subsets erzeugen
subset_a = yes_subset[condition_first_before_2021 & condition_current_in_2025]
subset_b = yes_subset[~(condition_first_before_2021 & condition_current_in_2025)]

# Neue Spalte berechnen
subset_a["First Price (Inflation adjusted)"] = subset_a.apply(
    lambda row: adjust_for_inflation(row["First Price"], row["First Price Date"].year), axis=1
)

subset_a["Price Increase (%)"] = subset_a.apply(
    lambda row: round(
        (float(row["Current Price"]) - float(row["First Price (Inflation adjusted)"]))
        / float(row["First Price (Inflation adjusted)"]) * 100,
        2
    ) if is_float(row["Current Price"]) and is_float(row["First Price (Inflation adjusted)"]) else None,
    axis=1
)

average_increase = subset_a["Price Increase (%)"].mean()
median_increase = subset_a["Price Increase (%)"].median()


print(grouped_offers_repair)
print("Total entries in 'offers repair' grouping:", offers_total)

print("--")
print(summary_price_validity)
print("Total entries in price data validity grouping:", price_data_total)

print(overlap_pivot)

print("--")
print("Valid data:",subset_a.shape[0])
print("Rest:",subset_b.shape[0])

print(f"Average price increase: {average_increase:.2f}%")
print(f"Median price increase: {median_increase:.2f}%")