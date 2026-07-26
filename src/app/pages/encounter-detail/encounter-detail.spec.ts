import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { AuthService } from '../../services/auth-service';
import { EncounterStore } from '../../services/encounter-store';
import { NpcStore } from '../../services/npc-store';
import { PartyStore } from '../../services/party-store';
import { FakeAuthService } from '../../services/testing/fake-auth-service';
import { __resetFakeFirestore } from '../../services/testing/fake-firestore';
import { FakeNpcStore } from '../../services/testing/fake-npc-store';
import { FakePartyStore } from '../../services/testing/fake-party-store';
import { EncounterDetail } from './encounter-detail';

describe('EncounterDetail', () => {
  let component: EncounterDetail;
  let fixture: ComponentFixture<EncounterDetail>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [EncounterDetail],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(EncounterDetail);
    // encounterId is input.required<string>() — see the note in
    // party-detail.spec.ts for why tests must set it explicitly.
    fixture.componentRef.setInput('encounterId', 'nonexistent-encounter');
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

// Roll Initiative button emphasis flash — a separate describe block (rather
// than folding into the suite above) because it needs the real, Firestore-
// backed EncounterStore actually populated with an Encounter/Combatants
// (to drive combatants()/hasStarted()), same "fake 'firebase/firestore'
// itself, use the real store" approach as encounter-list.spec.ts — plus
// fake timers, since the flash's revert is a real setTimeout.
vi.mock('firebase/firestore', async () => {
  const { createFakeFirestoreModule } = await import('../../services/testing/fake-firestore');
  return createFakeFirestoreModule();
});

describe('EncounterDetail roll button emphasis', () => {
  let component: EncounterDetail;
  let fixture: ComponentFixture<EncounterDetail>;
  let encounterStore: EncounterStore;

  beforeEach(async () => {
    localStorage.clear();
    __resetFakeFirestore();
    vi.useFakeTimers();
    // jsdom doesn't implement scrollIntoView/ResizeObserver — harmless to
    // stub here, only exercised because rollInitiative() (in the "already
    // rolled" test below) renders the run-phase view, whose own unrelated
    // effects (active-combatant-scroll, the Timers rail's ResizeObserver)
    // then run for the first time.
    Element.prototype.scrollIntoView = vi.fn();
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    };
    await TestBed.configureTestingModule({
      imports: [EncounterDetail],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: new FakeAuthService() },
        { provide: PartyStore, useValue: new FakePartyStore() },
        { provide: NpcStore, useValue: new FakeNpcStore() },
      ],
    }).compileComponents();

    encounterStore = TestBed.inject(EncounterStore);
    // Flushes EncounterStore's constructor effect() (what actually
    // subscribes its Firestore onSnapshot listeners) *before* any test
    // mutates it — same reasoning as encounter-store.spec.ts's own
    // TestBed.tick() here. Without this, a test's createEncounter()/
    // addAdHocCombatant() calls land before anything is listening.
    TestBed.tick();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // TestBed.tick() (not fixture.whenStable(), which polls via a real timer
  // and hangs forever under vi.useFakeTimers() above) is what flushes
  // effect() — same reasoning as encounter-store.spec.ts's own use of it.
  function createComponent(encounterId: string): void {
    fixture = TestBed.createComponent(EncounterDetail);
    fixture.componentRef.setInput('encounterId', encounterId);
    component = fixture.componentInstance;
    fixture.detectChanges();
    TestBed.tick();
  }

  function rollBtn(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.roll-btn');
  }

  it('flashes immediately when the page is opened on an Encounter that already has combatants', () => {
    const encounter = encounterStore.createEncounter('Goblin Ambush', []);
    encounterStore.addAdHocCombatant(encounter.id, 'npc', {
      name: 'Goblin',
      initiativeModifier: 0,
      ac: null,
      maxHp: null,
      notes: '',
    });

    createComponent(encounter.id);

    expect(component['rollButtonEmphasized']()).toBe(true);
    expect(rollBtn().classList.contains('emphasize')).toBe(true);
  });

  it('does not flash when opened on an Encounter with no combatants yet', () => {
    const encounter = encounterStore.createEncounter('Empty Encounter', []);

    createComponent(encounter.id);

    expect(component['rollButtonEmphasized']()).toBe(false);
    expect(rollBtn().classList.contains('emphasize')).toBe(false);
  });

  it('clears itself after the emphasis duration', () => {
    const encounter = encounterStore.createEncounter('Goblin Ambush', []);
    encounterStore.addAdHocCombatant(encounter.id, 'npc', {
      name: 'Goblin',
      initiativeModifier: 0,
      ac: null,
      maxHp: null,
      notes: '',
    });

    createComponent(encounter.id);
    expect(component['rollButtonEmphasized']()).toBe(true);

    vi.advanceTimersByTime(900);
    fixture.detectChanges();
    TestBed.tick();

    expect(component['rollButtonEmphasized']()).toBe(false);
    expect(rollBtn().classList.contains('emphasize')).toBe(false);
  });

  it('flashes again when a combatant is added to an already-open Encounter', () => {
    const encounter = encounterStore.createEncounter('Empty Encounter', []);
    createComponent(encounter.id);
    expect(component['rollButtonEmphasized']()).toBe(false);

    encounterStore.addAdHocCombatant(encounter.id, 'npc', {
      name: 'Orc',
      initiativeModifier: 0,
      ac: null,
      maxHp: null,
      notes: '',
    });
    fixture.detectChanges();
    TestBed.tick();

    expect(component['rollButtonEmphasized']()).toBe(true);
  });

  it('does not flash once initiative has been rolled', () => {
    const encounter = encounterStore.createEncounter('Goblin Ambush', []);
    encounterStore.addAdHocCombatant(encounter.id, 'npc', {
      name: 'Goblin',
      initiativeModifier: 0,
      ac: null,
      maxHp: null,
      notes: '',
    });
    encounterStore.rollInitiative(encounter.id);

    createComponent(encounter.id);

    expect(component['rollButtonEmphasized']()).toBe(false);
    expect(fixture.nativeElement.querySelector('.roll-btn')).toBeNull();
  });
});
