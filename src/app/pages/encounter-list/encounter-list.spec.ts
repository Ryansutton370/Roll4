import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { MonsterTemplate } from '../../models/monster-template.model';
import { EncounterStore } from '../../services/encounter-store';
import { NpcStore } from '../../services/npc-store';
import { PartyStore } from '../../services/party-store';
import { EncounterList } from './encounter-list';

describe('EncounterList', () => {
  let component: EncounterList;
  let fixture: ComponentFixture<EncounterList>;
  let encounterStore: EncounterStore;
  let partyStore: PartyStore;
  let npcStore: NpcStore;
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
    partyStore = TestBed.inject(PartyStore);
    npcStore = TestBed.inject(NpcStore);
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

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('starts collapsed, showing only the Create Encounter trigger', () => {
    expect(fixture.nativeElement.querySelector('.create-encounter-btn')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.encounter-form')).toBeNull();
  });

  it('the Create Encounter trigger opens the panel', async () => {
    await click('.create-encounter-btn');

    expect(fixture.nativeElement.querySelector('.encounter-form')).toBeTruthy();
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

  it('typing a name alone does not create an Encounter — only a real commitment does', async () => {
    await click('.create-encounter-btn');
    await fillInput('input[name=encounterName]', 'Just Thinking About It');

    expect(encounterStore.encounters().length).toBe(0);
  });

  it('Done on a never-materialized create session leaves no trace', async () => {
    await click('.create-encounter-btn');
    await fillInput('input[name=encounterName]', 'Abandoned');
    await click('.done-btn');

    expect(encounterStore.encounters().length).toBe(0);
    expect(fixture.nativeElement.querySelector('.create-encounter-btn')).toBeTruthy();
  });

  it('checking a Party immediately materializes the Encounter and pulls its Players in', async () => {
    const player = partyStore.createPlayer({
      name: 'Aria',
      initiativeModifier: 2,
      ac: null,
      maxHp: null,
      notes: '',
    });
    const party = partyStore.createParty('The Crew');
    partyStore.addPlayerToParty(party.id, player.id);
    fixture.detectChanges();

    await click('.create-encounter-btn');
    await click('input[type=checkbox]');

    expect(encounterStore.encounters().length).toBe(1);
    const encounterId = encounterStore.encounters()[0].id;
    const combatants = encounterStore.combatantsForEncounter(encounterId);
    expect(combatants.length).toBe(1);
    expect(combatants[0].playerId).toBe(player.id);

    // Unchecking reconciles the drop immediately too (setEncounterParties'
    // existing "only before the first Roll" behavior, just now triggered
    // per-toggle instead of at a since-removed submit).
    await click('input[type=checkbox]');
    expect(encounterStore.combatantsForEncounter(encounterId).length).toBe(0);
  });

  it('checking a Troop immediately materializes the Encounter and pulls its NPCs in', async () => {
    const npc = npcStore.createNpc({
      name: 'Goblin',
      initiativeModifier: 1,
      ac: null,
      maxHp: null,
      notes: '',
    });
    const troop = npcStore.createTroop('Goblin Warband');
    npcStore.addNpcToTroop(troop.id, npc.id);
    fixture.detectChanges();

    await click('.create-encounter-btn');
    await click('input[type=checkbox]');

    expect(encounterStore.encounters().length).toBe(1);
    const encounterId = encounterStore.encounters()[0].id;
    const combatants = encounterStore.combatantsForEncounter(encounterId);
    expect(combatants.length).toBe(1);
    expect(combatants[0].npcId).toBe(npc.id);
  });

  it('a name typed after materialization renames the real Encounter immediately; clearing it back to blank does not blank the stored name', async () => {
    const player = partyStore.createPlayer({
      name: 'Aria',
      initiativeModifier: 2,
      ac: null,
      maxHp: null,
      notes: '',
    });
    const party = partyStore.createParty('The Crew');
    partyStore.addPlayerToParty(party.id, player.id);
    fixture.detectChanges();

    await click('.create-encounter-btn');
    await click('input[type=checkbox]');
    const encounterId = encounterStore.encounters()[0].id;
    expect(encounterStore.getEncounter(encounterId)?.name).toBe('Untitled Encounter');

    await fillInput('input[name=encounterName]', 'Goblin Ambush');
    expect(encounterStore.getEncounter(encounterId)?.name).toBe('Goblin Ambush');

    await fillInput('input[name=encounterName]', '');
    expect(encounterStore.getEncounter(encounterId)?.name).toBe('Goblin Ambush');
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

  it('Done after mid-session materialization keeps the real Encounter (does not delete it) and closes the panel', async () => {
    await click('.create-encounter-btn');
    await openAddCombatantDialogAndCreateNew('Goblin');
    expect(encounterStore.encounters().length).toBe(1);

    await click('.done-btn');

    expect(encounterStore.encounters().length).toBe(1);
    expect(fixture.nativeElement.querySelector('.create-encounter-btn')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.encounter-form')).toBeNull();
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

describe('EncounterList generator explicit commit', () => {
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

  it('Generate stages a Candidate — no real Combatant exists until explicitly added', async () => {
    await openBuilderAndFlushMonsterData();
    await clickGenerate();

    expect(encounterStore.encounters().length).toBe(0);
    expect(fixture.nativeElement.querySelector('.candidate-row')).toBeTruthy();
    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    );
    expect(buttons.some((b) => b.textContent?.includes('Add All to Encounter'))).toBe(true);
    httpMock.verify();
  });

  it('"Add All to Encounter" commits every candidate as a real Combatant', async () => {
    await openBuilderAndFlushMonsterData();
    await clickGenerate();

    (fixture.nativeElement.querySelector('.add-all-btn') as HTMLElement).click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(encounterStore.encounters().length).toBe(1);
    const encounterId = encounterStore.encounters()[0].id;
    const combatants = encounterStore.combatantsForEncounter(encounterId);
    expect(combatants.length).toBe(1);
    expect(combatants[0].name).toBe('Goblin');
    expect(combatants[0].monsterTemplateId).toBe('5e-srd-goblin');
    httpMock.verify();
  });

  it('a Candidate row\'s individual "Add to Encounter" button commits just that one candidate', async () => {
    await openBuilderAndFlushMonsterData();
    await clickGenerate();
    // Seed a second candidate directly (there's no +/- count adjuster
    // anymore — Candidates are per-instance rows only) so committing one
    // individually leaves the other still staged. generatorDraft is
    // protected; reaching past that here is simpler than driving an extra
    // full Generate roundtrip just to get a second instance.
    interface WithGeneratorDraft {
      generatorDraft: { (): { localId: string }[]; set(v: { localId: string }[]): void };
    }
    const draftSignal = (component as unknown as WithGeneratorDraft).generatorDraft;
    const [first] = draftSignal();
    draftSignal.set([first, { ...first, localId: 'second' }]);
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.add-one-btn') as HTMLElement).click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(encounterStore.encounters().length).toBe(1);
    const encounterId = encounterStore.encounters()[0].id;
    expect(encounterStore.combatantsForEncounter(encounterId).length).toBe(1);
    httpMock.verify();
  });

  it('renaming a staged candidate before committing it is reflected on the real Combatant once added', async () => {
    await openBuilderAndFlushMonsterData();
    await clickGenerate();

    const nameInput: HTMLInputElement = fixture.nativeElement.querySelector('.candidate-name');
    nameInput.value = 'Grix';
    nameInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(encounterStore.encounters().length).toBe(0);

    (fixture.nativeElement.querySelector('.add-all-btn') as HTMLElement).click();
    fixture.detectChanges();
    await fixture.whenStable();

    const encounterId = encounterStore.encounters()[0].id;
    expect(encounterStore.combatantsForEncounter(encounterId)[0].name).toBe('Grix');
    httpMock.verify();
  });

  it('reuses the same materialized Encounter across multiple commit actions', async () => {
    await openBuilderAndFlushMonsterData();
    await clickGenerate();
    (fixture.nativeElement.querySelector('.add-all-btn') as HTMLElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(encounterStore.encounters().length).toBe(1);
    const idAfterFirst = encounterStore.encounters()[0].id;

    await clickGenerate();
    (fixture.nativeElement.querySelector('.add-all-btn') as HTMLElement).click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(encounterStore.encounters().length).toBe(1);
    expect(encounterStore.encounters()[0].id).toBe(idAfterFirst);
    expect(encounterStore.combatantsForEncounter(idAfterFirst).length).toBe(2);
    httpMock.verify();
  });

  it('Browse Monster List\'s Add goes straight to the Encounter, not Candidates', async () => {
    await openBuilderAndFlushMonsterData();

    (fixture.nativeElement.querySelector('app-monster-picker-table .picker-toggle') as HTMLElement)
      .click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('app-monster-picker-table .add-btn') as HTMLElement)
      .click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(encounterStore.encounters().length).toBe(1);
    const encounterId = encounterStore.encounters()[0].id;
    const combatants = encounterStore.combatantsForEncounter(encounterId);
    expect(combatants.length).toBe(1);
    expect(combatants[0].monsterTemplateId).toBe('5e-srd-goblin');
    // Never staged as a Candidate.
    expect(fixture.nativeElement.querySelector('.candidates')).toBeFalsy();
    httpMock.verify();
  });
});
