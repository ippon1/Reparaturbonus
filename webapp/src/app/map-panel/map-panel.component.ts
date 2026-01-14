import {
  AfterViewInit,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  Input,
  OnChanges,
  OnDestroy,
  PLATFORM_ID,
  Signal,
  signal,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import * as L from 'leaflet';
import * as d3 from 'd3';
import {CommonModule, isPlatformBrowser} from '@angular/common';
import type {ShopRecord} from '../types';

/**
 * Interactive map component using Leaflet.js.
 * Displays bicycle repair shops on an OpenStreetMap-based map with color-coded markers.
 *
 * Marker color coding (matches histogram):
 * - Green shades: Price decreased or increased less than inflation (darker = further from zero)
 * - Gray (#707070): Price change near zero
 * - Red shades: Price increased more than inflation (darker = further from zero)
 * - Gray (#999): Missing price data
 *
 * Features:
 * - Interactive popups with shop details and price change percentage
 * - Automatic bounds fitting on first data load
 * - Marker size indicates selection state
 * - SSR-compatible (map only initializes in browser)
 * - Centered on Vienna (48.208, 16.373)
 */
@Component({
  selector: 'app-map-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './map-panel.component.html',
})
export class MapPanelComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('mapEl', {static: true}) mapEl!: ElementRef<HTMLElement>;

  /** Input signal containing shop records to display on map */
  @Input({required: true}) records!: Signal<ShopRecord[]>;

  /** Set of selected shop keys (for future selection features) */
  @Input() selectedKeys: Set<string> = new Set<string>();

  private destroyRef = inject(DestroyRef);
  private injector = inject(Injector);
  private platformId = inject(PLATFORM_ID);

  private map!: L.Map;
  private markersLayer!: L.LayerGroup;

  // State management for initialization
  private mapReady = signal(false);  // Tracks if Leaflet map is initialized
  private firstDataPainted = false;  // Ensures auto-fit only happens once

  constructor() {
    // Effects created in ngOnInit to avoid races with @Input binding
  }

  /**
   * Sets up reactive effect to re-render markers when data changes.
   * Only activates after map is fully initialized.
   */
  ngOnInit() {
    effect(() => {
      if (!this.mapReady()) return;
      const _ = this.records(); // Track records signal changes
      // Micro-debounce to batch rapid updates
      queueMicrotask(() => {
        this.renderMarkers();
        if (!this.firstDataPainted) {
          this.fitToData();  // Auto-fit bounds on first data load
          this.firstDataPainted = true;
        }
      });
    }, {injector: this.injector as any});
  }

  ngAfterViewInit() {
    if (!isPlatformBrowser(this.platformId)) return; // optional, schadet nicht

    this.map = L.map(this.mapEl.nativeElement, {
      center: [48.208, 16.373],
      zoom: 12,
    });

L.tileLayer(
  'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  {
    maxZoom: 19,
    attribution:
      '&copy; OpenStreetMap contributors &copy; CARTO'
  }
).addTo(this.map);

    this.markersLayer = L.layerGroup().addTo(this.map);
    requestAnimationFrame(() => this.map.invalidateSize());
    this.mapReady.set(true);
  }

  ngOnChanges(changes: SimpleChanges): void {
    // If selectedKeys changes and map is ready, re-render to reflect styling
    if (this.mapReady() && (changes['selectedKeys'] || changes['records'])) {
      this.renderMarkers();
    }
  }

  private renderMarkers() {
    if (!this.markersLayer) return;

    // Clear all previous markers
    this.markersLayer.clearLayers();

    const bounds = L.latLngBounds([]);
    const data = this.records();

    // Calculate max absolute value for color scale domain (same as histogram)
    const validDeltas = data
      .map(r => r.deltaVsFirstAdjPercentage)
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

    const maxAbs = validDeltas.length > 0
      ? Math.max(...validDeltas.map(v => Math.abs(v)))
      : 0.5; // Default if no data

    // Create same color scales as histogram
    const negativeColorScale = d3.scaleSequential(d3.interpolateGreens)
      .domain([0, maxAbs]);  // Light green at 0, dark green at -maxAbs

    const positiveColorScale = d3.scaleSequential(d3.interpolateReds)
      .domain([0, maxAbs]);  // Light red at 0, dark red at +maxAbs

    for (const r of data) {
      const lat = r.lat != null ? Number(r.lat) : NaN;
      const lon = r.lon != null ? Number(r.lon) : NaN;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

      const key = keyOf(r);
      const isSelected = this.selectedKeys.has(key);

      // Use deltaVsFirstAdjPercentage for color (same as histogram)
      const delta = r.deltaVsFirstAdjPercentage;
      let color = '#999';  // Gray for missing data

      if (delta != null && Number.isFinite(delta)) {
        const distanceFromZero = Math.abs(delta);

        // Near zero gets gray (matching histogram center bar)
        if (distanceFromZero < maxAbs * 0.05) {  // Within 5% of range considered "zero"
          color = '#707070';
        }
        // Negative values get green
        else if (delta < 0) {
          color = negativeColorScale(distanceFromZero);
        }
        // Positive values get red
        else {
          color = positiveColorScale(distanceFromZero);
        }
      }

      const marker = L.circleMarker([lat, lon], {
        radius: isSelected ? 7 : 5,
        weight: isSelected ? 2 : 1,
        color,
        fill: true,
        fillOpacity: 0.7,
      }).addTo(this.markersLayer);

      const addr = r.address ? `<div>${escapeHtml(r.address)}</div>` : '';
      const site = r.website ? `<div><a href="${r.website}" target="_blank" rel="noopener">Website</a></div>` : '';

      // Create price change text with colored value (same scheme as marker)
      let price = '';
      if (r.deltaVsFirstAdjPercentage != null) {
        const deltaPercent = (r.deltaVsFirstAdjPercentage * 100).toFixed(1);
        price = `<div>Preisänderung: <strong style="color: ${color}">${deltaPercent}%</strong></div>`;
      }

      marker.bindPopup(`
        <div style="min-width:200px">
          <strong>${escapeHtml(r.name)}</strong>
          ${addr}${site}${price}
        </div>
      `);

      bounds.extend([lat, lon]);
    }
    // Don't auto-fit here; use the button or first-data pass
  }

  fitToData() {
    if (!this.map || !this.markersLayer) return;
    const bounds = (this.markersLayer as any).getBounds?.();
    if (bounds && bounds.isValid()) {
      this.map.fitBounds(bounds, {padding: [18, 18]});
    }
  }

  ngOnDestroy() {
    if (this.map) {
      this.map.remove();
    }
  }
}

function keyOf(r: ShopRecord): string {
  return `${r.name}||${r.address ?? ''}`; // stable-enough key for selection
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  } as any)[c]);
}
