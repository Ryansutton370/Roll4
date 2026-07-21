import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MonsterTemplate } from '../../models/monster-template.model';
import { MonsterStatBlockDialog } from './monster-stat-block-dialog';

const goblin: MonsterTemplate = {
  id: '5e-srd-goblin',
  source: '5e-srd',
  homebrew: false,
  name: 'Goblin',
  difficulty: 0.25,
  ac: 15,
  maxHp: 7,
  initiativeModifier: 2,
  statBlock: [
    { label: 'Type', value: 'Small, Humanoid, goblinoid' },
    { label: 'Nimble Escape', value: 'The goblin can take the Disengage or Hide action...' },
  ],
};

describe('MonsterStatBlockDialog', () => {
  let component: MonsterStatBlockDialog;
  let fixture: ComponentFixture<MonsterStatBlockDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MonsterStatBlockDialog],
    }).compileComponents();

    fixture = TestBed.createComponent(MonsterStatBlockDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('opens the native dialog and renders the template', async () => {
    const dialog: HTMLDialogElement = fixture.nativeElement.querySelector('dialog');
    const showModalSpy = vi.fn();
    dialog.showModal = showModalSpy;

    component.openFor(goblin);
    fixture.detectChanges();

    expect(showModalSpy).toHaveBeenCalled();
    const heading: HTMLElement = fixture.nativeElement.querySelector('h2');
    expect(heading.textContent).toBe('Goblin');
    const meta: HTMLElement = fixture.nativeElement.querySelector('.stat-block-meta');
    expect(meta.textContent).toContain('D&D 5e SRD');
    expect(meta.textContent).toContain('CR 0.25');
    const entries = fixture.nativeElement.querySelectorAll('.stat-block-entries dt');
    expect(entries.length).toBe(2);
    expect(entries[1].textContent).toBe('Nimble Escape');
  });

  it('labels a homebrew entry as such, distinct from the licensed import', () => {
    const dialog: HTMLDialogElement = fixture.nativeElement.querySelector('dialog');
    dialog.showModal = vi.fn();
    const homebrewGoblin: MonsterTemplate = { ...goblin, id: 'homebrew-goblin', homebrew: true };

    component.openFor(homebrewGoblin);
    fixture.detectChanges();

    const meta: HTMLElement = fixture.nativeElement.querySelector('.stat-block-meta');
    expect(meta.textContent).toContain('D&D 5e SRD (Homebrew)');
  });

  it('closes the dialog on Close', () => {
    const dialog: HTMLDialogElement = fixture.nativeElement.querySelector('dialog');
    dialog.showModal = vi.fn();
    const closeSpy = vi.fn();
    dialog.close = closeSpy;

    component.openFor(goblin);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('.dialog-close-btn').click();

    expect(closeSpy).toHaveBeenCalled();
  });

  it('closes on a click outside the dialog box, not on a click inside it', () => {
    const dialog: HTMLDialogElement = fixture.nativeElement.querySelector('dialog');
    dialog.showModal = vi.fn();
    const closeSpy = vi.fn();
    dialog.close = closeSpy;
    // jsdom lays every element out at 0x0 by default, so getBoundingClientRect()
    // wouldn't naturally distinguish "inside" from "outside" here — stubbed to
    // a fixed box the way monster-stat-block-dialog.ts actually renders one.
    dialog.getBoundingClientRect = () =>
      ({ left: 100, right: 300, top: 100, bottom: 300 }) as DOMRect;

    component.openFor(goblin);
    fixture.detectChanges();

    dialog.dispatchEvent(new MouseEvent('click', { clientX: 200, clientY: 200 }));
    expect(closeSpy).not.toHaveBeenCalled();

    dialog.dispatchEvent(new MouseEvent('click', { clientX: 10, clientY: 10 }));
    expect(closeSpy).toHaveBeenCalled();
  });
});
