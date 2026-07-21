import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToastService } from './toast';
import { ToastContainer } from './toast-container';

describe('ToastContainer', () => {
  let fixture: ComponentFixture<ToastContainer>;
  let toastService: ToastService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ToastContainer],
    }).compileComponents();

    fixture = TestBed.createComponent(ToastContainer);
    toastService = TestBed.inject(ToastService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders a toast for each queued message', () => {
    toastService.show('Added Goblin');
    toastService.show('Added Orc');
    fixture.detectChanges();

    const toasts = fixture.nativeElement.querySelectorAll('.toast');
    expect(toasts.length).toBe(2);
    expect(toasts[0].textContent).toContain('Added Goblin');
    expect(toasts[1].textContent).toContain('Added Orc');
  });
});
