import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth-service';

// CanActivateFn: a plain function Angular's router calls before entering a
// route — return true to allow navigation, or a UrlTree (from
// router.parseUrl) to redirect instead. This is the functional style
// (Angular's current idiom); the older class-based `CanActivate` interface
// does the same job with more ceremony.

/** Blocks the whole app behind a signed-in GM — wraps every existing route except /login in app.routes.ts. */
export const authGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  await authService.ready();
  return authService.uid() ? true : router.parseUrl('/login');
};

/**
 * Keeps an already-signed-in GM from landing back on the login form (e.g. a
 * bookmarked /login link). A guest (continueAsGuest) session deliberately
 * doesn't count as "already signed in" here — a guest still needs to reach
 * this page to create a real account, unlike a GM who's already fully
 * signed in.
 */
export const redirectIfAuthedGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  await authService.ready();
  const user = authService.user();
  return user && !user.isAnonymous ? router.parseUrl('/') : true;
};
