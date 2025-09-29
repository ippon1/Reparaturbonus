import {Component, computed, inject, signal, Signal} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {MapPanelComponent} from './map-panel/map-panel.component';
import {ShopsComponent} from './shops/shops.component';
import {HistogramComponent} from './histogram/histogram.component';
import {ScatterplotComponent} from './scatterplot/scatterplot.component';
import {defaultSelectionSettings, SelectionSettings, ShopRecord} from './types';
import {DataService} from './data.service';

type SortKey = keyof ShopRecord | 'name';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, MapPanelComponent, ShopsComponent, HistogramComponent, ScatterplotComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'Treibt Reparaturbonus die Inflation?';


  private selected = signal<Set<string>>(new Set<string>());

  selectionSettings = signal<SelectionSettings>({...defaultSelectionSettings});

  private ds = inject(DataService)

  resetFilters() {
    this.selectionSettings.set({...defaultSelectionSettings});
  }

  selectedKeys() {
    return this.selected()
  }

  async onChildValue(value: SelectionSettings) {
    this.selectionSettings.set({...value});
  }

  filtered: Signal<ShopRecord[]> = computed(() => {
    const s = this.selectionSettings();
    const q = (s.q ?? '').trim().toLowerCase();
    const firstFromT = s.firstDateFrom ? Date.parse(s.firstDateFrom) : null;
    const firstToT = s.firstDateTo ? Date.parse(s.firstDateTo) : null;
    const currFromT = s.currentDateFrom ? Date.parse(s.currentDateFrom) : null;
    const currToT = s.currentDateTo ? Date.parse(s.currentDateTo) : null;

    const presenceFilter = (val: any, wantSet: boolean, wantMissing: boolean): boolean => {
      if (wantSet && !wantMissing) return val != null;
      if (!wantSet && wantMissing) return val == null;
      return true;
    };

    let arr = this.ds.records(); // nehme DataService-Signal als Quelle

    if (q) {
      arr = arr.filter(r =>
        (r.name?.toLowerCase().includes(q)) ||
        (r.address?.toLowerCase().includes(q))
      );
    }

    arr = arr.filter(r =>
      presenceFilter(r.firstPrice, s.hasFirstPrice, s.missingFirstPrice) &&
      presenceFilter(r.firstPriceInflationAdjusted, s.hasFirstAdj, s.missingFirstAdj) &&
      presenceFilter(r.currentPrice, s.hasCurrentPrice, s.missingCurrentPrice)
    );

    if (s.onlyWithCurrent) {
      arr = arr.filter(r => r.currentPrice != null);
    }

    if (firstFromT !== null || firstToT !== null) {
      arr = arr.filter(r => {
        const t = parseDateLoose(r.firstPriceDate);
        if (t === null) return false;
        if (firstFromT !== null && t < firstFromT) return false;
        if (firstToT !== null && t > firstToT) return false;
        return true;
      });
    }

    if (currFromT !== null || currToT !== null) {
      arr = arr.filter(r => {
        const t = parseDateLoose(r.currentPriceDate);
        if (t === null) return false;
        if (currFromT !== null && t < currFromT) return false;
        if (currToT !== null && t > currToT) return false;
        return true;
      });
    }

    return arr;
  });

  //histo = signal<number[]>([]);
  histo: Signal<number[]> = computed(() => {
    let arr = this.filtered; // nehme DataService-Signal als Quelle
    const deltaPercentage = arr()
      .map(shop => shop.deltaVsFirstAdjPercentage)
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

    return deltaPercentage;
  });

  //histo = signal<number[]>([]);
  values = signal([1, 2, 3, 4, 5]);

  // abgeleitetes Signal (liefert ein Signal<number>)
  bins = computed(() => {
    const arr = this.values();
    return Math.min(30, 5);
  });
}


function parseDateLoose(s?: string | null): number | null {
  if (!s) return null;
  const raw = s.trim();
  if (!raw) return null;

  // ISO-like first
  const iso = raw.replace(/\//g, '-');
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const t = Date.parse(iso);
    return Number.isFinite(t) ? t : null;
  }

  // dd.mm.yyyy
  const m1 = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m1) {
    const [_, dd, mm, yyyy] = m1;
    const t = Date.parse(`${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`);
    return Number.isFinite(t) ? t : null;
  }

  // Fallback: let Date try
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : null;
}
