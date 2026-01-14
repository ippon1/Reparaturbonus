import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Reusable section wrapper for the narrative story layout.
 * Provides consistent spacing and width constraints.
 */
@Component({
  selector: 'app-story-section',
  imports: [CommonModule],
  templateUrl: './story-section.component.html',
  styleUrl: './story-section.component.scss'
})
export class StorySectionComponent {
  /**
   * Width variant:
   * - 'standard': Normal content width (900px) - used for all sections
   * - 'breakout': Wider content for table section (1170px on desktop, calc(100vw - 4vw) on mobile)
   */
  @Input() width: 'standard' | 'breakout' = 'standard';

  /**
   * Background variant: 'default' or 'alt' (gray background)
   */
  @Input() background: 'default' | 'alt' = 'default';

  /**
   * Optional CSS class for custom styling
   */
  @Input() cssClass: string = '';
}
