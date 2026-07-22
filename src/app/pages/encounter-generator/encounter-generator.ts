import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { EncounterStore } from '../../services/encounter-store';
import { NpcStore } from '../../services/npc-store';
import { MonsterCredits } from '../../shared/monster-credits/monster-credits';
import { ToastService } from '../../shared/toast/toast';
import {
  combatantFieldsFromDraft,
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
  protected readonly encounterStore = inject(EncounterStore);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly draft = signal<DraftCombatant[]>([]);

  protected readonly troopName = signal('');
  protected readonly savedTroopId = signal<string | null>(null);

  // '' sentinel = "+ New Encounter" in the <select> below — the default and
  // only option until the GM has at least one saved Encounter already.
  protected readonly targetEncounterId = signal('');

  protected saveAsTroop(): void {
    const troopName = this.troopName().trim();
    if (!troopName || this.draft().length === 0) return;

    const troop = this.npcStore.createTroop(troopName);
    for (const d of this.draft()) {
      const npc = this.npcStore.createNpc(combatantFieldsFromDraft(d));
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

  // Adds every current Candidate straight onto a real Encounter — either
  // one already saved (picked from the dropdown) or a brand-new one — then
  // jumps to the Encounters tab with that Encounter's setup/edit panel
  // already open (see EncounterList.openForEncounterId), the same "commit
  // straight to an Encounter" flow EncounterList's own embedded Monsters
  // section uses (onAddAllToEncounter), just reachable from this standalone
  // page too.
  protected addToEncounter(): void {
    const drafts = this.draft();
    if (drafts.length === 0) return;

    const existingId = this.targetEncounterId();
    const encounterId = existingId || this.encounterStore.createEncounter('Untitled Encounter', []).id;

    for (const d of drafts) {
      this.encounterStore.addAdHocCombatant(encounterId, 'npc', combatantFieldsFromDraft(d));
    }

    const encounterName = this.encounterStore.getEncounter(encounterId)?.name ?? 'Encounter';
    this.toastService.show(`Added to ${encounterName}`);

    this.draft.set([]);
    this.targetEncounterId.set('');
    this.router.navigate(['/encounters'], { queryParams: { edit: encounterId } });
  }
}
