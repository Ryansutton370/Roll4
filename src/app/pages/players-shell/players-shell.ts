import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

/**
 * Owns the "Roster / Parties" sub-nav for everything under /players — see
 * app.routes.ts, which nests PlayerRoster/PartyList/PartyDetail as
 * children of this route so they all render into its <router-outlet>
 * instead of app.html's own header needing to know about sub-sections.
 */
@Component({
  selector: 'app-players-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './players-shell.html',
})
export class PlayersShell {}
