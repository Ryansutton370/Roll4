import { Component, ElementRef, output, signal, viewChild } from '@angular/core';
import { Combatant } from '../../models/encounter.model';
import { RichTextEditor } from '../rich-text-editor/rich-text-editor';

/**
 * The combatant bubble's Notes icon opens this — a read/write popout for
 * that one combatant's notes, editing via the shared RichTextEditor. Same
 * native <dialog> + viewChild + openFor() shape as MonsterStatBlockDialog/
 * EditCombatantDialog. Deliberately its own small dialog rather than
 * reusing EditCombatantDialog: that one edits Name/AC/HP/Initiative
 * together as a batch (see CombatantDetailsChanges), but the bubble's
 * Notes icon is meant as a single-purpose "just the notes" shortcut, one
 * click away without also seeing the rest of the form.
 */
@Component({
  selector: 'app-notes-dialog',
  imports: [RichTextEditor],
  templateUrl: './notes-dialog.html',
  styleUrl: './notes-dialog.css',
})
export class NotesDialog {
  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  private combatantId: string | null = null;
  protected readonly notes = signal('');
  protected readonly dialogTitle = signal('Notes');

  readonly notesSaved = output<{ combatantId: string; notes: string }>();

  openFor(combatant: Combatant, displayName: string): void {
    this.combatantId = combatant.id;
    this.notes.set(combatant.notes);
    this.dialogTitle.set(`${displayName}'s Notes`);
    this.dialogRef().nativeElement.showModal();
  }

  protected save(): void {
    if (!this.combatantId) return;
    this.notesSaved.emit({ combatantId: this.combatantId, notes: this.notes() });
    this.dialogRef().nativeElement.close();
  }

  protected cancel(): void {
    this.dialogRef().nativeElement.close();
  }
}
