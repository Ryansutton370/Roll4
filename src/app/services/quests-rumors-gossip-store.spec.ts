import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { QuestsRumorsGossipTable } from '../models/quests-rumors-gossip-table.model';
import { QuestsRumorsGossipStore } from './quests-rumors-gossip-store';

describe('QuestsRumorsGossipStore', () => {
  let service: QuestsRumorsGossipStore;
  let httpMock: HttpTestingController;

  const sampleTables: QuestsRumorsGossipTable[] = [
    {
      id: 'quests-rumors-gossip-warmup-prompts',
      setName: 'Quests, Rumors and Gossip',
      tableName: 'Warmup Prompts',
      entries: [
        { text: 'What is something you regret?', detail: null },
        { text: 'Describe your favorite place.', detail: null },
      ],
    },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(QuestsRumorsGossipStore);
    httpMock = TestBed.inject(HttpTestingController);
    httpMock.expectOne('data/quests-rumors-gossip.json').flush(sampleTables);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('exposes the loaded tables', () => {
    expect(service.tables()).toEqual(sampleTables);
  });

  it('derives distinct set names in file order', () => {
    expect(service.setNames()).toEqual(['Quests, Rumors and Gossip']);
  });

  it('filters tables by set', () => {
    expect(service.tablesForSet('Quests, Rumors and Gossip').map((t) => t.id)).toEqual([
      'quests-rumors-gossip-warmup-prompts',
    ]);
  });

  it('looks up a single table by id', () => {
    expect(service.getTable('quests-rumors-gossip-warmup-prompts')).toEqual(sampleTables[0]);
  });

  it('rolls entries from a table by id', () => {
    const rolled = service.roll('quests-rumors-gossip-warmup-prompts', 2);
    expect(new Set(rolled)).toEqual(new Set(sampleTables[0].entries));
  });

  it('rolling from an unknown table id returns an empty list rather than throwing', () => {
    expect(service.roll('does-not-exist')).toEqual([]);
  });
});
