import {
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Combatant, Timer } from '../../models/encounter.model';
import { EncounterStore, computeDisplayNames } from '../../services/encounter-store';
import { NpcStore } from '../../services/npc-store';
import { PartyStore } from '../../services/party-store';
import { AddCombatantDialog, NewCombatantSubmitted } from '../../shared/add-combatant-dialog/add-combatant-dialog';
import {
  CombatantDetailsChanges,
  EditCombatantDialog,
} from '../../shared/edit-combatant-dialog/edit-combatant-dialog';
import { CombatantBubble } from './combatant-bubble';

@Component({
  selector: 'app-encounter-detail',
  imports: [
    FormsModule,
    RouterLink,
    DragDropModule,
    NgTemplateOutlet,
    CombatantBubble,
    EditCombatantDialog,
    AddCombatantDialog,
  ],
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

  // "Goblin"/"Goblin" -> "Goblin A"/"Goblin B" — keyed by creation order
  // (combatantsForEncounterInCreationOrder), not the initiative order
  // combatants() above uses, so a re-roll/manual-reorder/hold-return never
  // relabels who's "A" vs "B" — see computeDisplayNames' own doc comment.
  protected readonly displayNames = computed(() =>
    computeDisplayNames(this.encounterStore.combatantsForEncounterInCreationOrder(this.encounterId())),
  );

  protected displayName(combatantId: string): string {
    return this.displayNames().get(combatantId) ?? '';
  }

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
  // action is pulled out into the secondary Hold Action list below, everyone
  // Removed from Combat is pulled out into the Removed From Combat table
  // further down the page, and everyone Ready to Join (added mid-encounter,
  // not yet rolled in) is pulled out into its own list — see readyToJoinCombatants.
  protected readonly mainCombatants = computed(() =>
    this.combatants().filter((c) => !c.onHold && !c.removedFromCombat && !c.readyToJoin),
  );

  // Ready to Join list, shown between the turn controls and the Removed From
  // Combat table — added mid-encounter via the "+" menu, not yet in turn
  // order. Clicking one joins it in (EncounterStore.joinReadyToJoinCombatant);
  // left un-joined, it folds into the main list automatically at the next
  // round boundary (see reRollRound/foldInReadyToJoin in encounter-store.ts).
  protected readonly readyToJoinCombatants = computed(() =>
    this.combatants().filter((c) => c.readyToJoin),
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
      if (!c.removedFromCombat && !c.onHold && !c.readyToJoin) acc.push(i);
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

  // Roster entries not yet in this Encounter — fed into AddCombatantDialog
  // so it never offers a no-op add (the id is already filtered out once
  // it's pulled in).
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

  // Same pattern for the "Add Combatant" flow — one shared dialog instance
  // used by both the setup-phase button and the run-phase "+" menu (see
  // openAddCombatantDialog below), instead of two separate always-visible
  // inline forms like this page used to have.
  private readonly addCombatantDialog = viewChild.required<AddCombatantDialog>('addCombatantDialog');

  protected openAddCombatantDialog(): void {
    this.closeAddMenu();
    this.addCombatantDialog().open();
  }

  // readyToJoin is decided here, not passed in from the template: the
  // setup-phase button and the run-phase "+" menu share this one dialog and
  // these same three handlers, and hasStarted() alone already tells them
  // apart — true only once the run phase's controls even exist to open it.
  protected onExistingPlayerChosen(playerId: string): void {
    this.encounterStore.addPlayerCombatant(this.encounterId(), playerId, this.hasStarted());
  }

  protected onExistingNpcChosen(npcId: string): void {
    this.encounterStore.addNpcCombatant(this.encounterId(), npcId, this.hasStarted());
  }

  protected onNewCombatantSubmitted(event: NewCombatantSubmitted): void {
    this.encounterStore.addAdHocCombatant(this.encounterId(), event.type, event.fields, this.hasStarted());
  }

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

  /** Manually joining a Ready to Join combatant — see joinReadyToJoinCombatant's own doc comment. */
  protected joinCombatant(combatantId: string): void {
    this.encounterStore.joinReadyToJoinCombatant(this.encounterId(), combatantId);
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
    this.editDialog().openFor(combatant, this.displayName(combatant.id));
  }

  // The drawer's "Create Timer" button — instant creation with a default
  // name/value (same starting value as the regular Add Timer form's
  // newTimerValue below), rather than an inline sub-form. The drawer stays
  // open afterward so the GM sees the new card land in the rail right away.
  protected requestCreateTimer(combatant: Combatant): void {
    this.encounterStore.createTimer(this.encounterId(), `${combatant.name}'s Timer`, 3, combatant.id);
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

  // Setup-phase list's read-only HP bar — same percent/hue math as
  // CombatantBubble.hpPercent()/hpHue() (combatant-bubble.ts), duplicated
  // for the same view-encapsulation reason as the icon markup itself (see
  // the comment above the setup list's stat icons in encounter-detail.html).
  protected setupHpPercent(c: Combatant): number {
    if (!c.maxHp) return 0;
    return Math.round(((c.currentHp ?? c.maxHp) / c.maxHp) * 100);
  }

  protected setupHpHue(c: Combatant): number {
    return Math.round(this.setupHpPercent(c) * 1.2);
  }

  // Which setup-list combatant currently has its Notes expanded — a single
  // nullable id (not a Set), same "only one at a time" pattern as
  // revealedHandleId above, collapsed via the same click-away listener
  // (see collapseHandleOnClickAway) rather than a second one.
  protected readonly revealedSetupNotesId = signal<string | null>(null);

  protected isSetupNotesRevealed(combatantId: string): boolean {
    return this.revealedSetupNotesId() === combatantId;
  }

  protected toggleSetupNotesRevealed(combatantId: string): void {
    this.revealedSetupNotesId.update((id) => (id === combatantId ? null : combatantId));
  }

  protected rollInitiative(): void {
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

  // Same click-away pattern as collapseHandleOnClickAway just above, for
  // the setup-phase list's Notes reveal (revealedSetupNotesId) — a separate
  // method (rather than folding into the one above) since the two features
  // are unrelated and each stays simpler read on its own.
  @HostListener('document:click', ['$event'])
  protected collapseSetupNotesOnClickAway(event: MouseEvent): void {
    const revealedId = this.revealedSetupNotesId();
    if (!revealedId) return;
    const target = event.target as HTMLElement;
    if (!target.closest(`[data-combatant-id="${revealedId}"]`)) {
      this.revealedSetupNotesId.set(null);
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

  // ---------------------------------------------------------------------
  // "+" menu — turn-controls button to the left of Previous/Next Turn.
  // 'timer' opens the inline "new timer" card in the rail (see
  // createTimer below); choosing Combatant instead opens AddCombatantDialog
  // directly (openAddCombatantDialog above) and never sets this to
  // 'combatant' — the dialog manages its own open/closed state.
  // ---------------------------------------------------------------------
  protected readonly addMenuMode = signal<'closed' | 'menu' | 'timer'>('closed');

  protected toggleAddMenu(): void {
    this.addMenuMode.update((mode) => (mode === 'closed' ? 'menu' : 'closed'));
  }

  protected chooseTimerMode(): void {
    this.addMenuMode.set('timer');
  }

  // viewChild(): only present in the DOM while the create-timer card is
  // showing (see the @if (addMenuMode() === 'timer') around #timerNameInput
  // in encounter-detail.html) — undefined the rest of the time, same as
  // CombatantBubble's hpDeltaInputEl.
  private readonly timerNameInput = viewChild<ElementRef<HTMLInputElement>>('timerNameInput');

  protected closeAddMenu(): void {
    this.addMenuMode.set('closed');
  }

  // The store itself keeps no ordering (see EncounterStore.timersForEncounter's
  // own doc comment — array order there is just insertion order), so it's
  // sorted here for display: ascending `remaining` naturally puts expired
  // (<= 0) timers first, and the linkedCombatantId tiebreaker groups
  // same-tick timers sharing a link adjacent to each other.
  protected readonly timers = computed(() =>
    [...this.encounterStore.timersForEncounter(this.encounterId())].sort(
      (a, b) => a.remaining - b.remaining || (a.linkedCombatantId ?? '').localeCompare(b.linkedCombatantId ?? ''),
    ),
  );

  // Measured off .combatant-columns (the main list + Hold Action panel row)
  // via a ResizeObserver below — lets the Timers rail (a separate sidebar,
  // see .timers-rail in encounter-detail.css) know exactly how tall it can
  // grow before it would extend past where the Previous/Next Turn buttons
  // sit, so it can switch to an internal scrollbar there instead of
  // growing past them. null until the observer's first callback fires.
  private readonly combatantColumnsEl = viewChild<ElementRef<HTMLElement>>('combatantColumns');
  protected readonly mainColumnHeight = signal<number | null>(null);
  private resizeObserverAttached = false;
  // A floor, not the real minimum height of anything specific — with only
  // one or two short combatant bubbles, .combatant-columns can measure
  // shorter than a single Timer card, which would otherwise put the rail
  // into a near-useless sliver of scroll space instead of comfortably
  // showing at least one or two cards before it needs to scroll.
  private static readonly MIN_TIMERS_RAIL_HEIGHT_PX = 224; // 14rem

  // A Timer can only be linked to a combatant currently cycling through
  // turns or waiting on Hold Action — not Removed (they're out of the
  // fight) and not Ready to Join (they haven't joined yet, so there's no
  // "their turn" to tick against).
  protected readonly linkableCombatants = computed(() =>
    this.combatants().filter((c) => !c.removedFromCombat && !c.readyToJoin),
  );

  protected readonly newTimerName = signal('');
  protected readonly newTimerValue = signal(3);
  protected readonly newTimerLinkedId = signal<string | null>(null);

  protected createTimer(): void {
    const name = this.newTimerName().trim();
    if (!name) return;
    this.encounterStore.createTimer(this.encounterId(), name, this.newTimerValue(), this.newTimerLinkedId());
    this.newTimerName.set('');
    this.newTimerValue.set(3);
    this.newTimerLinkedId.set(null);
    this.closeAddMenu(); // the "new timer" card disappears once it's actually created
  }

  protected dismissTimer(timerId: string): void {
    this.encounterStore.dismissTimer(this.encounterId(), timerId);
  }

  protected renameTimer(timerId: string, name: string): void {
    this.encounterStore.renameTimer(this.encounterId(), timerId, name);
  }

  protected adjustTimer(timerId: string, delta: number): void {
    this.encounterStore.adjustTimerValue(this.encounterId(), timerId, delta);
  }

  // Drives the card's light-grey-to-black background: a percentage of the
  // GM's *original* value (Timer.initialValue), not an absolute scale, so a
  // timer that started at 3 and one that started at 20 both read as urgent
  // as they approach their own zero — same idea as CombatantBubble's
  // hpHue()/--hp-hue for the HP bar, just lightness instead of hue.
  protected timerLightness(t: Timer): number {
    const percent = t.initialValue > 0 ? Math.min(1, Math.max(0, t.remaining / t.initialValue)) : 0;
    return 10 + percent * 82; // 10% (near-black) .. 92% (light grey)
  }

  // Once the background gets dark enough, the name needs to switch to
  // light text to stay readable — mirrors the same "expired" white-on-red
  // text, just for the gradient's darker end instead of the hard override.
  protected timerIsLight(t: Timer): boolean {
    return this.timerLightness(t) >= 50;
  }

  protected linkedCombatantName(t: Timer): string {
    return this.combatants().find((c) => c.id === t.linkedCombatantId)?.name ?? '';
  }

  /** Whether any Timer is currently linked to this combatant — drives the small clock icon next to their name (see combatant-bubble.html). */
  protected isLinkedToTimer(combatantId: string): boolean {
    return this.timers().some((t) => t.linkedCombatantId === combatantId);
  }

  // ---------------------------------------------------------------------
  // Timer-hits-zero shake: a brief, one-off animation the exact moment a
  // Timer's remaining crosses from > 0 to <= 0 — not "while it's at 0"
  // (which would replay the shake on every unrelated re-render once
  // expired). Detected with a plain effect() comparing each Timer's
  // remaining against the value last seen for its id, since a computed
  // signal only exposes the current value, not what it changed from.
  // ---------------------------------------------------------------------
  private readonly previousTimerRemaining = new Map<string, number>();
  protected readonly shakingTimerIds = signal<ReadonlySet<string>>(new Set());
  private static readonly SHAKE_DURATION_MS = 400;

  // effect(): re-runs whenever any signal it reads changes — here, timers().
  // Constructor-scoped (not a field initializer) purely by convention, to
  // keep it next to the class's one other piece of non-DI setup logic.
  constructor() {
    effect(() => {
      const current = this.timers();
      for (const t of current) {
        const previous = this.previousTimerRemaining.get(t.id);
        if (previous !== undefined && previous > 0 && t.remaining <= 0) {
          this.triggerShake(t.id);
        }
        this.previousTimerRemaining.set(t.id, t.remaining);
      }
      // Forget dismissed timers so a same-named/reused id can't inherit a stale "previous" value.
      const currentIds = new Set(current.map((t) => t.id));
      for (const id of this.previousTimerRemaining.keys()) {
        if (!currentIds.has(id)) this.previousTimerRemaining.delete(id);
      }
    });

    // Re-runs whenever addMenuMode()/timerNameInput() change — Angular
    // schedules effects to run *after* the DOM update, so by the time this
    // fires following chooseTimerMode() opening the create-timer card, the
    // input it reads via viewChild is already there. Same reasoning as the
    // plain `autofocus` attribute not working reliably in an SPA that
    // CombatantBubble's hpAdjustOpen effect documents — this GM can also
    // have a long combatant list above the fold, so scrollIntoView is
    // needed here too, not just focus().
    effect(() => {
      if (this.addMenuMode() !== 'timer') return;
      const input = this.timerNameInput()?.nativeElement;
      if (!input) return;
      input.focus();
      input.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });

    // .combatant-columns is always in the DOM throughout the run phase (not
    // behind an @if), so this effect only really runs once — the moment the
    // viewChild first resolves — rather than genuinely reacting to repeated
    // changes; resizeObserverAttached guards against attaching a second
    // observer to the same element if it somehow reran. The observer itself
    // (not this effect) is what keeps mainColumnHeight() live afterward.
    effect(() => {
      const el = this.combatantColumnsEl()?.nativeElement;
      if (!el || this.resizeObserverAttached) return;
      this.resizeObserverAttached = true;
      const observer = new ResizeObserver((entries) => {
        const height = entries[0]?.contentRect.height;
        if (height !== undefined) {
          this.mainColumnHeight.set(Math.max(height, EncounterDetail.MIN_TIMERS_RAIL_HEIGHT_PX));
        }
      });
      observer.observe(el);
    });
  }

  private triggerShake(timerId: string): void {
    this.shakingTimerIds.update((ids) => new Set(ids).add(timerId));
    setTimeout(() => {
      this.shakingTimerIds.update((ids) => {
        if (!ids.has(timerId)) return ids;
        const next = new Set(ids);
        next.delete(timerId);
        return next;
      });
    }, EncounterDetail.SHAKE_DURATION_MS);
  }

  protected isShaking(timerId: string): boolean {
    return this.shakingTimerIds().has(timerId);
  }
}
