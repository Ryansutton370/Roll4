import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { NpcsShell } from './npcs-shell';

describe('NpcsShell', () => {
  let component: NpcsShell;
  let fixture: ComponentFixture<NpcsShell>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NpcsShell],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(NpcsShell);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
