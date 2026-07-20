import { Component, HostListener, computed, inject, input, signal, viewChild } from '@angular/core';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Combatant, CombatantType } from '../../models/encounter.model';
import { EncounterStore } from '../../services/encounter-store';
import { NpcStore } from '../../services/npc-store';
import { PartyStore } from '../../services/party-store';
import { CombatantFields } from '../../shared/combatant-fields/combatant-fields';
import {
  CombatantDetailsChanges,
  EditCombatantDialog,
} from '../../shared/edit-combatant-dialog/edit-combatant-dialog';
import { CombatantBubble } from './combatant-bubble';

@Component({
  selector: 'app-encounter-detail',
  imports: [FormsModule, RouterLink, DragDropModule, CombatantBubble, CombatantFields, EditCombatantDialog],
  templateUrl: './encounter-detail.html',
  styleUrl: './encounter-detail.css',
})
export class EncounterDetail {
  protected readonly encounterStore = inject(EncounterStore);
  protected readonly partyStore = inject(PartyStore);
  protected readonly npcStore = inject(NpcStore);

  // Auto-populated from the ':encounterId' route segment — see
  // withComponentInputBinding() in app.config.ts.
  readonly encounterId = input.required<string>();

  protected readonly encounter = computed(() => this.encounterStore.getEncounter(this.encounterId()));
  protected readonly combatants = computed(() =>
    this.encounterStore.combatantsForEncounter(this.encounterId()),
  );

  // Party members always shown first, ad-hoc NPCs after — same ordering as
  // EncounterList's editing form. Only used by the setup-phase list below:
  // combatants() itself has to stay in encounter.combatantIds order, since
  // activeCombatantIndex/mainCombatants/heldCombatants all index into it.
  protected readonly setupCombatants = computed(() =>
    [...this.combatants()].sort((a, b) => (a.type === b.type ? 0 : a.type === 'pc' ? -1 : 1)),
  );

  // This one computed signal drives which of the two views (setup vs. run)
  // the template shows — see docs/DATA_MODEL.md: activeCombatantIndex is
  // null exactly until the first Roll.
  protected readonly hasStarted = computed(() => {
    const e = this.encounter();
    return !!e && e.activeCombatantIndex !== null;
  });

  // The combatant bubbles shown in the main list — everyone holding their
  // action is pulled out into the secondary Hold Action list below, and
  // everyone Removed from Combat is pulled out into the Removed From Combat
  // table further down the page.
  protected readonly mainCombatants = computed(() =>
    this.combatants().filter((c) => !c.onHold && !c.removedFromCombat),
  );

  // Removed From Combat table, shown below the turn controls. Kept in
  // combatants() order (already sunk to the bottom by the store — see
  // EncounterStore.toggleRemoved) rather than re-sorted here.
  protected readonly removedCombatants = computed(() =>
    this.combatants().filter((c) => c.removedFromCombat),
  );

  // The secondary Hold Action list, in the order combatants started holding
  // (Encounter.holdOrder) rather than initiative order.
  protected readonly heldCombatants = computed(() => {
    const e = this.encounter();
    if (!e) return [];
    const byId = new Map(this.combatants().map((c) => [c.id, c]));
    return e.holdOrder.map((id) => byId.get(id)).filter((c): c is Combatant => !!c);
  });

  // Looked up by id, not index — mainCombatants/heldCombatants are filtered/
  // reordered views of combatants(), so activeCombatantIndex (which indexes
  // the latter) can't be reused directly as a position in either.
  protected readonly activeCombatantId = computed(() => {
    const e = this.encounter();
    if (!e || e.activeCombatantIndex === null) return null;
    return this.combatants()[e.activeCombatantIndex]?.id ?? null;
  });

  // Eligible (not removed, not on hold) combatant indices, in turn order —
  // shared by isFirstActiveCombatant/isFinalActiveCombatant below, and
  // mirrors the activeIndices lookup in EncounterStore.advanceTurn, since
  // that's what actually decides where Back/Forward can move.
  private readonly activeIndices = computed(() =>
    this.combatants().reduce<number[]>((acc, c, i) => {
      if (!c.removedFromCombat && !c.onHold) acc.push(i);
      return acc;
    }, []),
  );

  // True when the Active combatant is the first eligible one in turn order —
  // Back can't move earlier than this without crossing a round boundary
  // (Phase 1: not supported yet, see EncounterStore.advanceTurn), so the
  // button is disabled instead of silently no-op'ing.
  protected readonly isFirstActiveCombatant = computed(() => {
    const e = this.encounter();
    if (!e || e.activeCombatantIndex === null) return false;
    const indices = this.activeIndices();
    if (indices.length === 0) return false;
    return indices[0] === e.activeCombatantIndex;
  });

