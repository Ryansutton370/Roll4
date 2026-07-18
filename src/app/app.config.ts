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
  ],
};
