import { HttpClient } from '@angular/common/http';
import { Service, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { CombatThesaurusTable } from '../models/combat-thesaurus-table.model';
import { pickRandomEntries } from './name-table-store';

/**
 * Read-only access to the Combat Thesaurus category data (public/data/
 * combat-thesaurus.json — hand-edited, see CombatThesaurusTable's doc
 * comment). Same near-twin shape as NameTableStore/WildMagicStore/
 * TreasureStore (toSignal-over-HttpClient load, shared pickRandomEntries
 * roll logic) but its own service/model, same reasoning as those: a combat
 * verb isn't a name the inline 🎲 Name-field popover should offer.
 */
@Service()
export class CombatThesaurusStore {
  private readonly http = inject(HttpClient);

  private readonly tablesSignal = toSignal(
    this.http
      .get<CombatThesaurusTable[]>('data/combat-thesaurus.json')
      .pipe(catchError(() => of([]))),
    { initialValue: [] as CombatThesaurusTable[] },
  );

  readonly tables = this.tablesSignal;

  /** Distinct setNames in file order — currently just "Combat Thesaurus". */
  readonly setNames = computed(() => [...new Set(this.tables().map((t) => t.setName))]);

  tablesForSet(setName: string): CombatThesaurusTable[] {
    return this.tables().filter((t) => t.setName === setName);
  }

  getTable(id: string): CombatThesaurusTable | undefined {
    return this.tables().find((t) => t.id === id);
  }

  roll(tableId: string, count = 1): string[] {
    const table = this.getTable(tableId);
    return table ? pickRandomEntries(table.entries, count) : [];
  }
}
