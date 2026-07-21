import { HttpClient } from '@angular/common/http';
import { Service, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { NameTable } from '../models/name-table.model';

/**
 * Fisher-Yates shuffle, then take the front `count` entries — picks
 * without replacement whenever the table has enough entries to satisfy
 * `count`, and falls back to returning every entry (shuffled) once `count`
 * meets or exceeds the table's size, rather than looping with replacement.
 * Exported for direct unit testing, same "pure logic, no DI" convention as
 * compareByInitiative/computeDisplayNames in encounter-store.ts.
 *
 * Generic over the entry type (not just `string`) so WildMagicStore and
 * TreasureStore can reuse this same shuffle instead of each duplicating it
 * — TreasureStore's entries are `TreasureEntry` objects, not strings.
 */
export function pickRandomEntries<T>(entries: T[], count: number): T[] {
  const shuffled = [...entries];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return count >= shuffled.length ? shuffled : shuffled.slice(0, count);
}

/**
 * Read-only access to the imported name-table data (public/data/name-tables.json
 * — see scripts/import-names.cjs). Used both by the standalone Random
 * Generators tab and, inline, by CombatantFields' "generate a name"
 * popover, so it lives as its own service rather than being owned by
 * either page.
 */
@Service()
export class NameTableStore {
  private readonly http = inject(HttpClient);

  // toSignal(): bridges an RxJS Observable into a signal components can
  // read reactively like any other state in this app — the async
  // equivalent of NpcStore/PartyStore's synchronous localStorage reads.
  // This is the app's first HttpClient call; catchError keeps a failed/
  // missing fetch from ever surfacing as an error, just an empty list.
  private readonly tablesSignal = toSignal(
    this.http.get<NameTable[]>('data/name-tables.json').pipe(catchError(() => of([]))),
    { initialValue: [] as NameTable[] },
  );

  readonly tables = this.tablesSignal;

  /** Distinct setNames in file order (European, Non-European, Fantasy, ...) — drives the picker's grouping. */
  readonly setNames = computed(() => [...new Set(this.tables().map((t) => t.setName))]);

  tablesForSet(setName: string): NameTable[] {
    return this.tables().filter((t) => t.setName === setName);
  }

  getTable(id: string): NameTable | undefined {
    return this.tables().find((t) => t.id === id);
  }

  rollNames(tableId: string, count = 1): string[] {
    const table = this.getTable(tableId);
    return table ? pickRandomEntries(table.entries, count) : [];
  }
}
