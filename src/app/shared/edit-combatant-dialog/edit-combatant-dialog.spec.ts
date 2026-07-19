import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Combatant } from '../../models/encounter.model';
import { EditCombatantDialog } from './edit-combatant-dialog';

const combatant: Combatant = {
  id: 'c1',
  encounterId: 'e1',
  type: 'npc',
  pcId: null,
  name: 'Goblin',
  initiativeModifier: 2,
  ac: 13,
  maxHp: 7,
  currentHp: 7,
  notes: 'Skittish',
  lastRoll: null,
  initiativeTotal: null,
  removedFromCombat: false,
  incapacitated: false,
  onHold: false,
  preHoldLastRoll: null,
  preHoldInitiativeTotal: null,
};

describe('EditCombatantDialog', () => {
  let component: EditCombatantDialog;
  let fixture: ComponentFixture<EditCombatantDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditCombatantDialog],
    }).compileComponents();

    fixture = TestBed.createComponent(EditCombatantDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('seeds the form from the combatant and opens the native dialog', async () => {
    const dialog: HTMLDialogElement = fixture.nativeElement.querySelector('dialog');
    // This test environment's DOM doesn't implement <dialog>'s
    // showModal()/close() at all (no method to spy on), so they're stubbed
    // directly rather than via vi.spyOn.
    const showModalSpy = vi.fn();
    dialog.showModal = showModalSpy;

    component.openFor(combatant);
    fixture.detectChanges();
    // NgModel defers writing the DOM value to a microtask (to avoid an
    // ExpressionChangedAfterItHasBeenCheckedError) rather than doing it
    // synchronously inside detectChanges() — whenStable() flushes it.
    await fixture.whenStable();

    expect(showModalSpy).toHaveBeenCalled();
    const nameInput: HTMLInputElement = fixture.nativeElement.querySelector('.field-name');
    expect(nameInput.value).toBe('Goblin');
  });

  it('emits saveRequested with the edited fields and closes the dialog', async () => {
    const dialog: HTMLDialogElement = fixture.nativeElement.querySelector('dialog');
    dialog.showModal = vi.fn();
    const closeSpy = vi.fn();
    dialog.close = closeSpy;

    component.openFor(combatant);
    fixture.detectChanges();
    await fixture.whenStable();

    let emitted: { combatantId: string; changes: { name: string; ac: number | null } } | undefined;
    component.saveRequested.subscribe((event) => (emitted = event));

    const nameInput: HTMLInputElement = fixture.nativeElement.querySelector('.field-name');
    nameInput.value = 'Goblin Boss';
    nameInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();

    const form: HTMLFormElement = fixture.nativeElement.querySelector('form');
    form.dispatchEvent(new Event('submit'));

    expect(emitted?.combatantId).toBe('c1');
    expect(emitted?.changes.name).toBe('Goblin Boss');
    expect(emitted?.changes.ac).toBe(13);
    expect(closeSpy).toHaveBeenCalled();
  });
});
