import { Component, computed, inject, input, model, output, signal, viewChild } from '@angular/core';
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
import { MonsterPickerTable } from '../monster-picker-table/monster-picker-table';
import { MonsterStatBlockDialog } from '../monster-stat-block-dialog/monster-stat-block-dialog';
import { NameGeneratorButton } from '../name-generator-button/name-generator-button';
import { ToastService } from '../toast/toast';

/** One individual monster in the working roster — the unit a host component's own "commit" action (Save as Troop, Add to Encounter, ...) turns into something real. Kept flat (not grouped by template) so each instance can carry its own personal name; multiples of the same monster (e.g. 3 Goblins) show as three separate Candidates rows rather than one grouped "x3" row. */
export interface DraftCombatant {
  localId: string;
  template: MonsterTemplate;
  personalName: string;
}

/**
 * The generate/adjust roster-building UI shared by the standalone Encounter
 * Generator page and (embedded) the Encounter List's create/edit panel —
 * extracted once a second host needed the exact same flow. Owns everything
 * about *building* the draft roster; deliberately does NOT own what happens
 * once the GM is done with it (EncounterGenerator's "Save as Troop" vs.
 * EncounterList's "Add to Encounter") — that stays host-specific, reading
 * `draft()` via the two-way binding below. Naming a candidate is per-row
 * only (the 🎲 `NameGeneratorButton` next to each one) — there's no bulk
 * "name everything at once" pass; a GM generating a batch usually wants
 * different names/tables per monster anyway, and removing/renaming
 * individual entries is already one click each.
 */
@Component({
  selector: 'app-monster-generator-panel',
  imports: [FormsModule, MonsterPickerTable, NameGeneratorButton, MonsterStatBlockDialog],
  templateUrl: './monster-generator-panel.html',
  styleUrl: './monster-generator-panel.css',
})
export class MonsterGeneratorPanel {
  private readonly monsterStore = inject(MonsterStore);
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

  // Opt-in "commit to a real Encounter" UI — false/null on the standalone
  // Encounter Generator page (which has no Encounter concept and keeps its
  // own separate "Save as Troop" step), true + a name when EncounterList
  // embeds this panel. Gates the "Add All to Encounter" button and each
  // Candidates row's individual "Add to {encounterName}" button below (also
  // switches Browse Monster List's Add from staging a Candidate to adding
  // straight to the Encounter — see addTemplate()).
  // encounterName is used verbatim (not suffixed with "Encounter" here) —
  // the host already builds the full phrase (e.g. "Goblin Ambush Encounter"),
  // since only it knows how to avoid a doubled "Untitled Encounter Encounter"
  // for the unnamed-encounter case (see EncounterList.encounterCommitPhrase).
  readonly showEncounterCommitActions = input(false);
  readonly encounterName = input<string | null>(null);

  // Emitted immediately on click (the host commits it to the real Encounter
  // right away) — the row itself keeps rendering, marked via addingIds
  // below, until its flash-green/shrink CSS animation finishes and
  // finishAdding() actually drops it from draft. See combatant-pop-out's
  // identical "(animationend) does the real removal" precedent in
  // encounter-detail.css/.ts.
  readonly addAllToEncounter = output<DraftCombatant[]>();
  readonly addOneToEncounter = output<DraftCombatant>();

  protected readonly addingIds = signal<ReadonlySet<string>>(new Set());

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

  protected readonly allTemplatesForSource = computed(() =>
    this.monsterStore.templatesForSource(this.source()),
  );

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

  private addTemplateInstance(template: MonsterTemplate): void {
    this.draft.update((d) => [...d, { localId: crypto.randomUUID(), template, personalName: '' }]);
    this.draftEdited.emit();
  }

  protected removeInstance(localId: string): void {
    this.draft.update((d) => d.filter((x) => x.localId !== localId));
    this.draftEdited.emit();
  }

  protected addTemplate(template: MonsterTemplate): void {
    if (this.showEncounterCommitActions()) {
      // Embedded in the Encounter builder — Browse Monster List adds
      // straight to the real Encounter, skipping Candidates entirely (only
      // Generate Monsters populates Candidates here). The host shows its
      // own "X added to {encounter}" toast for this (see EncounterList's
      // onAddOneToEncounter), so no local toast here.
      this.addOneToEncounter.emit({ localId: crypto.randomUUID(), template, personalName: '' });
      return;
    }
    this.addTemplateInstance(template);
    // Browse Monster List's Add is the one action here whose result isn't
    // otherwise visible without scrolling (the table itself can be long,
    // and Candidates renders below it) — confirm it landed rather than
    // leaving the GM to scroll down and check. Worded "to Candidates" (not
    // just "Added X") since landing in draft doesn't mean it's in a real
    // Encounter — this only ever runs on the standalone Encounter Generator
    // page, which has no Encounter to add to (see the branch above).
    this.toastService.show(`Added ${template.name} to Candidates`);
  }

  protected setPersonalName(localId: string, name: string): void {
    this.draft.update((d) =>
      d.map((entry) => (entry.localId === localId ? { ...entry, personalName: name } : entry)),
    );
  }

  protected label(template: MonsterTemplate): string {
    return monsterDifficultyLabel(template);
  }

  private readonly statBlockDialog = viewChild.required<MonsterStatBlockDialog>('statBlockDialog');

  protected openStatBlock(template: MonsterTemplate): void {
    this.statBlockDialog().openFor(template);
  }

  /** "Add All to Encounter" — commits every current Candidates row, each playing its own flash-green/shrink exit (see addingIds/finishAdding). */
  protected addAllToEncounterClicked(): void {
    const entries = this.draft();
    if (entries.length === 0) return;
    this.addAllToEncounter.emit(entries);
    this.addingIds.set(new Set(entries.map((d) => d.localId)));
  }

  protected addOneToEncounterClicked(entry: DraftCombatant): void {
    this.addOneToEncounter.emit(entry);
    this.addingIds.update((ids) => new Set(ids).add(entry.localId));
  }

  /** (animationend) handler — the flash-green/shrink CSS animation has finished, so this is what actually drops the row from draft, same "(animationend) does the real removal" precedent as combatant-pop-out/finishPopOut in encounter-detail.css/.ts. */
  protected finishAdding(localId: string): void {
    if (!this.addingIds().has(localId)) return;
    this.draft.update((d) => d.filter((x) => x.localId !== localId));
    this.addingIds.update((ids) => {
      const next = new Set(ids);
      next.delete(localId);
      return next;
    });
  }
}
