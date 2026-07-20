import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Combatant, Encounter } from '../../models/encounter.model';
import { EncounterStore, computeDisplayNames } from '../../services/encounter-store';
import { NpcStore } from '../../services/npc-store';
import { PartyStore } from '../../services/party-store';
import { AddCombatantDialog, NewCombatantSubmitted } from '../../shared/add-combatant-dialog/add-combatant-dialog';
import { CombatantFields } from '../../shared/combatant-fields/combatant-fields';

@Component({
  selector: 'app-encounter-list',
  imports: [FormsModule, RouterLink, CombatantFields, AddCombatantDialog],
  templateUrl: './encounter-list.html',
  styleUrl: './encounter-list.css',
})
export class EncounterList {
  protected readonly encounterStore = inject(EncounterStore);
  protected readonly partyStore = inject(PartyStore);
  protected readonly npcStore = inject(NpcStore);
  private readonly router = inject(Router);

  protected readonly newEncounterName = signal('');
  protected readonly selectedPartyIds = signal<string[]>([]);
  protected readonly selectedTroopIds = signal<string[]>([]);

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

  // "Goblin"/"Goblin" -> "Goblin A"/"Goblin B" — see EncounterDetail's
  // identical displayNames/displayName pair, and computeDisplayNames' own
  // doc comment, for why this needs creation order specifically.
  protected readonly displayNames = computed(() => {
    const id = this.editingEncounterId();
    return id
      ? computeDisplayNames(this.encounterStore.combatantsForEncounterInCreationOrder(id))
      : new Map<string, string>();
  });

  protected displayName(combatantId: string): string {
    return this.displayNames().get(combatantId) ?? '';
  }

  // Roster entries not yet in the Encounter being edited — same "never
  // offer a no-op add" filtering as EncounterDetail's pickers, fed into
  // AddCombatantDialog below.
  protected readonly availablePlayersToAdd = computed(() => {
    const presentIds = new Set(this.editingCombatants().map((c) => c.playerId));
    return this.partyStore.players().filter((p) => !presentIds.has(p.id));
  });
  protected readonly availableNpcsToAdd = computed(() => {
    const presentIds = new Set(this.editingCombatants().map((c) => c.npcId));
    return this.npcStore.npcs().filter((n) => !presentIds.has(n.id));
  });

  // Same shared dialog/viewChild pattern as EncounterDetail — see that
  // component for the full rationale.
  private readonly addCombatantDialog = viewChild.required<AddCombatantDialog>('addCombatantDialog');

  protected openAddCombatantDialog(): void {
    this.addCombatantDialog().open();
  }

  protected onExistingPlayerChosen(playerId: string): void {
    this.addIndividualPlayerToEditingEncounter(playerId);
  }

  protected onExistingNpcChosen(npcId: string): void {
    this.addIndividualNpcToEditingEncounter(npcId);
  }

  protected onNewCombatantSubmitted(event: NewCombatantSubmitted): void {
    const encounterId = this.editingEncounterId();
    if (!encounterId) return;
    this.encounterStore.addAdHocCombatant(encounterId, event.type, event.fields);
  }

  protected togglePartySelected(partyId: string, checked: boolean): void {
    this.selectedPartyIds.update((ids) =>
      checked ? [...ids, partyId] : ids.filter((id) => id !== partyId),
    );
  }

  protected toggleTroopSelected(troopId: string, checked: boolean): void {
    this.selectedTroopIds.update((ids) =>
      checked ? [...ids, troopId] : ids.filter((id) => id !== troopId),
    );
  }

  // Pre-populates the create form with an existing Encounter's name and
  // Party/Troop selection so it doubles as the edit form — see
  // submitEncounterForm for what happens to those values on submit.
  protected startEdit(encounter: Encounter): void {
    this.editingEncounterId.set(encounter.id);
    this.newEncounterName.set(encounter.name);
    this.selectedPartyIds.set([...encounter.partyIds]);
    this.selectedTroopIds.set([...encounter.troopIds]);
  }

  protected cancelEdit(): void {
    this.editingEncounterId.set(null);
    this.newEncounterName.set('');
    this.selectedPartyIds.set([]);
    this.selectedTroopIds.set([]);
  }

