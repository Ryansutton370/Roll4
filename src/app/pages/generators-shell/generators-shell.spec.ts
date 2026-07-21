import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { GeneratorsShell } from './generators-shell';

describe('GeneratorsShell', () => {
  let component: GeneratorsShell;
  let fixture: ComponentFixture<GeneratorsShell>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GeneratorsShell],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(GeneratorsShell);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
