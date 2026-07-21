import { HttpClient } from '@angular/common/http';
import { Service, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { TreasureEntry, TreasureTable } from '../models/treasure-table.model';
import { pickRandomEntries } from './name-table-store';

/**
 * Read-only access to the imported Treasure table data (public/data/
 * treasure.json — see scripts/import-treasure.cjs). Same near-twin shape as
 * NameTableStore/WildMagicStore (toSignal-over-HttpClient load, shared
 * pickRandomEntries roll logic) but its own service/model — see
 * TreasureTable's doc comment for why.
 */
@Service()
export class TreasureStore {
  private readonly http = inject(HttpClient);

  private readonly tablesSignal = toSignal(
    this.http.get<TreasureTable[]>('data/treasure.json').pipe(catchError(() => of([]))),
    { initialValue: [] as TreasureTable[] },
  );

  readonly tables = this.tablesSignal;

  /** Distinct setNames in file order — currently just "Treasure". */
  readonly setNames = computed(() => [...new Set(this.tables().map((t) => t.setName))]);

  tablesForSet(setName: string): TreasureTable[] {
    return this.tables().filter((t) => t.setName === setName);
  }

  getTable(id: string): TreasureTable | undefined {
    return this.tables().find((t) => t.id === id);
  }

  roll(tableId: string, count = 1): TreasureEntry[] {
    const table = this.getTable(tableId);
    return table ? pickRandomEntries(table.entries, count) : [];
  }
}
