import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { PlayerRoster } from './player-roster';

describe('PlayerRoster', () => {
  let component: PlayerRoster;
  let fixture: ComponentFixture<PlayerRoster>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [PlayerRoster],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(PlayerRoster);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('creates a player from the form', () => {
    component['newPlayerName'].set('Aria');
    component['createPlayer']();

    expect(component['partyStore'].players().map((p) => p.name)).toEqual(['Aria']);
  });
});
