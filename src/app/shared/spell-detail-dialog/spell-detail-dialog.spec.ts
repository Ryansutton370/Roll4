import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SpellTemplate } from '../../models/spell-template.model';
import { SpellDetailDialog } from './spell-detail-dialog';

const fireball: SpellTemplate = {
  id: '5e-srd-fireball',
  source: '5e-srd',
  homebrew: false,
  name: 'Fireball',
  level: 3,
  school: 'Evocation',
  classes: ['Sorcerer', 'Wizard'],
  description: 'A bright streak of flame.',
  details: [
    { label: 'Casting Time', value: '1 action' },
    { label: 'Range', value: '150 feet' },
  ],
};

const light: SpellTemplate = {
  id: 'shadowdark-light',
  source: 'shadowdark',
  homebrew: false,
  name: 'Light',
  level: 1,
  school: null,
  classes: ['Priest', 'Wizard'],
  description: 'Makes an object glow.',
  details: [
    { label: 'Duration', value: 'Focus' },
    { label: 'Range', value: 'Near' },
  ],
};

describe('SpellDetailDialog', () => {
  let component: SpellDetailDialog;
  let fixture: ComponentFixture<SpellDetailDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SpellDetailDialog],
    }).compileComponents();

    fixture = TestBed.createComponent(SpellDetailDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('opens the native dialog and renders a 5e spell', () => {
    const dialog: HTMLDialogElement = fixture.nativeElement.querySelector('dialog');
    const showModalSpy = vi.fn();
    dialog.showModal = showModalSpy;

    component.openFor(fireball);
    fixture.detectChanges();

    expect(showModalSpy).toHaveBeenCalled();
    const heading: HTMLElement = fixture.nativeElement.querySelector('h2');
    expect(heading.textContent).toBe('Fireball');
    const meta: HTMLElement = fixture.nativeElement.querySelector('.spell-detail-meta');
    expect(meta.textContent).toContain('Level 3');
    expect(meta.textContent).toContain('Evocation');
    expect(meta.textContent).toContain('Sorcerer, Wizard');
    const entries = fixture.nativeElement.querySelectorAll('.spell-detail-entries dt');
    expect(entries.length).toBe(2);
  });

  it('omits the school segment for a Shadowdark spell (no school concept) and shows its plain-number level, not "Tier N"', () => {
    const dialog: HTMLDialogElement = fixture.nativeElement.querySelector('dialog');
    dialog.showModal = vi.fn();

    component.openFor(light);
    fixture.detectChanges();

    const meta: HTMLElement = fixture.nativeElement.querySelector('.spell-detail-meta');
    expect(meta.textContent).toContain('1 ·');
    expect(meta.textContent).not.toContain('Tier');
    expect(meta.textContent).not.toContain('null');
    expect(meta.textContent).toContain('Priest, Wizard');
  });

  it('closes the dialog on Close', () => {
    const dialog: HTMLDialogElement = fixture.nativeElement.querySelector('dialog');
    dialog.showModal = vi.fn();
    const closeSpy = vi.fn();
    dialog.close = closeSpy;

    component.openFor(fireball);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('.dialog-close-btn').click();

    expect(closeSpy).toHaveBeenCalled();
  });

  it('closes on a click outside the dialog box, not on a click inside it', () => {
    const dialog: HTMLDialogElement = fixture.nativeElement.querySelector('dialog');
    dialog.showModal = vi.fn();
    const closeSpy = vi.fn();
    dialog.close = closeSpy;
    dialog.getBoundingClientRect = () =>
      ({ left: 100, right: 300, top: 100, bottom: 300 }) as DOMRect;

    component.openFor(fireball);
    fixture.detectChanges();

    dialog.dispatchEvent(new MouseEvent('click', { clientX: 200, clientY: 200 }));
    expect(closeSpy).not.toHaveBeenCalled();

    dialog.dispatchEvent(new MouseEvent('click', { clientX: 10, clientY: 10 }));
    expect(closeSpy).toHaveBeenCalled();
  });
});
