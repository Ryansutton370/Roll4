import { Component, ElementRef, computed, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CombatantType } from '../../models/encounter.model';
import { Npc } from '../../models/npc.model';
import { Player } from '../../models/party.model';
import { CombatantFields } from '../combatant-fields/combatant-fields';

export interface NewCombatantSubmitted {
  type: CombatantType;
  fields: {
    name: string;
    initiativeModifier: number;
    ac: number | null;
    maxHp: number | null;
    notes: string;
  };
}

/**
 * The "Add Combatant" flow shared by three places: the Encounter setup
 * screen, the Encounters list's Edit form, and the run-phase "+" menu.
 * Opens as a modal (same native <dialog>/showModal() pattern as
 * EditCombatantDialog) always starting on a three-way choice — Existing
 * NPC, Existing Player, or Create New — which expands into the matching
 * next step. Either path, or the Cancel button/Escape key, closes it
 * without the caller needing to track any open/closed state itself.
 */
@Component({
  selector: 'app-add-combatant-dialog',
  imports: [CombatantFields, FormsModule],
  templateUrl: './add-combatant-dialog.html',
  styleUrl: './add-combatant-dialog.css',
})
export class AddCombatantDialog {
  // input(): the caller (EncounterDetail/EncounterList) already computes
  // "which roster Players/NPCs aren't in this Encounter yet" for its own
  // purposes — passed straight through rather than this dialog knowing
  // about EncounterStore/PartyStore/NpcStore itself.
  readonly availablePlayers = input.required<Player[]>();
  readonly availableNpcs = input.required<Npc[]>();

  // Fired when the GM picks an existing roster entry to add.
  readonly existingPlayerChosen = output<string>();
  readonly existingNpcChosen = output<string>();
  // Fired when the GM submits the "create new" form instead.
  readonly newCombatantSubmitted = output<NewCombatantSubmitted>();

  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  // Three-way top-level choice, per the GM spec: Existing NPC / Existing
  // Player / Create New are peers, not "existing" with "new" buried behind
  // a toggle link. `type` only matters once `step` has moved past 'choose'
  // — set alongside it when picking an Existing* option, or via the radio
  // inside the 'new' step's own form (a brand-new ad-hoc combatant still
  // needs a type, it just isn't known before that step).
  protected readonly step = signal<'choose' | 'existing' | 'new'>('choose');
  protected readonly type = signal<CombatantType>('npc');

  protected readonly name = signal('');
  protected readonly initiativeModifier = signal(0);
  protected readonly ac = signal<number | null>(null);
  protected readonly maxHp = signal<number | null>(null);
  protected readonly notes = signal('');

  // Whichever roster list matches the currently-chosen type — the
  // "existing" step's picker reads from this rather than branching on
  // type() itself in the template.
  protected readonly currentAvailable = computed<(Player | Npc)[]>(() =>
    this.type() === 'pc' ? this.availablePlayers() : this.availableNpcs(),
  );

  /** Opens the dialog, always starting on the three-way choice step. */
  open(): void {
    this.step.set('choose');
    this.type.set('npc');
    this.resetNewFields();
    this.dialogRef().nativeElement.showModal();
  }

  protected startExisting(type: CombatantType): void {
    this.type.set(type);
    this.step.set('existing');
  }

  protected startNew(): void {
    this.step.set('new');
  }

  protected backToChoose(): void {
    this.step.set('choose');
  }

  protected pickExisting(id: string): void {
    if (this.type() === 'pc') {
      this.existingPlayerChosen.emit(id);
    } else {
      this.existingNpcChosen.emit(id);
    }
    this.close();
  }

  protected submitNew(): void {
    const name = this.name().trim();
    if (!name) return;
    this.newCombatantSubmitted.emit({
      type: this.type(),
      fields: {
        name,
        initiativeModifier: this.initiativeModifier(),
        ac: this.ac(),
        maxHp: this.maxHp(),
        notes: this.notes(),
      },
    });
    this.close();
  }

  protected cancel(): void {
    this.close();
  }

  private close(): void {
    this.dialogRef().nativeElement.close();
  }

  private resetNewFields(): void {
    this.name.set('');
    this.initiativeModifier.set(0);
    this.ac.set(null);
    this.maxHp.set(null);
    this.notes.set('');
  }
}
