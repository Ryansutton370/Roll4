import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CombatantFields } from './combatant-fields';

describe('CombatantFields', () => {
  let component: CombatantFields;
  let fixture: ComponentFixture<CombatantFields>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CombatantFields],
    }).compileComponents();

    fixture = TestBed.createComponent(CombatantFields);
    fixture.componentRef.setInput('name', 'Goblin');
    fixture.componentRef.setInput('initiativeModifier', 2);
    fixture.componentRef.setInput('ac', 15);
    fixture.componentRef.setInput('maxHp', 7);
    fixture.componentRef.setInput('notes', 'Skittish');
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the bound values into their inputs', () => {
    const nameInput: HTMLInputElement = fixture.nativeElement.querySelector('.field-name');
    const acInput: HTMLInputElement = fixture.nativeElement.querySelector('.field-ac');
    expect(nameInput.value).toBe('Goblin');
    expect(acInput.value).toBe('15');
  });

  // model() returns a signal that doubles as its own output (there's no
  // separate `nameChange` class member — the compiler only synthesizes
  // that name for template `[(name)]` sugar) — subscribing directly to
  // the model signal confirms typing into the field both updates it and
  // would notify a parent bound via [(name)]="mySignal".
  it('updates the name model and notifies subscribers when the name field changes', () => {
    let emitted: string | undefined;
    component.name.subscribe((value) => (emitted = value));

    const nameInput: HTMLInputElement = fixture.nativeElement.querySelector('.field-name');
    nameInput.value = 'Goblin Boss';
    nameInput.dispatchEvent(new Event('input'));

    expect(component.name()).toBe('Goblin Boss');
    expect(emitted).toBe('Goblin Boss');
  });

  it('marks the Notes toggle as having notes, and expands the rich-text editor on click', () => {
    const toggle: HTMLButtonElement = fixture.nativeElement.querySelector('.field-icon-notes');
    expect(toggle.classList.contains('has-notes')).toBe(true);
    expect(toggle.title).toBe('See Notes');
    expect(fixture.nativeElement.querySelector('app-rich-text-editor')).toBeNull();

    toggle.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-rich-text-editor')).not.toBeNull();
  });

  it('shows the Notes toggle as empty when there are no notes', () => {
    fixture.componentRef.setInput('notes', '');
    fixture.detectChanges();

    const toggle: HTMLButtonElement = fixture.nativeElement.querySelector('.field-icon-notes');
    expect(toggle.classList.contains('has-notes')).toBe(false);
    expect(toggle.title).toBe('Add Notes');
  });
});
