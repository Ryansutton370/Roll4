import { Component, computed, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NameGeneratorButton } from '../name-generator-button/name-generator-button';
import { RichTextEditor, hasRichTextContent } from '../rich-text-editor/rich-text-editor';

/**
 * The 5-field input set shared by every place a PC/NPC's data is entered or
 * edited: PartyDetail's "Save Player" form, the ad-hoc NPC forms in
 * EncounterDetail/EncounterList, and EditCombatantDialog. A dumb,
 * fields-only component — it doesn't own a <form>, a submit button, or any
 * validation; the parent decides what "submit" means (create vs. save an
 * edit) and keeps its own signals for the values, same as every existing
 * inline form in this app.
 */
@Component({
  selector: 'app-combatant-fields',
  imports: [FormsModule, NameGeneratorButton, RichTextEditor],
  templateUrl: './combatant-fields.html',
  styleUrl: './combatant-fields.css',
})
export class CombatantFields {
  // model(): the signal-based two-way-binding primitive. `name` is both a
  // readable signal *and* registered as an output under the synthesized
  // name `nameChange` (there's no separate `nameChange` class field — the
  // same `name` property serves both roles). Callers here bind it the same
  // explicit way as every other signal-backed field in this app —
  // `[name]="mySignal()" (nameChange)="mySignal.set($event)"` — rather than
  // Angular's `[(name)]="mySignal"` two-way shorthand, for one consistent
  // binding style across the codebase. .required() means the parent must
  // bind it — there's no sensible default for "what name is this
  // combatant."
  readonly name = model.required<string>();
  readonly initiativeModifier = model.required<number>();
  readonly ac = model.required<number | null>();
  readonly maxHp = model.required<number | null>();
  /** Rich-text HTML, edited via RichTextEditor — see that component for why (and how its sanitization works). */
  readonly notes = model.required<string>();

  protected readonly hasNotes = computed(() => hasRichTextContent(this.notes()));

  // Collapsed by default — a full rich-text toolbar+editor on every single
  // create/edit form (this component is reused a lot; see the class doc
  // comment) would be a lot of vertical space spent on a field most
  // combatants don't need. Component-local UI state, not part of the
  // model() fields above: it's purely "is this form control expanded right
  // now," not data about the combatant itself.
  protected readonly notesExpanded = signal(false);
}
