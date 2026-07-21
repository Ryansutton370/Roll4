import {
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CombatantType } from '../../models/encounter.model';
import { MonsterSource, MonsterTemplate } from '../../models/monster-template.model';
import { Npc } from '../../models/npc.model';
import { Player } from '../../models/party.model';
import { MonsterStore } from '../../services/monster-store';
import { CombatantFields } from '../combatant-fields/combatant-fields';
import { MonsterPickerTable } from '../monster-picker-table/monster-picker-table';

export interface NewCombatantSubmitted {
  type: CombatantType;
  fields: {
    name: string;
    initiativeModifier: number;
    ac: number | null;
    maxHp: number | null;
    notes: string;
    monsterTemplateId: string | null;
    monsterName: string | null;
  };
}

/**
 * The "Add Combatant" flow shared by three places: the Encounter setup
 * screen, the Encounters list's Edit form, and the run-phase "+" menu.
 * Opens as a modal (same native <dialog>/showModal() pattern as
 * EditCombatantDialog) always starting on a four-way choice — Existing
 * NPC, Existing Player, From Book, or Create New — which expands into the
 * matching next step. Either path, or the Cancel button/Escape key, closes
 * it without the caller needing to track any open/closed state itself.
 */
@Component({
  selector: 'app-add-combatant-dialog',
  imports: [CombatantFields, FormsModule, MonsterPickerTable],
  templateUrl: './add-combatant-dialog.html',
  styleUrl: './add-combatant-dialog.css',
})
export class AddCombatantDialog {
  private readonly monsterStore = inject(MonsterStore);

  // input(): the caller (EncounterDetail/EncounterList) already computes
  // "which roster Players/NPCs aren't in this Encounter yet" for its own
  // purposes — passed straight through rather than this dialog knowing
  // about EncounterStore/PartyStore/NpcStore itself.
  readonly availablePlayers = input.required<Player[]>();
  readonly availableNpcs = input.required<Npc[]>();

  // Fired when the GM picks an existing roster entry to add.
  readonly existingPlayerChosen = output<string>();
  readonly existingNpcChosen = output<string>();
  // Fired when the GM submits the "create new" form instead (including a
  // From Book pick, which lands here too — see pickTemplate()).
  readonly newCombatantSubmitted = output<NewCombatantSubmitted>();

  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  // Four-way top-level choice, per the GM spec: Existing NPC / Existing
  // Player / From Book / Create New are peers, not "existing" with "new"
  // buried behind a toggle link. `type` only matters once `step` has moved
  // past 'choose' — set alongside it when picking an Existing* option, via
  // pickTemplate() for From Book (a monster is always an NPC), or via the
  // radio inside the 'new' step's own form (a hand-typed ad-hoc combatant
  // still needs a type, it just isn't known before that step).
  protected readonly step = signal<'choose' | 'existing' | 'book' | 'new'>('choose');
  protected readonly type = signal<CombatantType>('npc');

  protected readonly name = signal('');
  protected readonly initiativeModifier = signal(0);
  protected readonly ac = signal<number | null>(null);
  protected readonly maxHp = signal<number | null>(null);
  protected readonly notes = signal('');

  // Set only via pickTemplate() (the From Book path) — carried into
  // submitNew()'s emitted payload, and what tells the 'new' step to hide
  // its NPC/Player radio (a monster template is always an NPC) and its
  // "← Back" button to return to the book picker instead of the top choice.
  protected readonly monsterTemplateId = signal<string | null>(null);
  protected readonly monsterName = signal<string | null>(null);

  // From Book's own source toggle + monster list, independent of the
  // Encounter Generator's identical-looking one — this dialog has no
  // reason to share state with a whole separate page. Sorting is
  // MonsterPickerTable's own job now, so this is just the source filter.
  protected readonly bookSource = signal<MonsterSource>('5e-srd');
  protected readonly templatesForBookSource = computed<MonsterTemplate[]>(() =>
    this.monsterStore.templatesForSource(this.bookSource()),
  );

  // Whichever roster list matches the currently-chosen type — the
  // "existing" step's picker reads from this rather than branching on
  // type() itself in the template.
  protected readonly currentAvailable = computed<(Player | Npc)[]>(() =>
    this.type() === 'pc' ? this.availablePlayers() : this.availableNpcs(),
  );

  /** Opens the dialog, always starting on the four-way choice step. */
  open(): void {
    this.step.set('choose');
    this.type.set('npc');
    this.bookSource.set('5e-srd');
    this.resetNewFields();
    this.dialogRef().nativeElement.showModal();
  }

  protected startExisting(type: CombatantType): void {
    this.type.set(type);
    this.step.set('existing');
  }

  protected startBook(): void {
    this.step.set('book');
  }

  protected startNew(): void {
    this.step.set('new');
  }

  /** The 'existing'/'book' steps' own "← Back" — a full reset back to the top-level choice. */
  protected backToChoose(): void {
    this.resetNewFields();
    this.step.set('choose');
  }

  /**
   * The 'new' step's own "← Back". A From Book pick returns to the monster
   * list (so picking the wrong monster is a one-click correction, not a
   * trip back through the top-level choice) rather than resetting
   * everything — resetNewFields() only runs once the GM actually leaves
   * the From Book flow via backToChoose() above.
   */
  protected backFromNew(): void {
    this.step.set(this.monsterTemplateId() !== null ? 'book' : 'choose');
  }

  protected pickExisting(id: string): void {
    if (this.type() === 'pc') {
      this.existingPlayerChosen.emit(id);
    } else {
      this.existingNpcChosen.emit(id);
    }
    this.close();
  }

  /** Prefills the 'new' step's form from a monster template and jumps straight there — same one-form flow as Create New, just pre-populated and NPC-locked. */
  protected pickTemplate(templateId: string): void {
    const template = this.monsterStore.getTemplate(templateId);
    if (!template) return;
    this.type.set('npc');
    this.name.set(template.name);
    this.initiativeModifier.set(template.initiativeModifier);
    this.ac.set(template.ac);
    this.maxHp.set(template.maxHp);
    this.notes.set('');
    this.monsterTemplateId.set(template.id);
    this.monsterName.set(template.name);
    this.step.set('new');
  }

  protected submitNew(): void {
    const name = this.name().trim();
    if (!name) return;
    this.newCombatantSubmitted.emit({
      type: this.type(),
      fields: {
        name,
        initiativeModifier: this.initiativeModifier(),
        ac: this.ac(),
        maxHp: this.maxHp(),
        notes: this.notes(),
        monsterTemplateId: this.monsterTemplateId(),
        monsterName: this.monsterName(),
      },
    });
    this.close();
  }

  protected cancel(): void {
    this.close();
  }

  private close(): void {
    this.dialogRef().nativeElement.close();
  }

  private resetNewFields(): void {
    this.name.set('');
    this.initiativeModifier.set(0);
    this.ac.set(null);
    this.maxHp.set(null);
    this.notes.set('');
    this.monsterTemplateId.set(null);
    this.monsterName.set(null);
  }
}
