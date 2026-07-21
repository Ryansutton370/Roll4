import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Encounter } from '../../models/encounter.model';
import { EncounterStore } from '../../services/encounter-store';
import { NpcStore } from '../../services/npc-store';
import { PartyStore } from '../../services/party-store';
import {
  AddCombatantDialog,
  NewCombatantSubmitted,
} from '../../shared/add-combatant-dialog/add-combatant-dialog';
import { EncounterPreviewPanel } from '../../shared/encounter-preview-panel/encounter-preview-panel';
import { MonsterCredits } from '../../shared/monster-credits/monster-credits';
import {
  DraftCombatant,
  MonsterGeneratorPanel,
} from '../../shared/monster-generator-panel/monster-generator-panel';
import { ToastService } from '../../shared/toast/toast';

@Component({
  selector: 'app-encounter-list',
  imports: [
    FormsModule,
    RouterLink,
    AddCombatantDialog,
    MonsterGeneratorPanel,
    MonsterCredits,
    EncounterPreviewPanel,
  ],
  templateUrl: './encounter-list.html',
  styleUrl: './encounter-list.css',
})
export class EncounterList {
  protected readonly encounterStore = inject(EncounterStore);
  protected readonly partyStore = inject(PartyStore);
  protected readonly npcStore = inject(NpcStore);
  private readonly toastService = inject(ToastService);

  // Gates the whole create/edit panel — collapsed by default, showing just
  // a "+ Create Encounter" button. Both startCreate() and startEdit() open
  // it; closePanel() closes it. Kept separate from editingEncounterId below
  // since the panel can be open with no Encounter created yet at all (a
  // fresh, not-yet-materialized create — see ensureEncounterCreated()).
  protected readonly builderOpen = signal(false);

  protected readonly newEncounterName = signal('');
  protected readonly selectedPartyIds = signal<string[]>([]);
  protected readonly selectedTroopIds = signal<string[]>([]);

  // The embedded Encounter Generator's working roster (see
  // MonsterGeneratorPanel) — staged here until the GM explicitly commits it
  // via "Add All to Encounter" or an individual Roster row's "Add to
  // Encounter" (see onAddAllToEncounter/onAddOneToEncounter below), rather
  // than live-syncing automatically. Encounter Preview only ever shows real
  // Combatants, so a candidate sitting in this draft is genuinely not part
  // of the Encounter yet.
  protected readonly generatorDraft = signal<DraftCombatant[]>([]);

  // Non-null once this panel's Encounter actually exists in the store —
  // either a pre-existing Encounter being edited (startEdit), or one
  // materialized by ensureEncounterCreated() the first time the GM does
  // anything real (checking a Party/Troop, an Add All/individual "Add to
  // Encounter", an Add Combatant pick, typing a name). Every one of those
  // applies immediately now — there's no "Update Encounter" submit step to
  // wait for — so this just drives what Encounter Preview shows.
  protected readonly editingEncounterId = signal<string | null>(null);

  protected readonly editingEncounter = computed(() => {
    const id = this.editingEncounterId();
    return id ? this.encounterStore.getEncounter(id) : null;
  });

