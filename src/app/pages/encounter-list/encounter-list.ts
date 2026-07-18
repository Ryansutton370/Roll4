import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { EncounterStore } from '../../services/encounter-store';
import { PartyStore } from '../../services/party-store';

@Component({
  selector: 'app-encounter-list',
  imports: [FormsModule, RouterLink],
  templateUrl: './encounter-list.html',
  styleUrl: './encounter-list.css',
})
export class EncounterList {
  protected readonly encounterStore = inject(EncounterStore);
  protected readonly partyStore = inject(PartyStore);
  private readonly router = inject(Router);

  protected readonly newEncounterName = signal('');
  protected readonly selectedPartyIds = signal<string[]>([]);

  protected togglePartySelected(partyId: string, checked: boolean): void {
    this.selectedPartyIds.update((ids) =>
      checked ? [...ids, partyId] : ids.filter((id) => id !== partyId),
    );
  }

  protected createEncounter(): void {
    const name = this.newEncounterName().trim();
    if (!name) return;
    const encounter = this.encounterStore.createEncounter(name, this.selectedPartyIds());
    this.newEncounterName.set('');
    this.selectedPartyIds.set([]);
    // Straight into the setup/run screen for the encounter just created.
    this.router.navigate(['/encounters', encounter.id]);
  }

  protected deleteEncounter(id: string, name: string): void {
    if (confirm(`Delete "${name}"?`)) {
      this.encounterStore.deleteEncounter(id);
    }
  }
}
