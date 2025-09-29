import {inject, Injectable, PLATFORM_ID, REQUEST, signal} from '@angular/core';
import {isPlatformServer} from '@angular/common';
import {tsvParse} from 'd3-dsv';
import type {ShopRecord} from './types';

// Source: https://www.statistik.at/en/statistics/national-economy-and-public-finance/prices-and-price-indices/consumer-price-index-cpi/-hicp
// Source (2025): https://finanzbildung.oenb.at/docroot/waehrungsrechner/#/
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
  return Math.round(price * (cpiTarget / cpiBase) * 100) / 100;
}

@Injectable({providedIn: 'root'})
export class DataService {
  private platformId = inject(PLATFORM_ID);
  private request = inject(REQUEST, {optional: true}) as Request | null;

  private _records = signal<ShopRecord[]>([]);
  readonly records = this._records.asReadonly();

  constructor() {
    this.reload();
  }

  async reload() {
    this._records.set(await this.loadRecords());
  }

  private parsePrice(v: any): number | null {
    if (v == null) return null;
    const s = String(v).trim();
    if (!s || s.toLowerCase() === 'na' || s.toLowerCase() === 'null') return null;
    // remove currency symbols, spaces; handle comma decimals
    const n = s.replace(/[€\s]/g, '').replace(/\./g, '').replace(',', '.');
    const num = Number(n);
    return Number.isFinite(num) ? num : null;
  }

  private toBool(v: any): boolean | null {
    if (v == null) return null;
    const s = String(v).trim().toLowerCase();
    if (!s) return false;
    if (['1', 'true', 'yes', 'y', 'ja'].includes(s)) return true;
    if (['0', 'false', 'no', 'n', 'nein'].includes(s)) return false;
    return false;
  }

  private fixUrl(u?: string | null): string | undefined {
    if (!u) return undefined;
    const s = u.trim();
    if (!s) return undefined;
    if (/^https?:\/\//i.test(s)) return s;
    return `https://${s}`;
  }

  private resolveUrl(path: string): string {
    if (isPlatformServer(this.platformId) && this.request) {
      const origin = new URL(this.request.url).origin; // e.g. http://localhost:4200
      return new URL(path, origin).toString();
    }
    return path; // browser: keep relative
  }

  private parseNum(v: any): number | null {
    if (v == null) return null;
    const s = String(v).trim();
    if (!s) return null;
    const n = Number(s.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }

  async loadRecords(): Promise<ShopRecord[]> {
    const url = this.resolveUrl('/data/bicycle_repair_shops_vienna.tsv');
    const res = await fetch(url, {cache: 'no-store'});
    const text = await res.text();
    const rows = tsvParse(text);

    const data: ShopRecord[] = rows.map((r: any) => {
      // accept both spaced and underscored keys just in case
      const g = (k: string, alt?: string) => (r[k] ?? (alt ? r[alt] : undefined));

      const firstPrice = this.parsePrice(g('First Price'));
      const firstAdjFromFile = this.parsePrice(g('First Price (Inflation adjusted)'));
      const current = this.parsePrice(g('Current Price'));

      const lat = this.parseNum(g('lat') ?? g('latitude'));
      const lon = this.parseNum(g('lon') ?? g('lng') ?? g('longitude'));

      const yearStr = g('First Price Date');
      const year = yearStr ? new Date(yearStr).getFullYear() : null;
      const computedAdj = (firstPrice != null && year != null)
        ? adjustForInflation(firstPrice, year)
        : null;
      const firstAdj = firstAdjFromFile ?? computedAdj;
      const delta = (current != null) && (firstAdj != null)
        ? current - firstAdj : null;

      const
        rec: ShopRecord = {
          name: String(g('name') ?? '').trim(),
          address: g('address')?.trim(),
          website: this.fixUrl(g('website')),

          offersRepair: (() => {
            const raw = g('offers repair') ?? g('offers_repair');
            if (raw && String(raw).trim().toLowerCase().startsWith('yes')) {
              return true;
            }
            return this.toBool(raw);
          })(),

          firstPriceDate: (!g('First Price Date') ? "1000-01-01" : g('First Price Date')),
          firstPrice,
          firstPriceInflationAdjusted: firstAdj,
          firstPriceSource: g('First Price Source') ?? null,

          currentPriceDate: (!g('Current Price Date') ? "1000-01-01" : g('Current Price Date')),
          currentPrice: current,
          currentPriceSource: g('Current Price Source') ?? null,

          lat, lon,

          deltaVsFirstAdj: delta,
          deltaVsFirstAdjPercentage: (delta != null) && (current != null) ? delta / current : null,
        };
      return rec;
    })
      .filter(d => d.name); // keep only valid rows

    return data;
  }
}
