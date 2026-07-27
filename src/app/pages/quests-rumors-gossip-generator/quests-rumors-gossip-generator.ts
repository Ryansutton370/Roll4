import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { QuestsRumorsGossipEntry } from '../../models/quests-rumors-gossip-table.model';
import { QuestsRumorsGossipStore } from '../../services/quests-rumors-gossip-store';
import { GeneratorDisclaimer } from '../../shared/generator-disclaimer/generator-disclaimer';

/**
 * The Content & Generators tab's seventh page — rolls on the imported
 * Quests, Rumors and Gossip tables (see QuestsRumorsGossipStore). Same
 * shape as TreasureGenerator: a Table picker across
 * QuestsRumorsGossipStore's one "Quests, Rumors and Gossip" set (currently
 * just Warmup Prompts), not a Set-then-Table picker like the Names page.
 */
@Component({
  selector: 'app-quests-rumors-gossip-generator',
  imports: [FormsModule, GeneratorDisclaimer],
  templateUrl: './quests-rumors-gossip-generator.html',
  styleUrl: './quests-rumors-gossip-generator.css',
})
export class QuestsRumorsGossipGenerator {
  protected readonly questsRumorsGossipStore = inject(QuestsRumorsGossipStore);

  protected readonly selectedTableId = signal<string | null>(null);
  // Same default roll count as every other Content & Generators page
  // (except Encounter Generator), GM-adjustable via the Count input below.
  protected readonly rollCount = signal(6);
  protected readonly rolledEntries = signal<QuestsRumorsGossipEntry[]>([]);
  protected readonly copiedIndex = signal<number | null>(null);

  protected readonly tables = computed(() =>
    this.questsRumorsGossipStore.tablesForSet('Quests, Rumors and Gossip'),
  );

  constructor() {
    // Same async-load-then-default-select pattern as TreasureGenerator/
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
    this.rolledEntries.set(this.questsRumorsGossipStore.roll(tableId, this.rollCount()));
  }

  // Copies "Text — Detail" for a two-field entry, or just the text for a
  // one-field entry (Warmup Prompts) — matches what's shown on screen
  // either way.
  protected async copy(entry: QuestsRumorsGossipEntry, index: number): Promise<void> {
    const text = entry.detail ? `${entry.text} — ${entry.detail}` : entry.text;
    await navigator.clipboard.writeText(text);
    this.copiedIndex.set(index);
    setTimeout(() => {
      if (this.copiedIndex() === index) this.copiedIndex.set(null);
    }, 1200);
  }
}
