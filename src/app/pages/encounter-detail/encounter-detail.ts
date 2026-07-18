import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EncounterStore } from '../../services/encounter-store';

@Component({
  selector: 'app-encounter-detail',
  imports: [FormsModule, RouterLink],
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

  // This one computed signal drives which of the two views (setup vs. run)
  // the template shows — see docs/DATA_MODEL.md: activeCombatantIndex is
  // null exactly until the first Roll.
  protected readonly hasStarted = computed(() => {
    const e = this.encounter();
    return !!e && e.activeCombatantIndex !== null;
  });

  protected readonly newNpcName = signal('');
  protected readonly newNpcModifier = signal(0);

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

  protected rollInitiative(): void {
    this.encounterStore.rollInitiative(this.encounterId());
  }

  protected advance(direction: 'forward' | 'back'): void {
    this.encounterStore.advanceTurn(this.encounterId(), direction);
  }

  protected toggleRemoved(combatantId: string): void {
    this.encounterStore.toggleRemoved(this.encounterId(), combatantId);
  }

  protected toggleHoldAction(combatantId: string): void {
    this.encounterStore.toggleHoldAction(this.encounterId(), combatantId);
  }

  protected setReRollEachRound(reRollEachRound: boolean): void {
    this.encounterStore.setReRollEachRound(this.encounterId(), reRollEachRound);
  }
}
