import { HttpClient } from '@angular/common/http';
import { Service, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { WildMagicTable } from '../models/wild-magic-table.model';
import { pickRandomEntries } from './name-table-store';

/**
 * Read-only access to the imported Wild Magic table data (public/data/
 * wild-magic.json — see scripts/import-wild-magic.cjs). Structured as a
 * near-twin of NameTableStore (same toSignal-over-HttpClient load, same
 * pickRandomEntries roll logic, reused directly rather than copied) but
 * kept as its own service/model — see WildMagicTable's doc comment for why.
 */
@Service()
export class WildMagicStore {
  private readonly http = inject(HttpClient);

  private readonly tablesSignal = toSignal(
    this.http.get<WildMagicTable[]>('data/wild-magic.json').pipe(catchError(() => of([]))),
    { initialValue: [] as WildMagicTable[] },
  );

  readonly tables = this.tablesSignal;

  /** Distinct setNames in file order — currently just "Wild Magic", kept plural for parity with NameTableStore if a second source is ever added. */
  readonly setNames = computed(() => [...new Set(this.tables().map((t) => t.setName))]);

  tablesForSet(setName: string): WildMagicTable[] {
    return this.tables().filter((t) => t.setName === setName);
  }

  getTable(id: string): WildMagicTable | undefined {
    return this.tables().find((t) => t.id === id);
  }

  roll(tableId: string, count = 1): string[] {
    const table = this.getTable(tableId);
    return table ? pickRandomEntries(table.entries, count) : [];
  }
}
