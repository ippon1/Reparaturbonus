import {Component, computed, EventEmitter, Input, Output, signal, Signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {SelectionSettings, ShopRecord} from '../types';

type SortKey = keyof ShopRecord | 'name';
type AverageDeltaTrend = 'positive' | 'negative' | 'neutral';
type AverageDeltaResult = { value: number | null; trend: AverageDeltaTrend };

/**
 * Parses date strings in various formats to Unix timestamps.
 * Handles ISO format, European format (DD.MM.YYYY), and other common formats.
 * See app.component.ts for detailed documentation of this shared utility.
 */
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

/**
 * Data table component displaying bicycle repair shop records.
 *
 * Features:
 * - Sortable columns (click header to toggle ascending/descending)
 * - Computed sorting via Angular signals
 * - Color-coded price deltas (green = increase, red = decrease)
 * - Formatted currency display (€ symbol, Austrian locale)
 * - Links to price sources (Wayback Machine archives or current websites)
 * - Average price change calculation
 * - Displays both original and inflation-adjusted prices
 * - Date formatting for price capture timestamps
 */
@Component({
  selector: 'app-shops',
  imports: [CommonModule, FormsModule],
  templateUrl: './shops.component.html',
  styleUrl: './shops.component.scss'
})
export class ShopsComponent {
  /** Input signal containing shop records to display */
  @Input({required: true}) records!: Signal<ShopRecord[]>;

  /** Input signal with current filter settings */
  @Input({required: true}) selectionSettings!: Signal<SelectionSettings>;

  /** Emits when filter settings should be updated */
  @Output() valueChange = new EventEmitter<SelectionSettings>();

  /** Current sort column */
  sortKey = signal<SortKey>('name');

  /** Sort direction: 1 = ascending, -1 = descending */
  sortDir = signal<1 | -1>(1);

  async reloadButton() {
    this.valueChange.emit(this.selectionSettings());
  }

  sortedRecords = computed(() => {
    const arr = [...this.records()];
    const key = this.sortKey();
    const dir = this.sortDir();

    return arr.sort((a, b) => {
      const va = a[key] ?? '';
      const vb = b[key] ?? '';
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  });

  setSort(k: SortKey) {
    if (this.sortKey() === k) {
      this.sortDir.set(this.sortDir() === 1 ? -1 : 1);
    } else {
      this.sortKey.set(k);
      this.sortDir.set(1);
    }
  }

  fmt(n: number | null | undefined): string {
    if (n == null || !Number.isFinite(n)) return '';
    return `€${Math.round(n).toLocaleString('de-AT')}`;
  }

  decimaltoPercentage(n: number | null | undefined): string {
    if (n == null || !Number.isFinite(n)) return '';
    return new Intl.NumberFormat('de-AT', {
      style: 'percent',
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(n);
  }

  resetPresence() {
    this.selectionSettings().hasFirstPrice = this.selectionSettings().missingFirstPrice =
      this.selectionSettings().hasFirstAdj = this.selectionSettings().missingFirstAdj =
        this.selectionSettings().hasCurrentPrice = this.selectionSettings().missingCurrentPrice = false;
  }

  firstDateMinMax = computed(() => {
    const times = this.records().map(r => parseDateLoose(r.firstPriceDate)).filter((t): t is number => t !== null);
    if (!times.length) return {min: null as Date | null, max: null as Date | null};
    return {min: new Date(Math.min(...times)), max: new Date(Math.max(...times))};
  });

  currentDateMinMax = computed(() => {
    const times = this.records().map(r => parseDateLoose(r.currentPriceDate)).filter((t): t is number => t !== null);
    if (!times.length) return {min: null as Date | null, max: null as Date | null};
    return {min: new Date(Math.min(...times)), max: new Date(Math.max(...times))};
  });


  averageDelta = computed<AverageDeltaResult>(() => {
    // Prozent-Deltas berechnen: (current - first) / first
    const deltas = this.records()
      .map(r => {
        if (typeof r.deltaVsFirstAdjPercentage === 'number') {
          return r.deltaVsFirstAdjPercentage;
        }
        return null;
      })
      .filter((d): d is number => d !== null && Number.isFinite(d));

    if (!deltas.length) {
      return {value: null, trend: 'neutral'};
    }

    const sum = deltas.reduce((a, b) => a + b, 0);
    const avgPct = (sum / deltas.length) * 100;

    // truncate auf 2 Nachkommastellen
    const value = Math.trunc(avgPct * 100) / 100;
    const trend: AverageDeltaTrend =
      value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral';

    return {value, trend};
  });
}
