import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TreasureTable } from '../models/treasure-table.model';
import { TreasureStore } from './treasure-store';

describe('TreasureStore', () => {
  let service: TreasureStore;
  let httpMock: HttpTestingController;

  const sampleTables: TreasureTable[] = [
    {
      id: 'treasure-trinkets',
      setName: 'Treasure',
      tableName: 'Trinkets',
      entries: [
        { text: 'A small, square iron mirror', detail: null },
        { text: 'A set of carved stone dice', detail: null },
      ],
    },
    {
      id: 'treasure-potions',
      setName: 'Treasure',
      tableName: 'Potions',
      entries: [
        { text: 'Healing', detail: 'Heal 1d8 HP' },
        { text: 'Invisibility', detail: 'You remain invisible' },
      ],
    },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TreasureStore);
    httpMock = TestBed.inject(HttpTestingController);
    httpMock.expectOne('data/treasure.json').flush(sampleTables);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('exposes the loaded tables', () => {
    expect(service.tables()).toEqual(sampleTables);
  });

  it('derives distinct set names in file order', () => {
    expect(service.setNames()).toEqual(['Treasure']);
  });

  it('filters tables by set', () => {
    expect(service.tablesForSet('Treasure').map((t) => t.id)).toEqual([
      'treasure-trinkets',
      'treasure-potions',
    ]);
  });

  it('looks up a single table by id', () => {
    expect(service.getTable('treasure-potions')).toEqual(sampleTables[1]);
  });

  it('rolls entries from a table by id', () => {
    const rolled = service.roll('treasure-trinkets', 2);
    expect(new Set(rolled)).toEqual(new Set(sampleTables[0].entries));
  });

  it('rolling from an unknown table id returns an empty list rather than throwing', () => {
    expect(service.roll('does-not-exist')).toEqual([]);
  });
});
