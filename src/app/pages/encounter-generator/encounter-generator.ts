import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NpcStore } from '../../services/npc-store';
import { MonsterCredits } from '../../shared/monster-credits/monster-credits';
import {
  DraftCombatant,
  MonsterGeneratorPanel,
} from '../../shared/monster-generator-panel/monster-generator-panel';

@Component({
  selector: 'app-encounter-generator',
  imports: [FormsModule, MonsterGeneratorPanel, MonsterCredits],
  templateUrl: './encounter-generator.html',
  styleUrl: './encounter-generator.css',
})
export class EncounterGenerator {
  private readonly npcStore = inject(NpcStore);
  private readonly router = inject(Router);

  protected readonly draft = signal<DraftCombatant[]>([]);

  protected readonly troopName = signal('');
  protected readonly savedTroopId = signal<string | null>(null);

  protected saveAsTroop(): void {
    const troopName = this.troopName().trim();
    if (!troopName || this.draft().length === 0) return;

    const troop = this.npcStore.createTroop(troopName);
    for (const d of this.draft()) {
      const npc = this.npcStore.createNpc({
        name: d.personalName.trim() || d.template.name,
        initiativeModifier: d.template.initiativeModifier,
        ac: d.template.ac,
        maxHp: d.template.maxHp,
        notes: '',
        monsterTemplateId: d.template.id,
        monsterName: d.template.name,
      });
      this.npcStore.addNpcToTroop(troop.id, npc.id);
    }

    this.savedTroopId.set(troop.id);
    this.draft.set([]);
    this.troopName.set('');
  }

  protected goToSavedTroop(): void {
    const troopId = this.savedTroopId();
    if (troopId) this.router.navigate(['/npcs/troops', troopId]);
  }
}
