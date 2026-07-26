import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SpellTemplate } from '../../models/spell-template.model';
import { SpellPickerTable } from './spell-picker-table';

const templates: SpellTemplate[] = [
  {
    id: '5e-srd-fireball',
    source: '5e-srd',
    homebrew: false,
    name: 'Fireball',
    level: 3,
    school: 'Evocation',
    classes: ['Sorcerer', 'Wizard'],
    description: 'Boom.',
    details: [],
  },
  {
    id: '5e-srd-acid-splash',
    source: '5e-srd',
    homebrew: false,
    name: 'Acid Splash',
    level: 0,
    school: 'Conjuration',
    classes: ['Sorcerer', 'Wizard'],
    description: 'Splash.',
    details: [],
  },
  {
    id: '5e-srd-cure-wounds',
    source: '5e-srd',
    homebrew: false,
    name: 'Cure Wounds',
    level: 1,
    school: 'Evocation',
    classes: ['Bard', 'Cleric', 'Druid'],
    details: [],
    description: 'Heal.',
  },
];

describe('SpellPickerTable', () => {
  let component: SpellPickerTable;
  let fixture: ComponentFixture<SpellPickerTable>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SpellPickerTable],
    }).compileComponents();

    fixture = TestBed.createComponent(SpellPickerTable);
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

  function rowNames(): string[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll('.picker-table tbody tr td:first-child'),
    ).map((td) => (td as HTMLElement).textContent);
  }

  function rowLevels(): string[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll('.picker-table tbody tr .col-level'),
    ).map((td) => (td as HTMLElement).textContent);
  }

  function headerButton(label: string): HTMLButtonElement {
    return Array.from(fixture.nativeElement.querySelectorAll('.sort-btn')).find((b) =>
      (b as HTMLButtonElement).textContent?.includes(label),
    ) as HTMLButtonElement;
  }

  it('defaults to Name A-Z', () => {
    fixture.componentRef.setInput('initiallyExpanded', true);
    fixture.detectChanges();

    expect(rowNames()).toEqual(['Acid Splash', 'Cure Wounds', 'Fireball']);
  });

  it('clicking the Name header again reverses to Z-A', () => {
    fixture.componentRef.setInput('initiallyExpanded', true);
    fixture.detectChanges();

    headerButton('Name').click();
    fixture.detectChanges();

    expect(rowNames()).toEqual(['Fireball', 'Cure Wounds', 'Acid Splash']);
  });

  it('filters rows by case-insensitive name search', () => {
    fixture.componentRef.setInput('initiallyExpanded', true);
    fixture.detectChanges();

    const search: HTMLInputElement = fixture.nativeElement.querySelector('.picker-search');
    search.value = 'fire';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(rowNames()).toEqual(['Fireball']);
  });

  it('shows a "no matches" message when search matches nothing', () => {
    fixture.componentRef.setInput('initiallyExpanded', true);
    fixture.detectChanges();

    const search: HTMLInputElement = fixture.nativeElement.querySelector('.picker-search');
    search.value = 'zzz';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.empty-state').textContent).toContain(
      'No spells match "zzz"',
    );
  });

  it('clicking the Level column header sorts ascending, with Cantrip (level 0) first, then descending on a second click', () => {
    fixture.componentRef.setInput('initiallyExpanded', true);
    fixture.detectChanges();

    const levelHeaderBtn = headerButton('Level');

    levelHeaderBtn.click();
    fixture.detectChanges();
    expect(rowNames()).toEqual(['Acid Splash', 'Cure Wounds', 'Fireball']);
    expect(rowLevels()).toEqual(['Cantrip', 'Level 1', 'Level 3']);

    levelHeaderBtn.click();
    fixture.detectChanges();
    expect(rowNames()).toEqual(['Fireball', 'Cure Wounds', 'Acid Splash']);
  });

  it('sorts Shadowdark spells by Level numerically (plain numbers, no "Tier" text)', () => {
    const shadowdarkTemplates: SpellTemplate[] = [
      {
        id: 'shadowdark-a',
        source: 'shadowdark',
        homebrew: false,
        name: 'Alpha',
        level: 5,
        school: null,
        classes: ['Wizard'],
        description: '',
        details: [],
      },
      {
        id: 'shadowdark-b',
        source: 'shadowdark',
        homebrew: false,
        name: 'Beta',
        level: 1,
        school: null,
        classes: ['Priest'],
        description: '',
        details: [],
      },
      {
        id: 'shadowdark-c',
        source: 'shadowdark',
        homebrew: false,
        name: 'Gamma',
        level: 3,
        school: null,
        classes: ['Wizard'],
        description: '',
        details: [],
      },
    ];
    fixture.componentRef.setInput('source', 'shadowdark');
    fixture.componentRef.setInput('templates', shadowdarkTemplates);
    fixture.componentRef.setInput('initiallyExpanded', true);
    fixture.detectChanges();

    headerButton('Level').click();
    fixture.detectChanges();

    expect(rowNames()).toEqual(['Beta', 'Gamma', 'Alpha']);
    expect(rowLevels()).toEqual(['1', '3', '5']);
  });

  it('hides the School column for Shadowdark (no school concept)', () => {
    const shadowdarkTemplates: SpellTemplate[] = [
      {
        id: 'shadowdark-light',
        source: 'shadowdark',
        homebrew: false,
        name: 'Light',
        level: 1,
        school: null,
        classes: ['Priest'],
        description: 'Glow.',
        details: [],
      },
    ];
    fixture.componentRef.setInput('source', 'shadowdark');
    fixture.componentRef.setInput('templates', shadowdarkTemplates);
    fixture.componentRef.setInput('initiallyExpanded', true);
    fixture.detectChanges();

    const headers = Array.from(
      fixture.nativeElement.querySelectorAll('.picker-table thead th'),
    ).map((th) => (th as HTMLElement).textContent?.trim());
    expect(headers).not.toContain('School');
    expect(fixture.nativeElement.querySelector('.picker-table tbody .col-school')).toBeNull();
  });

  it('clicking a row eye icon opens the embedded detail dialog', () => {
    fixture.componentRef.setInput('initiallyExpanded', true);
    fixture.detectChanges();

    const dialog: HTMLDialogElement = fixture.nativeElement.querySelector('.spell-detail-dialog');
    const showModalSpy = vi.fn();
    dialog.showModal = showModalSpy;

    const eyeBtn: HTMLButtonElement =
      fixture.nativeElement.querySelector('.picker-table .icon-btn');
    eyeBtn.click();
    fixture.detectChanges();

    expect(showModalSpy).toHaveBeenCalled();
    const heading: HTMLElement = fixture.nativeElement.querySelector('.spell-detail-dialog h2');
    expect(heading.textContent).toBe('Acid Splash');
  });

  describe('Class/School filters', () => {
    // Bless (Cleric/Paladin, Enchantment) alongside the outer templates
    // (Fireball/Acid Splash: Sorcerer/Wizard; Cure Wounds: Bard/Cleric/
    // Druid, both Evocation) gives every combination needed below: a class
    // shared with another spell (Cleric), a class unique to one spell
    // (Paladin), and a school (Enchantment) that doesn't overlap Cure
    // Wounds' Evocation despite sharing the Cleric class.
    const filterTemplates: SpellTemplate[] = [
      ...templates,
      {
        id: '5e-srd-bless',
        source: '5e-srd',
        homebrew: false,
        name: 'Bless',
        level: 1,
        school: 'Enchantment',
        classes: ['Cleric', 'Paladin'],
        description: 'Buff.',
        details: [],
      },
    ];

    beforeEach(() => {
      fixture.componentRef.setInput('templates', filterTemplates);
      fixture.componentRef.setInput('initiallyExpanded', true);
      fixture.detectChanges();
    });

    function chip(groupIndex: number, label: string): HTMLButtonElement {
      const group = fixture.nativeElement.querySelectorAll('.filter-group')[groupIndex];
      const found = Array.from(group.querySelectorAll('.filter-chip')).find(
        (b) => (b as HTMLButtonElement).textContent?.trim() === label,
      );
      if (!found) throw new Error(`No filter chip found for "${label}"`);
      return found as HTMLButtonElement;
    }

    const classChip = (label: string) => chip(0, label);
    const schoolChip = (label: string) => chip(1, label);

    it('filters to spells matching a single checked class', () => {
      classChip('Cleric').click();
      fixture.detectChanges();

      expect(rowNames()).toEqual(['Bless', 'Cure Wounds']);
    });

    it('ORs multiple checked classes together', () => {
      classChip('Bard').click();
      classChip('Paladin').click();
      fixture.detectChanges();

      expect(rowNames()).toEqual(['Bless', 'Cure Wounds']);
    });

    it('ANDs the Class and School facets together', () => {
      classChip('Cleric').click();
      schoolChip('Evocation').click();
      fixture.detectChanges();

      // Bless is Cleric but Enchantment, not Evocation — excluded once
      // both facets are active, even though it matched Class alone.
      expect(rowNames()).toEqual(['Cure Wounds']);
    });

    it('shows a filters-specific empty message when a filter combination matches nothing', () => {
      classChip('Sorcerer').click();
      schoolChip('Enchantment').click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.empty-state').textContent).toContain(
        'No spells match the selected filters.',
      );
    });

    it('Clear filters resets to the full unfiltered list', () => {
      classChip('Cleric').click();
      fixture.detectChanges();
      expect(rowNames()).toEqual(['Bless', 'Cure Wounds']);

      fixture.nativeElement.querySelector('.clear-filters-btn').click();
      fixture.detectChanges();

      expect(rowNames()).toEqual(['Acid Splash', 'Bless', 'Cure Wounds', 'Fireball']);
      expect(fixture.nativeElement.querySelector('.clear-filters-btn')).toBeNull();
    });

    it('clears both filters when the source changes', () => {
      classChip('Cleric').click();
      fixture.detectChanges();
      expect(component['selectedClasses']().size).toBe(1);

      fixture.componentRef.setInput('source', 'shadowdark');
      fixture.componentRef.setInput('templates', []);
      fixture.detectChanges();

      expect(component['selectedClasses']().size).toBe(0);
      expect(component['selectedSchools']().size).toBe(0);
    });
  });
});