  // Internal only — not rendered directly (Encounter Preview reads the
  // store itself), just used below to filter AddCombatantDialog's roster
  // pickers down to entries not already in this Encounter.
  private readonly editingCombatants = computed(() => {
    const id = this.editingEncounterId();
    return id ? this.encounterStore.combatantsForEncounter(id) : [];
  });

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
  private readonly addCombatantDialog =
    viewChild.required<AddCombatantDialog>('addCombatantDialog');

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
    const encounterId = this.ensureEncounterCreated();
    this.encounterStore.addAdHocCombatant(encounterId, event.type, event.fields);
  }

  // Checking/unchecking a Party (or Troop, below) applies immediately —
  // materializing the Encounter on first use via ensureEncounterCreated(),
  // same as any other real commit — rather than staying staged until a
  // since-removed "Update Encounter" submit. setEncounterParties reconciles
  // membership itself (adds newly-selected PCs, drops de-selected ones
  // before the first Roll), so this is safe to call on every toggle.
  protected togglePartySelected(partyId: string, checked: boolean): void {
    const partyIds = checked
      ? [...this.selectedPartyIds(), partyId]
      : this.selectedPartyIds().filter((id) => id !== partyId);
    this.selectedPartyIds.set(partyIds);
    const encounterId = this.ensureEncounterCreated();
    this.encounterStore.setEncounterParties(encounterId, partyIds);
  }

  protected toggleTroopSelected(troopId: string, checked: boolean): void {
    const troopIds = checked
      ? [...this.selectedTroopIds(), troopId]
      : this.selectedTroopIds().filter((id) => id !== troopId);
    this.selectedTroopIds.set(troopIds);
    const encounterId = this.ensureEncounterCreated();
    this.encounterStore.setEncounterTroops(encounterId, troopIds);
  }

  // Opens the panel blank, for a genuinely new Encounter — nothing is
  // created in the store yet (see ensureEncounterCreated()).
  protected startCreate(): void {
    this.editingEncounterId.set(null);
    this.newEncounterName.set('');
    this.selectedPartyIds.set([]);
    this.selectedTroopIds.set([]);
    this.generatorDraft.set([]);
    this.builderOpen.set(true);
  }

  // Pre-populates the create form with an existing Encounter's name and
  // Party/Troop selection so it doubles as the edit form — name/Party/Troop
  // edits from here apply immediately (see onEncounterNameChange/
  // togglePartySelected/toggleTroopSelected), same as any other change.
  protected startEdit(encounter: Encounter): void {
    this.editingEncounterId.set(encounter.id);
    this.newEncounterName.set(encounter.name);
    this.selectedPartyIds.set([...encounter.partyIds]);
    this.selectedTroopIds.set([...encounter.troopIds]);
    this.generatorDraft.set([]);
    this.builderOpen.set(true);
  }

  // Closes the panel back onto the Saved Encounters list — there's nothing
  // left to "cancel" (every change in this panel already applies live), so
  // this is just "I'm done," same as closing any other already-saved
  // editor.
  protected closePanel(): void {
    this.editingEncounterId.set(null);
    this.newEncounterName.set('');
    this.selectedPartyIds.set([]);
    this.selectedTroopIds.set([]);
    this.generatorDraft.set([]);
    this.builderOpen.set(false);
  }

  // Creates this panel's Encounter on first real commitment — a Party/Troop
  // check, an Add All/individual "Add to Encounter", or any Add Combatant
  // pick. Reuses the same id for the rest of this panel session once
  // materialized. A brand-new Encounter is deliberately NOT created the
  // instant the panel opens — only once the GM actually adds something
  // real, so an abandoned "+ Create Encounter" click never leaves a stub
  // behind (see docs/PRODUCT.md section 2).
  private ensureEncounterCreated(): string {
    const existing = this.editingEncounterId();
    if (existing) return existing;
    const encounter = this.encounterStore.createEncounter(
      this.newEncounterName().trim() || 'Untitled Encounter',
      this.selectedPartyIds(),
      this.selectedTroopIds(),
    );
    this.editingEncounterId.set(encounter.id);
    return encounter.id;
  }

  // Live-typed name shown in Encounter Preview's heading and in the
  // Add-to-Encounter button/toast wording — deliberately the in-progress
  // newEncounterName signal, not editingEncounter()?.name: this Encounter
  // may not be materialized yet (nothing typed here creates one on its
  // own), and even once it is, onEncounterNameChange below only pushes a
  // non-blank name to the store, so the local signal is the source of
  // truth for what the GM is currently seeing either way.
  protected encounterNameForDisplay(): string {
    return this.newEncounterName().trim() || 'Untitled Encounter';
  }

  // Typing a name applies immediately once this Encounter already exists —
  // no separate "Update Encounter" submit to wait for. A blank name doesn't
  // rename the store's copy (leaves whatever it already is, e.g. "Untitled
  // Encounter") rather than flickering the real Encounter's name to blank
  // while the GM is mid-edit (e.g. selecting-all to retype); it also
  // doesn't materialize an Encounter on its own — typing a name alone still
  // isn't a "real" commitment (see docs/PRODUCT.md section 2).
  protected onEncounterNameChange(name: string): void {
    this.newEncounterName.set(name);
    const encounterId = this.editingEncounterId();
    const trimmed = name.trim();
    if (encounterId && trimmed) this.encounterStore.renameEncounter(encounterId, trimmed);
  }

  // The Add All/individual Add-to-Encounter phrase (passed to
  // MonsterGeneratorPanel as encounterName, used verbatim there without
  // appending anything further) — avoids "Untitled Encounter Encounter"
  // once the default placeholder name already ends with the word.
  protected encounterCommitPhrase(): string {
    const name = this.encounterNameForDisplay();
    return /\bencounter$/i.test(name) ? name : `${name} Encounter`;
  }

  private addDraftAsCombatant(encounterId: string, d: DraftCombatant): void {
    const name = d.personalName.trim() || d.template.name;
    this.encounterStore.addAdHocCombatant(encounterId, 'npc', {
      name,
      initiativeModifier: d.template.initiativeModifier,
      ac: d.template.ac,
      maxHp: d.template.maxHp,
      notes: '',
      monsterTemplateId: d.template.id,
      monsterName: d.template.name,
    });
  }

  protected onAddAllToEncounter(entries: DraftCombatant[]): void {
    const encounterId = this.ensureEncounterCreated();
    for (const d of entries) this.addDraftAsCombatant(encounterId, d);
    this.toastService.show(`Added to ${this.encounterCommitPhrase()}`);
  }

  protected onAddOneToEncounter(d: DraftCombatant): void {
    const encounterId = this.ensureEncounterCreated();
    this.addDraftAsCombatant(encounterId, d);
    const name = d.personalName.trim() || d.template.name;
    this.toastService.show(`${name} added to ${this.encounterCommitPhrase()}`);
  }

  // Adding/removing combatants applies immediately (like the setup screen on
  // encounter-detail) — everything in this panel does now, there's no
  // staged state waiting on a submit button anymore.
  private addIndividualPlayerToEditingEncounter(playerId: string): void {
    if (!playerId) return;
    const encounterId = this.ensureEncounterCreated();
    this.encounterStore.addPlayerCombatant(encounterId, playerId);
  }

  private addIndividualNpcToEditingEncounter(npcId: string): void {
    if (!npcId) return;
    const encounterId = this.ensureEncounterCreated();
    this.encounterStore.addNpcCombatant(encounterId, npcId);
  }

  protected deleteEncounter(id: string, name: string): void {
    if (confirm(`Delete "${name}"?`)) {
      if (this.editingEncounterId() === id) this.closePanel();
      this.encounterStore.deleteEncounter(id);
    }
  }
}
