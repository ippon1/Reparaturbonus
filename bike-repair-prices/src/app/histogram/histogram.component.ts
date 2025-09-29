import {
  AfterViewInit,
  ChangeDetectionStrategy,
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
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import {CommonModule, isPlatformBrowser} from '@angular/common';
import * as d3 from 'd3';

@Component({
  selector: 'app-histogram',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './histogram.component.html',
  styleUrl: './histogram.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistogramComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('host', {static: true}) hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('tooltip', {static: true}) tooltipRef!: ElementRef<HTMLDivElement>;

  /** Daten: Zahlenreihe fürs Histogramm */
  @Input({required: true}) values!: Signal<number[]>;

  /** Anzahl Bins (optional) */
  @Input({required: true}) bins!: Signal<number>;

  /** Optionaler Wertebereich; wenn nicht gesetzt, wird automatisch aus den Daten genommen */
  @Input() domain: [number, number] | null = null;

  /** Innenränder */
  @Input() margin = {top: 20, right: 16, bottom: 36, left: 40};

  private destroyRef = inject(DestroyRef);
  private platformId = inject(PLATFORM_ID);
  private injector = inject(Injector);
  private svg?: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private resizeObserver?: ResizeObserver;

  ngOnInit() {
    effect(() => {
      const _ = this.values();
      if (!this.svg) return;
      queueMicrotask(() => {
        this.render();
      });
    }, {injector: this.injector as any});
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return; // SSR-Guard
    this.initChart();
    this.render();

    // Responsives Resize
    this.resizeObserver = new ResizeObserver(() => this.render());
    this.resizeObserver.observe(this.hostRef.nativeElement);
    this.destroyRef.onDestroy(() => this.resizeObserver?.disconnect());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.svg && (changes['values'] || changes['bins'] || changes['domain'])) {
      this.render();
    }
  }

  ngOnDestroy(): void {
    this.svg?.remove();
  }

  private initChart() {
    const host = this.hostRef.nativeElement;
    d3.select(host).selectAll('svg').remove();

    this.svg = d3.select(host)
      .append('svg')
      .attr('width', host.clientWidth)
      .attr('height', host.clientHeight);
  }

  private render(): void {
    if (!this.svg) return;

    const host = this.hostRef.nativeElement;
    const tooltip = d3.select(this.tooltipRef.nativeElement);

    const width = host.clientWidth;
    const height = host.clientHeight;
    const {top, right, bottom, left} = this.margin;
    const innerW = Math.max(0, width - left - right);
    const innerH = Math.max(0, height - top - bottom);

    this.svg!.attr('width', width).attr('height', height);
    this.svg!.selectAll('*').remove();

    const g = this.svg!.append('g').attr('transform', `translate(${left},${top})`);

    const data = (this.values() ?? []).filter((d) => Number.isFinite(d)) as number[];

    const dataExtent = d3.extent(data) as [number, number] | [number, number] | [undefined, undefined];
    const inputDomain = this.domain ?? (dataExtent as [number, number]) ?? [0, 0];
    const maxAbs = Math.max(Math.abs(inputDomain[0] ?? 0), Math.abs(inputDomain[1] ?? 0));
    const symDomain: [number, number] = [-maxAbs, maxAbs];

    const wanted = this.bins?.() ?? 11;
    const binCount = Math.max(1, Math.round(wanted));
    const oddBinCount = binCount % 2 === 1 ? binCount : binCount + 1;

    const w = (2 * maxAbs) / oddBinCount;
    const edges = Array.from({length: oddBinCount + 1}, (_, j) => (j - oddBinCount / 2) * w);

    const x = d3.scaleLinear()
      .domain([edges[0], edges[edges.length - 1]])
      .range([0, innerW]);

    const binGen = d3.bin<number, number>()
      .domain([edges[0], edges[edges.length - 1]] as [number, number])
      .thresholds(edges.slice(1, -1));

    const bins = binGen(data);

    const y = d3.scaleLinear()
      .domain([0, d3.max(bins, (d) => d.length) || 0])
      .nice()
      .range([innerH, 0]);

    // Achsen
    const xAxis = d3.axisBottom(x);
    const yAxis = d3.axisLeft(y).ticks(5).tickFormat(d3.format('~s'));

    g.append('g').attr('transform', `translate(0,${innerH})`).call(xAxis);

    g.append('g').call(yAxis);

    const xAxisG = g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(xAxis);

    const yAxisG = g.append('g')
      .call(yAxis);

    // X-Achsenlabel
    xAxisG.append('text')
      .attr('class', 'axis-label')
      .attr('x', innerW / 2)
      .attr('y', 32)               // etwas Abstand unterhalb der Achse
      .attr('fill', 'currentColor')
      .attr('text-anchor', 'middle')
      .text('Δ Preis vs. Erstpreis (%)');

    // Y-Achsenlabel
    yAxisG.append('text')
      .attr('class', 'axis-label')
      .attr('x', -innerH / 2)      // Mitte der Y-Achse
      .attr('y', -36)              // links daneben
      .attr('fill', 'currentColor')
      .attr('text-anchor', 'middle')
      .attr('transform', 'rotate(-90)')
      .text('Häufigkeit');


    // Balken
    const gap = 0;
    const bar = g.append('g')
      .selectAll('rect')
      .data(bins)
      .join('rect')
      .attr('x', d => x(d.x0 as number) + gap / 2)
      .attr('y', d => y(d.length))
      .attr('width', d => Math.max(0, x(d.x1 as number) - x(d.x0 as number) - gap))
      .attr('height', d => innerH - y(d.length))
      .attr('rx', 2);

    // Tooltip-Interaktion
    bar.on('mousemove', (event, d) => {
      const [mx, my] = d3.pointer(event, this.svg!.node());
      const from = d.x0 ?? 0;
      const to = d.x1 ?? 0;
      const count = d.length;
      const pct = data.length ? (count / data.length) * 100 : 0;

      tooltip
        .style('left', `${mx}px`)
        .style('top', `${my - 12}px`)
        .style('opacity', 1)
        .html(
          `<div><strong>${from.toFixed(2)} – ${to.toFixed(2)}</strong></div>
           <div>n = ${count} (${pct.toFixed(1)}%)</div>`
        );
    }).on('mouseleave', () => {
      tooltip.style('opacity', 0);
    });

    // Titel optional (hier ausgelassen); Achsenlabels Beispiel:
    // g.append('text').attr('x', innerW).attr('y', innerH + 30).attr('text-anchor','end').text('Wert');
    // g.append('text').attr('x', 0).attr('y', -8).attr('text-anchor','start').text('Häufigkeit');
  }
}
