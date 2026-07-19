import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { TroopDetail } from './troop-detail';

describe('TroopDetail', () => {
  let component: TroopDetail;
  let fixture: ComponentFixture<TroopDetail>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [TroopDetail],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(TroopDetail);
    // troopId is input.required<string>() — see the note in
    // party-detail.spec.ts for why tests must set it explicitly.
    fixture.componentRef.setInput('troopId', 'nonexistent-troop');
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
