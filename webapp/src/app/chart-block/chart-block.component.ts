import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Wrapper component for charts with title, description, and annotation support.
 * Provides consistent styling and layout for data visualizations.
 */
@Component({
  selector: 'app-chart-block',
  imports: [CommonModule],
  templateUrl: './chart-block.component.html',
  styleUrl: './chart-block.component.scss'
})
export class ChartBlockComponent {
  /**
   * Optional heading above the chart
   */
  @Input() title: string = '';

  /**
   * Optional description or context below title
   */
  @Input() description: string = '';

  /**
   * Optional "what to look for" annotation
   */
  @Input() annotation: string = '';
}
