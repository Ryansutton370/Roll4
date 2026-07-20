import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NameTable } from '../../models/name-table.model';
import { NameGeneratorButton } from './name-generator-button';

describe('NameGeneratorButton', () => {
  let fixture: ComponentFixture<NameGeneratorButton>;
  let component: NameGeneratorButton;
  let httpMock: HttpTestingController;

  const sampleTables: NameTable[] = [
    {
      id: 'european-goblin',
      setName: 'European',
      tableName: 'Anglo-Saxon',
      gender: null,
      entries: ['Aelfgar', 'Wace'],
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NameGeneratorButton],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(NameGeneratorButton);
    component = fixture.componentInstance;
    fixture.detectChanges();

    httpMock = TestBed.inject(HttpTestingController);
    httpMock.expectOne('data/name-tables.json').flush(sampleTables);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('opens the picker and defaults to the first set/table on click', () => {
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.generate-name-btn');
    button.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.name-picker-popover')).toBeTruthy();
  });

  it('rolling and picking a name emits nameSelected and closes the popover', () => {
    let emitted: string | undefined;
    component.nameSelected.subscribe((value) => (emitted = value));

    fixture.nativeElement.querySelector('.generate-name-btn').click();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.name-picker-roll').click();
    fixture.detectChanges();

    const resultButton: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.name-picker-results button',
    );
    resultButton.click();
    fixture.detectChanges();

    expect(emitted).toBeTruthy();
    expect(sampleTables[0].entries).toContain(emitted);
    expect(fixture.nativeElement.querySelector('.name-picker-popover')).toBeFalsy();
  });
});