  // True when the Active combatant is the last eligible one in turn order —
  // this is what decides whether Forward starts a new round instead of just
  // moving to the next combatant.
  protected readonly isFinalActiveCombatant = computed(() => {
    const e = this.encounter();
    if (!e || e.activeCombatantIndex === null) return false;
    const indices = this.activeIndices();
    if (indices.length === 0) return false;
    return indices[indices.length - 1] === e.activeCombatantIndex;
  });

  protected readonly newAdHocType = signal<CombatantType>('npc');
  protected readonly newNpcName = signal('');
  protected readonly newNpcModifier = signal(0);
  protected readonly newNpcAc = signal<number | null>(null);
  protected readonly newNpcMaxHp = signal<number | null>(null);
  protected readonly newNpcNotes = signal('');

  // Roster entries not yet in this Encounter — feeds the "Add from Roster"
  // pickers below so they never offer a no-op add (the id is already
  // filtered out once it's pulled in).
  protected readonly availablePlayersToAdd = computed(() => {
    const presentIds = new Set(this.combatants().map((c) => c.playerId));
    return this.partyStore.players().filter((p) => !presentIds.has(p.id));
  });
  protected readonly availableNpcsToAdd = computed(() => {
    const presentIds = new Set(this.combatants().map((c) => c.npcId));
    return this.npcStore.npcs().filter((n) => !presentIds.has(n.id));
  });

  // viewChild(): the signal-based handle on the <app-edit-combatant-dialog
  // #editDialog> instance in this component's own template — used to call
  // its openFor() method imperatively from openEditDialog() below.
  private readonly editDialog = viewChild.required<EditCombatantDialog>('editDialog');

  // Which combatant bubbles currently have their Removed/Hold-Action
  // drawer open. A Set (not a single id) because more than one bubble can
  // be expanded at once. Kept as component-local UI state rather than on
  // the Combatant model itself — it's purely presentational and shouldn't
  // be persisted.
  protected readonly expandedCombatantIds = signal<ReadonlySet<string>>(new Set());

  protected isExpanded(combatantId: string): boolean {
    return this.expandedCombatantIds().has(combatantId);
  }

  protected toggleExpanded(combatantId: string): void {
    this.expandedCombatantIds.update((ids) => {
      const next = new Set(ids);
      if (next.has(combatantId)) {
        next.delete(combatantId);
      } else {
        next.add(combatantId);
      }
      return next;
    });
  }

  // Removed/Hold Action are rare-to-combine, one-off toggles — closing the
  // drawer as soon as either is chosen keeps the list compact. A GM who
  // does need both just reopens it via the chevron.
  private collapseExpanded(combatantId: string): void {
    this.expandedCombatantIds.update((ids) => {
      if (!ids.has(combatantId)) return ids;
      const next = new Set(ids);
      next.delete(combatantId);
      return next;
    });
  }

  protected addAdHocCombatant(): void {
    const name = this.newNpcName().trim();
    if (!name) return;
    this.encounterStore.addAdHocCombatant(this.encounterId(), this.newAdHocType(), {
      name,
      initiativeModifier: this.newNpcModifier(),
      ac: this.newNpcAc(),
      maxHp: this.newNpcMaxHp(),
      notes: this.newNpcNotes(),
    });
    this.newAdHocType.set('npc');
    this.newNpcName.set('');
    this.newNpcModifier.set(0);
    this.newNpcAc.set(null);
    this.newNpcMaxHp.set(null);
    this.newNpcNotes.set('');
  }

  protected addIndividualPlayer(playerId: string): void {
    if (!playerId) return;
    this.encounterStore.addPlayerCombatant(this.encounterId(), playerId);
  }

  protected addIndividualNpc(npcId: string): void {
    if (!npcId) return;
    this.encounterStore.addNpcCombatant(this.encounterId(), npcId);
  }

  // Which ad-hoc combatants currently have their "Save to Roster" picker
  // open — same Set-of-ids pattern as expandedCombatantIds/revealedHandleIds
  // above.
  protected readonly savingToRosterIds = signal<ReadonlySet<string>>(new Set());

  // Which Party/Troop checkboxes are currently checked in an open "Save to
  // Roster" picker, keyed by combatant id — cleared whenever that
  // combatant's picker closes (see toggleSavingToRoster).
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

  // Creates a library Player/Npc from an ad-hoc Combatant's own fields,
  // assigns it to whichever Parties/Troops were checked (can save
  // unattached), then links the *same* Combatant row to it — no second
  // Combatant is ever created, satisfying "save without duplicating the
  // entry in the encounter being built."
  protected confirmSaveToRoster(combatant: Combatant): void {
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
    this.encounterStore.linkCombatantToLibraryEntry(this.encounterId(), combatant.id, linkedId);
    this.toggleSavingToRoster(combatant.id);
  }

