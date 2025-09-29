import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  Injector,
  Input,
  OnChanges,
  OnDestroy,
  PLATFORM_ID,
  Signal,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import {CommonModule, isPlatformBrowser} from '@angular/common';
import * as d3 from 'd3';
import type {ShopRecord} from '../types';

export type ScatterPoint = { date: Date | string | number; value: number };

@Component({
  selector: 'app-scatterplot',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './scatterplot.component.html',
  styleUrls: ['./scatterplot.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScatterplotComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('host', {static: true}) hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('tooltip', {static: true}) tooltipRef!: ElementRef<HTMLDivElement>;

  /** Datenpunkte */
  @Input({required: true}) records!: Signal<ShopRecord[]>;

  /** Außenränder */
  @Input() margin = {top: 16, right: 20, bottom: 36, left: 48};

  /** Punktgröße in px */
  @Input() dotRadius = 3.5;

  private platformId = inject(PLATFORM_ID);
  private injector = inject(Injector);
  private svg?: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private resizeObs?: ResizeObserver;

  ngOnInit() {
    effect(() => {
      const _ = this.records(); // track changes
      if (!isPlatformBrowser(this.platformId)) return;
      queueMicrotask(() => this.render());
    }, { injector: this.injector as any });
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.render();

    // Responsiveness
    this.resizeObs = new ResizeObserver(() => this.render());
    this.resizeObs.observe(this.hostRef.nativeElement);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.render();
  }

  ngOnDestroy(): void {
    this.resizeObs?.disconnect();
  }

  private parseDate(x: Date | string | number | null | undefined): Date {
    if (x instanceof Date) return x;
    if (typeof x === 'number') return new Date(x);
    if (typeof x === 'string') {
      const d = new Date(x);
      return isNaN(+d) ? new Date(Date.parse(x)) : d;
    }
    return new Date(NaN); // signal "invalid"
  }

  private isFiniteNumber(n: unknown): n is number {
    return typeof n === 'number' && Number.isFinite(n);
  }

  private render(): void {

    const host = this.hostRef.nativeElement;
    const tooltip = this.tooltipRef.nativeElement;

    const w = host.clientWidth || 600;
    const h = host.clientHeight || 320;

    const {top, right, bottom, left} = this.margin;
    const innerW = Math.max(0, w - left - right);
    const innerH = Math.max(0, h - top - bottom);

    // Clear
    host.innerHTML = '';

    // SVG Grundgerüst
    const svg = d3
      .select(host)
      .append('svg')
      .attr('width', w)
      .attr('height', h);

    const g = svg.append('g').attr('transform', `translate(${left},${top})`);

    const arr: ShopRecord[] = this.records() ?? [];

    const data: { date: Date; value: number; name: string }[] = arr.flatMap(p => {
      const d = this.parseDate(p.firstPriceDate);
      const v = p.deltaVsFirstAdjPercentage;
      const n = p.name;
      return !isNaN(+d) && typeof v === 'number' && isFinite(v) ? [{date: d, value: v, name: n}] : [];
    });

    if (data.length === 0) {
      g.append('text')
        .attr('x', innerW / 2)
        .attr('y', innerH / 2)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .text('Keine Daten');
      return;
    }

    // Skalen
    const xExt = d3.extent(data, d => d.date);  // [Date | undefined, Date | undefined]
    const yExt = d3.extent(data, d => d.value); // [number | undefined, number | undefined]

    const xDomain: [Date, Date] = [
      xExt[0] ?? xExt[1] ?? new Date(),
      xExt[1] ?? xExt[0] ?? new Date(),
    ];

    let yDomain: [number, number] = [
      yExt[0] ?? 0,
      yExt[1] ?? yExt[0] ?? 1,
    ];
    if (yDomain[0] === yDomain[1]) {
      const base = Math.abs(yDomain[0]) || 1;
      const pad = base * 0.05;
      yDomain = [yDomain[0] - pad, yDomain[1] + pad];
    }

    const x = d3.scaleTime().domain(xDomain).range([0, innerW]).nice();
    const y = d3.scaleLinear().domain(yDomain).range([innerH, 0]).nice();

    // Achsen
    g.append('g').attr('transform', `translate(0,${innerH})`).call(d3.axisBottom(x).ticks(Math.min(8, innerW / 80)));
    g.append('g').call(d3.axisLeft(y).ticks(Math.min(6, innerH / 40)));

    // Achsen
    const xAxis = g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(Math.min(8, innerW / 80)));

    const yAxis = g.append('g')
      .call(d3.axisLeft(y).ticks(Math.min(6, innerH / 40)));

    // X-Achsenlabel
    xAxis.append('text')
      .attr('class', 'axis-label')
      .attr('x', innerW / 2)
      .attr('y', 32)               // etwas unterhalb der Achse
      .attr('fill', 'currentColor')
      .attr('text-anchor', 'middle')
      .text('Datum');

    // Y-Achsenlabel
    yAxis.append('text')
      .attr('class', 'axis-label')
      .attr('x', -innerH / 2)      // in der Mitte der Achse
      .attr('y', -40)              // links neben der Achse
      .attr('fill', 'currentColor')
      .attr('text-anchor', 'middle')
      .attr('transform', 'rotate(-90)')
      .text('Δ Preis vs. Erstpreis (%)');


    // Punkte
    const dots = g
      .append('g')
      .attr('class', 'dots')
      .selectAll('circle')
      .data(data)
      .join('circle')
      .attr('cx', d => x(d.date))
      .attr('cy', d => y(d.value))
      .attr('r', this.dotRadius)
      .attr('fill', 'currentColor')
      .attr('opacity', 0.85);

    const fmtDate = d3.timeFormat('%Y-%m-%d');
    dots
      .on('mouseenter', (event, d) => {
        tooltip.style.display = 'block';
        tooltip.innerText = `${fmtDate(d.date)} • Name: ${d.name} • Preisänderung: ${(d.value * 100).toFixed(1)} %`;
      })
      .on('mousemove', (event: MouseEvent) => {
        const {clientX, clientY} = event;
        tooltip.style.left = clientX + 12 + 'px';
        tooltip.style.top = clientY + 12 + 'px';
      })
      .on('mouseleave', () => {
        tooltip.style.display = 'none';
      });
  }
}
