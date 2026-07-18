import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PartyStore } from '../../services/party-store';

@Component({
  selector: 'app-party-detail',
  imports: [FormsModule, RouterLink],
  templateUrl: './party-detail.html',
  styleUrl: './party-detail.css',
})
export class PartyDetail {
  protected readonly partyStore = inject(PartyStore);

  // input.required(): a signal-based component input. app.config.ts turns
  // on withComponentInputBinding(), which auto-fills this from the
  // ':partyId' segment of the matched route — no manual ActivatedRoute
  // subscription needed.
  readonly partyId = input.required<string>();

  // computed(): derives a value from other signals (partyId + the store's
  // parties/pcs) and recalculates automatically whenever either changes.
  protected readonly party = computed(() => this.partyStore.getParty(this.partyId()));
  protected readonly pcs = computed(() => this.partyStore.pcsForParty(this.partyId()));

  protected readonly newPcName = signal('');
  protected readonly newPcModifier = signal(0);

  protected addPc(): void {
    const name = this.newPcName().trim();
    if (!name) return;
    this.partyStore.addPc(this.partyId(), name, this.newPcModifier());
    this.newPcName.set('');
    this.newPcModifier.set(0);
  }

  protected removePc(id: string, name: string): void {
    if (confirm(`Remove ${name} from this party?`)) {
      this.partyStore.removePc(id);
    }
  }

  protected renamePc(id: string, name: string): void {
    this.partyStore.updatePc(id, { name });
  }

  protected setPcModifier(id: string, initiativeModifier: number): void {
    this.partyStore.updatePc(id, { initiativeModifier });
  }
}