  protected openEditDialog(combatant: Combatant): void {
    this.editDialog().openFor(combatant);
  }

  protected onEditSave(event: { combatantId: string; changes: CombatantDetailsChanges }): void {
    this.encounterStore.updateCombatantDetails(this.encounterId(), event.combatantId, event.changes);
  }

  protected onHpAdjustSubmit(combatantId: string, delta: number): void {
    this.encounterStore.adjustCurrentHp(this.encounterId(), combatantId, delta);
  }

  protected removeCombatant(combatantId: string): void {
    this.encounterStore.removeCombatant(this.encounterId(), combatantId);
  }

  protected setCombatantModifier(combatantId: string, initiativeModifier: number): void {
    this.encounterStore.setInitiativeModifier(this.encounterId(), combatantId, initiativeModifier);
  }

  // Rolling implicitly commits whatever's still sitting in the ad-hoc
  // combatant fields — addAdHocCombatant() itself no-ops on a blank name,
  // so this is a plain "press Add first" rather than a special case.
  protected rollInitiative(): void {
    this.addAdHocCombatant();
    this.encounterStore.rollInitiative(this.encounterId());
  }

  protected advance(direction: 'forward' | 'back'): void {
    this.encounterStore.advanceTurn(this.encounterId(), direction);
  }

  protected toggleRemoved(combatantId: string): void {
    this.encounterStore.toggleRemoved(this.encounterId(), combatantId);
    this.collapseExpanded(combatantId);
  }

  protected toggleHoldAction(combatantId: string): void {
    this.encounterStore.toggleHoldAction(this.encounterId(), combatantId);
    this.collapseExpanded(combatantId);
  }

  protected toggleIncapacitated(combatantId: string): void {
    this.encounterStore.toggleIncapacitated(this.encounterId(), combatantId);
    this.collapseExpanded(combatantId);
  }

