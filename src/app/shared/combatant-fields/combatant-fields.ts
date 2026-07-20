import {
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NameTableStore } from '../../services/name-table-store';

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
  imports: [FormsModule],
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
  readonly notes = model.required<string>();

  // Injected directly (rather than piping the name-table data down through
  // an input, or a generated-name choice back up through an output): this
  // is read-only reference data, not app state a parent needs to own or
  // react to, so there's nothing for the parent to mediate — same reasoning
  // ARCHITECTURE.md gives for services in general, just applied to a
  // component that happens to read one directly.
  protected readonly nameTableStore = inject(NameTableStore);

  protected readonly namePickerOpen = signal(false);
  protected readonly selectedSetName = signal<string | null>(null);
  protected readonly selectedTableId = signal<string | null>(null);
  protected readonly rolledNames = signal<string[]>([]);

  protected readonly tablesForSelectedSet = computed(() => {
    const setName = this.selectedSetName();
    return setName ? this.nameTableStore.tablesForSet(setName) : [];
  });

  // viewChild + HostListener('document:click'): the same "collapse on
  // click away" pattern as CombatantBubble's HP-adjust/notes popovers —
  // see that component for the fuller explanation. A click that opened the
  // popover (on generateNameBtn) also bubbles up to this same document
  // listener; toggleNamePicker already ran by then, so re-checking
  // namePickerOpen() here doesn't immediately re-close what that click just
  // opened.
  private readonly namePickerEl = viewChild<ElementRef<HTMLElement>>('namePicker');

  @HostListener('document:click', ['$event'])
  protected collapseNamePickerOnClickAway(event: MouseEvent): void {
    if (!this.namePickerOpen()) return;
    const el = this.namePickerEl()?.nativeElement;
    if (el && !el.contains(event.target as Node)) {
      this.namePickerOpen.set(false);
    }
  }

  protected toggleNamePicker(): void {
    const opening = !this.namePickerOpen();
    this.namePickerOpen.set(opening);
    if (opening && this.selectedSetName() === null) {
      this.selectSet(this.nameTableStore.setNames()[0] ?? null);
    }
  }

  protected selectSet(setName: string | null): void {
    this.selectedSetName.set(setName);
    const firstTable = setName ? this.nameTableStore.tablesForSet(setName)[0] : undefined;
    this.selectedTableId.set(firstTable?.id ?? null);
    this.rolledNames.set([]);
  }

  protected selectTable(tableId: string): void {
    this.selectedTableId.set(tableId);
    this.rolledNames.set([]);
  }

  protected rollNames(): void {
    const tableId = this.selectedTableId();
    if (!tableId) return;
    this.rolledNames.set(this.nameTableStore.rollNames(tableId, 6));
  }

  protected pickName(candidate: string): void {
    this.name.set(candidate);
    this.namePickerOpen.set(false);
  }
}
