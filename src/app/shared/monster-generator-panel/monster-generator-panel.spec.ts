import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MonsterTemplate } from '../../models/monster-template.model';
import { NameTable } from '../../models/name-table.model';
import { ToastService } from '../toast/toast';
import { DraftCombatant, MonsterGeneratorPanel } from './monster-generator-panel';

// A single cheap monster so the 5e SRD "medium" budget for a level-1
// party of 1 only ever affords exactly one of it — makes Generate's
// otherwise-stochastic output deterministic for these tests.
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

const sampleNameTables: NameTable[] = [
  {
    id: 'european-german-male',
    setName: 'European',
    tableName: 'German',
    gender: 'male',
    entries: ['Otto', 'Heinrich'],
  },
];

describe('MonsterGeneratorPanel', () => {
  let fixture: ComponentFixture<MonsterGeneratorPanel>;
  let component: MonsterGeneratorPanel;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MonsterGeneratorPanel],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MonsterGeneratorPanel);
    component = fixture.componentInstance;
    fixture.detectChanges();

    httpMock = TestBed.inject(HttpTestingController);
    httpMock.expectOne('data/monsters-5e-srd.json').flush([goblin]);
    httpMock.expectOne('data/monsters-shadowdark.json').flush([]);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  function setNumberInput(index: number, value: number): void {
    const inputs: HTMLInputElement[] = fixture.nativeElement.querySelectorAll(
      '.generate-row input[type="number"]',
    );
    inputs[index].value = String(value);
    inputs[index].dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  // NameTableStore's HTTP call is triggered lazily by the per-row
  // NameGeneratorButton (🎲) the first time a Candidates row actually
  // renders — not by MonsterGeneratorPanel itself, which no longer has any
  // bulk "Apply Names" pass of its own to need it for. match() (not
  // expectOne()) since not every test renders a row at all.
  function flushNameTablesIfRequested(): void {
    for (const req of httpMock.match('data/name-tables.json')) {
      req.flush(sampleNameTables);
    }
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('Generate populates the draft (two-way bound) and the Candidates section renders', () => {
    // Party Level=1, Party Size=1 keeps the budget small enough that only
    // the one cheap Goblin in the pool is ever affordable.
    setNumberInput(0, 1);
    setNumberInput(1, 1);

    let emitted: DraftCombatant[] | undefined;
    component.draft.subscribe((d) => (emitted = d));
    fixture.nativeElement.querySelector('.generate-row button').click();
    fixture.detectChanges();
    flushNameTablesIfRequested();

    expect(component.draft().length).toBeGreaterThan(0);
    expect(emitted).toEqual(component.draft());
    expect(fixture.nativeElement.querySelector('.candidates')).toBeTruthy();
    const candidateType: HTMLElement = fixture.nativeElement.querySelector('.candidate-type');
    expect(candidateType.textContent).toBe('Goblin');
  });

  it('Generate emits draftEdited', () => {
    const draftEditedSpy = vi.fn();
    component.draftEdited.subscribe(draftEditedSpy);

    fixture.nativeElement.querySelector('.generate-row button').click();
    fixture.detectChanges();
    flushNameTablesIfRequested();

    expect(draftEditedSpy).toHaveBeenCalled();
  });

  it('removing a candidate instance drops it from the draft and emits draftEdited', () => {
    setNumberInput(0, 1);
    setNumberInput(1, 1);
    fixture.nativeElement.querySelector('.generate-row button').click();
    fixture.detectChanges();
    flushNameTablesIfRequested();
    expect(component.draft().length).toBe(1);

    const draftEditedSpy = vi.fn();
    component.draftEdited.subscribe(draftEditedSpy);

    fixture.nativeElement.querySelector('.remove-btn').click();
    fixture.detectChanges();

    expect(component.draft().length).toBe(0);
    expect(draftEditedSpy).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('.candidates')).toBeFalsy();
  });

  it('switching source clears the draft and emits draftEdited', () => {
    fixture.nativeElement.querySelector('.generate-row button').click();
    fixture.detectChanges();
    flushNameTablesIfRequested();
    expect(component.draft().length).toBeGreaterThan(0);

    const draftEditedSpy = vi.fn();
    component.draftEdited.subscribe(draftEditedSpy);

    fixture.nativeElement.querySelector('.source-toggle button:last-child').click();
    fixture.detectChanges();

    expect(component.draft().length).toBe(0);
    expect(draftEditedSpy).toHaveBeenCalledTimes(1);
  });

  it('the embedded MonsterPickerTable "Add" button increments the draft via addTemplate, without a separate draftEdited listener miss', () => {
    fixture.nativeElement.querySelector('.generate-row button').click();
    fixture.detectChanges();
    flushNameTablesIfRequested();
    const countBefore = component.draft().length;

    fixture.nativeElement.querySelector('app-monster-picker-table .picker-toggle').click();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('app-monster-picker-table .add-btn').click();
    fixture.detectChanges();

    expect(component.draft().length).toBe(countBefore + 1);
  });

  it('picking a monster from Browse Monster List shows a confirmation toast', () => {
    const toastService = TestBed.inject(ToastService);

    fixture.nativeElement.querySelector('app-monster-picker-table .picker-toggle').click();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('app-monster-picker-table .add-btn').click();
    fixture.detectChanges();
    flushNameTablesIfRequested();

    expect(toastService.messages().map((m) => m.text)).toContain('Added Goblin to Candidates');
  });

  it('with showEncounterCommitActions, Browse Monster List\'s Add emits addOneToEncounter directly instead of staging a Candidate', () => {
    fixture.componentRef.setInput('showEncounterCommitActions', true);
    fixture.componentRef.setInput('encounterName', 'Goblin Ambush');
    fixture.detectChanges();

    const addOneSpy = vi.fn();
    component.addOneToEncounter.subscribe(addOneSpy);

    fixture.nativeElement.querySelector('app-monster-picker-table .picker-toggle').click();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('app-monster-picker-table .add-btn').click();
    fixture.detectChanges();

    expect(addOneSpy).toHaveBeenCalledTimes(1);
    expect(addOneSpy.mock.calls[0][0].template.name).toBe('Goblin');
    // Never touched draft — it goes straight to the real Encounter, not Candidates.
    expect(component.draft().length).toBe(0);
    expect(fixture.nativeElement.querySelector('.candidates')).toBeFalsy();
  });
});
