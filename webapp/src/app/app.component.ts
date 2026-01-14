import {Component, computed, inject, signal, Signal} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {MapPanelComponent} from './map-panel/map-panel.component';
import {ShopsComponent} from './shops/shops.component';
import {HistogramComponent} from './histogram/histogram.component';
import {ScatterplotComponent} from './scatterplot/scatterplot.component';
import {StorySectionComponent} from './story-section/story-section.component';
import {ChartBlockComponent} from './chart-block/chart-block.component';
import {CalloutComponent} from './callout/callout.component';
import {defaultSelectionSettings, SelectionSettings, ShopRecord} from './types';
import {DataService} from './data.service';

type SortKey = keyof ShopRecord | 'name';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    MapPanelComponent,
    ShopsComponent,
    HistogramComponent,
    ScatterplotComponent,
    StorySectionComponent,
    ChartBlockComponent,
    CalloutComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'Preisentwicklung bei Radreparaturen während des Reparaturbonus im Vergleich zur Inflation in Wien';


  // Signal tracking selected shop records (for future selection features)
  private selected = signal<Set<string>>(new Set<string>());

  // Central filter state - all user-selected filters are stored here
  selectionSettings = signal<SelectionSettings>({...defaultSelectionSettings});

  // Inject DataService to access shop records
  private ds = inject(DataService)

  /**
   * Resets all filters to their default state
   */
  resetFilters() {
    this.selectionSettings.set({...defaultSelectionSettings});
  }

  /**
   * Returns the set of selected shop keys
   */
  selectedKeys() {
    return this.selected()
  }

  /**
   * Receives filter updates from child components and updates the central state
   * @param value Updated filter settings from child component
   */
  async onChildValue(value: SelectionSettings) {
    this.selectionSettings.set({...value});
  }

  /**
   * Computed signal that reactively filters shop records based on current selection settings.
   * This signal automatically updates whenever selectionSettings or the underlying data changes.
   *
   * Applies the following filters:
   * 1. Text search (name/address)
   * 2. Data presence filters (has/missing price data)
   * 3. Date range filters (for first and current price dates)
   */
  filtered: Signal<ShopRecord[]> = computed(() => {
    const s = this.selectionSettings();

    // Normalize search query to lowercase for case-insensitive matching
    const q = (s.q ?? '').trim().toLowerCase();

    // Parse date range boundaries to timestamps for efficient comparison
    const firstFromT = s.firstDateFrom ? Date.parse(s.firstDateFrom) : null;
    const firstToT = s.firstDateTo ? Date.parse(s.firstDateTo) : null;
    const currFromT = s.currentDateFrom ? Date.parse(s.currentDateFrom) : null;
    const currToT = s.currentDateTo ? Date.parse(s.currentDateTo) : null;

    /**
     * Helper function to check if a value matches presence/absence requirements.
     * Supports three states: only records with data, only records without data, or both.
     *
     * @param val The value to check
     * @param wantSet True if user wants records WITH this value
     * @param wantMissing True if user wants records WITHOUT this value
     * @returns True if the value matches the filter criteria
     */
    const presenceFilter = (val: any, wantSet: boolean, wantMissing: boolean): boolean => {
      if (wantSet && !wantMissing) return val != null;  // Only records with data
      if (!wantSet && wantMissing) return val == null;  // Only records without data
      return true;  // Both states allowed (no filter applied)
    };

    // Start with all records from DataService
    let arr = this.ds.records();

    // Filter 1: Text search - matches against shop name or address
    if (q) {
      arr = arr.filter(r =>
        (r.name?.toLowerCase().includes(q)) ||
        (r.address?.toLowerCase().includes(q))
      );
    }

    // Filter 2: Data presence - check if required price fields are present/absent
    arr = arr.filter(r =>
      presenceFilter(r.firstPrice, s.hasFirstPrice, s.missingFirstPrice) &&
      presenceFilter(r.firstPriceInflationAdjusted, s.hasFirstAdj, s.missingFirstAdj) &&
      presenceFilter(r.currentPrice, s.hasCurrentPrice, s.missingCurrentPrice)
    );

    // Filter 3: Only show shops with current prices (if enabled)
    if (s.onlyWithCurrent) {
      arr = arr.filter(r => r.currentPrice != null);
    }

    // Filter 4: Date range for first price capture
    if (firstFromT !== null || firstToT !== null) {
      arr = arr.filter(r => {
        const t = parseDateLoose(r.firstPriceDate);
        if (t === null) return false;  // Exclude records without valid date
        if (firstFromT !== null && t < firstFromT) return false;  // Before range
        if (firstToT !== null && t > firstToT) return false;  // After range
        return true;
      });
    }

    // Filter 5: Date range for current price capture
    if (currFromT !== null || currToT !== null) {
      arr = arr.filter(r => {
        const t = parseDateLoose(r.currentPriceDate);
        if (t === null) return false;  // Exclude records without valid date
        if (currFromT !== null && t < currFromT) return false;  // Before range
        if (currToT !== null && t > currToT) return false;  // After range
        return true;
      });
    }

    return arr;
  });

  /**
   * Computed signal that extracts price change percentages from filtered records.
   * Used as data source for the histogram visualization.
   *
   * Filters out invalid values (null, undefined, NaN, Infinity) to ensure
   * only meaningful percentage changes are visualized.
   */
  histo: Signal<number[]> = computed(() => {
    let arr = this.filtered;
    const deltaPercentage = arr()
      .map(shop => shop.deltaVsFirstAdjPercentage)
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

    return deltaPercentage;
  });

  // Example values for demonstration (not actively used)
  values = signal([1, 2, 3, 4, 5]);

  /**
   * Computed signal determining optimal number of histogram bins.
   * Currently returns a fixed value but could be extended to be dynamic.
   */
  bins = computed(() => {
    const arr = this.values();
    return Math.min(30, 5);
  });
}

/**
 * Parses date strings in various formats to Unix timestamps.
 * Handles multiple common date formats found in the data:
 * - ISO format: YYYY-MM-DD or YYYY/MM/DD
 * - European format: DD.MM.YYYY
 * - Other formats parseable by Date.parse()
 *
 * @param s Date string to parse
 * @returns Unix timestamp in milliseconds, or null if parsing fails
 */
function parseDateLoose(s?: string | null): number | null {
  if (!s) return null;
  const raw = s.trim();
  if (!raw) return null;

  // Try ISO-like format first (YYYY-MM-DD or YYYY/MM/DD)
  const iso = raw.replace(/\//g, '-');
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const t = Date.parse(iso);
    return Number.isFinite(t) ? t : null;
  }

  // Try European format (DD.MM.YYYY)
  const m1 = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m1) {
    const [_, dd, mm, yyyy] = m1;
    // Convert to ISO format for reliable parsing
    const t = Date.parse(`${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`);
    return Number.isFinite(t) ? t : null;
  }

  // Fallback: let JavaScript's Date.parse() handle it
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : null;
}
