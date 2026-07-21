import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MonsterTemplate } from '../../models/monster-template.model';
import { MonsterPickerTable } from './monster-picker-table';

const templates: MonsterTemplate[] = [
  {
    id: '5e-srd-goblin',
    source: '5e-srd',
    homebrew: false,
    name: 'Goblin',
    difficulty: 0.25,
    ac: 15,
    maxHp: 7,
    initiativeModifier: 2,
    statBlock: [],
  },
  {
    id: '5e-srd-ancient-red-dragon',
    source: '5e-srd',
    homebrew: false,
    name: 'Ancient Red Dragon',
    difficulty: 24,
    ac: 22,
    maxHp: 546,
    initiativeModifier: 0,
    statBlock: [],
  },
  {
    id: '5e-srd-swarming-thing',
    source: '5e-srd',
    homebrew: true,
    name: 'Context-Scaling Thing',
    difficulty: null,
    ac: null,
    maxHp: null,
    initiativeModifier: 0,
    statBlock: [],
  },
];

describe('MonsterPickerTable', () => {
  let component: MonsterPickerTable;
  let fixture: ComponentFixture<MonsterPickerTable>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MonsterPickerTable],
    }).compileComponents();

    fixture = TestBed.createComponent(MonsterPickerTable);
    fixture.componentRef.setInput('source', '5e-srd');
    fixture.componentRef.setInput('templates', templates);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('starts collapsed by default, with no table rendered', () => {
    expect(fixture.nativeElement.querySelector('.picker-table')).toBeNull();
  });

  it('starts expanded when initiallyExpanded is true', async () => {
    fixture.componentRef.setInput('initiallyExpanded', true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.picker-table')).not.toBeNull();
  });

  it('the toggle button expands and collapses the table', () => {
    const toggle: HTMLButtonElement = fixture.nativeElement.querySelector('.picker-toggle');
    toggle.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.picker-table')).not.toBeNull();

    toggle.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.picker-table')).toBeNull();
  });

  function expandedRowNames(): string[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll('.picker-table tbody tr td:first-child'),
    ).map((td) => (td as HTMLElement).textContent);
  }

  it('sorts by Name A-Z by default, with null-difficulty entries unaffected by that sort', () => {
    fixture.componentRef.setInput('initiallyExpanded', true);
    fixture.detectChanges();

    expect(expandedRowNames()).toEqual(['Ancient Red Dragon', 'Context-Scaling Thing', 'Goblin']);
  });

  it('clicking the Name header again reverses to Z-A', () => {
    fixture.componentRef.setInput('initiallyExpanded', true);
    fixture.detectChanges();

    const nameHeaderBtn: HTMLButtonElement = fixture.nativeElement.querySelectorAll('.sort-btn')[0];
    nameHeaderBtn.click();
    fixture.detectChanges();

    expect(expandedRowNames()).toEqual(['Goblin', 'Context-Scaling Thing', 'Ancient Red Dragon']);
  });

  it('sorting by CR/LV always sorts null-difficulty entries last, in either direction', () => {
    fixture.componentRef.setInput('initiallyExpanded', true);
    fixture.detectChanges();

    const difficultyHeaderBtn: HTMLButtonElement =
      fixture.nativeElement.querySelectorAll('.sort-btn')[1];
    difficultyHeaderBtn.click();
    fixture.detectChanges();
    expect(expandedRowNames()).toEqual(['Goblin', 'Ancient Red Dragon', 'Context-Scaling Thing']);

    difficultyHeaderBtn.click();
    fixture.detectChanges();
    expect(expandedRowNames()).toEqual(['Ancient Red Dragon', 'Goblin', 'Context-Scaling Thing']);
  });

  it('filters rows by case-insensitive name search', () => {
    fixture.componentRef.setInput('initiallyExpanded', true);
    fixture.detectChanges();

    const search: HTMLInputElement = fixture.nativeElement.querySelector('.picker-search');
    search.value = 'gob';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(expandedRowNames()).toEqual(['Goblin']);
  });

  it('clicking a row Add button emits addTemplate with the full MonsterTemplate', () => {
    fixture.componentRef.setInput('initiallyExpanded', true);
    fixture.detectChanges();

    const emitted: MonsterTemplate[] = [];
    component.addTemplate.subscribe((t) => emitted.push(t));

    const addBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.add-btn');
    addBtn.click();

    expect(emitted.length).toBe(1);
    expect(emitted[0].name).toBe('Ancient Red Dragon');
  });

  it('clicking a row eye icon opens the embedded stat-block dialog', () => {
    fixture.componentRef.setInput('initiallyExpanded', true);
    fixture.detectChanges();

    const dialog: HTMLDialogElement = fixture.nativeElement.querySelector('.stat-block-dialog');
    const showModalSpy = vi.fn();
    dialog.showModal = showModalSpy;

    const eyeBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.picker-table .icon-btn:not(.add-btn)',
    );
    eyeBtn.click();
    fixture.detectChanges();

    expect(showModalSpy).toHaveBeenCalled();
    const heading: HTMLElement = fixture.nativeElement.querySelector('.stat-block-dialog h2');
    expect(heading.textContent).toBe('Ancient Red Dragon');
  });
});
