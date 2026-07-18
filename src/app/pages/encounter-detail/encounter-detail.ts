import { Component, computed, inject, input, signal } from '@angular/core';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Combatant } from '../../models/encounter.model';
import { EncounterStore } from '../../services/encounter-store';

@Component({
  selector: 'app-encounter-detail',
  imports: [FormsModule, RouterLink, DragDropModule],
  templateUrl: './encounter-detail.html',
  styleUrl: './encounter-detail.css',
})
export class EncounterDetail {
  protected readonly encounterStore = inject(EncounterStore);

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
  // action is pulled out of here into the secondary list below.
  protected readonly mainCombatants = computed(() => this.combatants().filter((c) => !c.onHold));

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

  protected readonly newNpcName = signal('');
  protected readonly newNpcModifier = signal(0);

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

  protected addNpc(): void {
    const name = this.newNpcName().trim();
    if (!name) return;
    this.encounterStore.addNpc(this.encounterId(), name, this.newNpcModifier());
    this.newNpcName.set('');
    this.newNpcModifier.set(0);
  }

  protected removeCombatant(combatantId: string): void {
    this.encounterStore.removeCombatant(this.encounterId(), combatantId);
  }

  protected setCombatantModifier(combatantId: string, initiativeModifier: number): void {
    this.encounterStore.setInitiativeModifier(this.encounterId(), combatantId, initiativeModifier);
  }

  // Rolling implicitly commits whatever's still sitting in the Add NPC
  // fields — addNpc() itself no-ops on a blank name, so this is a plain
  // "press Add NPC first" rather than a special case.
  protected rollInitiative(): void {
    this.addNpc();
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

  // Which bubbles have had their drag handle revealed by a tap/click — the
  // handle is hidden by default (see .drag-handle in encounter-detail.css)
  // and otherwise only shown on :hover/:focus-within, which have no touch
  // equivalent. Same Set-of-ids pattern as expandedCombatantIds above.
  protected readonly revealedHandleIds = signal<ReadonlySet<string>>(new Set());

  protected isHandleRevealed(combatantId: string): boolean {
    return this.revealedHandleIds().has(combatantId);
  }

  protected toggleHandleRevealed(combatantId: string): void {
    this.revealedHandleIds.update((ids) => {
      const next = new Set(ids);
      if (next.has(combatantId)) {
        next.delete(combatantId);
      } else {
        next.add(combatantId);
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
