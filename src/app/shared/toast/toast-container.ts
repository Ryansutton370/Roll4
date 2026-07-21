import { Component, inject } from '@angular/core';
import { ToastService } from './toast';

/**
 * Mounted once in app.html (outside <router-outlet>, so it survives route
 * changes) — renders whatever ToastService currently has queued, fixed to
 * the viewport so a confirmation is visible regardless of scroll position.
 */
@Component({
  selector: 'app-toast-container',
  templateUrl: './toast-container.html',
  styleUrl: './toast-container.css',
})
export class ToastContainer {
  protected readonly toastService = inject(ToastService);
}
