import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SpellTemplate } from '../models/spell-template.model';
import { SpellStore } from './spell-store';

describe('SpellStore', () => {
  let service: SpellStore;
  let httpMock: HttpTestingController;

  const srdTemplates: SpellTemplate[] = [
    {
      id: '5e-srd-acid-splash',
      source: '5e-srd',
      homebrew: false,
      name: 'Acid Splash',
      level: 0,
      school: 'Conjuration',
      classes: ['Sorcerer', 'Wizard'],
      description: 'A bubble of acid.',
      details: [],
    },
    {
      id: '5e-srd-fireball',
      source: '5e-srd',
      homebrew: false,
      name: 'Fireball',
      level: 3,
      school: 'Evocation',
      classes: ['Sorcerer', 'Wizard'],
      description: 'A bright streak of flame.',
      details: [],
    },
  ];

  const shadowdarkTemplates: SpellTemplate[] = [
    {
      id: 'shadowdark-light',
      source: 'shadowdark',
      homebrew: false,
      name: 'Light',
      level: 1,
      school: null,
      classes: ['Priest', 'Wizard'],
      description: 'Makes an object glow.',
      details: [],
    },
    {
      id: 'shadowdark-animate-dead',
      source: 'shadowdark',
      homebrew: false,
      name: 'Animate Dead',
      level: 3,
      school: null,
      classes: ['Wizard'],
      description: 'Raises a zombie or skeleton.',
      details: [],
    },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SpellStore);
    httpMock = TestBed.inject(HttpTestingController);

    httpMock.expectOne('data/spells-5e-srd.json').flush(srdTemplates);
    httpMock.expectOne('data/spells-shadowdark.json').flush(shadowdarkTemplates);
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
    expect(service.getTemplate('5e-srd-fireball')).toEqual(srdTemplates[1]);
  });

  it('lists distinct classes for a source, sorted', () => {
    expect(service.classesForSource('shadowdark')).toEqual(['Priest', 'Wizard']);
  });

  it('filters by level range within one source', () => {
    expect(service.templatesInLevelRange('5e-srd', 0, 1).map((t) => t.id)).toEqual([
      '5e-srd-acid-splash',
    ]);
  });

  it('filters by level range and class together', () => {
    expect(service.templatesInLevelRange('shadowdark', 1, 3, 'Priest').map((t) => t.id)).toEqual([
      'shadowdark-light',
    ]);
  });

  it('returns nothing for a class not present in that range', () => {
    expect(service.templatesInLevelRange('shadowdark', 1, 3, 'Priest')).not.toContainEqual(
      expect.objectContaining({ id: 'shadowdark-animate-dead' }),
    );
  });
});
