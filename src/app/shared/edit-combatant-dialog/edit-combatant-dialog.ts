import { Component, ElementRef, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Combatant } from '../../models/encounter.model';
import { CombatantFields } from '../combatant-fields/combatant-fields';

export interface CombatantDetailsChanges {
  name: string;
  initiativeModifier: number;
  ac: number | null;
  maxHp: number | null;
  notes: string;
}

/**
 * The Edit button in a combatant bubble's drawer opens this — the same
 * CombatantFields input set used to create a combatant, pre-filled with its
 * current values. One instance lives in EncounterDetail (not inside
 * CombatantBubble itself — same "child reports, parent decides" separation
 * already used for CombatantBubble's other outputs); EncounterDetail calls
 * `openFor(combatant)` to open it for whichever bubble's Edit button was
 * clicked.
 */
@Component({
  selector: 'app-edit-combatant-dialog',
  // FormsModule is needed here (not just re-exported from CombatantFields)
  // because (ngSubmit) below is NgForm's own output — without FormsModule
  // imported in *this* component, there's no NgForm directive on <form> to
  // back it, so (ngSubmit) would silently listen for a native DOM event
  // that never fires instead of the real 'submit' event.
  imports: [CombatantFields, FormsModule],
  templateUrl: './edit-combatant-dialog.html',
  styleUrl: './edit-combatant-dialog.css',
})
export class EditCombatantDialog {
  // viewChild(): the signal-based replacement for @ViewChild — gets a
  // handle on the native <dialog> element (via its #dialog template
  // reference) so showModal()/close() can be called imperatively. Native
  // <dialog> has no declarative "open" binding for a modal dialog, so this
  // imperative handle is required rather than optional.
  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  private combatantId: string | null = null;

  protected readonly name = signal('');
  protected readonly initiativeModifier = signal(0);
  protected readonly ac = signal<number | null>(null);
  protected readonly maxHp = signal<number | null>(null);
  protected readonly notes = signal('');

  readonly saveRequested = output<{ combatantId: string; changes: CombatantDetailsChanges }>();

  /** Seeds the form from the combatant's current values and opens the dialog. */
  openFor(combatant: Combatant): void {
    this.combatantId = combatant.id;
    this.name.set(combatant.name);
    this.initiativeModifier.set(combatant.initiativeModifier);
    this.ac.set(combatant.ac);
    this.maxHp.set(combatant.maxHp);
    this.notes.set(combatant.notes);
    this.dialogRef().nativeElement.showModal();
  }

  protected save(): void {
    if (!this.combatantId) return;
    this.saveRequested.emit({
      combatantId: this.combatantId,
      changes: {
        name: this.name(),
        initiativeModifier: this.initiativeModifier(),
        ac: this.ac(),
        maxHp: this.maxHp(),
        notes: this.notes(),
      },
    });
    this.dialogRef().nativeElement.close();
  }

  protected cancel(): void {
    this.dialogRef().nativeElement.close();
  }
}
