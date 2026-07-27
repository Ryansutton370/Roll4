import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Combatant } from '../../models/encounter.model';
import { CombatantBubble } from './combatant-bubble';

const combatant: Combatant = {
  id: 'c1',
  encounterId: 'e1',
  ownerId: 'test-gm',
  type: 'pc',
  playerId: 'pc1',
  npcId: null,
  name: 'Aria Windmere',
  initiativeModifier: 3,
  initiativeAdvantage: 'none',
  ac: 16,
  maxHp: 30,
  currentHp: 22,
  tempHp: 0,
  bonusAc: 0,
  notes: 'Wields a longsword',
  monsterTemplateId: null,
  monsterName: null,
  lastRoll: 12,
  initiativeTotal: 15,
  removedFromCombat: false,
  incapacitated: false,
  onHold: false,
  preHoldLastRoll: null,
  preHoldInitiativeTotal: null,
  readyToJoin: false,
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
    fixture.componentRef.setInput('displayName', combatant.name);
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

  it('emits editRequested when the drawer Edit Info button is clicked', () => {
    let emittedCount = 0;
    component.editRequested.subscribe(() => emittedCount++);

    const editBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.edit-info-btn');
    editBtn.click();

    expect(emittedCount).toBe(1);
  });

  it('emits createTimerRequested when the drawer Create Timer button is clicked', () => {
    let emittedCount = 0;
    component.createTimerRequested.subscribe(() => emittedCount++);

    const createTimerBtn: HTMLButtonElement =
      fixture.nativeElement.querySelector('.create-timer-btn');
    createTimerBtn.click();

    expect(emittedCount).toBe(1);
  });

  it('renders the AC/HP/Notes row and emits a damage delta by default', async () => {
    const hpStat: HTMLButtonElement = fixture.nativeElement.querySelector('.hp-stat');
    expect(hpStat.textContent).toContain('22/30');

    let emitted: number | undefined;
    component.hpAdjustSubmit.subscribe((delta) => (emitted = delta));

    hpStat.click();
    fixture.detectChanges();
    // NgModel writes its bound value into the input asynchronously (a
    // microtask, to avoid an ExpressionChangedAfterItHasBeenCheckedError) —
    // whenStable() flushes that before the next assertion reads .value.
    // See combatant-fields.spec.ts for the same pattern.
    await fixture.whenStable();

    // Damage is the default mode — typing "15" (just the magnitude) should
    // submit as -15, with no +/- to type.
    const input: HTMLInputElement = fixture.nativeElement.querySelector('.hp-delta-input');
    expect(input.value).toBe('-');
    input.value = '-15';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const confirmBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.hp-adjust-popover .icon-btn',
    );
    confirmBtn.click();

    expect(emitted).toBe(-15);
  });

  it('emits a positive delta once the Damage/Healing toggle is switched to Healing', async () => {
    let emitted: number | undefined;
    component.hpAdjustSubmit.subscribe((delta) => (emitted = delta));

    const hpStat: HTMLButtonElement = fixture.nativeElement.querySelector('.hp-stat');
    hpStat.click();
    fixture.detectChanges();
    await fixture.whenStable();

    // The toggle is a real checkbox (styled as a switch, see .hp-mode-switch
    // in combatant-bubble.css) — 'change' is what a click/tap/keyboard
    // toggle actually fires on a checkbox, same as the drawer's checkboxes
    // above.
    const modeCheckbox: HTMLInputElement = fixture.nativeElement.querySelector(
      '.hp-mode-switch input[type="checkbox"]',
    );
    modeCheckbox.checked = true;
    modeCheckbox.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await fixture.whenStable();
    const modeLabel: HTMLElement = fixture.nativeElement.querySelector('.hp-mode-label');
    expect(modeLabel.textContent?.trim()).toBe('Healing');

    // Typing a literal "-" is stripped along with the digits it's typed
    // with — only the toggle can set the sign, so this still heals.
    const input: HTMLInputElement = fixture.nativeElement.querySelector('.hp-delta-input');
    input.value = '+-10';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(input.value).toBe('+10');

    const confirmBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.hp-adjust-popover .icon-btn',
    );
    confirmBtn.click();

    expect(emitted).toBe(10);
  });

  it('+Temp opens a dedicated entry prompt instead of reading the damage/heal input, and the checkmark submits it', async () => {
    let emitted: number | undefined;
    component.tempHpSubmit.subscribe((amount) => (emitted = amount));

    const hpStat: HTMLButtonElement = fixture.nativeElement.querySelector('.hp-stat');
    hpStat.click();
    fixture.detectChanges();
    await fixture.whenStable();

    // Type a damage amount first — the entry prompt must NOT read this.
    const damageInput: HTMLInputElement = fixture.nativeElement.querySelector('.hp-delta-input');
    damageInput.value = '-99';
    damageInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const tempBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.temp-hp-btn');
    tempBtn.click();
    fixture.detectChanges();
    await fixture.whenStable();

    // Nothing emitted yet — opening the prompt isn't a submit.
    expect(emitted).toBeUndefined();
    // The damage/heal controls are gone; a fresh, empty entry input is shown instead.
    expect(fixture.nativeElement.querySelector('.hp-mode-switch')).toBeNull();
    const entryInput: HTMLInputElement = fixture.nativeElement.querySelector('.hp-delta-input');
    expect(entryInput.value).toBe('');

    entryInput.value = '5';
    entryInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const saveBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.temp-hp-entry-actions .icon-btn',
    );
    saveBtn.click();

    expect(emitted).toBe(5);
  });

  it('the entry prompt\'s X cancels without submitting and returns to the normal Damage/Healing view', async () => {
    let emittedCount = 0;
    component.tempHpSubmit.subscribe(() => emittedCount++);

    const hpStat: HTMLButtonElement = fixture.nativeElement.querySelector('.hp-stat');
    hpStat.click();
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.nativeElement.querySelector('.temp-hp-btn').click();
    fixture.detectChanges();
    await fixture.whenStable();

    const entryInput: HTMLInputElement = fixture.nativeElement.querySelector('.hp-delta-input');
    entryInput.value = '5';
    entryInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.temp-hp-entry-actions .icon-btn'),
    );
    buttons[1].click(); // the X
    fixture.detectChanges();

    expect(emittedCount).toBe(0);
    expect(fixture.nativeElement.querySelector('.hp-mode-switch')).not.toBeNull();
  });

  it('marks the Notes badge dark with a "See Notes" hint when the combatant has notes', () => {
    const notesBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.notes-badge-btn');
    expect(notesBtn.classList.contains('has-notes')).toBe(true);
    expect(notesBtn.title).toBe('See Notes');

    let emittedCount = 0;
    component.notesRequested.subscribe(() => emittedCount++);
    notesBtn.click();
    expect(emittedCount).toBe(1);
  });

  it('marks the Notes badge muted with an "Add Notes" hint when the combatant has no notes', async () => {
    fixture.componentRef.setInput('combatant', { ...combatant, notes: '<p><br></p>' });
    fixture.detectChanges();
    await fixture.whenStable();

    const notesBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.notes-badge-btn');
    expect(notesBtn.classList.contains('has-notes')).toBe(false);
    expect(notesBtn.title).toBe('Add Notes');
  });

  it('only shows the View Stat Block badge for a monster-templated combatant, and emits viewStatBlockRequested when clicked', async () => {
    expect(fixture.nativeElement.querySelector('.stat-block-badge-btn')).toBeNull();

    fixture.componentRef.setInput('combatant', {
      ...combatant,
      monsterTemplateId: '5e-srd-goblin',
      monsterName: 'Goblin',
    });
    fixture.detectChanges();
    await fixture.whenStable();

    let emittedCount = 0;
    component.viewStatBlockRequested.subscribe(() => emittedCount++);
    const statBlockBtn: HTMLButtonElement =
      fixture.nativeElement.querySelector('.stat-block-badge-btn');
    statBlockBtn.click();

    expect(emittedCount).toBe(1);
  });

  it('hides AC/HP/Notes/Initiative from the row in compact mode, moving them into the drawer instead', async () => {
    fixture.componentRef.setInput('compact', true);
    fixture.detectChanges();
    await fixture.whenStable();

    const row: HTMLElement = fixture.nativeElement.querySelector('.combatant-row');
    expect(row.querySelector('.init-stat')).toBeNull();
    expect(row.querySelector('.hp-stat-wrapper')).toBeNull();

    // #statsBlock instead renders inside .drawer-stats — collapsed via the
    // drawer's own grid-rows trick (combatant-bubble.css) rather than being
    // absent from the DOM, same as the drawer's checkboxes always are.
    const drawer: HTMLElement = fixture.nativeElement.querySelector('.drawer-stats');
    expect(drawer.querySelector('.init-stat')).not.toBeNull();
    expect(drawer.querySelector('.init-stat')?.textContent).toContain('15');
  });
});
