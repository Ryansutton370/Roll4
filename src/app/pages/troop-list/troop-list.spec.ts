import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { TroopList } from './troop-list';

describe('TroopList', () => {
  let component: TroopList;
  let fixture: ComponentFixture<TroopList>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [TroopList],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(TroopList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
