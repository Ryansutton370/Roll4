import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GeneratorsHome } from './generators-home';

describe('GeneratorsHome', () => {
  let fixture: ComponentFixture<GeneratorsHome>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GeneratorsHome],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(GeneratorsHome);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('shows a card linking to each Content & Generators sub-page', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const cards = Array.from(compiled.querySelectorAll<HTMLAnchorElement>('.quick-nav-card'));
    expect(cards.map((c) => c.getAttribute('href'))).toEqual([
      '/generators/names',
      '/generators/encounter',
      '/generators/wild-magic',
      '/generators/treasure',
      '/generators/combat-thesaurus',
      '/generators/spells',
    ]);
    expect(cards.map((c) => c.querySelector('.quick-nav-title')?.textContent)).toEqual([
      'Names',
      'Encounter',
      'Wild Magic',
      'Treasure',
      'Combat Thesaurus',
      'Spell Lists',
    ]);
  });
});
