import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
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
  // NgTemplateOutlet backs the [ngTemplateOutlet] binding in the template —
  // it's what renders the #statsBlock <ng-template> in place at each of its
  // two <ng-container [ngTemplateOutlet]> spots (row vs. drawer, depending
  // on compact()).
  imports: [FormsModule, NgTemplateOutlet],
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
  /** Mirrors hpAdjustOpen() below — EncounterDetail needs to know so it can raise the open bubble's <li> above its siblings (see the comment on the effect() below for why). */
  readonly hpAdjustOpenChange = output<boolean>();

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
  /** Damage/Healing toggle above the input — Damage is the default each time the popover opens. */
  protected readonly hpAdjustMode = signal<'damage' | 'healing'>('damage');
  // Only ever holds the digits the GM typed — the sign is never part of
  // this, it's added back by hpDeltaDisplay() below from hpAdjustMode()
  // instead, so the toggle (not the keyboard) is the only way to change it.
  protected readonly hpDeltaMagnitude = signal('');

  // computed(): derives the input's displayed value from the two signals
  // above — re-runs automatically whenever either changes. This is what
  // makes the leading -/+ un-typeable: every keystroke re-renders the input
  // from this, so even if the GM's edit touched the sign character, the
  // next render puts the correct one straight back.
  protected readonly hpDeltaDisplay = computed(
    () => (this.hpAdjustMode() === 'damage' ? '-' : '+') + this.hpDeltaMagnitude(),
  );

  // viewChild(): a signal-based reference to the '#hpDeltaInputEl' input in
  // this component's own template — only present in the DOM while the
  // popover (hpAdjustOpen()) is open, so this reads as undefined the rest
  // of the time.
  private readonly hpDeltaInputEl = viewChild<ElementRef<HTMLInputElement>>('hpDeltaInputEl');

  // effect(): re-runs whenever any signal it reads changes — here that's
  // hpAdjustOpen() and (once it exists) hpDeltaInputEl(). Angular schedules
  // effects to run *after* change detection has updated the DOM, so by the
  // time this fires following toggleHpAdjust() opening the popover, the
  // input it's reading via viewChild is already there to focus. This
  // replaces a plain HTML `autofocus` attribute on the input (see the old
  // template), which doesn't work reliably here: `autofocus` per spec only
  // fires once per document navigation, so on a single-page app it would
  // only ever focus the very first popover a GM opened, not every one
  // after — an effect re-focuses on every open instead.
  //
  // Also emits hpAdjustOpenChange every time hpAdjustOpen() changes — every
  // combatant <li> in the main list has a permanent CSS `animation` on it
  // (.main-combatant's pop-in, see encounter-detail.css), and per the CSS
  // spec an element with an applicable `animation` targeting `transform`
  // creates its own stacking context for as long as that animation rule
  // matches it — not just while the animation is actually playing. That
  // means every bubble is already its own stacking context, so this
  // popover's own z-index (in combatant-bubble.css) only ever wins against
  // OTHER content inside the SAME bubble; it can't reach past its <li> to
  // outrank a sibling bubble's content, no matter how high that z-index is
  // — sibling bubbles below it in the DOM paint on top of it instead. The
  // fix has to raise the <li> itself, which lives in EncounterDetail's own
  // template, not this component's — hence telling the parent via an
  // output instead of just handling it locally. Constructor is where
  // effect() needs to run, since it needs the component's injection
  // context.
  constructor() {
    effect(() => {
      const open = this.hpAdjustOpen();
      this.hpAdjustOpenChange.emit(open);
      if (open) {
        this.hpDeltaInputEl()?.nativeElement.focus();
      }
    });
  }

  protected toggleHpAdjust(): void {
    this.hpAdjustOpen.update((open) => !open);
    this.hpDeltaMagnitude.set('');
    this.hpAdjustMode.set('damage');
  }

  protected toggleHpAdjustMode(): void {
    this.hpAdjustMode.update((mode) => (mode === 'damage' ? 'healing' : 'damage'));
  }

  // Bound to the input's (ngModelChange) — strips anything that isn't a
  // digit out of what the GM typed/pasted, including the -/+ itself (there's
  // no way to tell "the sign we rendered" apart from "a sign the GM typed"
  // once they're both just characters in the same string, so the simplest
  // reliable fix is to disallow typing one at all and let toggleHpAdjustMode()
  // be the only source of the sign).
  protected onHpDeltaInput(raw: string): void {
    this.hpDeltaMagnitude.set(raw.replace(/[^0-9]/g, ''));
  }

  protected submitHpAdjust(): void {
    const magnitude = Number(this.hpDeltaMagnitude());
    if (Number.isFinite(magnitude) && magnitude !== 0) {
      const delta = this.hpAdjustMode() === 'damage' ? -magnitude : magnitude;
      this.hpAdjustSubmit.emit(delta);
    }
    this.hpAdjustOpen.set(false);
    this.hpDeltaMagnitude.set('');
    this.hpAdjustMode.set('damage');
  }

  // Click/tap-to-reveal the full note text (see combatant-bubble.html/css —
  // hover only highlights now, it no longer expands anything, since
  // expand-on-hover was what caused the stutter this replaced). Kept local
  // here rather than lifted to EncounterDetail, same as hpAdjustOpen above —
  // no sibling needs to know about it.
  protected readonly notesRevealed = signal(false);

  // viewChild(): a signal-based reference to the '#notesToggle' element in
  // this component's own template (see combatant-bubble.html) — used below
  // to tell a click on the note itself apart from a click elsewhere on the
  // page, so the document-wide listener knows when to collapse it.
  private readonly notesToggle = viewChild<ElementRef<HTMLElement>>('notesToggle');

  protected toggleNotesRevealed(): void {
    this.notesRevealed.update((revealed) => !revealed);
  }

  // @HostListener('document:click', ...): registers a click listener on the
  // whole document (not just this component's own element), so this fires
  // for a click ANYWHERE on the page — that's what "collapse after a click
  // away" needs. A click on the notes element itself already toggled
  // notesRevealed via (click) in the template above by the time this runs
  // (that handler fires first, then the same click event bubbles up to
  // document), so re-checking notesRevealed() here and bailing out when the
  // click landed inside the notes element avoids immediately closing what
  // that click just opened.
  @HostListener('document:click', ['$event'])
  protected collapseNotesOnClickAway(event: MouseEvent): void {
    if (!this.notesRevealed()) return;
    const notesEl = this.notesToggle()?.nativeElement;
    if (notesEl && !notesEl.contains(event.target as Node)) {
      this.notesRevealed.set(false);
    }
  }
}
