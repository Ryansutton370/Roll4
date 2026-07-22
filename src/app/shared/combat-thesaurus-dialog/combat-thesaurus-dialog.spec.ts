import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CombatThesaurusTable } from '../../models/combat-thesaurus-table.model';
import { CombatThesaurusDialog } from './combat-thesaurus-dialog';

const sampleTables: CombatThesaurusTable[] = [
  {
    id: 'combat-thesaurus-blade',
    setName: 'Combat Thesaurus',
    tableName: 'Blade',
    icon: 'blade',
    entries: ['Slash', 'Stab'],
  },
];

describe('CombatThesaurusDialog', () => {
  let component: CombatThesaurusDialog;
  let fixture: ComponentFixture<CombatThesaurusDialog>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CombatThesaurusDialog],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(CombatThesaurusDialog);
    component = fixture.componentInstance;

    httpMock = TestBed.inject(HttpTestingController);
    httpMock.expectOne('data/combat-thesaurus.json').flush(sampleTables);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('opens the native dialog and renders the picker', () => {
    const dialog: HTMLDialogElement = fixture.nativeElement.querySelector('dialog');
    const showModalSpy = vi.fn();
    dialog.showModal = showModalSpy;

    component.open();
    fixture.detectChanges();

    expect(showModalSpy).toHaveBeenCalled();
    const categoryBtn: HTMLElement = fixture.nativeElement.querySelector('.category-btn');
    expect(categoryBtn.textContent).toContain('Blade');
  });

  it('closes the dialog on ×', () => {
    const dialog: HTMLDialogElement = fixture.nativeElement.querySelector('dialog');
    dialog.showModal = vi.fn();
    const closeSpy = vi.fn();
    dialog.close = closeSpy;

    component.open();
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
    // a fixed box the way combat-thesaurus-dialog.ts actually renders one.
    dialog.getBoundingClientRect = () =>
      ({ left: 100, right: 300, top: 100, bottom: 300 }) as DOMRect;

    component.open();
    fixture.detectChanges();

    dialog.dispatchEvent(new MouseEvent('click', { clientX: 200, clientY: 200 }));
    expect(closeSpy).not.toHaveBeenCalled();

    dialog.dispatchEvent(new MouseEvent('click', { clientX: 10, clientY: 10 }));
    expect(closeSpy).toHaveBeenCalled();
  });
});
