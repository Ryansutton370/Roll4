import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WildMagicStore } from '../../services/wild-magic-store';
import { GeneratorDisclaimer } from '../../shared/generator-disclaimer/generator-disclaimer';

/**
 * The Content & Generators tab's third page — rolls on the imported Wild
 * Magic tables (see WildMagicStore). Structured like NameGenerator (same
 * picker-row/results-list/copy-to-clipboard shape) but with only a Table
 * picker, not a Set-then-Table one: WildMagicStore currently holds exactly
 * one set ("Wild Magic"), so a Set dropdown would just be a single
 * always-selected option standing in the way of the Table picker underneath
 * it.
 */
@Component({
  selector: 'app-wild-magic-generator',
  imports: [FormsModule, GeneratorDisclaimer],
  templateUrl: './wild-magic-generator.html',
  styleUrl: './wild-magic-generator.css',
})
export class WildMagicGenerator {
  protected readonly wildMagicStore = inject(WildMagicStore);

  protected readonly selectedTableId = signal<string | null>(null);
  // Matches NameGeneratorButton's hardcoded 6 (the inline 🎲 popover on
  // every Player/NPC Name field) — same default roll count across every
  // Content & Generators page except Encounter Generator, just GM-adjustable
  // via the Count input below instead of fixed.
  protected readonly rollCount = signal(6);
  protected readonly rolledEntries = signal<string[]>([]);
  protected readonly copiedIndex = signal<number | null>(null);

  protected readonly tables = computed(() => this.wildMagicStore.tablesForSet('Wild Magic'));

  protected readonly selectedTable = computed(() =>
    this.tables().find((t) => t.id === this.selectedTableId()),
  );

  constructor() {
    // Same async-load-then-default-select pattern as NameGenerator: the
    // table data loads asynchronously, so there's nothing to select at
    // construction time — this effect picks the first table once the data
    // actually arrives, but only if the GM hasn't already picked one.
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
    this.rolledEntries.set(this.wildMagicStore.roll(tableId, this.rollCount()));
  }

  protected async copy(entry: string, index: number): Promise<void> {
    await navigator.clipboard.writeText(entry);
    this.copiedIndex.set(index);
    setTimeout(() => {
      if (this.copiedIndex() === index) this.copiedIndex.set(null);
    }, 1200);
  }
}
