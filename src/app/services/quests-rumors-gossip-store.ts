import { HttpClient } from '@angular/common/http';
import { Service, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import {
  QuestsRumorsGossipEntry,
  QuestsRumorsGossipTable,
} from '../models/quests-rumors-gossip-table.model';
import { pickRandomEntries } from './name-table-store';

/**
 * Read-only access to the imported Quests, Rumors and Gossip table data
 * (public/data/quests-rumors-gossip.json). Same near-twin shape as
 * TreasureStore/CombatThesaurusStore (toSignal-over-HttpClient load, shared
 * pickRandomEntries roll logic) but its own service/model — see
 * QuestsRumorsGossipTable's doc comment for why.
 */
@Service()
export class QuestsRumorsGossipStore {
  private readonly http = inject(HttpClient);

  private readonly tablesSignal = toSignal(
    this.http
      .get<QuestsRumorsGossipTable[]>('data/quests-rumors-gossip.json')
      .pipe(catchError(() => of([]))),
    { initialValue: [] as QuestsRumorsGossipTable[] },
  );

  readonly tables = this.tablesSignal;

  /** Distinct setNames in file order — currently just "Quests, Rumors and Gossip". */
  readonly setNames = computed(() => [...new Set(this.tables().map((t) => t.setName))]);

  tablesForSet(setName: string): QuestsRumorsGossipTable[] {
    return this.tables().filter((t) => t.setName === setName);
  }

  getTable(id: string): QuestsRumorsGossipTable | undefined {
    return this.tables().find((t) => t.id === id);
  }

  roll(tableId: string, count = 1): QuestsRumorsGossipEntry[] {
    const table = this.getTable(tableId);
    return table ? pickRandomEntries(table.entries, count) : [];
  }
}
