import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

/**
 * Owns the "Roster / Troops" sub-nav for everything under /npcs — mirrors
 * PlayersShell exactly (see that file for the reasoning).
 */
@Component({
  selector: 'app-npcs-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './npcs-shell.html',
})
export class NpcsShell {}
