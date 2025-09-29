import {Component, computed, EventEmitter, Input, Output, signal, Signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {SelectionSettings, ShopRecord} from '../types';

type SortKey = keyof ShopRecord | 'name';

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

@Component({
  selector: 'app-shops',
  imports: [CommonModule, FormsModule],
  templateUrl: './shops.component.html',
  styleUrl: './shops.component.scss'
})
export class ShopsComponent {
  @Input({required: true}) records!: Signal<ShopRecord[]>;
  @Input({required: true}) selectionSettings!: Signal<SelectionSettings>;
  @Output() valueChange = new EventEmitter<SelectionSettings>();

  sortKey = signal<SortKey>('name');
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


  averageDelta = computed(() => {
    // Prozent-Deltas berechnen: (current - first) / first
    const deltas = this.records()
      .map(r => {
        if (typeof r.deltaVsFirstAdjPercentage === 'number') {
          return r.deltaVsFirstAdjPercentage;
        }
        return null;
      })
      .filter((d): d is number => d !== null && Number.isFinite(d));

    if (!deltas.length) return null;

    const sum = deltas.reduce((a, b) => a + b, 0);
    const avgPct = (sum / deltas.length) * 100;

    // truncate auf 2 Nachkommastellen
    return Math.trunc(avgPct * 100) / 100;
  });
}
