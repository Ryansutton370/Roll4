import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { PlayersShell } from './players-shell';

describe('PlayersShell', () => {
  let component: PlayersShell;
  let fixture: ComponentFixture<PlayersShell>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlayersShell],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(PlayersShell);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
