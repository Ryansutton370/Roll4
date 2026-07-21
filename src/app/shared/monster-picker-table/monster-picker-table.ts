import { Component, computed, effect, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  MonsterSource,
  MonsterTemplate,
  monsterDifficultyLabel,
} from '../../models/monster-template.model';
import { MonsterStatBlockDialog } from '../monster-stat-block-dialog/monster-stat-block-dialog';

type SortColumn = 'name' | 'difficulty';
type SortDirection = 'asc' | 'desc';

/**
 * A sortable, searchable table for picking one MonsterTemplate out of a
 * source's full list — replaces the plain alphabetical <select> that used
 * to live in AddCombatantDialog's "From Book" step and the Encounter
 * Generator's "Add a monster" control (both had the same "hundreds of
 * options, no way to sort/search/preview" problem). Collapsed behind a
 * toggle by default so it doesn't dominate whatever page embeds it; a
 * caller with nothing else on that step (AddCombatantDialog's book step)
 * can start it expanded via `initiallyExpanded`.
 *
 * Doesn't own "what happens when a monster is picked" — like
 * NameGeneratorButton, it just reports via `addTemplate` and lets the
 * caller decide (prefill a form, increment a draft count, ...).
 */
@Component({
  selector: 'app-monster-picker-table',
  imports: [FormsModule, MonsterStatBlockDialog],
  templateUrl: './monster-picker-table.html',
  styleUrl: './monster-picker-table.css',
})
export class MonsterPickerTable {
  readonly source = input.required<MonsterSource>();
  readonly templates = input.required<MonsterTemplate[]>();
  readonly initiallyExpanded = input(false);

  readonly addTemplate = output<MonsterTemplate>();

  protected readonly expanded = signal(false);
  protected readonly searchText = signal('');
  protected readonly sortColumn = signal<SortColumn>('name');
  protected readonly sortDirection = signal<SortDirection>('asc');

  private readonly statBlockDialog = viewChild.required<MonsterStatBlockDialog>('statBlockDialog');

  constructor() {
    // input()s aren't available yet inside a field initializer or the rest
    // of the constructor body — Angular only applies bound input values
    // once the component starts rendering. An effect() re-runs once they
    // are, same pattern EncounterGenerator uses to default-select its first
    // name table once NameTableStore's data actually arrives.
    effect(() => {
      if (this.initiallyExpanded()) this.expanded.set(true);
    });
  }

  protected readonly rows = computed<MonsterTemplate[]>(() => {
    const search = this.searchText().trim().toLowerCase();
    const filtered = search
      ? this.templates().filter((t) => t.name.toLowerCase().includes(search))
      : this.templates();

    const column = this.sortColumn();
    const direction = this.sortDirection() === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (column === 'name') return a.name.localeCompare(b.name) * direction;
      // A null difficulty (context-scaling monsters — see MonsterTemplate)
      // always sorts last, regardless of asc/desc, since there's nothing
      // to meaningfully rank it against.
      if (a.difficulty === null) return b.difficulty === null ? 0 : 1;
      if (b.difficulty === null) return -1;
      return (a.difficulty - b.difficulty) * direction;
    });
  });

  protected toggleExpanded(): void {
    this.expanded.update((e) => !e);
  }

  protected setSort(column: SortColumn): void {
    if (this.sortColumn() === column) {
      this.sortDirection.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortColumn.set(column);
      this.sortDirection.set('asc');
    }
  }

  protected difficultyLabel(template: MonsterTemplate): string {
    return monsterDifficultyLabel(template);
  }

  protected difficultyColumnLabel(): string {
    return this.source() === '5e-srd' ? 'CR' : 'LV';
  }

  protected openStatBlock(template: MonsterTemplate): void {
    this.statBlockDialog().openFor(template);
  }

  protected pick(template: MonsterTemplate): void {
    this.addTemplate.emit(template);
  }
}
