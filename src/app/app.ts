import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './services/auth-service';
import { ToastContainer } from './shared/toast/toast-container';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, ToastContainer],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  // Route guards (auth-guard.ts) only run *during navigation* — signing
  // out while already sitting on a guarded page wouldn't otherwise leave
  // it, since nothing re-triggers a navigation on its own. Navigate to
  // /login explicitly once sign-out actually completes.
  protected async logout(): Promise<void> {
    await this.authService.signOutUser();
    this.router.navigateByUrl('/login');
  }
}
