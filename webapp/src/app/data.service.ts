import {inject, Injectable, PLATFORM_ID, REQUEST, signal} from '@angular/core';
import {isPlatformServer} from '@angular/common';
import {tsvParse} from 'd3-dsv';
import type {ShopRecord} from './types';

/**
 * Consumer Price Index (CPI) data for Austria with 2015 as base year (100.0).
 * Used to calculate inflation-adjusted prices for comparing historical and current prices.
 *
 * Data sources:
 * - Statistics Austria: https://www.statistik.at/en/statistics/national-economy-and-public-finance/prices-and-price-indices/consumer-price-index-cpi/-hicp
 * - Austrian National Bank (2025 data): https://finanzbildung.oenb.at/docroot/waehrungsrechner/#/
 */
export const cpi2015Base: Record<number, number> = {
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

/**
 * Adjusts a historical price to its equivalent value in a target year, accounting for inflation.
 *
 * Formula: adjustedPrice = originalPrice × (CPI_target / CPI_base)
 *
 * Example: A service cost €100 in 2020 (CPI: 108.2).
 *          In 2025 terms (CPI: 136.78): €100 × (136.78 / 108.2) ≈ €126.42
 *
 * @param price Original price amount
 * @param baseYear Year when the original price was recorded
 * @param targetYear Year to adjust the price to (defaults to 2025)
 * @param cpiTable CPI lookup table (defaults to Austrian CPI with 2015 base)
 * @returns Inflation-adjusted price rounded to 2 decimal places, or null if year data is missing
 */
export function adjustForInflation(
  price: number,
  baseYear: number,
  targetYear: number = 2025,
  cpiTable: Record<number, number> = cpi2015Base
): number | null {
  const cpiBase = cpiTable[baseYear];
  const cpiTarget = cpiTable[targetYear];
  if (cpiBase === undefined || cpiTarget === undefined) {
    return null;
  }
  // Round to 2 decimal places for currency precision
  return Math.round(price * (cpiTarget / cpiBase) * 100) / 100;
}

/**
 * Service responsible for loading and processing bicycle repair shop data.
 * Handles TSV parsing, data normalization, inflation adjustment, and serving data via signals.
 */
@Injectable({providedIn: 'root'})
export class DataService {
  // Angular dependency injection for platform detection (browser vs SSR)
  private platformId = inject(PLATFORM_ID);
  private request = inject(REQUEST, {optional: true}) as Request | null;

  // Internal writable signal for shop records
  private _records = signal<ShopRecord[]>([]);
  // Public read-only signal exposing shop records to components
  readonly records = this._records.asReadonly();

  constructor() {
    this.reload();
  }

  /**
   * Reloads all shop records from the TSV data file
   */
  async reload() {
    this._records.set(await this.loadRecords());
  }

  /**
   * Parses price strings in various formats to numbers.
   * Handles European number format (comma as decimal separator),
   * currency symbols (€), and placeholder values (NA, null).
   *
   * Examples:
   * - "€ 125,50" → 125.5
   * - "1.200,99" → 1200.99
   * - "NA" → null
   *
   * @param v Raw price value from TSV
   * @returns Parsed price as number, or null if invalid
   */
  private parsePrice(v: any): number | null {
    if (v == null) return null;
    const s = String(v).trim();
    if (!s || s.toLowerCase() === 'na' || s.toLowerCase() === 'null') return null;
    // Remove currency symbols and spaces; convert comma decimal to period decimal
    // Note: European thousands separator (.) is removed, comma becomes decimal point
    const n = s.replace(/[€\s]/g, '').replace(/\./g, '').replace(',', '.');
    const num = Number(n);
    return Number.isFinite(num) ? num : null;
  }

  /**
   * Parses boolean values from various string representations.
   * Supports English and German boolean indicators.
   *
   * @param v Raw boolean value from TSV
   * @returns Boolean value, or null if unparseable
   */
  private toBool(v: any): boolean | null {
    if (v == null) return null;
    const s = String(v).trim().toLowerCase();
    if (!s) return false;
    if (['1', 'true', 'yes', 'y', 'ja'].includes(s)) return true;
    if (['0', 'false', 'no', 'n', 'nein'].includes(s)) return false;
    return false;
  }

  /**
   * Ensures URLs have proper protocol prefix (https://).
   * Many shop websites in the data are stored without protocol.
   *
   * @param u Raw URL string
   * @returns Normalized URL with https:// prefix, or undefined if empty
   */
  private fixUrl(u?: string | null): string | undefined {
    if (!u) return undefined;
    const s = u.trim();
    if (!s) return undefined;
    if (/^https?:\/\//i.test(s)) return s;
    return `https://${s}`;
  }

  /**
   * Resolves relative URLs to absolute URLs.
   * During Server-Side Rendering (SSR), relative paths need to be resolved
   * to absolute URLs using the current request origin.
   *
   * @param path Relative or absolute URL path
   * @returns Absolute URL when running on server, original path in browser
   */
  private resolveUrl(path: string): string {
    if (isPlatformServer(this.platformId) && this.request) {
      try {
        // preserve the request path so relative assets keep the base href
        return new URL(path, this.request.url).toString();
      } catch (_firstError) {
        try {
          const origin = new URL(this.request.url).origin; // fallback to origin-only URLs
          return new URL(path, origin).toString();
        } catch (_secondError) {
          return path;
        }
      }
    }
    return path; // browser: keep relative
  }

  /**
   * Parses numeric values, handling European comma decimal format.
   *
   * @param v Raw numeric value
   * @returns Parsed number or null
   */
  private parseNum(v: any): number | null {
    if (v == null) return null;
    const s = String(v).trim();
    if (!s) return null;
    const n = Number(s.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }

  /**
   * Loads and processes all shop records from the TSV data file.
   * Performs comprehensive data transformation including:
   * - Parsing and normalizing all fields
   * - Calculating inflation-adjusted prices
   * - Computing price deltas (absolute and percentage)
   * - Handling multiple column name variations
   *
   * @returns Array of processed ShopRecord objects
   */
  async loadRecords(): Promise<ShopRecord[]> {
    const res = await fetch('data/bicycle_repair_shops_vienna.tsv', { cache: 'no-store' });
    const text = await res.text();
    const rows = tsvParse(text);

    const data: ShopRecord[] = rows.map((r: any) => {
      // Helper to get field value, supporting both spaced and underscored column names
      const g = (k: string, alt?: string) => (r[k] ?? (alt ? r[alt] : undefined));

      // Parse price fields using European number format
      const firstPrice = this.parsePrice(g('First Price'));
      const firstAdjFromFile = this.parsePrice(g('First Price (Inflation adjusted)'));
      const current = this.parsePrice(g('Current Price'));

      // Parse geographic coordinates (support multiple column name variants)
      const lat = this.parseNum(g('lat') ?? g('latitude'));
      const lon = this.parseNum(g('lon') ?? g('lng') ?? g('longitude'));

      // Calculate inflation adjustment if not pre-computed in file
      const yearStr = g('First Price Date');
      const year = yearStr ? new Date(yearStr).getFullYear() : null;
      const computedAdj = (firstPrice != null && year != null)
        ? adjustForInflation(firstPrice, year)
        : null;
      // Prefer file-provided adjusted price, fallback to computed
      const firstAdj = firstAdjFromFile ?? computedAdj;

      // Calculate price delta: how much has the price changed vs. inflation-adjusted baseline?
      const delta = (current != null) && (firstAdj != null)
        ? current - firstAdj : null;

      const rec: ShopRecord = {
        name: String(g('name') ?? '').trim(),
        address: g('address')?.trim(),
        website: this.fixUrl(g('website')),

        // Special handling for 'offers repair' field which may have "yes - ..." format
        offersRepair: (() => {
          const raw = g('offers repair') ?? g('offers_repair');
          if (raw && String(raw).trim().toLowerCase().startsWith('yes')) {
            return true;
          }
          return this.toBool(raw);
        })(),

        // Use placeholder date if missing to allow sorting/filtering without errors
        firstPriceDate: (!g('First Price Date') ? "1000-01-01" : g('First Price Date')),
        firstPrice,
        firstPriceInflationAdjusted: firstAdj,
        firstPriceSource: g('First Price Source') ?? null,

        currentPriceDate: (!g('Current Price Date') ? "1000-01-01" : g('Current Price Date')),
        currentPrice: current,
        currentPriceSource: g('Current Price Source') ?? null,

        lat, lon,

        // Derived metrics for analysis
        deltaVsFirstAdj: delta,  // Absolute price change in euros
        deltaVsFirstAdjPercentage: (delta != null) && (current != null)
          ? delta / current   // Percentage change relative to current price
          : null,
        };
      return rec;
    })
      .filter(d => d.name); // Exclude rows without a valid shop name

    return data;
  }
}
