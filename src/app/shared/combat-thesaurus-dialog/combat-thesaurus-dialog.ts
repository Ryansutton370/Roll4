import { Component, ElementRef, viewChild } from '@angular/core';
import { CombatThesaurusPicker } from '../combat-thesaurus-picker/combat-thesaurus-picker';

/**
 * The run-phase "+" menu's "Combat Thesaurus" option opens this — a quick
 * popup for rolling a flavor verb mid-combat without leaving the Encounter
 * screen (see EncounterDetail.openCombatThesaurusDialog). Follows the exact
 * same native <dialog> + viewChild + open()/close()/onOverlayClick shape as
 * MonsterStatBlockDialog, minus that dialog's openFor(data) argument — this
 * one needs no data passed in, since CombatThesaurusPicker loads its own via
 * CombatThesaurusStore.
 */
@Component({
  selector: 'app-combat-thesaurus-dialog',
  imports: [CombatThesaurusPicker],
  templateUrl: './combat-thesaurus-dialog.html',
  styleUrl: './combat-thesaurus-dialog.css',
})
export class CombatThesaurusDialog {
  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  open(): void {
    this.dialogRef().nativeElement.showModal();
  }

  protected close(): void {
    this.dialogRef().nativeElement.close();
  }

  // See MonsterStatBlockDialog.onOverlayClick's doc comment for why this
  // compares click coordinates to the dialog's box instead of event.target.
  protected onOverlayClick(event: MouseEvent): void {
    const rect = this.dialogRef().nativeElement.getBoundingClientRect();
    const clickedOutside =
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom;
    if (clickedOutside) this.close();
  }
}
