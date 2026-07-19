import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NpcStore } from '../../services/npc-store';
import { CombatantFields } from '../../shared/combatant-fields/combatant-fields';

/**
 * The GM's full NPC library — mirrors PlayerRoster exactly (see that
 * file), for NPCs/Troops instead of Players/Parties.
 */
@Component({
  selector: 'app-npc-roster',
  imports: [FormsModule, RouterLink, CombatantFields],
  templateUrl: './npc-roster.html',
  styleUrl: './npc-roster.css',
})
export class NpcRoster {
  protected readonly npcStore = inject(NpcStore);

  protected readonly newNpcName = signal('');
  protected readonly newNpcModifier = signal(0);
  protected readonly newNpcAc = signal<number | null>(null);
  protected readonly newNpcMaxHp = signal<number | null>(null);
  protected readonly newNpcNotes = signal('');

  protected createNpc(): void {
    const name = this.newNpcName().trim();
    if (!name) return;
    this.npcStore.createNpc({
      name,
      initiativeModifier: this.newNpcModifier(),
      ac: this.newNpcAc(),
      maxHp: this.newNpcMaxHp(),
      notes: this.newNpcNotes(),
    });
    this.newNpcName.set('');
    this.newNpcModifier.set(0);
    this.newNpcAc.set(null);
    this.newNpcMaxHp.set(null);
    this.newNpcNotes.set('');
  }

  protected deleteNpc(id: string, name: string): void {
    if (confirm(`Delete ${name}? This removes it from any Troops too.`)) {
      this.npcStore.deleteNpc(id);
    }
  }

  protected renameNpc(id: string, name: string): void {
    this.npcStore.updateNpc(id, { name });
  }

  protected setNpcModifier(id: string, initiativeModifier: number): void {
    this.npcStore.updateNpc(id, { initiativeModifier });
  }

  protected setNpcAc(id: string, ac: number | null): void {
    this.npcStore.updateNpc(id, { ac });
  }

  protected setNpcMaxHp(id: string, maxHp: number | null): void {
    this.npcStore.updateNpc(id, { maxHp });
  }

  protected setNpcNotes(id: string, notes: string): void {
    this.npcStore.updateNpc(id, { notes });
  }
}
