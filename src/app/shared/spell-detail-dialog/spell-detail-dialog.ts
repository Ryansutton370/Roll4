import { Component, ElementRef, signal, viewChild } from '@angular/core';
import { SpellTemplate, spellLevelLabel } from '../../models/spell-template.model';

/**
 * SpellPickerTable's (and the Spell Lists page's Generate results') eye
 * icon opens this — a read-only reference popup for a spell, same native
 * <dialog> + viewChild + openFor() shape as MonsterStatBlockDialog, minus
 * the CR/AC/HP header line (a spell has nothing analogous) in favor of a
 * Level/School/Classes summary line instead.
 */
@Component({
  selector: 'app-spell-detail-dialog',
  templateUrl: './spell-detail-dialog.html',
  styleUrl: './spell-detail-dialog.css',
})
export class SpellDetailDialog {
  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly template = signal<SpellTemplate | null>(null);

  protected readonly levelLabel = spellLevelLabel;

  openFor(template: SpellTemplate): void {
    this.template.set(template);
    this.dialogRef().nativeElement.showModal();
  }

  protected close(): void {
    this.dialogRef().nativeElement.close();
  }

  // Same click-outside-the-rendered-box detection as MonsterStatBlockDialog
  // — see that component's onOverlayClick for why coordinates rather than
  // event.target.
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
