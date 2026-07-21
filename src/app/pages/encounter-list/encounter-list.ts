import { Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Combatant, Encounter } from '../../models/encounter.model';
import { EncounterStore, computeDisplayNames } from '../../services/encounter-store';
import { NpcStore } from '../../services/npc-store';
import { PartyStore } from '../../services/party-store';
import {
  AddCombatantDialog,
  NewCombatantSubmitted,
} from '../../shared/add-combatant-dialog/add-combatant-dialog';
import { CombatantFields } from '../../shared/combatant-fields/combatant-fields';
import { MonsterCredits } from '../../shared/monster-credits/monster-credits';
import {
  DraftCombatant,
  MonsterGeneratorPanel,
} from '../../shared/monster-generator-panel/monster-generator-panel';

@Component({
  selector: 'app-encounter-list',
  imports: [
    FormsModule,
    RouterLink,
    CombatantFields,
    AddCombatantDialog,
    MonsterGeneratorPanel,
    MonsterCredits,
  ],
  templateUrl: './encounter-list.html',
  styleUrl: './encounter-list.css',
})
export class EncounterList {
  protected readonly encounterStore = inject(EncounterStore);
  protected readonly partyStore = inject(PartyStore);
  protected readonly npcStore = inject(NpcStore);
  private readonly router = inject(Router);

  // Gates the whole create/edit panel — collapsed by default, showing just
  // a "+ Create Encounter" button. Both startCreate() and startEdit() open
  // it; cancelEdit() closes it. Kept separate from editingEncounterId below
  // since the panel can be open with no Encounter created yet at all (a
  // fresh, not-yet-materialized create — see ensureEncounterCreated()).
  protected readonly builderOpen = signal(false);

  protected readonly newEncounterName = signal('');
  protected readonly selectedPartyIds = signal<string[]>([]);
  protected readonly selectedTroopIds = signal<string[]>([]);

  // The embedded Encounter Generator's working roster (see
  // MonsterGeneratorPanel) — live-synced to real Combatants by the
  // reconciliation effect below as the GM builds it (Generate, Browse
  // Monster List's Add, the +/- adjusters, Roster's remove/rename all flow
  // through this same signal), rather than requiring a separate "commit"
  // step the way the standalone Encounter Generator page's "Save as Troop"
  // does.
  protected readonly generatorDraft = signal<DraftCombatant[]>([]);

  // Tracks which draft entries (by DraftCombatant.localId) have already
  // been promoted to a real Combatant, and that Combatant's last-known
  // name — lets the reconciliation effect tell "new," "unchanged," and
  // "renamed" apart without re-deriving it from the store every run. Plain
  // mutable field, not a signal: pure internal bookkeeping the template
  // never reads, and mutating it must NOT retrigger the effect that owns
  // it (a signal here would create a feedback loop).
  private readonly generatorCombatantLinks = new Map<
    string,
    { combatantId: string; lastName: string }
  >();

  // Non-null once this panel's Encounter actually exists in the store —
  // either a pre-existing Encounter being edited (startEdit), or one
  // materialized mid-session by ensureEncounterCreated() the first time the
  // GM commits something real (a generated roster, an Add Combatant pick)
  // before ever reaching the bottom submit button. Drives both the submit
  // button's label ("Update Encounter" vs. "Create Encounter") and whether
  // the Combatants list has anything to show.
  protected readonly editingEncounterId = signal<string | null>(null);

  protected readonly editingEncounter = computed(() => {
    const id = this.editingEncounterId();
    return id ? this.encounterStore.getEncounter(id) : null;
  });

  constructor() {
    // Keeps generatorDraft's contents live-synced to real Combatants —
    // the "+ Add These to Encounter" button this replaced required the GM
    // to remember an extra click after already reviewing/naming the
    // roster; this way whatever's in the draft (from Generate, Browse
    // Monster List's Add, the +/- count adjusters, or a Roster rename/
    // remove) is always already reflected in the Combatants section below
    // it. Materializes the Encounter on first use via
    // ensureEncounterCreated(), same as any other first commit.
    effect(() => {
      const draft = this.generatorDraft();
      const currentLocalIds = new Set(draft.map((d) => d.localId));

      for (const [localId, link] of [...this.generatorCombatantLinks]) {
        if (currentLocalIds.has(localId)) continue;
        const encounterId = this.editingEncounterId();
        if (encounterId) this.encounterStore.removeCombatant(encounterId, link.combatantId);
        this.generatorCombatantLinks.delete(localId);
      }

      for (const d of draft) {
        const name = d.personalName.trim() || d.template.name;
        const existing = this.generatorCombatantLinks.get(d.localId);
        if (!existing) {
          const encounterId = this.ensureEncounterCreated();
          const combatant = this.encounterStore.addAdHocCombatant(encounterId, 'npc', {
            name,
            initiativeModifier: d.template.initiativeModifier,
            ac: d.template.ac,
            maxHp: d.template.maxHp,
            notes: '',
            monsterTemplateId: d.template.id,
            monsterName: d.template.name,
          });
          this.generatorCombatantLinks.set(d.localId, {
            combatantId: combatant.id,
            lastName: name,
          });
        } else if (existing.lastName !== name) {
          const encounterId = this.editingEncounterId();
          if (encounterId) {
            this.encounterStore.updateCombatantDetails(encounterId, existing.combatantId, { name });
            existing.lastName = name;
          }
        }
      }
    });
  }

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

