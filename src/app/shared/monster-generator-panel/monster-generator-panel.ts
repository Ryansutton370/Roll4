import { Component, computed, effect, inject, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  MonsterSource,
  MonsterTemplate,
  monsterDifficultyLabel,
} from '../../models/monster-template.model';
import {
  EncounterDifficulty,
  GeneratedMonsterEntry,
  generate5eEncounter,
  generateShadowdarkEncounter,
} from '../../services/encounter-generator';
import { MonsterStore } from '../../services/monster-store';
import { NameTableStore } from '../../services/name-table-store';
import { MonsterPickerTable } from '../monster-picker-table/monster-picker-table';
import { NameGeneratorButton } from '../name-generator-button/name-generator-button';
import { ToastService } from '../toast/toast';

/** One individual monster in the working roster — the unit a host component's own "commit" action (Save as Troop, Add to Encounter, ...) turns into something real. Kept flat (not grouped by template) so each instance can carry its own personal name. */
export interface DraftCombatant {
  localId: string;
  template: MonsterTemplate;
  personalName: string;
}

/** The count-adjuster view groups DraftCombatants back up by template — "3 Goblins" as one row with +/- controls, rather than three separate rows. */
interface DraftGroup {
  template: MonsterTemplate;
  count: number;
}

/**
 * The generate/adjust/apply-names roster-building UI shared by the
 * standalone Encounter Generator page and (embedded) the Encounter List's
 * create/edit panel — extracted once a second host needed the exact same
 * flow. Owns everything about *building* the draft roster; deliberately
 * does NOT own what happens once the GM is done with it (EncounterGenerator's
 * "Save as Troop" vs. EncounterList's "Add to Encounter") — that stays
 * host-specific, reading `draft()` via the two-way binding below.
 */
@Component({
  selector: 'app-monster-generator-panel',
  imports: [FormsModule, MonsterPickerTable, NameGeneratorButton],
  templateUrl: './monster-generator-panel.html',
  styleUrl: './monster-generator-panel.css',
})
export class MonsterGeneratorPanel {
  private readonly monsterStore = inject(MonsterStore);
  protected readonly nameTableStore = inject(NameTableStore);
  private readonly toastService = inject(ToastService);

  // Two-way bound (model()) rather than an output — the host needs to read
  // the current roster whenever ITS OWN commit button is clicked (Save as
  // Troop / Add to Encounter), not just react to changes as they happen.
  readonly draft = model<DraftCombatant[]>([]);

  // Emitted from every method that mutates the roster, so a host that shows
  // a "Saved!" banner (EncounterGenerator) knows to hide it again — see
  // EncounterGenerator.saveAsTroop(); a host with no such banner (EncounterList)
  // just leaves this unbound.
  readonly draftEdited = output<void>();

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
    this.draftEdited.emit();
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
    this.draftEdited.emit();
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
    this.draftEdited.emit();
  }

  /** Removes the last (most recently added) instance of this template — an arbitrary but simple choice; if the GM cares which specific instance goes, they can clear/remove it individually in the roster list below. */
  protected decrementGroup(templateId: string): void {
    this.draft.update((d) => {
      const lastIndex = d.map((x) => x.template.id).lastIndexOf(templateId);
      if (lastIndex === -1) return d;
      return [...d.slice(0, lastIndex), ...d.slice(lastIndex + 1)];
    });
    this.draftEdited.emit();
  }

  protected removeInstance(localId: string): void {
    this.draft.update((d) => d.filter((x) => x.localId !== localId));
    this.draftEdited.emit();
  }

  protected addTemplate(template: MonsterTemplate): void {
    this.incrementGroup(template.id);
    // Browse Monster List's Add is the one action here whose result isn't
    // otherwise visible without scrolling (the table itself can be long,
    // and Candidates/Roster render below it) — confirm it landed rather
    // than leaving the GM to scroll down and check.
    this.toastService.show(`Added ${template.name}`);
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

  protected label(template: MonsterTemplate): string {
    return monsterDifficultyLabel(template);
  }
}
