import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FirebaseError } from 'firebase/app';
import { AuthService } from '../../services/auth-service';

type Mode = 'signin' | 'signup';

// Firebase's error `.code` values for the auth flows this page uses —
// translated to GM-facing text once here rather than showing Firebase's
// own (accurate, but jargon-y) messages directly.
const ERROR_MESSAGES: Record<string, string> = {
  'auth/email-already-in-use': 'An account with that email already exists.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/user-not-found': 'Incorrect email or password.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/invalid-email': "That doesn't look like a valid email address.",
  'auth/popup-closed-by-user': 'Google sign-in was closed before finishing.',
};

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly mode = signal<Mode>('signin');
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly submitting = signal(false);
  protected readonly guestSubmitting = signal(false);

  protected setMode(mode: Mode): void {
    this.mode.set(mode);
    this.error.set(null);
  }

  protected async submitEmailForm(): Promise<void> {
    const email = this.email().trim();
    const password = this.password();
    if (!email || !password) return;

    this.submitting.set(true);
    this.error.set(null);
    try {
      if (this.mode() === 'signup') {
        await this.authService.signUpWithEmail(email, password);
      } else {
        await this.authService.signInWithEmail(email, password);
      }
      // The auth guard only re-checks on navigation, not reactively — a
      // successful sign-in from *this* page still needs an explicit nav
      // to actually leave the login screen.
      this.router.navigateByUrl('/');
    } catch (err) {
      this.error.set(this.describeError(err));
    } finally {
      this.submitting.set(false);
    }
  }

  protected async continueWithGoogle(): Promise<void> {
    this.error.set(null);
    try {
      await this.authService.signInWithGoogle();
      this.router.navigateByUrl('/');
    } catch (err) {
      this.error.set(this.describeError(err));
    }
  }

  protected async continueAsGuest(): Promise<void> {
    this.guestSubmitting.set(true);
    this.error.set(null);
    try {
      await this.authService.continueAsGuest();
      this.router.navigateByUrl('/');
    } catch (err) {
      this.error.set(this.describeError(err));
    } finally {
      this.guestSubmitting.set(false);
    }
  }

  private describeError(err: unknown): string {
    if (err instanceof FirebaseError) {
      return ERROR_MESSAGES[err.code] ?? 'Something went wrong. Please try again.';
    }
    return 'Something went wrong. Please try again.';
  }
}
