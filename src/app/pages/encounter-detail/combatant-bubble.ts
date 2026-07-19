import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Combatant } from '../../models/encounter.model';

/**
 * The row + expandable drawer shared by a combatant bubble in the main
 * initiative list and in the Hold Action panel — name, status icons,
 * initiative total, expand toggle, and the Removed/Hold/Incapacitated
 * checkboxes. Split out of EncounterDetail because that template had grown
 * to ~550 lines with this content duplicated almost verbatim between the
 * two lists.
 *
 * The outer <li> (cdkDrag/cdkDropList wiring, and most of the
 * active/incapacitated/pop visual states) stays in EncounterDetail's
 * template rather than moving in here — that wiring differs between the
 * main list and the Hold Action panel, and splitting it out would mean this
 * component reaching back into two different drag-and-drop setups. Angular's
 * view encapsulation means the outer <li>'s classes can't style anything
 * inside this component's own template though, so the two visual states
 * that *do* reach inside (a smaller expand button in the Hold Action panel;
 * a larger name on the Active combatant) are re-exposed as the `compact`/
 * `active` inputs below instead, each driving a plain local class on the
 * element that needs it. The leading control (drag handle vs. "return to
 * main list" button) is left to the caller entirely via content projection,
 * below.
 */
@Component({
  selector: 'app-combatant-bubble',
  imports: [FormsModule],
  templateUrl: './combatant-bubble.html',
  styleUrl: './combatant-bubble.css',
})
export class CombatantBubble {
  // input()/input.required(): same signal-based inputs as elsewhere in this
  // app (see party-detail.ts) — the parent's template binding sets these,
  // and the template below re-renders whenever they change.
  readonly combatant = input.required<Combatant>();
  readonly expanded = input.required<boolean>();
  readonly isPlacing = input.required<boolean>();
  /** True in the Hold Action panel, where the bubble is narrower — shrinks the expand button. */
  readonly compact = input(false);
  /** True when this is the encounter's Active combatant — bumps the name's font-size. */
  readonly active = input(false);

  // output(): the signal-based replacement for @Output()/EventEmitter — it
  // exposes an emitter that the parent's template listens to with a normal
  // (eventName) binding, e.g. (expandToggle)="toggleExpanded(c.id)". This
  // component only reports *what happened*; EncounterDetail still owns
  // deciding what that means (e.g. the Hold Action checkbox means something
  // different — start holding vs. begin placement — depending on which list
  // it's used from, so it's wired to a different handler at each call site).
  readonly expandToggle = output<void>();
  readonly holdActionChange = output<void>();
  readonly incapacitatedToggle = output<void>();
  readonly removedToggle = output<void>();
  /** Drawer's Edit button — EncounterDetail owns opening the shared EditCombatantDialog for this combatant. */
  readonly editRequested = output<void>();
  /** A signed HP delta typed into the popover below (damage negative, healing positive) — EncounterDetail applies it via EncounterStore.adjustCurrentHp. */
  readonly hpAdjustSubmit = output<number>();

  // Current/Max HP as a 0-100 percentage for the health bar's width. Guards
  // against maxHp being 0 (not a realistic value, but still a valid number)
  // so this never divides by zero.
  protected readonly hpPercent = computed(() => {
    const c = this.combatant();
    if (!c.maxHp) return 0;
    return Math.round(((c.currentHp ?? c.maxHp) / c.maxHp) * 100);
  });

  // HSL hue for the health bar fill: 120 (green) at full HP, sweeping down
  // through 60 (yellow) at half HP to 0 (red) at empty — a straight linear
  // interpolation across the hue wheel happens to pass through yellow at
  // the midpoint, which is exactly the green-to-yellow-to-red read a health
  // bar wants. Applied via a bound CSS custom property (--hp-hue) rather
  // than computing a full color string here, so the saturation/lightness
  // stay tunable in one place (combatant-bubble.css) instead of baked into
  // this expression.
  protected readonly hpHue = computed(() => Math.round(this.hpPercent() * 1.2));

  // The HP delta popover and the notes hover-expand are kept as bubble-local
  // state (plain signal(), not lifted to EncounterDetail like expanded/
  // isPlacing) — unlike the drawer, nothing needs to force-close either of
  // these from outside, so lifting them would just be copying the drawer's
  // pattern where it isn't earning its keep.
  protected readonly hpAdjustOpen = signal(false);
  protected readonly hpDeltaInput = signal('');

  protected toggleHpAdjust(): void {
    this.hpAdjustOpen.update((open) => !open);
    this.hpDeltaInput.set('');
  }

  protected submitHpAdjust(): void {
    const delta = this.parseHpDelta(this.hpDeltaInput());
    if (Number.isFinite(delta) && delta !== 0) {
      this.hpAdjustSubmit.emit(delta);
    }
    this.hpAdjustOpen.set(false);
    this.hpDeltaInput.set('');
  }

  // "+10"/"-15" are taken as written; a bare "15" (no leading sign) is
  // assumed to mean damage (-15) rather than healing — a GM reaching for
  // this control is typing damage far more often than healing, so leaving
  // the sign off should mean the common case instead of a no-op/error.
  private parseHpDelta(input: string): number {
    const trimmed = input.trim();
    const value = Number(trimmed);
    if (!Number.isFinite(value)) return NaN;
    return /^[+-]/.test(trimmed) ? value : -value;
  }

  // Tap-to-reveal for touch input, alongside the CSS :hover in
  // combatant-bubble.css — mirrors the drag-handle reveal pattern in
  // encounter-detail.ts, but kept local here since no sibling needs to know
  // about it.
  protected readonly notesRevealed = signal(false);

  protected toggleNotesRevealed(): void {
    this.notesRevealed.update((revealed) => !revealed);
  }
}
