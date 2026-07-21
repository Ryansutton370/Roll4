import { Service, signal } from '@angular/core';

export interface ToastMessage {
  id: string;
  text: string;
}

/**
 * A tiny global notification queue — "Added Goblin" after picking a
 * monster from a MonsterPickerTable, and any other brief confirmation a
 * page wants to surface without stealing focus or requiring a scroll to
 * see. `ToastContainer` (mounted once in app.html) renders whatever's
 * currently queued; any component can inject this service and call
 * `show()` regardless of where on the page it lives.
 */
@Service()
export class ToastService {
  private readonly messagesSignal = signal<ToastMessage[]>([]);
  readonly messages = this.messagesSignal.asReadonly();

  show(text: string, durationMs = 2500): void {
    const id = crypto.randomUUID();
    this.messagesSignal.update((messages) => [...messages, { id, text }]);
    setTimeout(() => this.dismiss(id), durationMs);
  }

  private dismiss(id: string): void {
    this.messagesSignal.update((messages) => messages.filter((m) => m.id !== id));
  }
}
