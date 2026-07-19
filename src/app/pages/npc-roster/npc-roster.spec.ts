import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { NpcRoster } from './npc-roster';

describe('NpcRoster', () => {
  let component: NpcRoster;
  let fixture: ComponentFixture<NpcRoster>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [NpcRoster],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(NpcRoster);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('creates an npc from the form', () => {
    component['newNpcName'].set('Goblin');
    component['createNpc']();

    expect(component['npcStore'].npcs().map((n) => n.name)).toEqual(['Goblin']);
  });
});
