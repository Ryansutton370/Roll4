import { Component, computed, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NpcStore } from '../../services/npc-store';

// Mirrors party-detail.ts exactly (see that file) — NPCs/Troops instead of Players/Parties.
@Component({
  selector: 'app-troop-detail',
  imports: [FormsModule, RouterLink],
  templateUrl: './troop-detail.html',
  styleUrl: './troop-detail.css',
})
export class TroopDetail {
  protected readonly npcStore = inject(NpcStore);

  readonly troopId = input.required<string>();

  protected readonly troop = computed(() => this.npcStore.getTroop(this.troopId()));
  protected readonly allNpcs = computed(() => this.npcStore.npcs());

  protected isMember(npcId: string): boolean {
    return this.troop()?.npcIds.includes(npcId) ?? false;
  }

  protected toggleMembership(npcId: string, checked: boolean): void {
    const troopId = this.troopId();
    if (checked) {
      this.npcStore.addNpcToTroop(troopId, npcId);
    } else {
      this.npcStore.removeNpcFromTroop(troopId, npcId);
    }
  }
}
