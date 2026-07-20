import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MonsterSource, MonsterTemplate } from '../../models/monster-template.model';
import {
  EncounterDifficulty,
  GeneratedMonsterEntry,
  generate5eEncounter,
  generateShadowdarkEncounter,
} from '../../services/encounter-generator';
import { MonsterStore } from '../../services/monster-store';
import { NameTableStore } from '../../services/name-table-store';
import { NpcStore } from '../../services/npc-store';
import { NameGeneratorButton } from '../../shared/name-generator-button/name-generator-button';

/** One individual monster in the working roster — the unit "Save as Troop" creates one Npc from. Kept flat (not grouped by template) so each instance can carry its own personal name. */
interface DraftCombatant {
  localId: string;
  template: MonsterTemplate;
  personalName: string;
}

/** The count-adjuster view groups DraftCombatants back up by template — "3 Goblins" as one row with +/- controls, rather than three separate rows. */
interface DraftGroup {
  template: MonsterTemplate;
  count: number;
}

@Component({
  selector: 'app-encounter-generator',
  imports: [FormsModule, NameGeneratorButton],
  templateUrl: './encounter-generator.html',
  styleUrl: './encounter-generator.css',
})
export class EncounterGenerator {
  private readonly monsterStore = inject(MonsterStore);
  protected readonly nameTableStore = inject(NameTableStore);
  private readonly npcStore = inject(NpcStore);
  private readonly router = inject(Router);

  protected readonly source = signal<MonsterSource>('5e-srd');

  // 5e generation inputs.
  protected readonly partyLevel = signal(3);
  protected readonly partySize = signal(4);
  protected readonly difficulty = signal<EncounterDifficulty>('medium');

  // Shadowdark generation inputs — a level range + headcount, not a
  // difficulty tier, since Shadowdark has no XP-budget system to target
  // (see encounter-generator.ts's module comment for why).
  protected readonly minLevel = signal(1);
  protected readonly maxLevel = signal(3);
  protected readonly monsterCount = signal(4);

  protected readonly draft = signal<DraftCombatant[]>([]);

  protected readonly draftGroups = computed<DraftGroup[]>(() => {
    const groups: DraftGroup[] = [];
    for (const d of this.draft()) {
      const existing = groups.find((g) => g.template.id === d.template.id);
      if (existing) existing.count++;
      else groups.push({ template: d.template, count: 1 });
    }
    return groups;
  });

  protected readonly allTemplatesForSource = computed(() =>
    this.monsterStore.templatesForSource(this.source()),
  );

  // Name-application controls — same Set/Table picker shape as
  // NameGenerator/CombatantFields, reused here for a bulk "fill every
  // still-unnamed draft combatant" pass rather than a single roll.
  protected readonly nameSetName = signal<string | null>(null);
  protected readonly nameTableId = signal<string | null>(null);
  protected readonly tablesForSelectedSet = computed(() => {
    const setName = this.nameSetName();
    return setName ? this.nameTableStore.tablesForSet(setName) : [];
  });

  protected readonly troopName = signal('');
  protected readonly savedTroopId = signal<string | null>(null);

  constructor() {
    // Same "the table data loads asynchronously, default-select once it
    // arrives" pattern as NameGenerator — without this, the Set/Table
    // selects sit empty (nothing to pick from yet) and "Generate Names"
    // silently no-ops until the GM manually opens the Set dropdown first.
    effect(() => {
      const setNames = this.nameTableStore.setNames();
      if (setNames.length > 0 && this.nameSetName() === null) {
        this.selectNameSet(setNames[0]);
      }
    });
  }

  protected selectSource(source: MonsterSource): void {
    this.source.set(source);
    this.draft.set([]);
    this.savedTroopId.set(null);
  }

  private setDraftFromEntries(entries: GeneratedMonsterEntry[]): void {
    this.draft.set(
      entries.flatMap((entry) =>
        Array.from({ length: entry.count }, () => ({
          localId: crypto.randomUUID(),
          template: entry.template,
          personalName: '',
        })),
      ),
    );
    this.savedTroopId.set(null);
  }

  protected generate(): void {
    const pool = this.allTemplatesForSource();
    const entries =
      this.source() === '5e-srd'
        ? generate5eEncounter({
            partyLevel: this.partyLevel(),
            partySize: this.partySize(),
            difficulty: this.difficulty(),
            pool,
          })
        : generateShadowdarkEncounter({
            minLevel: this.minLevel(),
            maxLevel: this.maxLevel(),
            monsterCount: this.monsterCount(),
            pool,
          });
    this.setDraftFromEntries(entries);
  }

  protected incrementGroup(templateId: string): void {
    const template = this.allTemplatesForSource().find((t) => t.id === templateId);
    if (!template) return;
    this.draft.update((d) => [...d, { localId: crypto.randomUUID(), template, personalName: '' }]);
    this.savedTroopId.set(null);
  }

  /** Removes the last (most recently added) instance of this template — an arbitrary but simple choice; if the GM cares which specific instance goes, they can clear/remove it individually in the roster list below. */
  protected decrementGroup(templateId: string): void {
    this.draft.update((d) => {
      const lastIndex = d.map((x) => x.template.id).lastIndexOf(templateId);
      if (lastIndex === -1) return d;
      return [...d.slice(0, lastIndex), ...d.slice(lastIndex + 1)];
    });
    this.savedTroopId.set(null);
  }

  protected removeInstance(localId: string): void {
    this.draft.update((d) => d.filter((x) => x.localId !== localId));
    this.savedTroopId.set(null);
  }

  protected addTemplate(templateId: string): void {
    if (!templateId) return;
    this.incrementGroup(templateId);
  }

  protected selectNameSet(setName: string): void {
    this.nameSetName.set(setName);
    this.nameTableId.set(this.nameTableStore.tablesForSet(setName)[0]?.id ?? null);
  }

  /** Fills every draft combatant that doesn't already have a personal name — rolls exactly as many distinct names as are needed in one pick (via NameTableStore.rollNames) rather than one at a time. */
  protected generateNames(): void {
    const tableId = this.nameTableId();
    if (!tableId) return;
    const unnamed = this.draft().filter((d) => d.personalName.trim() === '');
    if (unnamed.length === 0) return;
    const rolled = this.nameTableStore.rollNames(tableId, unnamed.length);
    let i = 0;
    this.draft.update((d) =>
      d.map((entry) =>
        entry.personalName.trim() === '' ? { ...entry, personalName: rolled[i++] ?? '' } : entry,
      ),
    );
  }

  protected setPersonalName(localId: string, name: string): void {
    this.draft.update((d) =>
      d.map((entry) => (entry.localId === localId ? { ...entry, personalName: name } : entry)),
    );
  }

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
