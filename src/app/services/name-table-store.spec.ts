import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NameTable } from '../models/name-table.model';
import { NameTableStore, pickRandomEntries } from './name-table-store';

describe('pickRandomEntries', () => {
  it('returns the requested count, all drawn from the source entries', () => {
    const entries = ['a', 'b', 'c', 'd', 'e'];
    const picked = pickRandomEntries(entries, 3);

    expect(picked).toHaveLength(3);
    for (const name of picked) expect(entries).toContain(name);
  });

  it('never repeats an entry within one roll while the table has enough of them', () => {
    const entries = ['a', 'b', 'c', 'd', 'e'];
    const picked = pickRandomEntries(entries, 5);

    expect(new Set(picked).size).toBe(5);
  });

  it('returns every entry, shuffled, once count meets or exceeds the table size', () => {
    const entries = ['a', 'b', 'c'];
    const picked = pickRandomEntries(entries, 10);

    expect(picked).toHaveLength(3);
    expect(new Set(picked)).toEqual(new Set(entries));
  });

  it('does not mutate the source array', () => {
    const entries = ['a', 'b', 'c'];
    const original = [...entries];

    pickRandomEntries(entries, 2);

    expect(entries).toEqual(original);
  });
});

describe('NameTableStore', () => {
  let service: NameTableStore;
  let httpMock: HttpTestingController;

  const sampleTables: NameTable[] = [
    {
      id: 'european-anglo-saxon',
      setName: 'European',
      tableName: 'Anglo-Saxon',
      gender: null,
      entries: ['Aelfgar', 'Aethelraed'],
    },
    {
      id: 'european-german-male',
      setName: 'European',
      tableName: 'German',
      gender: 'male',
      entries: ['Albert', 'Albrecht'],
    },
    {
      id: 'fantasy-goblin',
      setName: 'Fantasy',
      tableName: 'Goblin',
      gender: null,
      entries: ['Barvis', 'Bartha'],
    },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(NameTableStore);
    httpMock = TestBed.inject(HttpTestingController);

    // toSignal() subscribes as soon as the service is constructed (the
    // field initializer above runs in the constructor's injection
    // context), so the request is already in flight by the time
    // TestBed.inject returns — flushing it here means every test starts
    // from a loaded state instead of repeating this in each one.
    httpMock.expectOne('data/name-tables.json').flush(sampleTables);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('exposes the loaded tables', () => {
    expect(service.tables()).toEqual(sampleTables);
  });

  it('derives distinct set names in file order', () => {
    expect(service.setNames()).toEqual(['European', 'Fantasy']);
  });

  it('filters tables by set', () => {
    expect(service.tablesForSet('European').map((t) => t.id)).toEqual([
      'european-anglo-saxon',
      'european-german-male',
    ]);
  });

  it('looks up a single table by id', () => {
    expect(service.getTable('fantasy-goblin')).toEqual(sampleTables[2]);
  });

  it('rolls names from a table by id', () => {
    const rolled = service.rollNames('fantasy-goblin', 2);
    expect(new Set(rolled)).toEqual(new Set(['Barvis', 'Bartha']));
  });

  it('rolling from an unknown table id returns an empty list rather than throwing', () => {
    expect(service.rollNames('does-not-exist')).toEqual([]);
  });
});
