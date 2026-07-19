# Roll4 — Roadmap

This is a rough phase plan, not a committed schedule. Update it as scope
shifts — the point is to keep a shared picture of "what are we building
right now vs. later," not to lock in dates.

## Phase 1 — Local GM MVP

No accounts, no backend. Single GM using the app in one browser.

- [x] Party management: create a Party, add/edit/remove PCs (name +
      Initiative Modifier).
- [x] Encounter creation: pick a Party (or Parties), add ad-hoc NPCs.
- [x] Roll Initiative: d20 + modifier per combatant, sorted descending.
- [x] Initiative list UI: name, PC/NPC color, Active-turn highlight.
- [x] Forward/Back turn navigation, skipping Removed-from-Combat entries.
- [x] Round tracking + counter.
- [x] Per-encounter setting: Re-roll every round (default) vs. keep order.
- [x] Removed from Combat toggle (N/A initiative, sinks to the bottom,
      skipped; un-removing rolls fresh and rejoins below the Active total).
- [x] Hold Action toggle (moves to a secondary panel ordered by insertion,
      pinned to the Active total for display, skipped by Forward/Back until
      unchecked; cleared back into the main list at each new round).
      Returning from it uses a placement mode: two placeholder spots appear
      around Active (±1 initiative) and the GM picks one by click or drag
      (Angular CDK) while every other control locks.
- [x] Drag-and-drop initiative reordering: a drag handle on each main-list
      bubble lets the GM manually reposition it, with a dashed placeholder
      (CDK's default sortable-list gap) showing where it'll land. Pins to
      one point above/below whichever neighbor it's dropped next to, same
      convention as Hold Action placement. Removed/on-hold combatants
      aren't draggable. Kept structurally separate (its own self-contained
      cdkDropList) from the Hold Action placement drop lists, so the two
      drag interactions can't cross into each other.
- [x] Persistence to browser storage so a GM can close the tab and resume
      later.

**Exit criteria:** a GM can run a full multi-round combat, start to finish,
entirely within one browser, and trust that closing/reopening the tab
doesn't lose their Party or in-progress Encounter.

## Phase 1.5 — Visual/UX polish (interstitial)

Not a feature phase — a styling pass on the Phase 1 screens before Phase 2
starts, since the app was functionally complete but visually unstyled
(empty component stylesheets, no design tokens, no mobile layout
considerations).

- [x] Design tokens (color/shadow/motion) and shared bubble/card styling
      for party, PC, encounter, and combatant entries.
- [x] Black header, light-grey page background, mobile-first responsive
      layout.
- [x] Larger/highlighted active-turn combatant bubble.
- [x] Combatant bubble expansion drawer for Removed from Combat / Hold
      Action, with status icons on the collapsed bubble.

## Phase 2 — Combatant Data + Troops (current phase)

Still local-storage only, no backend yet — a feature pass that deepens what
a combatant *is* before Phase 3 moves persistence off the browser.

- [x] Combatant HP / AC / Notes: optional fields alongside Initiative
      Modifier, settable when creating a PC/NPC and editable live during an
      encounter, with column labels matching Initiative Modifier's. Answers
      the "how much combat data" open question in
      [PRODUCT.md](./PRODUCT.md).
- [ ] Troops tab: a third top-nav tab alongside Parties and Encounters —
      pre-made, reusable groupings of NPCs a GM can bring into an Encounter
      the same way Party PCs are brought in today (a checkbox to include
      the group). Answers the "NPC reuse" open question in
      [PRODUCT.md](./PRODUCT.md).

## Phase 3 — GM Accounts + Real Persistence

- [ ] Choose a backend (see [ARCHITECTURE.md](./ARCHITECTURE.md) — deferred
      on purpose until this phase).
- [ ] GM authentication/accounts.
- [ ] Migrate Parties/PCs/Encounters/Troops from browser storage to the
      backend, scoped per-GM.
- [ ] Data accessible from more than one device/browser.

## Phase 4 — Player Role

- [ ] Player accounts, distinct role from GM.
- [ ] A Player can be linked to a PC and upload/manage that character's
      data (at minimum: name + Initiative Modifier) instead of the GM
      entering it.
- [ ] Turn notification: a Player gets notified when their PC becomes the
      Active combatant.

## Backlog — future ideas (not yet phased)

Captured so they aren't lost, not scheduled into a phase yet. Needs proper
design (data model, UI) before it becomes phase work.

- **Timers** — an Encounter feature: an "Add Timer" button creates a Timer
  Card with a GM-written label (e.g. "Water floods the room in 4 rounds")
  that counts down each turn or round. Timer Cards sit above the
  combatants table, showing a progress bar/chart and rounds-or-turns
  remaining. On expiry, a timer is highlighted rather than removed — the GM
  dismisses it manually via an X. The GM can also nudge the remaining count
  up/down with +/- controls.
- **NPC name generator** — a tool to generate NPC names on demand.

## Explicitly not planned yet

Keep this section so we don't accidentally scope-creep during Phase 1: dice
rolling beyond initiative (attack/damage rolls), mobile app / offline PWA
packaging.
