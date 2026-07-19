import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Combatant } from '../../models/encounter.model';
import { CombatantBubble } from './combatant-bubble';

const combatant: Combatant = {
  id: 'c1',
  encounterId: 'e1',
  type: 'pc',
  pcId: 'pc1',
  name: 'Aria Windmere',
  initiativeModifier: 3,
  ac: 16,
  maxHp: 30,
  currentHp: 22,
  notes: 'Wields a longsword',
  lastRoll: 12,
  initiativeTotal: 15,
  removedFromCombat: false,
  incapacitated: false,
  onHold: false,
  preHoldLastRoll: null,
  preHoldInitiativeTotal: null,
};

describe('CombatantBubble', () => {
  let component: CombatantBubble;
  let fixture: ComponentFixture<CombatantBubble>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CombatantBubble],
    }).compileComponents();

    fixture = TestBed.createComponent(CombatantBubble);
    fixture.componentRef.setInput('combatant', combatant);
    fixture.componentRef.setInput('expanded', false);
    fixture.componentRef.setInput('isPlacing', false);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('emits expandToggle when the expand button is clicked', () => {
    let emittedCount = 0;
    component.expandToggle.subscribe(() => emittedCount++);

    const expandBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.expand-btn');
    expandBtn.click();

    expect(emittedCount).toBe(1);
  });

  it('emits removedToggle when the drawer checkbox changes', () => {
    let emittedCount = 0;
    component.removedToggle.subscribe(() => emittedCount++);

    // Each checkbox sits alone in its own <label>, so :last-of-type matches
    // all three (one per label) — index into the NodeList by position
    // (Hold Action, Incapacitated, Removed from Combat) instead.
    const checkboxes = fixture.nativeElement.querySelectorAll(
      '.drawer-content input[type="checkbox"]',
    ) as NodeListOf<HTMLInputElement>;
    checkboxes[2].dispatchEvent(new Event('change'));

    expect(emittedCount).toBe(1);
  });

  it('emits editRequested when the drawer Edit button is clicked', () => {
    let emittedCount = 0;
    component.editRequested.subscribe(() => emittedCount++);

    const editBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.drawer-edit-btn');
    editBtn.click();

    expect(emittedCount).toBe(1);
  });

  it('renders the AC/HP/Notes row and emits hpAdjustSubmit with the typed delta', () => {
    const hpStat: HTMLButtonElement = fixture.nativeElement.querySelector('.hp-stat');
    expect(hpStat.textContent).toContain('22/30');

    let emitted: number | undefined;
    component.hpAdjustSubmit.subscribe((delta) => (emitted = delta));

    hpStat.click();
    fixture.detectChanges();

    const input: HTMLInputElement = fixture.nativeElement.querySelector('.hp-delta-input');
    input.value = '-15';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const confirmBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.hp-adjust-popover .icon-btn');
    confirmBtn.click();

    expect(emitted).toBe(-15);
  });
});
