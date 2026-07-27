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
import { InitiativeAdvantageState } from '../../models/initiative-advantage.model';
import { hasRichTextContent } from '../../shared/rich-text-editor/rich-text-editor';

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
  /** combatant().name, but with an " A"/" B" suffix if another combatant in this encounter shares the name — see EncounterStore.computeDisplayNames. Used everywhere this component shows or announces a name, so a GM (or screen reader) can always tell two same-named combatants apart. */
  readonly displayName = input.required<string>();
  readonly expanded = input.required<boolean>();
  readonly isPlacing = input.required<boolean>();
  /** True in the Hold Action panel, where the bubble is narrower — shrinks the expand button. */
  readonly compact = input(false);
  /** True when this is the encounter's Active combatant — bumps the name's font-size. */
  readonly active = input(false);
  /** True when a Timer is currently linked to this combatant — shows a small clock icon next to their name (see EncounterDetail.isLinkedToTimer). */
  readonly hasLinkedTimer = input(false);
  /** True when this bubble is shown pre-Roll in the New Encounter builder's Encounter Preview (see EncounterPreviewPanel) rather than the run-phase screen — hides Hold Action/Incapacitated/Create Timer (none apply before combat starts), relabels Removed from Combat "Mark Absent" for a Player, and swaps it for a Delete button for an NPC. */
  readonly previewMode = input(false);

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
  /** Drawer's Edit Info button — EncounterDetail owns opening the shared EditCombatantDialog for this combatant. */
  readonly editRequested = output<void>();
  /** Drawer's Create Timer button — EncounterDetail creates a Timer linked to this combatant with a default name/value. */
  readonly createTimerRequested = output<void>();
  /** Drawer's View Stat Block button, and the same-named badge in the row itself (only shown when combatant().monsterTemplateId is set) — EncounterDetail looks up the MonsterTemplate and opens the shared MonsterStatBlockDialog. */
  readonly viewStatBlockRequested = output<void>();
  /** previewMode's Delete button (NPC only) — EncounterPreviewPanel removes this Combatant entirely (pre-Roll only, same EncounterStore.removeCombatant guard the setup-phase list already relies on). */
  readonly deleteRequested = output<void>();
  /** The row's Notes badge — EncounterDetail opens the shared NotesDialog for this combatant. */
  readonly notesRequested = output<void>();
  /** A signed HP delta typed into the popover below (damage negative, healing positive) — EncounterDetail applies it via EncounterStore.adjustCurrentHp. */
  readonly hpAdjustSubmit = output<number>();
  /** The HP popover's "+Temp" button, when no Temp HP pool is active — the typed magnitude becomes a fresh pool via EncounterStore.setTempHp. */
  readonly tempHpSubmit = output<number>();
  /** The HP popover's "+Temp" button, when a pool is already active — clears it immediately (no confirmation) via EncounterStore.clearTempHp. */
  readonly tempHpClear = output<void>();
  /** The AC popover's add-value step (shown when bonusAc is 0) — EncounterStore.setBonusAc. */
  readonly acBonusSubmit = output<number>();
  /** The AC popover's confirm-to-remove step (shown when bonusAc is already set) — EncounterStore.clearBonusAc. */
  readonly acBonusClear = output<void>();
  /** The Initiative popover's None/Advantage/Disadvantage radio choice — EncounterStore.setInitiativeAdvantage. */
  readonly initiativeAdvantageChange = output<InitiativeAdvantageState>();
  /** Mirrors anyPopoverOpen() below (HP/AC/Initiative popovers all share this) — EncounterDetail needs to know so it can raise the open bubble's <li> above its siblings (see the comment on the effect() below for why). */
  readonly popoverOpenChange = output<boolean>();

  // The creature-type subtitle ("Goblin") shown next to a personal name
  // ("Barry") — null whenever there's nothing to add: no monsterName at
  // all (a hand-entered combatant), or a generated monster that was never
  // given a personal name (name and monsterName are the same string, e.g.
  // both "Goblin"). Compared against the raw `name` field, not
  // displayName() — displayName() adds an " A"/" B" duplicate-name suffix
  // (see EncounterStore.computeDisplayNames), which would otherwise make
  // two unnamed "Goblin"s wrongly look like they'd been given a personal
  // name the moment they got lettered apart.
  protected readonly monsterSubtitle = computed(() => {
    const c = this.combatant();
    if (!c.monsterName) return null;
    if (c.name.trim().toLowerCase() === c.monsterName.trim().toLowerCase()) return null;
    return c.monsterName;
  });

  /** Drives the Notes badge's dark-vs-muted color and "See Notes"/"Add Notes" hint — see hasRichTextContent for why this isn't just `combatant().notes !== ''`. */
  protected readonly hasNotes = computed(() => hasRichTextContent(this.combatant().notes));

  // previewMode has no initiativeTotal yet (no Roll has happened) — showing
  // "N/A" there would be true but useless, since the one thing worth
  // knowing pre-Roll (the modifier that'll be added to the eventual d20
  // roll) is sitting right there on the Combatant already. Signed so a
  // negative modifier reads unambiguously (e.g. "-1"), matching how a GM
  // would write it by hand; 0 renders as a plain "0", not "+0".
  protected readonly initiativeBadgeValue = computed(() => {
    const c = this.combatant();
    if (!this.previewMode()) return c.initiativeTotal ?? 'N/A';
    const mod = c.initiativeModifier;
    return mod > 0 ? `+${mod}` : `${mod}`;
  });

  protected readonly initiativeBadgeTitle = computed(() => {
    if (this.previewMode()) return `Initiative Modifier: ${this.initiativeBadgeValue()}`;
    return `Initiative: ${this.combatant().initiativeTotal ?? 'N/A'}`;
  });

  // Current HP + any active Temp HP pool — the number actually shown in
  // .hp-numbers (see combatant-bubble.html). Temp HP can push this past
  // maxHp, which is exactly the point (it's "enhanced" for a reason) — see
  // hpPercent below for where that gets clamped back for the bar's width.
  protected readonly totalCurrentHp = computed(() => {
    const c = this.combatant();
    return (c.currentHp ?? c.maxHp ?? 0) + c.tempHp;
  });

  // Current/Max HP (including Temp HP) as a 0-100 percentage for the
  // health bar's width. Guards against maxHp being 0 (not a realistic
  // value, but still a valid number) so this never divides by zero.
  // Clamped to 100 — a bar can't visually show more than full, unlike the
  // numbers next to it — so a Temp HP pool never overflows the bar.
  protected readonly hpPercent = computed(() => {
    const c = this.combatant();
    if (!c.maxHp) return 0;
    return Math.min(100, Math.round((this.totalCurrentHp() / c.maxHp) * 100));
  });

  /** hp-stat's title — a plain instruction normally, or a breakdown of the Temp HP split when a pool is active. */
  protected readonly hpTitle = computed(() => {
    const c = this.combatant();
    if (c.tempHp > 0) {
      return `${c.currentHp ?? c.maxHp} HP + ${c.tempHp} Temp HP / ${c.maxHp} Max — click to apply damage or healing`;
    }
    return 'Current / Max HP — click to apply damage or healing';
  });

  /** Base AC + any active Bonus Armor — null (nothing to show) exactly when the base ac is null, same as before Bonus Armor existed. */
  protected readonly totalAc = computed(() => {
    const c = this.combatant();
    return c.ac === null ? null : c.ac + c.bonusAc;
  });

  /** ac-stat's title — plain "Armor Class: N" normally, or a breakdown when Bonus Armor is active. */
  protected readonly acTitle = computed(() => {
    const c = this.combatant();
    if (c.ac === null) return null;
    if (c.bonusAc > 0) return `Armor Class: ${c.ac} + ${c.bonusAc} Bonus Armor = ${this.totalAc()}`;
    return `Armor Class: ${c.ac}`;
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

  // Temp HP entry sub-mode: clicking "+Temp" (when no pool is active)
  // doesn't immediately read whatever's sitting in the damage/heal
  // magnitude input above — a GM could too easily click it before typing
  // anything, or while a damage amount is still sitting there from a
  // moment ago. Instead it swaps the popover into a dedicated prompt (its
  // own input, a checkmark to save, an X to cancel) — see
  // onTempHpButtonClick()/submitTempHpEntry()/cancelTempHpEntry() below.
  protected readonly tempHpEntryOpen = signal(false);
  protected readonly tempHpAmount = signal('');
  private readonly tempHpInputEl = viewChild<ElementRef<HTMLInputElement>>('tempHpInputEl');

  // The AC popover (Bonus Armor) — same local-signal shape as the HP
  // popover above, just a single positive magnitude (a bonus is always an
  // add, never signed) instead of a damage/healing toggle. Its content
  // branches in the template on combatant().bonusAc: 0 shows an add-value
  // form, >0 shows a confirm-to-remove prompt instead — see
  // combatant-bubble.html.
  protected readonly acAdjustOpen = signal(false);
  protected readonly acBonusMagnitude = signal('');
  private readonly acBonusInputEl = viewChild<ElementRef<HTMLInputElement>>('acBonusInputEl');

  // The Initiative popover (Advantage/Disadvantage) — no input to manage,
  // just an open/closed flag; picking a radio applies immediately (see
  // setInitiativeAdvantage below).
  protected readonly initiativePopoverOpen = signal(false);

  /** True while any of the three popovers above is open — see the effect() below for why this (not each popover individually) is what EncounterDetail needs to know about. */
  protected readonly anyPopoverOpen = computed(
    () => this.hpAdjustOpen() || this.acAdjustOpen() || this.initiativePopoverOpen(),
  );

  // effect(): re-runs whenever any signal it reads changes. Angular
  // schedules effects to run *after* change detection has updated the DOM,
  // so by the time this fires following one of the toggle*() methods below
  // opening a popover, the input it's reading via viewChild is already
  // there to focus. This replaces a plain HTML `autofocus` attribute on
  // the input (see the old template), which doesn't work reliably here:
  // `autofocus` per spec only fires once per document navigation, so on a
  // single-page app it would only ever focus the very first popover a GM
  // opened, not every one after — an effect re-focuses on every open
  // instead. (The Initiative popover has no text input, so nothing to
  // focus there — its radios are reachable by tab/click same as any other
  // control.)
  //
  // Also emits popoverOpenChange every time anyPopoverOpen() changes —
  // every combatant <li> in the main list has a permanent CSS `animation`
  // on it (.main-combatant's pop-in, see encounter-detail.css), and per the
  // CSS spec an element with an applicable `animation` targeting
  // `transform` creates its own stacking context for as long as that
  // animation rule matches it — not just while the animation is actually
  // playing. That means every bubble is already its own stacking context,
  // so a popover's own z-index (in combatant-bubble.css) only ever wins
  // against OTHER content inside the SAME bubble; it can't reach past its
  // <li> to outrank a sibling bubble's content, no matter how high that
  // z-index is — sibling bubbles below it in the DOM paint on top of it
  // instead. The fix has to raise the <li> itself, which lives in
  // EncounterDetail's own template, not this component's — hence telling
  // the parent via an output instead of just handling it locally. One
  // shared output for all three popovers (HP/AC/Initiative all hit the
  // exact same stacking-context problem) rather than three near-identical
  // ones. Constructor is where effect() needs to run, since it needs the
  // component's injection context.
  constructor() {
    effect(() => {
      this.popoverOpenChange.emit(this.anyPopoverOpen());
    });
    effect(() => {
      if (this.hpAdjustOpen() && !this.tempHpEntryOpen()) {
        this.hpDeltaInputEl()?.nativeElement.focus();
      }
    });
    effect(() => {
      if (this.tempHpEntryOpen()) {
        this.tempHpInputEl()?.nativeElement.focus();
      }
    });
    effect(() => {
      if (this.acAdjustOpen() && this.combatant().bonusAc === 0) {
        this.acBonusInputEl()?.nativeElement.focus();
      }
    });
  }

  protected toggleHpAdjust(): void {
    this.hpAdjustOpen.update((open) => !open);
    this.hpDeltaMagnitude.set('');
    this.hpAdjustMode.set('damage');
    this.tempHpEntryOpen.set(false);
    this.tempHpAmount.set('');
  }

  protected toggleHpAdjustMode(): void {
    this.hpAdjustMode.update((mode) => (mode === 'damage' ? 'healing' : 'damage'));
  }

  /**
   * The HP popover's "+Temp" button — only rendered in the normal
   * Damage/Healing view (see combatant-bubble.html), never in the Temp HP
   * entry prompt it opens, so this only ever has two cases:
   * - A pool is already active (tempHp > 0): clears it immediately, no
   *   confirmation needed — closes the whole HP popover, same as before.
   * - Otherwise: opens the entry prompt (see submitTempHpEntry/
   *   cancelTempHpEntry) instead of reading whatever's currently sitting
   *   in the damage/heal magnitude input — a GM could too easily click
   *   +Temp before typing a number, or with a leftover damage amount
   *   still in there from a moment ago.
   */
  protected onTempHpButtonClick(): void {
    if (this.combatant().tempHp > 0) {
      this.tempHpClear.emit();
      this.hpAdjustOpen.set(false);
      this.hpDeltaMagnitude.set('');
      this.hpAdjustMode.set('damage');
      return;
    }
    this.tempHpEntryOpen.set(true);
    this.tempHpAmount.set('');
  }

  // Digits-only, same stripping as onHpDeltaInput/onAcBonusInput — a Temp
  // HP amount is always a positive add, no sign to preserve.
  protected onTempHpAmountInput(raw: string): void {
    this.tempHpAmount.set(raw.replace(/[^0-9]/g, ''));
  }

  /** The Temp HP entry prompt's checkmark — applies the typed amount and closes the whole HP popover (same "commit closes the popover" convention as submitHpAdjust/submitAcBonus). No-op (silently) if the input's empty/zero, same guard as everywhere else that reads a magnitude. */
  protected submitTempHpEntry(): void {
    const magnitude = Number(this.tempHpAmount());
    if (Number.isFinite(magnitude) && magnitude > 0) {
      this.tempHpSubmit.emit(magnitude);
    }
    this.tempHpEntryOpen.set(false);
    this.tempHpAmount.set('');
    this.hpAdjustOpen.set(false);
    this.hpDeltaMagnitude.set('');
    this.hpAdjustMode.set('damage');
  }

  /** The Temp HP entry prompt's X — abandons the entry and returns to the normal Damage/Healing view, without closing the whole HP popover. */
  protected cancelTempHpEntry(): void {
    this.tempHpEntryOpen.set(false);
    this.tempHpAmount.set('');
  }

  protected toggleAcAdjust(): void {
    this.acAdjustOpen.update((open) => !open);
    this.acBonusMagnitude.set('');
  }

  // Same digits-only stripping as onHpDeltaInput below — a Bonus Armor
  // amount is always a positive add, so there's no sign to preserve here.
  protected onAcBonusInput(raw: string): void {
    this.acBonusMagnitude.set(raw.replace(/[^0-9]/g, ''));
  }

  /** The AC popover's add-value step (bonusAc is currently 0). */
  protected submitAcBonus(): void {
    const magnitude = Number(this.acBonusMagnitude());
    if (Number.isFinite(magnitude) && magnitude > 0) {
      this.acBonusSubmit.emit(magnitude);
    }
    this.acAdjustOpen.set(false);
    this.acBonusMagnitude.set('');
  }

  /** The AC popover's confirm-to-remove step (bonusAc is already set). */
  protected confirmClearAcBonus(): void {
    this.acBonusClear.emit();
    this.acAdjustOpen.set(false);
  }

  protected toggleInitiativePopover(): void {
    this.initiativePopoverOpen.update((open) => !open);
  }

  /** A radio pick in the Initiative popover — applies immediately (a radio choice is itself the final answer, no separate confirm step) and closes the popover. */
  protected pickInitiativeAdvantage(state: InitiativeAdvantageState): void {
    this.initiativeAdvantageChange.emit(state);
    this.initiativePopoverOpen.set(false);
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

  // Click/tap-to-expand the full name — for when the container-query
  // truncation ladder in combatant-bubble.css has tightened the name's
  // flex-basis. Hover is covered separately, for free, by a plain `title`
  // attribute in the template (no JS needed for that half).
  protected readonly nameExpanded = signal(false);
  private readonly nameToggle = viewChild<ElementRef<HTMLElement>>('nameToggle');

  protected toggleNameExpanded(): void {
    this.nameExpanded.update((expanded) => !expanded);
  }

  @HostListener('document:click', ['$event'])
  protected collapseNameOnClickAway(event: MouseEvent): void {
    if (!this.nameExpanded()) return;
    const nameEl = this.nameToggle()?.nativeElement;
    if (nameEl && !nameEl.contains(event.target as Node)) {
      this.nameExpanded.set(false);
    }
  }
}
