import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { MonsterTemplate } from '../../models/monster-template.model';
import { EncounterStore } from '../../services/encounter-store';

import { EncounterGenerator } from './encounter-generator';

// Same trick monster-generator-panel.spec.ts uses: a single cheap monster so
// a level-1/size-1 "medium" budget only ever affords exactly one of it,
// making Generate's otherwise-stochastic output deterministic.
const goblin: MonsterTemplate = {
  id: '5e-srd-goblin',
  source: '5e-srd',
  homebrew: false,
  name: 'Goblin',
  difficulty: 0.25,
  ac: 15,
  maxHp: 7,
  initiativeModifier: 2,
  statBlock: [],
};

describe('EncounterGenerator', () => {
  let component: EncounterGenerator;
  let fixture: ComponentFixture<EncounterGenerator>;
  let encounterStore: EncounterStore;
  let router: Router;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [EncounterGenerator],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(EncounterGenerator);
    component = fixture.componentInstance;
    encounterStore = TestBed.inject(EncounterStore);
    router = TestBed.inject(Router);
    fixture.detectChanges();

    httpMock = TestBed.inject(HttpTestingController);
    httpMock.expectOne('data/monsters-5e-srd.json').flush([goblin]);
    httpMock.expectOne('data/monsters-shadowdark.json').flush([]);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  // NameTableStore's HTTP call is triggered lazily by a Candidates row's
  // NameGeneratorButton, not by Generate itself — match() (not expectOne())
  // since it's only requested once a row actually renders.
  function flushNameTablesIfRequested(): void {
    for (const req of httpMock.match('data/name-tables.json')) {
      req.flush([]);
    }
  }

  function generateOneGoblin(): void {
    const inputs: HTMLInputElement[] = fixture.nativeElement.querySelectorAll(
      '.generate-row input[type="number"]',
    );
    inputs[0].value = '1'; // Party Level
    inputs[0].dispatchEvent(new Event('input'));
    inputs[1].value = '1'; // Party Size
    inputs[1].dispatchEvent(new Event('input'));
    fixture.detectChanges();

    fixture.nativeElement.querySelector('.generate-row button').click();
    fixture.detectChanges();
    flushNameTablesIfRequested();
    fixture.detectChanges();
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('addToEncounter creates a new Encounter, adds the candidate, and jumps to its edit panel', () => {
    generateOneGoblin();
    const navigateSpy = vi.spyOn(router, 'navigate');

    const addBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.add-encounter-row button');
    addBtn.click();
    fixture.detectChanges();

    const encounters = encounterStore.encounters();
    expect(encounters.length).toBe(1);
    expect(encounterStore.combatantsForEncounter(encounters[0].id).map((c) => c.name)).toEqual([
      'Goblin',
    ]);
    expect(fixture.nativeElement.querySelector('.candidates')).toBeNull();
    expect(navigateSpy).toHaveBeenCalledWith(['/encounters'], {
      queryParams: { edit: encounters[0].id },
    });
  });

  it('addToEncounter adds to an existing Encounter instead of creating a new one', () => {
    const existing = encounterStore.createEncounter('Goblin Ambush', []);
    fixture.detectChanges();
    generateOneGoblin();
    const navigateSpy = vi.spyOn(router, 'navigate');

    const select: HTMLSelectElement = fixture.nativeElement.querySelector('.add-encounter-row select');
    select.value = existing.id;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const addBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.add-encounter-row button');
    addBtn.click();
    fixture.detectChanges();

    expect(encounterStore.encounters().length).toBe(1);
    expect(encounterStore.combatantsForEncounter(existing.id).map((c) => c.name)).toEqual([
      'Goblin',
    ]);
    expect(navigateSpy).toHaveBeenCalledWith(['/encounters'], {
      queryParams: { edit: existing.id },
    });
  });
});
