import { Routes } from '@angular/router';
import { EncounterDetail } from './pages/encounter-detail/encounter-detail';
import { EncounterGenerator } from './pages/encounter-generator/encounter-generator';
import { EncounterList } from './pages/encounter-list/encounter-list';
import { GeneratorsShell } from './pages/generators-shell/generators-shell';
import { NameGenerator } from './pages/name-generator/name-generator';
import { NpcRoster } from './pages/npc-roster/npc-roster';
import { NpcsShell } from './pages/npcs-shell/npcs-shell';
import { PartyDetail } from './pages/party-detail/party-detail';
import { PartyList } from './pages/party-list/party-list';
import { PlayerRoster } from './pages/player-roster/player-roster';
import { PlayersShell } from './pages/players-shell/players-shell';
import { TreasureGenerator } from './pages/treasure-generator/treasure-generator';
import { TroopDetail } from './pages/troop-detail/troop-detail';
import { TroopList } from './pages/troop-list/troop-list';
import { WildMagicGenerator } from './pages/wild-magic-generator/wild-magic-generator';

export const routes: Routes = [
  { path: '', redirectTo: 'players', pathMatch: 'full' },
  // children: [...] — Angular's route nesting. PlayersShell owns the
  // "Roster / Parties" sub-nav and a <router-outlet> of its own (see
  // players-shell.html); these three routes render *into* that outlet
  // instead of app.html's single top-level one, which is what lets the
  // sub-nav stay visible across all three pages without each of them
  // having to render it themselves.
  {
    path: 'players',
    component: PlayersShell,
    children: [
      { path: '', component: PlayerRoster },
      { path: 'parties', component: PartyList },
      { path: 'parties/:partyId', component: PartyDetail },
    ],
  },
  {
    path: 'npcs',
    component: NpcsShell,
    children: [
      { path: '', component: NpcRoster },
      { path: 'troops', component: TroopList },
      { path: 'troops/:troopId', component: TroopDetail },
    ],
  },
  { path: 'encounters', component: EncounterList },
  { path: 'encounters/:encounterId', component: EncounterDetail },
  {
    path: 'generators',
    component: GeneratorsShell,
    children: [
      { path: '', component: NameGenerator },
      { path: 'encounter', component: EncounterGenerator },
      { path: 'wild-magic', component: WildMagicGenerator },
      { path: 'treasure', component: TreasureGenerator },
    ],
  },
];
