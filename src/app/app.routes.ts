import { Routes } from '@angular/router';
import { EncounterDetail } from './pages/encounter-detail/encounter-detail';
import { EncounterList } from './pages/encounter-list/encounter-list';
import { PartyDetail } from './pages/party-detail/party-detail';
import { PartyList } from './pages/party-list/party-list';

export const routes: Routes = [
  { path: '', redirectTo: 'parties', pathMatch: 'full' },
  { path: 'parties', component: PartyList },
  { path: 'parties/:partyId', component: PartyDetail },
  { path: 'encounters', component: EncounterList },
  { path: 'encounters/:encounterId', component: EncounterDetail },
];
