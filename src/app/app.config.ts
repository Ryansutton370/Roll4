import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // withComponentInputBinding(): lets route params (e.g. the ':partyId' in
    // '/parties/:partyId') flow straight into a routed component's
    // input.required<string>() signal, instead of every routed component
    // having to inject ActivatedRoute and subscribe to paramMap manually.
    provideRouter(routes, withComponentInputBinding()),
    // provideHttpClient(): registers Angular's HttpClient for injection —
    // needed for NameTableStore's fetch of public/data/name-tables.json,
    // the app's first use of HTTP (everything else reads localStorage
    // synchronously instead).
    provideHttpClient(),
  ],
};
