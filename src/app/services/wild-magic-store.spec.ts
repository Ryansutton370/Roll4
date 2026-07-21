import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { WildMagicTable } from '../models/wild-magic-table.model';
import { WildMagicStore } from './wild-magic-store';

describe('WildMagicStore', () => {
  let service: WildMagicStore;
  let httpMock: HttpTestingController;

  const sampleTables: WildMagicTable[] = [
    {
      id: 'wild-magic-chaos-burst',
      setName: 'Wild Magic',
      tableName: 'Chaos Burst',
      description: 'Wild magic mishap effects.',
      entries: ['A goose appears and demands tribute', 'The caster briefly turns to glass'],
    },
    {
      id: 'wild-magic-duration-condition',
      setName: 'Wild Magic',
      tableName: 'Burst Duration Condition',
      description: 'Conditions that end a Burst with no stated duration.',
      entries: ['He has slain a dragon', 'A year and a day have passed'],
    },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(WildMagicStore);
    httpMock = TestBed.inject(HttpTestingController);
    httpMock.expectOne('data/wild-magic.json').flush(sampleTables);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('exposes the loaded tables', () => {
    expect(service.tables()).toEqual(sampleTables);
  });

  it('derives distinct set names in file order', () => {
    expect(service.setNames()).toEqual(['Wild Magic']);
  });

  it('filters tables by set', () => {
    expect(service.tablesForSet('Wild Magic').map((t) => t.id)).toEqual([
      'wild-magic-chaos-burst',
      'wild-magic-duration-condition',
    ]);
  });

  it('looks up a single table by id', () => {
    expect(service.getTable('wild-magic-duration-condition')).toEqual(sampleTables[1]);
  });

  it('rolls entries from a table by id', () => {
    const rolled = service.roll('wild-magic-chaos-burst', 2);
    expect(new Set(rolled)).toEqual(new Set(sampleTables[0].entries));
  });

  it('rolling from an unknown table id returns an empty list rather than throwing', () => {
    expect(service.roll('does-not-exist')).toEqual([]);
  });
});
