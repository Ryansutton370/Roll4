import { Component, computed, inject, input, signal, viewChild } from '@angular/core';
import { Combatant } from '../../models/encounter.model';
import { InitiativeAdvantageState } from '../../models/initiative-advantage.model';
import { EncounterStore, computeDisplayNames } from '../../services/encounter-store';
import { NpcStore } from '../../services/npc-store';
import { PartyStore } from '../../services/party-store';
import { CombatantBubble } from '../../pages/encounter-detail/combatant-bubble';
import { CombatantDetailsChanges, EditCombatantDialog } from '../edit-combatant-dialog/edit-combatant-dialog';
import { MonsterStore } from '../../services/monster-store';
import { MonsterStatBlockDialog } from '../monster-stat-block-dialog/monster-stat-block-dialog';
import { NotesDialog } from '../notes-dialog/notes-dialog';

/**
 * The New Encounter builder's live preview of what's actually been added so
 * far — split out of EncounterList (see docs/ARCHITECTURE.md's CombatantBubble
 * precedent: same "template growing unwieldy" justification, one level up)
 * once its drawer/dialog wiring needed to fully match the run-phase screen.
 * Deliberately self-contained like MonsterGeneratorPanel — injects its own
 * stores rather than having every piece of state passed down — so the host
 * only needs to hand it an encounterId.
 */
@Component({
  selector: 'app-encounter-preview-panel',
  imports: [CombatantBubble, EditCombatantDialog, MonsterStatBlockDialog, NotesDialog],
  templateUrl: './encounter-preview-panel.html',
  styleUrl: './encounter-preview-panel.css',
})
export class EncounterPreviewPanel {
  protected readonly encounterStore = inject(EncounterStore);
  private readonly partyStore = inject(PartyStore);
  private readonly npcStore = inject(NpcStore);
  private readonly monsterStore = inject(MonsterStore);

  /** Null before the Encounter being built is materialized in the store (see EncounterList.ensureEncounterCreated) — renders the empty state until then. */
  readonly encounterId = input<string | null>(null);
  readonly encounterName = input('Untitled Encounter');

  // Party members first, ad-hoc NPCs after — same stable-sort convention
  // EncounterList's old inline list used.
  protected readonly combatants = computed(() => {
    const id = this.encounterId();
    if (!id) return [];
    return [...this.encounterStore.combatantsForEncounter(id)].sort((a, b) =>
      a.type === b.type ? 0 : a.type === 'pc' ? -1 : 1,
    );
  });

  // "Goblin"/"Goblin" -> "Goblin A"/"Goblin B" — same displayNames/
  // displayName pair as EncounterDetail; see computeDisplayNames' own doc
  // comment for why this needs creation order specifically.
  protected readonly displayNames = computed(() => {
    const id = this.encounterId();
    return id
      ? computeDisplayNames(this.encounterStore.combatantsForEncounterInCreationOrder(id))
      : new Map<string, string>();
  });

  protected displayName(combatantId: string): string {
    return this.displayNames().get(combatantId) ?? '';
  }

  // Which bubbles currently have their drawer open — same Set-of-ids
  // pattern as EncounterDetail.expandedCombatantIds.
  protected readonly expandedCombatantIds = signal<ReadonlySet<string>>(new Set());

  protected isExpanded(combatantId: string): boolean {
    return this.expandedCombatantIds().has(combatantId);
  }

  protected toggleExpanded(combatantId: string): void {
    this.expandedCombatantIds.update((ids) => {
      const next = new Set(ids);
      next.has(combatantId) ? next.delete(combatantId) : next.add(combatantId);
      return next;
    });
  }

  // Raises a bubble's <li> above its siblings while its HP delta popover is
  // open — same fix/rationale as EncounterDetail.popoverOpenIds (a bubble's
  // own permanent pop-in animation creates a stacking context that
  // otherwise traps the popover's z-index inside just that one bubble).
  // Shared by all three of CombatantBubble's popovers (HP/AC/Initiative)
  // via its single popoverOpenChange output.
  protected readonly popoverOpenIds = signal<ReadonlySet<string>>(new Set());

  protected isPopoverOpen(combatantId: string): boolean {
    return this.popoverOpenIds().has(combatantId);
  }

  protected setPopoverOpen(combatantId: string, open: boolean): void {
    this.popoverOpenIds.update((ids) => {
      const next = new Set(ids);
      open ? next.add(combatantId) : next.delete(combatantId);
      return next;
    });
  }

