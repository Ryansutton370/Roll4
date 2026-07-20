import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MonsterTemplate } from '../models/monster-template.model';
import { MonsterStore } from './monster-store';

describe('MonsterStore', () => {
  let service: MonsterStore;
  let httpMock: HttpTestingController;

  const srdTemplates: MonsterTemplate[] = [
    {
      id: '5e-srd-goblin',
      source: '5e-srd',
      name: 'Goblin',
      difficulty: 0.25,
      ac: 15,
      maxHp: 7,
      initiativeModifier: 2,
      statBlock: [],
    },
    {
      id: '5e-srd-aboleth',
      source: '5e-srd',
      name: 'Aboleth',
      difficulty: 10,
      ac: 17,
      maxHp: 135,
      initiativeModifier: -1,
      statBlock: [],
    },
  ];

  const shadowdarkTemplates: MonsterTemplate[] = [
    {
      id: 'shadowdark-goblin',
      source: 'shadowdark',
      name: 'Goblin',
      difficulty: 1,
      ac: 11,
      maxHp: 5,
      initiativeModifier: 1,
      statBlock: [],
    },
    {
      id: 'shadowdark-hydra',
      source: 'shadowdark',
      name: 'Hydra',
      difficulty: null,
      ac: 15,
      maxHp: null,
      initiativeModifier: -1,
      statBlock: [],
    },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MonsterStore);
    httpMock = TestBed.inject(HttpTestingController);

    httpMock.expectOne('data/monsters-5e-srd.json').flush(srdTemplates);
    httpMock.expectOne('data/monsters-shadowdark.json').flush(shadowdarkTemplates);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('exposes templates from both sources combined', () => {
    expect(service.templates()).toEqual([...srdTemplates, ...shadowdarkTemplates]);
  });

  it('filters templates by source', () => {
    expect(service.templatesForSource('shadowdark')).toEqual(shadowdarkTemplates);
  });

  it('looks up a single template by id', () => {
    expect(service.getTemplate('5e-srd-aboleth')).toEqual(srdTemplates[1]);
  });

  it('filters by difficulty range within one source', () => {
    expect(service.templatesInDifficultyRange('5e-srd', 0, 1).map((t) => t.id)).toEqual([
      '5e-srd-goblin',
    ]);
  });

  it('excludes a null difficulty (context-scaling monster) from every range', () => {
    expect(service.templatesInDifficultyRange('shadowdark', 0, 999).map((t) => t.id)).toEqual([
      'shadowdark-goblin',
    ]);
  });
});
