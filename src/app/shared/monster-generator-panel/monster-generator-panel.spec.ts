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
    httpMock.expectOne('data/name-tables.json').flush(sampleNameTables);
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

    expect(component.draft().length).toBeGreaterThan(0);
    expect(emitted).toEqual(component.draft());
    expect(fixture.nativeElement.querySelector('.candidates')).toBeTruthy();
    const groupName: HTMLElement = fixture.nativeElement.querySelector('.group-name');
    expect(groupName.textContent).toBe('Goblin');
  });

  it('Generate emits draftEdited', () => {
    const draftEditedSpy = vi.fn();
    component.draftEdited.subscribe(draftEditedSpy);

    fixture.nativeElement.querySelector('.generate-row button').click();
    fixture.detectChanges();

    expect(draftEditedSpy).toHaveBeenCalled();
  });

  it('the group +/- controls adjust the draft and emit draftEdited', () => {
    fixture.nativeElement.querySelector('.generate-row button').click();
    fixture.detectChanges();
    const countBefore = component.draft().length;

    const draftEditedSpy = vi.fn();
    component.draftEdited.subscribe(draftEditedSpy);

    fixture.nativeElement.querySelector('.group-count button[aria-label="Add one"]').click();
    fixture.detectChanges();
    expect(component.draft().length).toBe(countBefore + 1);
    expect(draftEditedSpy).toHaveBeenCalledTimes(1);

    fixture.nativeElement.querySelector('.group-count button[aria-label="Remove one"]').click();
    fixture.detectChanges();
    expect(component.draft().length).toBe(countBefore);
    expect(draftEditedSpy).toHaveBeenCalledTimes(2);
  });

  it('removing a roster instance drops it from the draft and emits draftEdited', () => {
    setNumberInput(0, 1);
    setNumberInput(1, 1);
    fixture.nativeElement.querySelector('.generate-row button').click();
    fixture.detectChanges();
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

    expect(toastService.messages().map((m) => m.text)).toContain('Added Goblin');
  });

  it('Generate Names fills only unnamed entries and does not emit draftEdited (matches pre-extraction behavior)', () => {
    fixture.nativeElement.querySelector('.generate-row button').click();
    fixture.detectChanges();
    component.draft.set([{ ...component.draft()[0], personalName: 'Keeper' }]);
    fixture.detectChanges();

    const draftEditedSpy = vi.fn();
    component.draftEdited.subscribe(draftEditedSpy);

    const nameButtons = fixture.nativeElement.querySelectorAll('.generate-row button');
    (nameButtons[nameButtons.length - 1] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(component.draft()[0].personalName).toBe('Keeper');
    expect(draftEditedSpy).not.toHaveBeenCalled();
  });
});
