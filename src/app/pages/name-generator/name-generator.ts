import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NameTableStore } from '../../services/name-table-store';
import { GeneratorDisclaimer } from '../../shared/generator-disclaimer/generator-disclaimer';

/**
 * The Random Generators tab's own page — a dedicated, browsable version of
 * the same table-picking/rolling flow CombatantFields offers inline (see
 * that component). Kept as a separate, simpler implementation rather than
 * factoring out one shared "picker" component: this page's UI (bigger
 * result list, copy-to-clipboard, no "which field does a click fill in")
 * is different enough from the inline popover's cramped, fill-a-field
 * job that sharing one component would mean branching most of its
 * template on which context it's in.
 */
@Component({
  selector: 'app-name-generator',
  imports: [FormsModule, GeneratorDisclaimer],
  templateUrl: './name-generator.html',
  styleUrl: './name-generator.css',
})
export class NameGenerator {
  protected readonly nameTableStore = inject(NameTableStore);

  protected readonly selectedSetName = signal<string | null>(null);
  protected readonly selectedTableId = signal<string | null>(null);
  // Matches NameGeneratorButton's hardcoded 6 (the inline 🎲 popover on
  // every Player/NPC Name field) — same default roll count here, just
  // GM-adjustable via the Count input below instead of fixed.
  protected readonly rollCount = signal(6);
  protected readonly rolledNames = signal<string[]>([]);
  protected readonly copiedIndex = signal<number | null>(null);

  protected readonly tablesForSelectedSet = computed(() => {
    const setName = this.selectedSetName();
    return setName ? this.nameTableStore.tablesForSet(setName) : [];
  });

  constructor() {
    // The table data loads asynchronously (NameTableStore.tables() starts
    // at [] until the HTTP fetch resolves — see that service), so there's
    // nothing to default-select at construction time. This effect re-runs
    // once setNames() actually has entries and picks the first one, but
    // only if the GM hasn't already picked something themselves.
    effect(() => {
      const setNames = this.nameTableStore.setNames();
      if (setNames.length > 0 && this.selectedSetName() === null) {
        this.selectSet(setNames[0]);
      }
    });
  }

  protected selectSet(setName: string): void {
    this.selectedSetName.set(setName);
    const firstTable = this.nameTableStore.tablesForSet(setName)[0];
    this.selectedTableId.set(firstTable?.id ?? null);
    this.rolledNames.set([]);
  }

  protected selectTable(tableId: string): void {
    this.selectedTableId.set(tableId);
    this.rolledNames.set([]);
  }

  protected roll(): void {
    const tableId = this.selectedTableId();
    if (!tableId) return;
    this.rolledNames.set(this.nameTableStore.rollNames(tableId, this.rollCount()));
  }

  protected async copy(name: string, index: number): Promise<void> {
    await navigator.clipboard.writeText(name);
    this.copiedIndex.set(index);
    setTimeout(() => {
      if (this.copiedIndex() === index) this.copiedIndex.set(null);
    }, 1200);
  }
}