  // Dragging a main-list bubble by its handle to manually reorder it. This
  // cdkDropList is self-contained (no cdkDropListConnectedTo/group) — it
  // only reorders among its own mainCombatants() items, deliberately kept
  // separate from the Hold Action placement drop lists below so the two
  // drag interactions can never collide.
  protected onReorderDropped(event: CdkDragDrop<Combatant[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    const combatantId = this.mainCombatants()[event.previousIndex]?.id;
    if (!combatantId) return;
    this.encounterStore.reorderCombatant(this.encounterId(), combatantId, event.currentIndex);
  }

  // Which bubble has had its drag handle revealed by a tap/click — the
  // handle is hidden by default (see .drag-handle in encounter-detail.css)
  // and otherwise only shown on :hover/:focus-within, which have no touch
  // equivalent. A single nullable id (not a Set, unlike expandedCombatantIds
  // above) — only one bubble's handle should ever be tap-revealed at once,
  // and that makes "clicking a different bubble" naturally hide the
  // previous one just by overwriting this signal, rather than needing to
  // separately clear the old id every time a new one is set.
  protected readonly revealedHandleId = signal<string | null>(null);

  protected isHandleRevealed(combatantId: string): boolean {
    return this.revealedHandleId() === combatantId;
  }

  protected toggleHandleRevealed(combatantId: string): void {
    this.revealedHandleId.update((id) => (id === combatantId ? null : combatantId));
  }

  // Mirrors :hover's own natural behavior (gone as soon as the pointer
  // leaves) for the tap/click-revealed case above, which — being a signal,
  // not CSS — would otherwise keep the handle visible until something else
  // cleared it. Only clears if this bubble is the one currently revealed,
  // so a stray mouseleave from an unrelated bubble can't clobber it.
  protected collapseHandleRevealed(combatantId: string): void {
    if (this.revealedHandleId() === combatantId) {
      this.revealedHandleId.set(null);
    }
  }

  // @HostListener('document:click', ...): fires for a click ANYWHERE on the
  // page (not just this component's own elements) — same pattern as
  // CombatantBubble's collapseNotesOnClickAway. A click that lands inside
  // the currently-revealed bubble is either the tap that just set
  // revealedHandleId (toggleHandleRevealed above already ran, earlier in
  // the same bubbling click) or a click on the drag handle itself — either
  // way it shouldn't be collapsed out from under itself, hence the
  // data-combatant-id lookup instead of unconditionally clearing.
  @HostListener('document:click', ['$event'])
  protected collapseHandleOnClickAway(event: MouseEvent): void {
    const revealedId = this.revealedHandleId();
    if (!revealedId) return;
    const target = event.target as HTMLElement;
    if (!target.closest(`[data-combatant-id="${revealedId}"]`)) {
      this.revealedHandleId.set(null);
    }
  }

  // Which combatant's HP delta popover is currently open — needed here (not
  // just as local state inside CombatantBubble) purely for z-index: every
  // bubble's <li> has a permanent CSS `animation` on it (.main-combatant's
  // pop-in), and per spec that gives every bubble its own stacking context
  // for as long as the animation rule applies, not just while it's actually
  // playing. That means a popover's own z-index (set in
  // combatant-bubble.css) can never reach past its own <li> to outrank a
  // sibling bubble's content — the <li> itself has to be raised instead
  // (see .hp-adjusting in encounter-detail.css), and the <li> lives in this
  // component's template, so this component needs to know. Fed by
  // CombatantBubble's hpAdjustOpenChange output. Same Set-of-ids pattern as
  // expandedCombatantIds above, even though in practice only one popover is
  // ever open at a time — a Set costs nothing extra and needs no "what if
  // two GMs open two at once" caveat.
  protected readonly hpAdjustingIds = signal<ReadonlySet<string>>(new Set());

  protected isHpAdjusting(combatantId: string): boolean {
    return this.hpAdjustingIds().has(combatantId);
  }

  protected setHpAdjusting(combatantId: string, open: boolean): void {
    this.hpAdjustingIds.update((ids) => {
      const alreadyHas = ids.has(combatantId);
      if (open === alreadyHas) return ids;
      const next = new Set(ids);
      if (open) {
        next.add(combatantId);
      } else {
        next.delete(combatantId);
      }
      return next;
    });
  }

  // The Active combatant's current initiative total — the two placeholder
  // spots when placing a returning combatant sit at this ±1.
  protected readonly activeTotal = computed(() => {
    const activeId = this.activeCombatantId();
    return this.combatants().find((c) => c.id === activeId)?.initiativeTotal ?? 0;
  });

  // Non-null while a combatant is returning from Hold Action and the GM is
  // choosing where it lands (see docs/PRODUCT.md's Hold Action section).
  // Drives the two placeholder bubbles around Active, and — via isPlacing()
  // with no argument — locks every other control on the page until it
  // resolves, since this is meant to be a modal, one-thing-at-a-time choice.
  protected readonly placingCombatantId = signal<string | null>(null);

  protected isPlacing(combatantId?: string): boolean {
    return combatantId === undefined
      ? this.placingCombatantId() !== null
      : this.placingCombatantId() === combatantId;
  }

  // Combatant id + chosen spot currently playing the pop-out/pop-in
  // animation (see .held-bubble.popping-out in encounter-detail.css) — kept
  // separate from placingCombatantId so the placeholders disappear the
  // instant a spot is chosen, rather than lingering through the animation.
  protected readonly resolvingReturn = signal<{ id: string; position: 'above' | 'below' } | null>(
    null,
  );

  protected isResolving(combatantId: string): boolean {
    return this.resolvingReturn()?.id === combatantId;
  }

  // Opens placement mode instead of un-holding immediately — called from
  // both the held bubble's "return to main list" button and its Hold Action
  // checkbox. The GM picks above/below Active next, either by clicking a
  // placeholder (choosePlacement) or dragging this bubble onto one (wired
  // via cdkDrag/cdkDropList in the template).
  protected beginPlacement(combatantId: string): void {
    if (this.placingCombatantId() || this.resolvingReturn()) return; // one at a time
    this.placingCombatantId.set(combatantId);
  }

  // Must match the pop-out animation's duration in encounter-detail.css —
  // a plain timer, not (animationend), because the held bubble is a cdkDrag
  // element: mid-drop, CDK is busy running its own "snap back to origin"
  // transition on that same element, which can suppress or delay our CSS
  // animation firing animationend at all.
  private static readonly POP_ANIMATION_MS = 220;

  protected choosePlacement(position: 'above' | 'below'): void {
    const combatantId = this.placingCombatantId();
    if (!combatantId) return;
    this.placingCombatantId.set(null);
    this.resolvingReturn.set({ id: combatantId, position });
    setTimeout(() => this.finishReturnFromHold(combatantId), EncounterDetail.POP_ANIMATION_MS);
  }

  // Actually moves the combatant to its chosen spot once the pop-out has had
  // time to play (see choosePlacement's setTimeout above).
  private finishReturnFromHold(combatantId: string): void {
    const resolving = this.resolvingReturn();
    if (!resolving || resolving.id !== combatantId) return;
    this.encounterStore.returnFromHold(this.encounterId(), combatantId, resolving.position);
    this.resolvingReturn.set(null);
  }

  protected setReRollEachRound(reRollEachRound: boolean): void {
    this.encounterStore.setReRollEachRound(this.encounterId(), reRollEachRound);
  }
}
