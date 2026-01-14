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

/**
 * Histogram visualization component using D3.js.
 * Displays the distribution of price change percentages across bicycle repair shops.
 *
 * Key features:
 * - Symmetric bins centered around zero for easy comparison
 * - Responsive layout with ResizeObserver
 * - Interactive tooltips showing bin ranges and counts
 * - Reactive updates via Angular Signals
 * - SSR-compatible (no rendering on server)
 */
@Component({
  selector: 'app-histogram',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './histogram.component.html',
  styleUrl: './histogram.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistogramComponent implements AfterViewInit, OnChanges, OnDestroy {
  // DOM element references
  @ViewChild('host', {static: true}) hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('tooltip', {static: true}) tooltipRef!: ElementRef<HTMLDivElement>;

  /** Input signal containing price change percentages to visualize */
  @Input({required: true}) values!: Signal<number[]>;

  /** Input signal determining the number of histogram bins */
  @Input({required: true}) bins!: Signal<number>;

  /** Optional domain override; if null, automatically calculated from data */
  @Input() domain: [number, number] | null = null;

  /** Chart margins for axes and labels */
  @Input() margin = {top: 20, right: 16, bottom: 36, left: 40};

  private destroyRef = inject(DestroyRef);
  private platformId = inject(PLATFORM_ID);
  private injector = inject(Injector);
  private svg?: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private resizeObserver?: ResizeObserver;

  /**
   * Sets up an Angular effect to reactively re-render the chart when values change.
   * Uses queueMicrotask to batch updates and avoid render thrashing.
   */
  ngOnInit() {
    effect(() => {
      const _ = this.values();  // Track values signal
      if (!this.svg) return;
      queueMicrotask(() => {
        this.render();
      });
    }, {injector: this.injector as any});
  }

  /**
   * Initializes the chart after the view is ready.
   * Sets up responsive resizing via ResizeObserver.
   * Only runs in browser (skipped during SSR).
   */
  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return; // SSR guard
    this.initChart();
    this.render();

    // Set up responsive chart resizing
    this.resizeObserver = new ResizeObserver(() => this.render());
    this.resizeObserver.observe(this.hostRef.nativeElement);
    this.destroyRef.onDestroy(() => this.resizeObserver?.disconnect());
  }

  /**
   * Re-renders chart when inputs change (values, bins, or domain).
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.svg && (changes['values'] || changes['bins'] || changes['domain'])) {
      this.render();
    }
  }

  /**
   * Cleanup: removes SVG element when component is destroyed.
   */
  ngOnDestroy(): void {
    this.svg?.remove();
  }

  /**
   * Initializes the D3 SVG container.
   * Removes any existing SVG to ensure clean state.
   */
  private initChart() {
    const host = this.hostRef.nativeElement;
    d3.select(host).selectAll('svg').remove();

    this.svg = d3.select(host)
      .append('svg')
      .attr('width', host.clientWidth)
      .attr('height', host.clientHeight);
  }

  /**
   * Main rendering function that creates the histogram using D3.
   * Called on initialization, data changes, and resize events.
   *
   * Algorithm:
   * 1. Calculate symmetric domain centered on zero (for visual balance)
   * 2. Create odd number of bins so one bin is centered at zero
   * 3. Generate D3 histogram with custom bin edges
   * 4. Draw bars with tooltip interactions
   * 5. Add axes and labels
   */
  private render(): void {
    if (!this.svg) return;

    const host = this.hostRef.nativeElement;
    const tooltip = d3.select(this.tooltipRef.nativeElement);

    // Calculate chart dimensions
    const width = host.clientWidth;
    const height = host.clientHeight;
    const {top, right, bottom, left} = this.margin;
    const innerW = Math.max(0, width - left - right);
    const innerH = Math.max(0, height - top - bottom);

    // Update SVG size and clear previous content
    this.svg!.attr('width', width).attr('height', height);
    this.svg!.selectAll('*').remove();

    // Create main group with margins applied
    const g = this.svg!.append('g').attr('transform', `translate(${left},${top})`);

    // Filter out invalid values (NaN, Infinity)
    const data = (this.values() ?? []).filter((d) => Number.isFinite(d)) as number[];

    // Calculate symmetric domain for balanced visualization
    // IMPORTANT: Symmetric bins make it easier to see if values cluster on positive/negative side
    const dataExtent = d3.extent(data) as [number, number] | [number, number] | [undefined, undefined];
    const inputDomain = this.domain ?? (dataExtent as [number, number]) ?? [0, 0];
    const maxAbs = Math.max(Math.abs(inputDomain[0] ?? 0), Math.abs(inputDomain[1] ?? 0));
    const symDomain: [number, number] = [-maxAbs, maxAbs];

    // Ensure odd number of bins so one bin is centered at zero
    // This makes it easy to see price increases (right) vs decreases (left)
    const wanted = this.bins?.() ?? 11;
    const binCount = Math.max(1, Math.round(wanted));
    const oddBinCount = binCount % 2 === 1 ? binCount : binCount + 1;

    // Calculate bin width and edges
    const w = (2 * maxAbs) / oddBinCount;
    // Generate edges: [-maxAbs, ..., 0, ..., +maxAbs]
    const edges = Array.from({length: oddBinCount + 1}, (_, j) => (j - oddBinCount / 2) * w);

    // X-scale: maps price change percentage to horizontal pixel position
    const x = d3.scaleLinear()
      .domain([edges[0], edges[edges.length - 1]])
      .range([0, innerW]);

    // D3 histogram generator with custom bin boundaries
    const binGen = d3.bin<number, number>()
      .domain([edges[0], edges[edges.length - 1]] as [number, number])
      .thresholds(edges.slice(1, -1));  // Use inner edges as thresholds

    // Generate histogram bins
    const bins = binGen(data);

    // Y-scale: maps count/frequency to vertical pixel position
    const y = d3.scaleLinear()
      .domain([0, d3.max(bins, (d) => d.length) || 0])
      .nice()  // Round domain to nice values
      .range([innerH, 0]);  // Inverted (SVG coordinates: 0 is top)

    // Create axes with percentage formatting
    const xAxis = d3.axisBottom(x)
      .tickFormat(d => `${d3.format('.0f')(+d * 100)}%`);  // Convert decimal to percentage (0.2 → 20%)
    const yAxis = d3.axisLeft(y).ticks(5).tickFormat(d3.format('~s'));

    // Draw axes with labels
    const xAxisG = g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(xAxis);

    const yAxisG = g.append('g')
      .call(yAxis);

    // X-axis label (removed "(%)" since ticks now show % symbol)
    xAxisG.append('text')
      .attr('class', 'axis-label')
      .attr('x', innerW / 2)
      .attr('y', 32)  // Below axis
      .attr('fill', 'currentColor')
      .attr('text-anchor', 'middle')
      .text('Δ Preis vs. Erstpreis');

    // Y-axis label: "Frequency" (rotated 90 degrees)
    yAxisG.append('text')
      .attr('class', 'axis-label')
      .attr('x', -innerH / 2)  // Center of Y-axis
      .attr('y', -36)  // Left of axis
      .attr('fill', 'currentColor')
      .attr('text-anchor', 'middle')
      .attr('transform', 'rotate(-90)')
      .text('Häufigkeit');

    // Create diverging color scale: green for negative (price decreases), red for positive (price increases)
    // Darker shades further from zero
    const negativeColorScale = d3.scaleSequential(d3.interpolateGreens)
      .domain([0, maxAbs]);  // Light green at 0, dark green at -maxAbs

    const positiveColorScale = d3.scaleSequential(d3.interpolateReds)
      .domain([0, maxAbs]);  // Light red at 0, dark red at +maxAbs

    // Draw histogram bars
    const gap = 0;  // Gap between bars (0 for continuous histogram)
    const bar = g.append('g')
      .selectAll('rect')
      .data(bins)
      .join('rect')
      .attr('x', d => x(d.x0 as number) + gap / 2)
      .attr('y', d => y(d.length))
      .attr('width', d => Math.max(0, x(d.x1 as number) - x(d.x0 as number) - gap))
      .attr('height', d => innerH - y(d.length))
      .attr('rx', 2)  // Rounded corners
      .attr('fill', d => {
        // Calculate bin center
        const binCenter = ((d.x0 ?? 0) + (d.x1 ?? 0)) / 2;
        const distanceFromZero = Math.abs(binCenter);

        // Special case: center bin at zero gets a medium-dark gray
        if (Math.abs(binCenter) < w / 2) {
          return '#707070';  // Medium-dark gray for center bin (15% lighter than #555)
        }

        // Use green scale for negative values, red scale for positive values
        if (binCenter < 0) {
          return negativeColorScale(distanceFromZero);
        } else {
          return positiveColorScale(distanceFromZero);
        }
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 0.5);  // Subtle border for definition

    // Interactive tooltip showing bin details on hover
    bar.on('mousemove', (event, d) => {
      const [mx, my] = d3.pointer(event, this.svg!.node());
      const from = (d.x0 ?? 0) * 100;  // Convert to percentage
      const to = (d.x1 ?? 0) * 100;    // Convert to percentage
      const count = d.length;
      const pct = data.length ? (count / data.length) * 100 : 0;

      tooltip
        .style('left', `${mx}px`)
        .style('top', `${my - 12}px`)
        .style('opacity', 1)
        .html(
          `<div><strong>${from.toFixed(1)}% – ${to.toFixed(1)}%</strong></div>
           <div>n = ${count} (${pct.toFixed(1)}%)</div>`
        );
    }).on('mouseleave', () => {
      tooltip.style('opacity', 0);
    });
  }
}
