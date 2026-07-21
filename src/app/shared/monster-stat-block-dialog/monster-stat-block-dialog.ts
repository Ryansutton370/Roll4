import { Component, ElementRef, computed, signal, viewChild } from '@angular/core';
import { MonsterTemplate } from '../../models/monster-template.model';

/**
 * The combatant bubble drawer's "View Stat Block" button opens this — a
 * read-only reference popup for a monster-generated combatant (see
 * MonsterTemplate in docs/DATA_MODEL.md). Follows the exact same native
 * <dialog> + viewChild + openFor() shape as EditCombatantDialog, minus the
 * <form>/save output, since there's nothing here for a GM to edit — this is
 * seed data, not the combatant's own copy.
 */
@Component({
  selector: 'app-monster-stat-block-dialog',
  templateUrl: './monster-stat-block-dialog.html',
  styleUrl: './monster-stat-block-dialog.css',
})
export class MonsterStatBlockDialog {
  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly template = signal<MonsterTemplate | null>(null);

  // Appends "(Homebrew)" for a GM-added entry — see MonsterTemplate.homebrew
  // — so it's visually clear on the one screen that shows a monster's full
  // details that this isn't covered by the Credits page's OGL/CC BY-SA
  // notices, without needing a GM to go check source data for that.
  protected readonly sourceLabel = computed(() => {
    const t = this.template();
    const base = t?.source === '5e-srd' ? 'D&D 5e SRD' : 'Shadowdark';
    return t?.homebrew ? `${base} (Homebrew)` : base;
  });
  /** 5e's difficulty is a Challenge Rating, Shadowdark's is a Level — see docs/DATA_MODEL.md's Encounter Generator algorithm note for why these aren't a shared concept. */
  protected readonly difficultyLabel = computed(() =>
    this.template()?.source === '5e-srd' ? 'CR' : 'LV',
  );

  openFor(template: MonsterTemplate): void {
    this.template.set(template);
    this.dialogRef().nativeElement.showModal();
  }

  protected close(): void {
    this.dialogRef().nativeElement.close();
  }
}
