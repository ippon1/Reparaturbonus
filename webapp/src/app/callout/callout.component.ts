import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Callout component for highlighting important information, findings, or asides.
 * Supports different visual styles for various types of content.
 */
@Component({
  selector: 'app-callout',
  imports: [CommonModule],
  templateUrl: './callout.component.html',
  styleUrl: './callout.component.scss'
})
export class CalloutComponent {
  /**
   * Visual variant: 'info' (blue), 'warning' (yellow), 'neutral' (gray)
   */
  @Input() variant: 'info' | 'warning' | 'neutral' = 'neutral';

  /**
   * Optional icon or emoji to display
   */
  @Input() icon: string = '';
}
