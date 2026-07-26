import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PartyStore } from '../../services/party-store';
import { CombatantFields } from '../../shared/combatant-fields/combatant-fields';

/**
 * The GM's full Player library — every Player regardless of which (if
 * any) Parties they belong to. Parties are assembled from this roster
 * (see PartyDetail) rather than Players being created from within a
 * Party, since a Player can belong to more than one.
 */
@Component({
  selector: 'app-player-roster',
  imports: [FormsModule, RouterLink, CombatantFields],
  templateUrl: './player-roster.html',
  styleUrl: './player-roster.css',
})
export class PlayerRoster {
  protected readonly partyStore = inject(PartyStore);

  protected readonly newPlayerName = signal('');
  protected readonly newPlayerModifier = signal(0);
  protected readonly newPlayerAc = signal<number | null>(null);
  protected readonly newPlayerMaxHp = signal<number | null>(null);
  protected readonly newPlayerNotes = signal('');

  // Which Saved Players rows are expanded — mobile-only (see
  // player-roster.css's .expand-toggle media query; desktop always shows
  // every field, so this set only matters below ~480px). A Set of ids
  // rather than one bool per row since the row count is dynamic.
  protected readonly expandedPlayerIds = signal(new Set<string>());

  protected isPlayerExpanded(id: string): boolean {
    return this.expandedPlayerIds().has(id);
  }

  protected togglePlayerExpanded(id: string): void {
    const next = new Set(this.expandedPlayerIds());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.expandedPlayerIds.set(next);
  }

  protected createPlayer(): void {
    const name = this.newPlayerName().trim();
    if (!name) return;
    this.partyStore.createPlayer({
      name,
      initiativeModifier: this.newPlayerModifier(),
      ac: this.newPlayerAc(),
      maxHp: this.newPlayerMaxHp(),
      notes: this.newPlayerNotes(),
    });
    this.newPlayerName.set('');
    this.newPlayerModifier.set(0);
    this.newPlayerAc.set(null);
    this.newPlayerMaxHp.set(null);
    this.newPlayerNotes.set('');
  }

  protected deletePlayer(id: string, name: string): void {
    if (confirm(`Delete ${name}? This removes them from any Parties too.`)) {
      this.partyStore.deletePlayer(id);
    }
  }

  protected renamePlayer(id: string, name: string): void {
    this.partyStore.updatePlayer(id, { name });
  }

  protected setPlayerModifier(id: string, initiativeModifier: number): void {
    this.partyStore.updatePlayer(id, { initiativeModifier });
  }

  protected setPlayerAc(id: string, ac: number | null): void {
    this.partyStore.updatePlayer(id, { ac });
  }

  protected setPlayerMaxHp(id: string, maxHp: number | null): void {
    this.partyStore.updatePlayer(id, { maxHp });
  }

  protected setPlayerNotes(id: string, notes: string): void {
    this.partyStore.updatePlayer(id, { notes });
  }
}
