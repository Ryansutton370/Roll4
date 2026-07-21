import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

/**
 * Owns the "Names / Encounter / Wild Magic / Treasure" sub-nav for
 * everything under /generators — same shape as PlayersShell/NpcsShell (see
 * app.routes.ts). Introduced in Milestone 3 once there were two pages to
 * switch between; Milestone 1's Name Generator shipped alone at
 * /generators with no shell at all.
 */
@Component({
  selector: 'app-generators-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './generators-shell.html',
})
export class GeneratorsShell {}
