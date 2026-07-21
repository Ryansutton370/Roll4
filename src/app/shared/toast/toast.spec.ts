import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToastService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with no messages', () => {
    expect(service.messages()).toEqual([]);
  });

  it('show() queues a message', () => {
    service.show('Added Goblin');
    expect(service.messages().map((m) => m.text)).toEqual(['Added Goblin']);
  });

  it('queues multiple messages independently', () => {
    service.show('Added Goblin');
    service.show('Added Orc');
    expect(service.messages().map((m) => m.text)).toEqual(['Added Goblin', 'Added Orc']);
  });

  it('auto-dismisses a message after its duration', () => {
    vi.useFakeTimers();
    service.show('Added Goblin', 1000);
    expect(service.messages().length).toBe(1);

    vi.advanceTimersByTime(1000);

    expect(service.messages().length).toBe(0);
  });
});
