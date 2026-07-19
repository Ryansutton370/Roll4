import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PartyStore } from '../../services/party-store';

@Component({
  selector: 'app-party-list',
  // A standalone component lists everything it needs directly in `imports`
  // instead of relying on an NgModule to have declared it elsewhere.
  imports: [FormsModule, RouterLink],
  templateUrl: './party-list.html',
  styleUrl: './party-list.css',
})
export class PartyList {
  // inject(): the modern way to get a dependency from Angular's DI system,
  // used as a class field initializer instead of a constructor parameter.
  protected readonly partyStore = inject(PartyStore);

  // Local UI state for the "new party" form — not persisted itself, just
  // what the GM is currently typing before they submit.
  protected readonly newPartyName = signal('');

  protected createParty(): void {
    const name = this.newPartyName().trim();
    if (!name) return;
    this.partyStore.createParty(name);
    this.newPartyName.set('');
  }

  // Unlike Phase 1, deleting a Party no longer deletes its members — a
  // Party is a tag over the shared Player roster now (many-to-many), not
  // an owner of it, so the confirm copy says so explicitly.
  protected deleteParty(id: string, name: string): void {
    if (confirm(`Delete "${name}"? Players in it stay in the roster.`)) {
      this.partyStore.deleteParty(id);
    }
  }
}
