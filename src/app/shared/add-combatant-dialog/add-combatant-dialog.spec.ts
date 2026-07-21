import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MonsterTemplate } from '../../models/monster-template.model';
import { Npc } from '../../models/npc.model';
import { Player } from '../../models/party.model';
import { AddCombatantDialog, NewCombatantSubmitted } from './add-combatant-dialog';

const goblin: MonsterTemplate = {
  id: '5e-srd-goblin',
  source: '5e-srd',
  homebrew: false,
  name: 'Goblin',
  difficulty: 0.25,
  ac: 15,
  maxHp: 7,
  initiativeModifier: 2,
  statBlock: [{ label: 'Type', value: 'Small, Humanoid' }],
};

const players: Player[] = [
  { id: 'p1', name: 'Aria', initiativeModifier: 3, ac: null, maxHp: null, notes: '' },
];
const npcs: Npc[] = [
  {
    id: 'n1',
    name: 'Guard',
    initiativeModifier: 1,
    ac: null,
    maxHp: null,
    notes: '',
    monsterTemplateId: null,
    monsterName: null,
  },
];

describe('AddCombatantDialog', () => {
  let component: AddCombatantDialog;
  let fixture: ComponentFixture<AddCombatantDialog>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddCombatantDialog],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AddCombatantDialog);
    fixture.componentRef.setInput('availablePlayers', players);
    fixture.componentRef.setInput('availableNpcs', npcs);
    component = fixture.componentInstance;
    fixture.detectChanges();

    httpMock = TestBed.inject(HttpTestingController);
    httpMock.expectOne('data/monsters-5e-srd.json').flush([goblin]);
    httpMock.expectOne('data/monsters-shadowdark.json').flush([]);
    fixture.detectChanges();

    const dialog: HTMLDialogElement = fixture.nativeElement.querySelector('.add-dialog');
    dialog.showModal = vi.fn();
    dialog.close = vi.fn();
  });

  afterEach(() => {
    httpMock.verify();
  });

  async function tick(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function click(selector: string): Promise<void> {
    (fixture.nativeElement.querySelector(selector) as HTMLElement).click();
    await tick();
  }

  /** CombatantFields' embedded 🎲 button (NameGeneratorButton) injects NameTableStore, which fires this request the first time the 'new' step actually mounts — flush it before asserting further or httpMock.verify() will fail. */
  async function flushNameTables(): Promise<void> {
    httpMock.expectOne('data/name-tables.json').flush([]);
    await tick();
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('opens on the four-way choice', async () => {
    component.open();
    await tick();

    const choices: HTMLButtonElement[] = fixture.nativeElement.querySelectorAll('.choose-btn');
    expect(Array.from(choices).map((b) => b.textContent?.trim())).toEqual([
      'Existing NPC',
      'Existing Player',
      'From Book',
      'Create New',
    ]);
  });

  it('picking an Existing NPC emits existingNpcChosen and closes', async () => {
    component.open();
    await tick();
    let emitted: string | undefined;
    component.existingNpcChosen.subscribe((id) => (emitted = id));

    await click('.choose-btn:nth-child(1)');
    await click('.roster-pick-list button');

    expect(emitted).toBe('n1');
  });

  it('picking an Existing Player emits existingPlayerChosen', async () => {
    component.open();
    await tick();
    let emitted: string | undefined;
    component.existingPlayerChosen.subscribe((id) => (emitted = id));

    await click('.choose-btn:nth-child(2)');
    await click('.roster-pick-list button');

    expect(emitted).toBe('p1');
  });

  it('the From Book step wires MonsterPickerTable to the current source, expanded by default', async () => {
    component.open();
    await tick();
    await click('.choose-btn:nth-child(3)');

    expect(fixture.nativeElement.querySelector('app-monster-picker-table')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.picker-table')).toBeTruthy();
    const rows = fixture.nativeElement.querySelectorAll('.picker-table tbody tr');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('Goblin');
  });

  it('picking a monster from the book jumps to the prefilled "new" step, NPC-locked (no type radio)', async () => {
    component.open();
    await tick();
    await click('.choose-btn:nth-child(3)');
    await click('.picker-table .add-btn');
    await flushNameTables();

    expect(fixture.nativeElement.querySelector('.ad-hoc-type')).toBeNull();
    const nameInput: HTMLInputElement = fixture.nativeElement.querySelector('.field-name');
    expect(nameInput.value).toBe('Goblin');
    const acInput: HTMLInputElement = fixture.nativeElement.querySelector('.field-ac');
    expect(acInput.value).toBe('15');
  });

  it('"Back" from a From-Book-prefilled "new" step returns to the book picker, not the top-level choice', async () => {
    component.open();
    await tick();
    await click('.choose-btn:nth-child(3)');
    await click('.picker-table .add-btn');
    await flushNameTables();

    await click('.mode-toggle');

    expect(fixture.nativeElement.querySelector('app-monster-picker-table')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.choose-btn')).toBeNull();
  });

  it('submitting a From-Book pick emits newCombatantSubmitted with the template link carried through', async () => {
    component.open();
    await tick();
    await click('.choose-btn:nth-child(3)');
    await click('.picker-table .add-btn');
    await flushNameTables();

    let emitted: NewCombatantSubmitted | undefined;
    component.newCombatantSubmitted.subscribe((e) => (emitted = e));
    const form: HTMLFormElement = fixture.nativeElement.querySelector('form.entry-form');
    form.dispatchEvent(new Event('submit'));

    expect(emitted?.type).toBe('npc');
    expect(emitted?.fields.name).toBe('Goblin');
    expect(emitted?.fields.monsterTemplateId).toBe('5e-srd-goblin');
    expect(emitted?.fields.monsterName).toBe('Goblin');
  });

  it('Create New shows the NPC/Player type radio (a monster template is always an NPC, but a hand-typed entry is not)', async () => {
    component.open();
    await tick();
    await click('.choose-btn:nth-child(4)');
    await flushNameTables();

    expect(fixture.nativeElement.querySelector('.ad-hoc-type')).toBeTruthy();

    let emitted: NewCombatantSubmitted | undefined;
    component.newCombatantSubmitted.subscribe((e) => (emitted = e));
    const nameInput: HTMLInputElement = fixture.nativeElement.querySelector('.field-name');
    nameInput.value = 'Barry';
    nameInput.dispatchEvent(new Event('input'));
    await tick();
    const form: HTMLFormElement = fixture.nativeElement.querySelector('form.entry-form');
    form.dispatchEvent(new Event('submit'));

    expect(emitted?.type).toBe('npc');
    expect(emitted?.fields.name).toBe('Barry');
    expect(emitted?.fields.monsterTemplateId).toBeNull();
  });
});
