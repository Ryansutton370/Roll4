import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CombatThesaurusStore } from '../../services/combat-thesaurus-store';

/**
 * The category-row/count/roll/copy-any-result UI shared by
 * `CombatThesaurusGenerator` (the full Content & Generators page, with its own
 * `<h1>`/intro/disclaimer) and `CombatThesaurusDialog` (the compact popup
 * opened from the run-phase "+" menu, for rolling a verb mid-combat without
 * leaving the Encounter screen). Pulled out once a second host needed the
 * exact same picker — see those two components for how each wraps it.
 */
@Component({
  selector: 'app-combat-thesaurus-picker',
  imports: [FormsModule],
  templateUrl: './combat-thesaurus-picker.html',
  styleUrl: './combat-thesaurus-picker.css',
})
export class CombatThesaurusPicker {
  protected readonly combatThesaurusStore = inject(CombatThesaurusStore);

  protected readonly selectedTableId = signal<string | null>(null);
  // Matches NameGeneratorButton's hardcoded 6 (the inline 🎲 popover on
  // every Player/NPC Name field) — same default roll count across every
  // Content & Generators page except Encounter Generator, just GM-adjustable
  // via the Count input below instead of fixed.
  protected readonly rollCount = signal(6);
  protected readonly rolledEntries = signal<string[]>([]);
  protected readonly copiedIndex = signal<number | null>(null);

  protected readonly tables = computed(() =>
    this.combatThesaurusStore.tablesForSet('Combat Thesaurus'),
  );

  protected readonly selectedTable = computed(() =>
    this.tables().find((t) => t.id === this.selectedTableId()),
  );

  constructor() {
    // Same async-load-then-default-select pattern as WildMagicGenerator/
    // TreasureGenerator: the table data loads asynchronously, so there's
    // nothing to select at construction time.
    effect(() => {
      const tables = this.tables();
      if (tables.length > 0 && this.selectedTableId() === null) {
        this.selectTable(tables[0].id);
      }
    });
  }

  protected selectTable(tableId: string): void {
    this.selectedTableId.set(tableId);
    this.rolledEntries.set([]);
  }

  protected roll(): void {
    const tableId = this.selectedTableId();
    if (!tableId) return;
    this.rolledEntries.set(this.combatThesaurusStore.roll(tableId, this.rollCount()));
  }

  protected async copy(entry: string, index: number): Promise<void> {
    await navigator.clipboard.writeText(entry);
    this.copiedIndex.set(index);
    setTimeout(() => {
      if (this.copiedIndex() === index) this.copiedIndex.set(null);
    }, 1200);
  }
}
