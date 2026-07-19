import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NpcStore } from '../../services/npc-store';

// Mirrors party-list.ts exactly (see that file) — Troops instead of Parties.
@Component({
  selector: 'app-troop-list',
  imports: [FormsModule, RouterLink],
  templateUrl: './troop-list.html',
  styleUrl: './troop-list.css',
})
export class TroopList {
  protected readonly npcStore = inject(NpcStore);

  protected readonly newTroopName = signal('');

  protected createTroop(): void {
    const name = this.newTroopName().trim();
    if (!name) return;
    this.npcStore.createTroop(name);
    this.newTroopName.set('');
  }

  protected deleteTroop(id: string, name: string): void {
    if (confirm(`Delete "${name}"? NPCs in it stay in the roster.`)) {
      this.npcStore.deleteTroop(id);
    }
  }
}
