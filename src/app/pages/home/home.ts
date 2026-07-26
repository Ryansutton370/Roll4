import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth-service';

/** A single row in the Upcoming Features list — see docs/ROADMAP.md's Backlog section and the "not part of this phase" note under Phase 3, which these are drawn from. */
interface UpcomingFeature {
  title: string;
  description: string;
}

/**
 * The app's landing page, at '/' — see app.routes.ts, the one route
 * reachable both signed-in and signed-out (every other route sits behind
 * authGuard). The template itself branches on sign-in state rather than
 * having two separate routes/components: a signed-out visitor gets a
 * prompt to sign in in place of the "jump into the app" links a signed-in
 * GM sees, but the title/About/Upcoming Features content is identical
 * either way.
 */
@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  // inject(): Angular's function-based DI, used here instead of a
  // constructor param — grabs the already-created AuthService singleton so
  // the template can read authService.uid() reactively.
  protected readonly authService = inject(AuthService);

  protected readonly guestSubmitting = signal(false);
  protected readonly guestError = signal<string | null>(null);

  // No navigation needed on success, unlike Login's equivalent handler —
  // this page's own @if (authService.uid()) already re-renders reactively
  // once continueAsGuest() resolves and the signal flips, swapping the
  // sign-in prompt for the quick-nav straight away.
  protected async continueAsGuest(): Promise<void> {
    this.guestSubmitting.set(true);
    this.guestError.set(null);
    try {
      await this.authService.continueAsGuest();
    } catch {
      this.guestError.set('Something went wrong starting a guest session. Please try again.');
    } finally {
      this.guestSubmitting.set(false);
    }
  }

  // Static content, not store-backed — hand-maintained alongside
  // docs/ROADMAP.md's Backlog section as that list changes. Player-role
  // items (Phase 4) are deliberately left off; that's not ready to
  // advertise yet.
  protected readonly upcomingFeatures: UpcomingFeature[] = [
    {
      title: 'More Content',
      description: 'Quest hooks, dispositions, more magic items, treasure, and possibly support for other games altogether.',
    },
    {
      title: 'User Profile Settings',
      description:
        'A settings page, starting with a preferred source book (D&D 5e SRD vs. Shadowdark) applied wherever that choice comes up today.',
    },
    {
      title: 'Custom Themes',
      description:
        'Pick an overall look — classic fantasy, retro, sci-fi — instead of the single built-in style.',
    },
    {
      title: 'Temporary HP & AC',
      description:
        "Track a temporary HP pool and stacking AC bonuses (e.g. from a Shield spell) separately from a combatant's base stats.",
    },
    {
      title: 'Torch Timer',
      description:
        "Track torchlight in real time for Shadowdark, or by rounds.",
    },
  ];
}
