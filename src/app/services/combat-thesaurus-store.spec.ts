import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CombatThesaurusTable } from '../models/combat-thesaurus-table.model';
import { CombatThesaurusStore } from './combat-thesaurus-store';

describe('CombatThesaurusStore', () => {
  let service: CombatThesaurusStore;
  let httpMock: HttpTestingController;

  const sampleTables: CombatThesaurusTable[] = [
    {
      id: 'combat-thesaurus-blade',
      setName: 'Combat Thesaurus',
      tableName: 'Blade',
      icon: 'blade',
      entries: ['slash', 'skewer'],
    },
    {
      id: 'combat-thesaurus-blunt',
      setName: 'Combat Thesaurus',
      tableName: 'Blunt',
      icon: 'blunt',
      entries: ['crush', 'bludgeon'],
    },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CombatThesaurusStore);
    httpMock = TestBed.inject(HttpTestingController);
    httpMock.expectOne('data/combat-thesaurus.json').flush(sampleTables);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('exposes the loaded tables', () => {
    expect(service.tables()).toEqual(sampleTables);
  });

  it('derives distinct set names in file order', () => {
    expect(service.setNames()).toEqual(['Combat Thesaurus']);
  });

  it('filters tables by set', () => {
    expect(service.tablesForSet('Combat Thesaurus').map((t) => t.id)).toEqual([
      'combat-thesaurus-blade',
      'combat-thesaurus-blunt',
    ]);
  });

  it('looks up a single table by id', () => {
    expect(service.getTable('combat-thesaurus-blunt')).toEqual(sampleTables[1]);
  });

  it('rolls entries from a table by id', () => {
    const rolled = service.roll('combat-thesaurus-blade', 2);
    expect(new Set(rolled)).toEqual(new Set(sampleTables[0].entries));
  });

  it('rolling from an unknown table id returns an empty list rather than throwing', () => {
    expect(service.roll('does-not-exist')).toEqual([]);
  });
});
