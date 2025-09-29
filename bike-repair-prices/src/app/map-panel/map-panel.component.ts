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
import {CommonModule, isPlatformBrowser} from '@angular/common';
import type {ShopRecord} from '../types';

type LeafletNS = typeof import('leaflet');

@Component({
  selector: 'app-map-panel',
  standalone: true,
  imports: [CommonModule],
  // Inline template so it's truly single-file
    templateUrl: './map-panel.component.html',
})
export class MapPanelComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('mapEl', {static: true}) mapEl!: ElementRef<HTMLElement>;

  @Input({required: true}) records!: Signal<ShopRecord[]>;
  @Input() selectedKeys: Set<string> = new Set<string>();

  private destroyRef = inject(DestroyRef);
  private injector = inject(Injector);
  private platformId = inject(PLATFORM_ID);

  private L!: LeafletNS;
  private map: any;
  private markersLayer: any;

  // gating + first paint
  private mapReady = signal(false);
  private firstDataPainted = false;

  constructor() {
    // no effects in constructor to avoid races with @Input
  }

  ngOnInit() {
    // React to records() only once the map is ready
    effect(() => {
      if (!this.mapReady()) return;
      const _ = this.records(); // track changes
      // micro-debounce in case records change rapidly
      queueMicrotask(() => {
        this.renderMarkers();
        if (!this.firstDataPainted) {
          this.fitToData();
          this.firstDataPainted = true;
        }
      });
    }, {injector: this.injector as any});
  }

  async ngAfterViewInit() {
    if (!isPlatformBrowser(this.platformId)) return;

    // Lazy-load Leaflet in the browser
    this.L = (await import('leaflet')) as unknown as LeafletNS;

    this.map = this.L.map(this.mapEl.nativeElement, {
      center: [48.208, 16.373], // Vienna
      zoom: 12,
    });

    this.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);

    // Reusable layer that we clear instead of removing
    this.markersLayer = this.L.layerGroup().addTo(this.map);

    // Ensure proper sizing if container is flex/hidden at first
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
    if (!this.L || !this.map || !this.markersLayer) return;

    // Clear all previous markers
    this.markersLayer.clearLayers?.();

    const bounds = this.L.latLngBounds([]);
    const data = this.records();

    for (const r of data) {
      const lat = r.lat != null ? Number(r.lat) : NaN;
      const lon = r.lon != null ? Number(r.lon) : NaN;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

      const key = keyOf(r);
      const isSelected = this.selectedKeys.has(key);

      const first = r.firstPriceInflationAdjusted ?? null;
      const current = r.currentPrice ?? null;

      let color = '#999';
      if (first != null && current != null) color = first < current ? '#cc0000' : '#2a6';

      const marker = this.L.circleMarker([lat, lon], {
        radius: isSelected ? 7 : 5,
        weight: isSelected ? 2 : 1,
        color,
        fill: true,
        fillOpacity: 0.7,
      }).addTo(this.markersLayer);

      const addr = r.address ? `<div>${escapeHtml(r.address)}</div>` : '';
      const site = r.website ? `<div><a href="${r.website}" target="_blank" rel="noopener">Website</a></div>` : '';
      const price = r.deltaVsFirstAdjPercentage != null ? `<div>Preisänderung: ${(r.deltaVsFirstAdjPercentage * 100).toFixed(1)} %</div>` : '';
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
      this.map = null;
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
