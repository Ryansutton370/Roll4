import { Component, computed, effect, input, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SpellSource, SpellTemplate, spellLevelLabel } from '../../models/spell-template.model';
import { SpellDetailDialog } from '../spell-detail-dialog/spell-detail-dialog';

type SortColumn = 'name' | 'level';
type SortDirection = 'asc' | 'desc';

/**
 * A searchable, sortable table for browsing a source's full spell list —
 * same search-box/eye-icon-opens-a-detail-dialog shape as
 * MonsterPickerTable. Name and Level are directly sortable via their own
 * clickable column headers (same asc/desc-toggle convention as
 * MonsterPickerTable's Name/CR headers) — always a flat list, no grouped
 * sections; Class/School narrow the list instead, via the filter chips
 * below (there's no per-row "arrange into sections" control anymore — it
 * was removed once the Class/School filters covered the same "just show me
 * X" need more directly than browsing everything grouped). Unlike
 * MonsterPickerTable there's no `addTemplate` output — this is a pure
 * browse-and-inspect widget; nothing yet needs to "pick" a spell into
 * another flow.
 */
@Component({
  selector: 'app-spell-picker-table',
  imports: [FormsModule, SpellDetailDialog],
  templateUrl: './spell-picker-table.html',
  styleUrl: './spell-picker-table.css',
})
export class SpellPickerTable {
  readonly source = input.required<SpellSource>();
  readonly templates = input.required<SpellTemplate[]>();
  readonly initiallyExpanded = input(false);

  protected readonly expanded = signal(false);
  protected readonly searchText = signal('');
  protected readonly sortColumn = signal<SortColumn>('name');
  protected readonly sortDirection = signal<SortDirection>('asc');

  // Faceted filters — a spell must match at least one selected class (if
  // any are selected) AND at least one selected school (if any are
  // selected). Lets a GM ask for e.g. "Priest spells" (one class checked)
  // or "Bard and Cleric spells that are Evocation" (two classes, one
  // school) directly, instead of scanning the whole list by eye.
  protected readonly selectedClasses = signal<ReadonlySet<string>>(new Set());
  protected readonly selectedSchools = signal<ReadonlySet<string>>(new Set());

  private readonly detailDialog = viewChild.required<SpellDetailDialog>('detailDialog');

  /** Shadowdark has no school concept at all (not just missing data) — the School column/filter only make sense for 5e SRD. */
  protected readonly showSchool = computed(() => this.source() === '5e-srd');

  protected readonly columnCount = computed(() => (this.showSchool() ? 5 : 4));

  /** Distinct classes present in the current source's templates, sorted — populates the Class filter's chip row. */
  protected readonly availableClasses = computed(() => {
    const classes = new Set<string>();
    for (const t of this.templates()) for (const c of t.classes) classes.add(c);
    return [...classes].sort((a, b) => a.localeCompare(b));
  });

  /** Distinct schools present in the current source's templates, sorted — empty (and hidden) for Shadowdark, which has no school concept. */
  protected readonly availableSchools = computed(() => {
    if (!this.showSchool()) return [];
    const schools = new Set<string>();
    for (const t of this.templates()) if (t.school) schools.add(t.school);
    return [...schools].sort((a, b) => a.localeCompare(b));
  });

  protected readonly hasActiveFilters = computed(
    () => this.selectedClasses().size > 0 || this.selectedSchools().size > 0,
  );

  constructor() {
    // input()s aren't available yet inside a field initializer or the rest
    // of the constructor body — same effect()-based default as
    // MonsterPickerTable's initiallyExpanded handling.
    effect(() => {
      if (this.initiallyExpanded()) this.expanded.set(true);
    });

    // Class/school values are meaningless outside their own source's
    // vocabulary ("Priest" doesn't exist in 5e SRD, "Bard" doesn't exist in
    // Shadowdark) — clear both filters whenever the source changes rather
    // than leave a stale, now-invisible selection silently still applied.
    effect(() => {
      this.source();
      this.selectedClasses.set(new Set());
      this.selectedSchools.set(new Set());
    });
  }

  /** Always a flat, sorted list — see the class doc comment for why grouping was dropped. */
  protected readonly rows = computed<SpellTemplate[]>(() => {
    const search = this.searchText().trim().toLowerCase();
    const classes = this.selectedClasses();
    const schools = this.selectedSchools();

    let filtered = this.templates();
    if (search) filtered = filtered.filter((t) => t.name.toLowerCase().includes(search));
    if (classes.size > 0) {
      filtered = filtered.filter((t) => t.classes.some((c) => classes.has(c)));
    }
    if (schools.size > 0) {
      filtered = filtered.filter((t) => t.school !== null && schools.has(t.school));
    }

    const column = this.sortColumn();
    const direction = this.sortDirection() === 'asc' ? 1 : -1;
    // `level` is already 0 for a 5e Cantrip (see SpellTemplate), so a
    // numeric sort naturally puts Cantrips first ascending with no
    // special-casing.
    return [...filtered].sort((a, b) => {
      const primary =
        column === 'name'
          ? a.name.localeCompare(b.name) * direction
          : (a.level - b.level) * direction;
      // Tie-break by name (always ascending) so spells sharing a level
      // land in a stable, readable order instead of raw import order.
      return primary !== 0 ? primary : a.name.localeCompare(b.name);
    });
  });

  protected toggleExpanded(): void {
    this.expanded.update((e) => !e);
  }

  private setSort(column: SortColumn): void {
    if (this.sortColumn() === column) {
      this.sortDirection.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortColumn.set(column);
      this.sortDirection.set('asc');
    }
  }

  /** The Name column header: toggles direction if already sorting by name, otherwise switches to it (ascending) — same click convention as MonsterPickerTable's sortable headers. */
  protected setNameSort(): void {
    this.setSort('name');
  }

  /** The Level column header: same toggle convention as setNameSort(), for both sources (Cantrip counts as 0, see the rows() computed). */
  protected setLevelSort(): void {
    this.setSort('level');
  }

  protected toggleClassFilter(className: string): void {
    this.selectedClasses.update((classes) => {
      const next = new Set(classes);
      if (next.has(className)) next.delete(className);
      else next.add(className);
      return next;
    });
  }

  protected toggleSchoolFilter(school: string): void {
    this.selectedSchools.update((schools) => {
      const next = new Set(schools);
      if (next.has(school)) next.delete(school);
      else next.add(school);
      return next;
    });
  }

  protected clearFilters(): void {
    this.selectedClasses.set(new Set());
    this.selectedSchools.set(new Set());
  }

  protected levelLabel(template: SpellTemplate): string {
    return spellLevelLabel(template);
  }

  protected totalCount(): number {
    return this.templates().length;
  }

  protected openDetail(template: SpellTemplate): void {
    this.detailDialog().openFor(template);
  }
}
