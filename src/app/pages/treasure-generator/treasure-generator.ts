import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TreasureEntry } from '../../models/treasure-table.model';
import { TreasureStore } from '../../services/treasure-store';
import { GeneratorDisclaimer } from '../../shared/generator-disclaimer/generator-disclaimer';

/**
 * The Random Generators tab's fourth page — rolls on the imported Treasure
 * tables (see TreasureStore). Same shape as WildMagicGenerator: a Table
 * picker across TreasureStore's one "Treasure" set (Trinkets, Wondrous
 * Items, Potions), not a Set-then-Table picker like the Names page.
 */
@Component({
  selector: 'app-treasure-generator',
  imports: [FormsModule, GeneratorDisclaimer],
  templateUrl: './treasure-generator.html',
  styleUrl: './treasure-generator.css',
})
export class TreasureGenerator {
  protected readonly treasureStore = inject(TreasureStore);

  protected readonly selectedTableId = signal<string | null>(null);
  protected readonly rollCount = signal(1);
  protected readonly rolledEntries = signal<TreasureEntry[]>([]);
  protected readonly copiedIndex = signal<number | null>(null);

  protected readonly tables = computed(() => this.treasureStore.tablesForSet('Treasure'));

  constructor() {
    // Same async-load-then-default-select pattern as NameGenerator/
    // WildMagicGenerator: the table data loads asynchronously, so there's
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
    this.rolledEntries.set(this.treasureStore.roll(tableId, this.rollCount()));
  }

  // Copies "Name — Effect" for a two-field entry (Potions), or just the
  // text for a one-field entry (Trinkets/Wondrous Items) — matches what's
  // shown on screen either way.
  protected async copy(entry: TreasureEntry, index: number): Promise<void> {
    const text = entry.detail ? `${entry.text} — ${entry.detail}` : entry.text;
    await navigator.clipboard.writeText(text);
    this.copiedIndex.set(index);
    setTimeout(() => {
      if (this.copiedIndex() === index) this.copiedIndex.set(null);
    }, 1200);
  }
}
