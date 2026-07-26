import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SpellSource, SpellTemplate, spellLevelLabel } from '../../models/spell-template.model';
import { pickRandomEntries } from '../../services/name-table-store';
import { SpellStore } from '../../services/spell-store';
import { SpellCredits } from '../../shared/spell-credits/spell-credits';
import { SpellDetailDialog } from '../../shared/spell-detail-dialog/spell-detail-dialog';
import { SpellPickerTable } from '../../shared/spell-picker-table/spell-picker-table';

/** Per-source defaults for the Generate panel's level range — a 5e cantrip-inclusive 0-3 doesn't make sense once Shadowdark's 1-5 Tier range is in play, and vice versa. */
const LEVEL_RANGE_DEFAULTS: Record<SpellSource, { min: number; max: number }> = {
  '5e-srd': { min: 0, max: 3 },
  shadowdark: { min: 1, max: 3 },
};

/**
 * The Content & Generators tab's sixth page (`/generators/spells`) — browse
 * the imported 5e SRD/Shadowdark spell lists (see SpellStore) and roll a
 * random batch within a level range, optionally narrowed to one class.
 * Unlike the Encounter Generator's Monsters section (Generate primary),
 * Browse is the primary section here — the richer ask, per an explicit
 * layout choice — stacked above Generate.
 */
@Component({
  selector: 'app-spell-lists-generator',
  imports: [FormsModule, SpellPickerTable, SpellDetailDialog, SpellCredits],
  templateUrl: './spell-lists-generator.html',
  styleUrl: './spell-lists-generator.css',
})
export class SpellListsGenerator {
  private readonly spellStore = inject(SpellStore);

  protected readonly source = signal<SpellSource>('5e-srd');

  protected readonly count = signal(6);
  protected readonly minLevel = signal(LEVEL_RANGE_DEFAULTS['5e-srd'].min);
  protected readonly maxLevel = signal(LEVEL_RANGE_DEFAULTS['5e-srd'].max);
  protected readonly selectedClass = signal('');
  protected readonly results = signal<SpellTemplate[]>([]);

  protected readonly templatesForSource = computed(() =>
    this.spellStore.templatesForSource(this.source()),
  );
  protected readonly classesForSource = computed(() =>
    this.spellStore.classesForSource(this.source()),
  );

  private readonly resultDetailDialog = viewChild.required<SpellDetailDialog>('resultDetailDialog');

  protected selectSource(source: SpellSource): void {
    this.source.set(source);
    const defaults = LEVEL_RANGE_DEFAULTS[source];
    this.minLevel.set(defaults.min);
    this.maxLevel.set(defaults.max);
    this.selectedClass.set('');
    this.results.set([]);
  }

  protected generate(): void {
    const pool = this.spellStore.templatesInLevelRange(
      this.source(),
      this.minLevel(),
      this.maxLevel(),
      this.selectedClass() || undefined,
    );
    this.results.set(pickRandomEntries(pool, this.count()));
  }

  protected levelLabel(template: SpellTemplate): string {
    return spellLevelLabel(template);
  }

  protected levelInputLabel(): string {
    return this.source() === '5e-srd' ? 'Level' : 'Tier';
  }

  protected openResultDetail(template: SpellTemplate): void {
    this.resultDetailDialog().openFor(template);
  }
}
