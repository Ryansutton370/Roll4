import { Component, computed, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PartyStore } from '../../services/party-store';

/**
 * A Party is now a membership *tag* over the shared Player roster
 * (many-to-many), not an owner of dedicated PCs — so this screen is a
 * checkbox list over every roster Player rather than an inline create
 * form. Players themselves are created/edited on PlayerRoster, since a
 * Player being creatable "inside" one Party stopped making sense once it
 * can belong to several.
 */
@Component({
  selector: 'app-party-detail',
  imports: [FormsModule, RouterLink],
  templateUrl: './party-detail.html',
  styleUrl: './party-detail.css',
})
export class PartyDetail {
  protected readonly partyStore = inject(PartyStore);

  // input.required(): a signal-based component input. app.config.ts turns
  // on withComponentInputBinding(), which auto-fills this from the
  // ':partyId' segment of the matched route — no manual ActivatedRoute
  // subscription needed.
  readonly partyId = input.required<string>();

  protected readonly party = computed(() => this.partyStore.getParty(this.partyId()));
  protected readonly allPlayers = computed(() => this.partyStore.players());

  protected isMember(playerId: string): boolean {
    return this.party()?.playerIds.includes(playerId) ?? false;
  }

  protected toggleMembership(playerId: string, checked: boolean): void {
    const partyId = this.partyId();
    if (checked) {
      this.partyStore.addPlayerToParty(partyId, playerId);
    } else {
      this.partyStore.removePlayerFromParty(partyId, playerId);
    }
  }
}
