import { Routes } from '@angular/router';
import { authGuard, redirectIfAuthedGuard } from './guards/auth-guard';
import { About } from './pages/about/about';
import { CombatThesaurusGenerator } from './pages/combat-thesaurus-generator/combat-thesaurus-generator';
import { EncounterDetail } from './pages/encounter-detail/encounter-detail';
import { EncounterGenerator } from './pages/encounter-generator/encounter-generator';
import { EncounterList } from './pages/encounter-list/encounter-list';
import { GeneratorsHome } from './pages/generators-home/generators-home';
import { GeneratorsShell } from './pages/generators-shell/generators-shell';
import { Home } from './pages/home/home';
import { Login } from './pages/login/login';
import { NameGenerator } from './pages/name-generator/name-generator';
import { NpcRoster } from './pages/npc-roster/npc-roster';
import { NpcsShell } from './pages/npcs-shell/npcs-shell';
import { PartyDetail } from './pages/party-detail/party-detail';
import { PartyList } from './pages/party-list/party-list';
import { PlayerRoster } from './pages/player-roster/player-roster';
import { PlayersShell } from './pages/players-shell/players-shell';
import { QuestsRumorsGossipGenerator } from './pages/quests-rumors-gossip-generator/quests-rumors-gossip-generator';
import { SpellListsGenerator } from './pages/spell-lists-generator/spell-lists-generator';
import { TreasureGenerator } from './pages/treasure-generator/treasure-generator';
import { TroopDetail } from './pages/troop-detail/troop-detail';
import { TroopList } from './pages/troop-list/troop-list';
import { WildMagicGenerator } from './pages/wild-magic-generator/wild-magic-generator';

export const routes: Routes = [
  // The landing page — the one route reachable both signed-in and
  // signed-out (Home branches on sign-in state itself instead of being
  // guarded). pathMatch: 'full' so this only matches the bare '' URL, not
  // every URL as a prefix (the default) — otherwise it would swallow every
  // other route below before they got a chance to match.
  { path: '', component: Home, pathMatch: 'full' },
  // /login sits outside the guarded parent below, and carries its own
  // guard the other direction — bouncing an already-signed-in GM straight
  // back to the landing page instead of showing them a login form again.
  { path: 'login', component: Login, canActivate: [redirectIfAuthedGuard] },
  // A pathless parent route ({ path: '' }) — it contributes no URL
  // segment of its own, just a canActivate check every child route below
  // inherits. Every existing URL (/players, /encounters/:id, etc.) is
  // unchanged; this only adds "must be signed in" in front of all of them.
  {
    path: '',
    canActivate: [authGuard],
    children: [
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
          // '' is this hub page, not any one generator — a GM picks a
          // card below rather than landing on whichever page shipped
          // first (Names, back when it was the only one).
          { path: '', component: GeneratorsHome },
          { path: 'names', component: NameGenerator },
          { path: 'encounter', component: EncounterGenerator },
          { path: 'wild-magic', component: WildMagicGenerator },
          { path: 'treasure', component: TreasureGenerator },
          { path: 'combat-thesaurus', component: CombatThesaurusGenerator },
          { path: 'spells', component: SpellListsGenerator },
          { path: 'quests-rumors-gossip', component: QuestsRumorsGossipGenerator },
        ],
      },
      // Always the last header nav tab (see app.html) — a static
      // About/Contact page, no sub-nav of its own.
      { path: 'about', component: About },
    ],
  },
];
