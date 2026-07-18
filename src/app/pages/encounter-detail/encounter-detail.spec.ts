import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { EncounterDetail } from './encounter-detail';

describe('EncounterDetail', () => {
  let component: EncounterDetail;
  let fixture: ComponentFixture<EncounterDetail>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [EncounterDetail],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(EncounterDetail);
    // encounterId is input.required<string>() — see the note in
    // party-detail.spec.ts for why tests must set it explicitly.
    fixture.componentRef.setInput('encounterId', 'nonexistent-encounter');
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
