import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { MonsterTemplate } from '../../models/monster-template.model';
import { EncounterStore } from '../../services/encounter-store';
import { EncounterList } from './encounter-list';

describe('EncounterList', () => {
  let component: EncounterList;
  let fixture: ComponentFixture<EncounterList>;
  let encounterStore: EncounterStore;
  let router: Router;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [EncounterList],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(EncounterList);
    component = fixture.componentInstance;
    encounterStore = TestBed.inject(EncounterStore);
    router = TestBed.inject(Router);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  async function click(selector: string): Promise<void> {
    const el: HTMLElement = fixture.nativeElement.querySelector(selector);
    el.click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function fillInput(selector: string, value: string): Promise<void> {
    const input: HTMLInputElement = fixture.nativeElement.querySelector(selector);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function submitEncounterForm(): Promise<void> {
    const form: HTMLFormElement = fixture.nativeElement.querySelector('form.encounter-form');
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('starts collapsed, showing only the Create Encounter trigger', () => {
    expect(fixture.nativeElement.querySelector('.create-encounter-btn')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('form.encounter-form')).toBeNull();
  });

  it('the Create Encounter trigger opens the panel', async () => {
    await click('.create-encounter-btn');

    expect(fixture.nativeElement.querySelector('form.encounter-form')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.create-encounter-btn')).toBeNull();
  });

  it('the saved-encounters list renders after the create/edit panel in the DOM', () => {
    encounterStore.createEncounter('Existing Encounter', []);
    fixture.detectChanges();

    const panelTrigger: HTMLElement = fixture.nativeElement.querySelector('.create-encounter-btn');
    const savedList: HTMLElement = fixture.nativeElement.querySelector('.bubble-list');
    expect(panelTrigger).toBeTruthy();
    expect(savedList).toBeTruthy();
    // DOCUMENT_POSITION_FOLLOWING (4) means savedList comes after panelTrigger.
    expect(panelTrigger.compareDocumentPosition(savedList) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('a plain create (name + submit, nothing else touched) is unchanged: creates and navigates straight to the detail page', async () => {
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await click('.create-encounter-btn');
    await fillInput('input[name=encounterName]', 'Simple Encounter');
    await submitEncounterForm();

    expect(encounterStore.encounters().length).toBe(1);
    expect(encounterStore.encounters()[0].name).toBe('Simple Encounter');
    expect(navigateSpy).toHaveBeenCalledWith(['/encounters', encounterStore.encounters()[0].id]);
  });

  it('Cancel on a never-materialized create session leaves no trace', async () => {
    await click('.create-encounter-btn');
    await fillInput('input[name=encounterName]', 'Abandoned');
    await click('.cancel-encounter-btn');

    expect(encounterStore.encounters().length).toBe(0);
    expect(fixture.nativeElement.querySelector('.create-encounter-btn')).toBeTruthy();
  });

  async function openAddCombatantDialogAndCreateNew(name: string): Promise<void> {
    const dialogEl: HTMLDialogElement = fixture.nativeElement.querySelector('.add-dialog');
    dialogEl.showModal = vi.fn();
    dialogEl.close = vi.fn();

    await click('button.add-combatant-btn');

    const chooseButtons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.choose-btn'),
    );
    chooseButtons.find((b) => b.textContent?.includes('Create New'))!.click();
    fixture.detectChanges();
    await fixture.whenStable();

    await fillInput('.add-dialog .field-name', name);

    const form: HTMLFormElement = fixture.nativeElement.querySelector(
      '.add-dialog form.entry-form',
    );
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('committing via Add Combatant before ever touching the name field materializes the Encounter as "Untitled Encounter"', async () => {
    await click('.create-encounter-btn');
    await openAddCombatantDialogAndCreateNew('Skulking Thing');

    expect(encounterStore.encounters().length).toBe(1);
    expect(encounterStore.encounters()[0].name).toBe('Untitled Encounter');
    expect(encounterStore.combatantsForEncounter(encounterStore.encounters()[0].id).length).toBe(1);
    const submitBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      'form.encounter-form button[type=submit]',
    );
    expect(submitBtn.textContent?.trim()).toBe('Update Encounter');
  });

  it('reuses the same materialized id for a second Add Combatant commit in the same session', async () => {
    await click('.create-encounter-btn');
    await openAddCombatantDialogAndCreateNew('First');
    const idAfterFirst = encounterStore.encounters()[0].id;

    await openAddCombatantDialogAndCreateNew('Second');

    expect(encounterStore.encounters().length).toBe(1);
    expect(encounterStore.encounters()[0].id).toBe(idAfterFirst);
    expect(encounterStore.combatantsForEncounter(idAfterFirst).length).toBe(2);
  });

  it('submitting with a blank name after mid-session materialization still closes the panel, keeping the existing name rather than no-opping', async () => {
    await click('.create-encounter-btn');
    await openAddCombatantDialogAndCreateNew('Goblin');
    expect(encounterStore.encounters()[0].name).toBe('Untitled Encounter');

    // Name field is still blank at this point — this is the regression case:
    // submitEncounterForm must not silently no-op just because name is empty
    // once an id already exists.
    await submitEncounterForm();

    expect(encounterStore.encounters()[0].name).toBe('Untitled Encounter');
    expect(fixture.nativeElement.querySelector('.create-encounter-btn')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('form.encounter-form')).toBeNull();
  });

  it('Cancel after mid-session materialization keeps the real Encounter (does not delete it)', async () => {
    await click('.create-encounter-btn');
    await openAddCombatantDialogAndCreateNew('Goblin');
    expect(encounterStore.encounters().length).toBe(1);

    await click('.cancel-encounter-btn');

    expect(encounterStore.encounters().length).toBe(1);
    expect(fixture.nativeElement.querySelector('.create-encounter-btn')).toBeTruthy();
  });

  it('startEdit on an existing Encounter opens the panel pre-filled without creating a duplicate', async () => {
    const encounter = encounterStore.createEncounter('Ambush', []);
    fixture.detectChanges();
    await fixture.whenStable();

    await click('.icon-btn');

    const nameInput: HTMLInputElement = fixture.nativeElement.querySelector(
      'input[name=encounterName]',
    );
    expect(nameInput.value).toBe('Ambush');
    expect(encounterStore.encounters().length).toBe(1);
    expect(encounterStore.encounters()[0].id).toBe(encounter.id);
  });
});

describe('EncounterList generator live-sync', () => {
  let fixture: ComponentFixture<EncounterList>;
  let component: EncounterList;
  let encounterStore: EncounterStore;
  let httpMock: HttpTestingController;

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

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [EncounterList],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(EncounterList);
    component = fixture.componentInstance;
    encounterStore = TestBed.inject(EncounterStore);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  async function openBuilderAndFlushMonsterData(): Promise<void> {
    (fixture.nativeElement.querySelector('.create-encounter-btn') as HTMLElement).click();
    fixture.detectChanges();
    await fixture.whenStable();

    httpMock = TestBed.inject(HttpTestingController);
    httpMock.expectOne('data/monsters-5e-srd.json').flush([goblin]);
    httpMock.expectOne('data/monsters-shadowdark.json').flush([]);
    httpMock.expectOne('data/name-tables.json').flush([]);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function setNumberInput(index: number, value: number): void {
    const inputs: HTMLInputElement[] = fixture.nativeElement.querySelectorAll(
      '.generate-row input[type="number"]',
    );
    inputs[index].value = String(value);
    inputs[index].dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  async function clickGenerate(): Promise<void> {
    setNumberInput(0, 1);
    setNumberInput(1, 1);
    (fixture.nativeElement.querySelector('.generate-row button') as HTMLElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('Generate immediately adds a real Combatant — no separate commit button exists', async () => {
    await openBuilderAndFlushMonsterData();
    await clickGenerate();

    expect(encounterStore.encounters().length).toBe(1);
    const encounterId = encounterStore.encounters()[0].id;
    const combatants = encounterStore.combatantsForEncounter(encounterId);
    expect(combatants.length).toBe(1);
    expect(combatants[0].name).toBe('Goblin');
    expect(combatants[0].monsterTemplateId).toBe('5e-srd-goblin');

    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    );
    expect(buttons.some((b) => b.textContent?.includes('Add These to Encounter'))).toBe(false);
    httpMock.verify();
  });

  it('removing a roster entry removes the real Combatant it was synced to', async () => {
    await openBuilderAndFlushMonsterData();
    await clickGenerate();
    const encounterId = encounterStore.encounters()[0].id;
    expect(encounterStore.combatantsForEncounter(encounterId).length).toBe(1);

    (fixture.nativeElement.querySelector('.remove-btn') as HTMLElement).click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(encounterStore.combatantsForEncounter(encounterId).length).toBe(0);
    httpMock.verify();
  });

  it('renaming a roster entry updates the real Combatant name', async () => {
    await openBuilderAndFlushMonsterData();
    await clickGenerate();
    const encounterId = encounterStore.encounters()[0].id;

    const nameInput: HTMLInputElement = fixture.nativeElement.querySelector('.roster-name');
    nameInput.value = 'Grix';
    nameInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(encounterStore.combatantsForEncounter(encounterId)[0].name).toBe('Grix');
    httpMock.verify();
  });

  it('reuses the same materialized Encounter across multiple generator actions', async () => {
    await openBuilderAndFlushMonsterData();
    await clickGenerate();
    expect(encounterStore.encounters().length).toBe(1);
    const idAfterFirst = encounterStore.encounters()[0].id;

    (
      fixture.nativeElement.querySelector(
        '.group-count button[aria-label="Add one"]',
      ) as HTMLElement
    ).click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(encounterStore.encounters().length).toBe(1);
    expect(encounterStore.encounters()[0].id).toBe(idAfterFirst);
    expect(encounterStore.combatantsForEncounter(idAfterFirst).length).toBe(2);
    httpMock.verify();
  });
});
