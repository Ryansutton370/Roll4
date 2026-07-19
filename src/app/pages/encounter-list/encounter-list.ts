import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Encounter } from '../../models/encounter.model';
import { EncounterStore } from '../../services/encounter-store';
import { PartyStore } from '../../services/party-store';
import { CombatantFields } from '../../shared/combatant-fields/combatant-fields';

@Component({
  selector: 'app-encounter-list',
  imports: [FormsModule, RouterLink, CombatantFields],
  templateUrl: './encounter-list.html',
  styleUrl: './encounter-list.css',
})
export class EncounterList {
  protected readonly encounterStore = inject(EncounterStore);
  protected readonly partyStore = inject(PartyStore);
  private readonly router = inject(Router);

  protected readonly newEncounterName = signal('');
  protected readonly selectedPartyIds = signal<string[]>([]);

  // Non-null while the form below is editing an existing Encounter rather
  // than creating a new one — set by startEdit, cleared by cancelEdit and by
  // a successful submitEncounterForm. Drives both the submit button's label
  // ("Update Encounter" vs. "Create Encounter") and which combatants section
  // (if any) the template shows under the form.
  protected readonly editingEncounterId = signal<string | null>(null);

  protected readonly editingEncounter = computed(() => {
    const id = this.editingEncounterId();
    return id ? this.encounterStore.getEncounter(id) : null;
  });

  // Party members always shown first, ad-hoc NPCs after — Array.sort is
  // stable (guaranteed since ES2019), so within each group the original
  // order (add order / initiative order) is left untouched.
  protected readonly editingCombatants = computed(() => {
    const id = this.editingEncounterId();
    if (!id) return [];
    return [...this.encounterStore.combatantsForEncounter(id)].sort((a, b) =>
      a.type === b.type ? 0 : a.type === 'pc' ? -1 : 1,
    );
  });

  protected readonly newNpcName = signal('');
  protected readonly newNpcModifier = signal(0);
  protected readonly newNpcAc = signal<number | null>(null);
  protected readonly newNpcMaxHp = signal<number | null>(null);
  protected readonly newNpcNotes = signal('');

  protected togglePartySelected(partyId: string, checked: boolean): void {
    this.selectedPartyIds.update((ids) =>
      checked ? [...ids, partyId] : ids.filter((id) => id !== partyId),
    );
  }

  // Pre-populates the create form with an existing Encounter's name and
  // Party selection so it doubles as the edit form — see submitEncounterForm
  // for what happens to those values on submit.
  protected startEdit(encounter: Encounter): void {
    this.editingEncounterId.set(encounter.id);
    this.newEncounterName.set(encounter.name);
    this.selectedPartyIds.set([...encounter.partyIds]);
  }

  protected cancelEdit(): void {
    this.editingEncounterId.set(null);
    this.newEncounterName.set('');
    this.selectedPartyIds.set([]);
    this.newNpcName.set('');
    this.newNpcModifier.set(0);
    this.newNpcAc.set(null);
    this.newNpcMaxHp.set(null);
    this.newNpcNotes.set('');
  }

  protected submitEncounterForm(): void {
    const name = this.newEncounterName().trim();
    if (!name) return;

    const editingId = this.editingEncounterId();
    if (editingId) {
      this.encounterStore.renameEncounter(editingId, name);
      this.encounterStore.setEncounterParties(editingId, this.selectedPartyIds());
      this.cancelEdit();
      return;
    }

    const encounter = this.encounterStore.createEncounter(name, this.selectedPartyIds());
    this.newEncounterName.set('');
    this.selectedPartyIds.set([]);
    // Straight into the setup/run screen for the encounter just created.
    this.router.navigate(['/encounters', encounter.id]);
  }

  // Adding/removing combatants applies immediately (like the setup screen on
  // encounter-detail) rather than waiting for Update Encounter — only the
  // name and Party selection are staged until submit.
  protected addNpcToEditingEncounter(): void {
    const encounterId = this.editingEncounterId();
    const name = this.newNpcName().trim();
    if (!encounterId || !name) return;
    this.encounterStore.addNpc(encounterId, {
      name,
      initiativeModifier: this.newNpcModifier(),
      ac: this.newNpcAc(),
      maxHp: this.newNpcMaxHp(),
      notes: this.newNpcNotes(),
    });
    this.newNpcName.set('');
    this.newNpcModifier.set(0);
    this.newNpcAc.set(null);
    this.newNpcMaxHp.set(null);
    this.newNpcNotes.set('');
  }

  protected removeCombatantFromEditingEncounter(combatantId: string): void {
    const encounterId = this.editingEncounterId();
    if (!encounterId) return;
    this.encounterStore.removeCombatant(encounterId, combatantId);
  }

  protected setCombatantModifierInEditingEncounter(combatantId: string, initiativeModifier: number): void {
    const encounterId = this.editingEncounterId();
    if (!encounterId) return;
    this.encounterStore.setInitiativeModifier(encounterId, combatantId, initiativeModifier);
  }

  // Party members can't be deleted from an Encounter here — a player being
  // absent is temporary, so this marks them Removed from Combat (same flag/
  // behavior as the in-combat drawer checkbox) instead of dropping their
  // Combatant record entirely. Clicking again un-marks them.
  protected toggleCombatantRemovedInEditingEncounter(combatantId: string): void {
    const encounterId = this.editingEncounterId();
    if (!encounterId) return;
    this.encounterStore.toggleRemoved(encounterId, combatantId);
  }

  protected deleteEncounter(id: string, name: string): void {
    if (confirm(`Delete "${name}"?`)) {
      if (this.editingEncounterId() === id) this.cancelEdit();
      this.encounterStore.deleteEncounter(id);
    }
  }
}
