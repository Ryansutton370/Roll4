import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MonsterSource, MonsterTemplate } from '../../models/monster-template.model';
import { MonsterStore } from '../../services/monster-store';
import { NpcStore } from '../../services/npc-store';
import { CombatantFields } from '../../shared/combatant-fields/combatant-fields';
import { MonsterPickerTable } from '../../shared/monster-picker-table/monster-picker-table';
import { ToastService } from '../../shared/toast/toast';

/**
 * The GM's full NPC library — mirrors PlayerRoster exactly (see that
 * file), for NPCs/Troops instead of Players/Parties, plus a Browse Monster
 * List section (Players has no equivalent — a monster template is always
 * an NPC) letting the GM save a template straight into the roster instead
 * of hand-typing its stats.
 */
@Component({
  selector: 'app-npc-roster',
  imports: [FormsModule, RouterLink, CombatantFields, MonsterPickerTable],
  templateUrl: './npc-roster.html',
  styleUrl: './npc-roster.css',
})
export class NpcRoster {
  protected readonly npcStore = inject(NpcStore);
  private readonly monsterStore = inject(MonsterStore);
  private readonly toastService = inject(ToastService);

  protected readonly newNpcName = signal('');
  protected readonly newNpcModifier = signal(0);
  protected readonly newNpcAc = signal<number | null>(null);
  protected readonly newNpcMaxHp = signal<number | null>(null);
  protected readonly newNpcNotes = signal('');

  // Browse Monster List's own source toggle — independent of any other
  // page's (Encounter Generator, AddCombatantDialog), same reasoning as
  // those: no reason for this picker to share state with a different
  // screen entirely.
  protected readonly monsterSource = signal<MonsterSource>('5e-srd');
  protected readonly templatesForSource = computed(() =>
    this.monsterStore.templatesForSource(this.monsterSource()),
  );

  // Picking a template saves it straight into the roster — same "add via
  // the picker = already saved, no separate submit" pattern
  // MonsterGeneratorPanel's own addTemplate() uses, rather than the
  // prefill-a-form-then-submit shape AddCombatantDialog's From Book step
  // uses. A GM who wants to rename it (e.g. "Barry" instead of "Goblin")
  // can already do that inline in the roster row below, same as any other
  // NPC — no separate rename-before-save step needed.
  protected addMonsterAsNpc(template: MonsterTemplate): void {
    const npc = this.npcStore.createNpc({
      name: template.name,
      initiativeModifier: template.initiativeModifier,
      ac: template.ac,
      maxHp: template.maxHp,
      notes: '',
      monsterTemplateId: template.id,
      monsterName: template.name,
    });
    this.toastService.show(`Added ${npc.name} to NPC roster`);
  }

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