  private readonly editDialog = viewChild.required<EditCombatantDialog>('editDialog');
  private readonly statBlockDialog = viewChild.required<MonsterStatBlockDialog>('statBlockDialog');
  private readonly notesDialog = viewChild.required<NotesDialog>('notesDialog');

  protected openEditDialog(combatant: Combatant): void {
    this.editDialog().openFor(combatant, this.displayName(combatant.id));
  }

  protected onEditSave(event: { combatantId: string; changes: CombatantDetailsChanges }): void {
    const id = this.encounterId();
    if (!id) return;
    this.encounterStore.updateCombatantDetails(id, event.combatantId, event.changes);
  }

  protected openStatBlockDialog(combatant: Combatant): void {
    const templateId = combatant.monsterTemplateId;
    if (!templateId) return;
    const template = this.monsterStore.getTemplate(templateId);
    if (!template) return;
    this.statBlockDialog().openFor(template);
  }

  protected openNotesDialog(combatant: Combatant): void {
    this.notesDialog().openFor(combatant, this.displayName(combatant.id));
  }

  protected onNotesSaved(event: { combatantId: string; notes: string }): void {
    const id = this.encounterId();
    if (!id) return;
    this.encounterStore.updateCombatantDetails(id, event.combatantId, { notes: event.notes });
  }

  protected onHpAdjustSubmit(combatantId: string, delta: number): void {
    const id = this.encounterId();
    if (!id) return;
    this.encounterStore.adjustCurrentHp(id, combatantId, delta);
  }

  protected onTempHpSubmit(combatantId: string, amount: number): void {
    const id = this.encounterId();
    if (!id) return;
    this.encounterStore.setTempHp(id, combatantId, amount);
  }

  protected onTempHpClear(combatantId: string): void {
    const id = this.encounterId();
    if (!id) return;
    this.encounterStore.clearTempHp(id, combatantId);
  }

  protected onAcBonusSubmit(combatantId: string, amount: number): void {
    const id = this.encounterId();
    if (!id) return;
    this.encounterStore.setBonusAc(id, combatantId, amount);
  }

  protected onAcBonusClear(combatantId: string): void {
    const id = this.encounterId();
    if (!id) return;
    this.encounterStore.clearBonusAc(id, combatantId);
  }

  protected onInitiativeAdvantageChange(
    combatantId: string,
    state: InitiativeAdvantageState,
  ): void {
    const id = this.encounterId();
    if (!id) return;
    this.encounterStore.setInitiativeAdvantage(id, combatantId, state);
  }

  // The drawer's relabeled "Mark Absent" (Player) — same underlying flag/
  // behavior as run-phase Removed from Combat (see CombatantBubble.previewMode).
  protected toggleMarkAbsent(combatantId: string): void {
    const id = this.encounterId();
    if (!id) return;
    this.encounterStore.toggleRemoved(id, combatantId);
  }

  // The drawer's Delete button (NPC only, previewMode) — pre-Roll only,
  // same EncounterStore.removeCombatant guard the run-phase screen already
  // relies on (a no-op once activeCombatantIndex is set, which can't be the
  // case here since this panel only exists before the first Roll).
  protected deleteCombatant(combatantId: string): void {
    const id = this.encounterId();
    if (!id) return;
    this.encounterStore.removeCombatant(id, combatantId);
  }

  // "Save to Roster" — same Set-of-ids pattern as EncounterDetail/the old
  // EncounterList inline list, ported essentially unchanged.
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

  protected readonly parties = computed(() => this.partyStore.parties());
  protected readonly troops = computed(() => this.npcStore.troops());

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
    const encounterId = this.encounterId();
    if (!encounterId) return;
    const groupIds = [...(this.saveToRosterSelections().get(combatant.id) ?? [])];
    const fields = {
      name: combatant.name,
      initiativeModifier: combatant.initiativeModifier,
      ac: combatant.ac,
      maxHp: combatant.maxHp,
      notes: combatant.notes,
      initiativeAdvantage: combatant.initiativeAdvantage,
    };
    // A monster-templated combatant (type 'npc' only) keeps its stat-block
    // link when saved to the roster, rather than that being silently
    // dropped — same as EncounterDetail's confirmSaveToRoster.
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
}
