import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MonsterTemplate } from '../../models/monster-template.model';
import { ToastService } from '../../shared/toast/toast';

import { NpcRoster } from './npc-roster';

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

describe('NpcRoster', () => {
  let component: NpcRoster;
  let fixture: ComponentFixture<NpcRoster>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [NpcRoster],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(NpcRoster);
    component = fixture.componentInstance;
    fixture.detectChanges();

    httpMock = TestBed.inject(HttpTestingController);
    httpMock.expectOne('data/monsters-5e-srd.json').flush([goblin]);
    httpMock.expectOne('data/monsters-shadowdark.json').flush([]);
    // CombatantFields' embedded NameGeneratorButton (used by the always-
    // rendered manual create form below) injects NameTableStore, which
    // fires this request too — see the equivalent gotcha noted in
    // add-combatant-dialog.spec.ts.
    httpMock.expectOne('data/name-tables.json').flush([]);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('creates an npc from the form', () => {
    component['newNpcName'].set('Goblin');
    component['createNpc']();

    expect(component['npcStore'].npcs().map((n) => n.name)).toEqual(['Goblin']);
  });

  it('renders the Browse Monster List section with the 5e SRD source by default', () => {
    expect(fixture.nativeElement.querySelector('.browse-section')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-monster-picker-table')).toBeTruthy();

    fixture.nativeElement.querySelector('.picker-toggle').click();
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('.picker-table tbody tr');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('Goblin');
  });

  it('picking a monster from Browse Monster List saves it straight into the roster, with the template link, and shows a confirmation toast', () => {
    const toastService = TestBed.inject(ToastService);

    fixture.nativeElement.querySelector('.picker-toggle').click();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.picker-table .add-btn').click();
    fixture.detectChanges();

    const npcs = component['npcStore'].npcs();
    expect(npcs.length).toBe(1);
    expect(npcs[0].name).toBe('Goblin');
    expect(npcs[0].ac).toBe(15);
    expect(npcs[0].maxHp).toBe(7);
    expect(npcs[0].initiativeModifier).toBe(2);
    expect(npcs[0].monsterTemplateId).toBe('5e-srd-goblin');
    expect(npcs[0].monsterName).toBe('Goblin');
    expect(toastService.messages().map((m) => m.text)).toContain('Added Goblin to NPC roster');
  });

  it('a monster added via Browse Monster List appears in the roster list, inline-editable like any other NPC', async () => {
    fixture.nativeElement.querySelector('.picker-toggle').click();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.picker-table .add-btn').click();
    fixture.detectChanges();
    await fixture.whenStable();

    const nameInput: HTMLInputElement = fixture.nativeElement.querySelector('.pc-name');
    expect(nameInput.value).toBe('Goblin');

    nameInput.value = 'Barry';
    nameInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(component['npcStore'].npcs()[0].name).toBe('Barry');
  });

  it('switching the source shows the matching sourcebook toggle as active', () => {
    const buttons: HTMLButtonElement[] = fixture.nativeElement.querySelectorAll(
      '.browse-section .source-toggle button',
    );
    expect(buttons[0].classList.contains('active')).toBe(true);

    buttons[1].click();
    fixture.detectChanges();

    expect(buttons[1].classList.contains('active')).toBe(true);
    expect(buttons[0].classList.contains('active')).toBe(false);
  });
});