  // Opens the panel blank, for a genuinely new Encounter — nothing is
  // created in the store yet (see ensureEncounterCreated()).
  protected startCreate(): void {
    this.editingEncounterId.set(null);
    this.newEncounterName.set('');
    this.selectedPartyIds.set([]);
    this.selectedTroopIds.set([]);
    this.generatorDraft.set([]);
    this.generatorCombatantLinks.clear();
    this.builderOpen.set(true);
  }

  // Pre-populates the create form with an existing Encounter's name and
  // Party/Troop selection so it doubles as the edit form — see
  // submitEncounterForm for what happens to those values on submit.
  protected startEdit(encounter: Encounter): void {
    this.editingEncounterId.set(encounter.id);
    this.newEncounterName.set(encounter.name);
    this.selectedPartyIds.set([...encounter.partyIds]);
    this.selectedTroopIds.set([...encounter.troopIds]);
    this.generatorDraft.set([]);
    this.generatorCombatantLinks.clear();
    this.builderOpen.set(true);
  }

  protected cancelEdit(): void {
    this.editingEncounterId.set(null);
    this.newEncounterName.set('');
    this.selectedPartyIds.set([]);
    this.selectedTroopIds.set([]);
    this.generatorDraft.set([]);
    this.generatorCombatantLinks.clear();
    this.builderOpen.set(false);
  }

  // Creates this panel's Encounter on first real commitment — either the
  // bottom submit button, or committing something before ever reaching it
  // (a generated roster via commitGeneratorDraftToEncounter, or any Add
  // Combatant pick). Reuses the same id for the rest of this panel session
  // once materialized. A brand-new Encounter is deliberately NOT created
  // the instant the panel opens — only once the GM actually adds something
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

  protected submitEncounterForm(): void {
    const name = this.newEncounterName().trim();
    const editingId = this.editingEncounterId();
    if (editingId) {
      // Already materialized — either a pre-existing Encounter being
      // edited, or one created mid-session above. A blank name here just
      // means "keep the current name" rather than no-opping the whole
      // submit (which would otherwise leave the GM stuck on an
      // unresponsive button once materialization can happen before this
      // is ever clicked).
      if (name) this.encounterStore.renameEncounter(editingId, name);
      this.encounterStore.setEncounterParties(editingId, this.selectedPartyIds());
      this.encounterStore.setEncounterTroops(editingId, this.selectedTroopIds());
      this.cancelEdit();
      return;
    }

    if (!name) return;
    const encounter = this.encounterStore.createEncounter(
      name,
      this.selectedPartyIds(),
      this.selectedTroopIds(),
    );
    this.newEncounterName.set('');
    this.selectedPartyIds.set([]);
    this.selectedTroopIds.set([]);
    this.generatorDraft.set([]);
    this.builderOpen.set(false);
    // Straight into the setup/run screen for the encounter just created —
    // only for this genuinely-fresh path; the editingId branch above stays
    // on the list, since the GM may still be refining combatants there.
    this.router.navigate(['/encounters', encounter.id]);
  }

  // Adding/removing combatants applies immediately (like the setup screen on
  // encounter-detail) rather than waiting for Update Encounter — only the
  // name and Party/Troop selection are staged until submit.
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

  // Same Set-of-ids "Save to Roster" pattern as EncounterDetail — see that
  // component for the full rationale.
  protected readonly savingToRosterIds = signal<ReadonlySet<string>>(new Set());
  private readonly saveToRosterSelections = signal<ReadonlyMap<string, ReadonlySet<string>>>(
    new Map(),
  );

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

  protected toggleGroupSelectedForSave(
    combatantId: string,
    groupId: string,
    checked: boolean,
  ): void {
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
    // A monster-templated combatant (type 'npc' only — see AddCombatantDialog's
    // From Book flow) keeps its stat-block link when saved to the roster,
    // rather than that being silently dropped.
    const linkedId =
      combatant.type === 'pc'
        ? this.partyStore.createPlayer(fields).id
        : this.npcStore.createNpc({
            ...fields,
            monsterTemplateId: combatant.monsterTemplateId,
            monsterName: combatant.monsterName,
          }).id;
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

  protected setCombatantModifierInEditingEncounter(
    combatantId: string,
    initiativeModifier: number,
  ): void {
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
