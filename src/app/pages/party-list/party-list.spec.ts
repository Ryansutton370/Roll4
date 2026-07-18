import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { PartyList } from './party-list';

describe('PartyList', () => {
  let component: PartyList;
  let fixture: ComponentFixture<PartyList>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [PartyList],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(PartyList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