  protected submitEncounterForm(): void {
    const name = this.newEncounterName().trim();
    if (!name) return;

    const editingId = this.editingEncounterId();
    if (editingId) {
      this.encounterStore.renameEncounter(editingId, name);
      this.encounterStore.setEncounterParties(editingId, this.selectedPartyIds());
      this.encounterStore.setEncounterTroops(editingId, this.selectedTroopIds());
      this.cancelEdit();
      return;
    }

    const encounter = this.encounterStore.createEncounter(
      name,
      this.selectedPartyIds(),
      this.selectedTroopIds(),
    );
    this.newEncounterName.set('');
    this.selectedPartyIds.set([]);
    this.selectedTroopIds.set([]);
    // Straight into the setup/run screen for the encounter just created.
    this.router.navigate(['/encounters', encounter.id]);
  }

  // Adding/removing combatants applies immediately (like the setup screen on
  // encounter-detail) rather than waiting for Update Encounter — only the
  // name and Party/Troop selection are staged until submit.
  private addIndividualPlayerToEditingEncounter(playerId: string): void {
    const encounterId = this.editingEncounterId();
    if (!encounterId || !playerId) return;
    this.encounterStore.addPlayerCombatant(encounterId, playerId);
  }

  private addIndividualNpcToEditingEncounter(npcId: string): void {
    const encounterId = this.editingEncounterId();
    if (!encounterId || !npcId) return;
    this.encounterStore.addNpcCombatant(encounterId, npcId);
  }

  // Same Set-of-ids "Save to Roster" pattern as EncounterDetail — see that
  // component for the full rationale.
  protected readonly savingToRosterIds = signal<ReadonlySet<string>>(new Set());
  private readonly saveToRosterSelections = signal<ReadonlyMap<string, ReadonlySet<string>>>(new Map());

  protected isSavingToRoster(combatantId: string): boolean {
    return this.savingToRosterIds().has(combatantId);
  }

  protected toggleSavingToRoster(combatantId: string): void {
    this.savingToRosterIds.update((ids) => {
      const next = new Set(ids);
      next.has(combatantId) ? next.delete(combatantId) : next.add(combatantId);
      return next;
    });
    this.saveToRosterSelections.update((selections) => {
      if (!selections.has(combatantId)) return selections;
      const next = new Map(selections);
      next.delete(combatantId);
      return next;
    });
  }

  protected isGroupSelectedForSave(combatantId: string, groupId: string): boolean {
    return this.saveToRosterSelections().get(combatantId)?.has(groupId) ?? false;
  }

  protected toggleGroupSelectedForSave(combatantId: string, groupId: string, checked: boolean): void {
    this.saveToRosterSelections.update((selections) => {
      const current = new Set(selections.get(combatantId) ?? []);
      checked ? current.add(groupId) : current.delete(groupId);
      const next = new Map(selections);
      next.set(combatantId, current);
      return next;
    });
  }

  protected confirmSaveToRoster(combatant: Combatant): void {
    const encounterId = this.editingEncounterId();
    if (!encounterId) return;
    const groupIds = [...(this.saveToRosterSelections().get(combatant.id) ?? [])];
    const fields = {
      name: combatant.name,
      initiativeModifier: combatant.initiativeModifier,
      ac: combatant.ac,
      maxHp: combatant.maxHp,
      notes: combatant.notes,
    };
    const linkedId =
      combatant.type === 'pc'
        ? this.partyStore.createPlayer(fields).id
        : this.npcStore.createNpc(fields).id;
    if (combatant.type === 'pc') {
      groupIds.forEach((partyId) => this.partyStore.addPlayerToParty(partyId, linkedId));
    } else {
      groupIds.forEach((troopId) => this.npcStore.addNpcToTroop(troopId, linkedId));
    }
    this.encounterStore.linkCombatantToLibraryEntry(encounterId, combatant.id, linkedId);
    this.toggleSavingToRoster(combatant.id);
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

  // Name/AC/Max HP/Notes for an existing combatant in the encounter being
  // edited — same updateCombatantDetails the run-phase Edit dialog uses
  // (unlike the modifier field above, there's no "locked after the first
  // Roll" rule for these, so this can go straight to the store).
  protected updateCombatantFieldInEditingEncounter(
    combatantId: string,
    changes: { name?: string; ac?: number | null; maxHp?: number | null; notes?: string },
  ): void {
    const encounterId = this.editingEncounterId();
    if (!encounterId) return;
    this.encounterStore.updateCombatantDetails(encounterId, combatantId, changes);
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
