import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { PartyDetail } from './party-detail';

describe('PartyDetail', () => {
  let component: PartyDetail;
  let fixture: ComponentFixture<PartyDetail>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [PartyDetail],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(PartyDetail);
    // partyId is input.required<string>() — normally filled in by the
    // router, but tests create the component directly, so it must be set
    // explicitly before the first change detection run.
    fixture.componentRef.setInput('partyId', 'nonexistent-party');
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
