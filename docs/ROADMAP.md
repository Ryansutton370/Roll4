# Roll4 — Roadmap

This is a rough phase plan, not a committed schedule. Update it as scope
shifts — the point is to keep a shared picture of "what are we building
right now vs. later," not to lock in dates.

## Phase 1 — Local GM MVP (current phase)

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
- [x] Hold Action toggle (pinned to one less than the Active total, lightly
      highlighted, skipped by Forward/Back until unchecked).
- [x] Persistence to browser storage so a GM can close the tab and resume
      later.

**Exit criteria:** a GM can run a full multi-round combat, start to finish,
entirely within one browser, and trust that closing/reopening the tab
doesn't lose their Party or in-progress Encounter.

## Phase 2 — GM Accounts + Real Persistence

- [ ] Choose a backend (see [ARCHITECTURE.md](./ARCHITECTURE.md) — deferred
      on purpose until this phase).
- [ ] GM authentication/accounts.
- [ ] Migrate Parties/PCs/Encounters from browser storage to the backend,
      scoped per-GM.
- [ ] Data accessible from more than one device/browser.

## Phase 3 — Player Role

- [ ] Player accounts, distinct role from GM.
- [ ] A Player can be linked to a PC and upload/manage that character's
      data (at minimum: name + Initiative Modifier) instead of the GM
      entering it.
- [ ] Turn notification: a Player gets notified when their PC becomes the
      Active combatant.

## Planned, not yet built

- **Drag-and-drop initiative reordering.** Let the GM drag a combatant entry
  to a new spot in the list; dropping it adjusts its initiative to one point
  above/below whatever it's dropped next to, so the manual reorder sticks
  without fighting the sort. Deferred until the initiative list's core
  interactions (Removed, Hold Action) are settled, since drag-and-drop needs
  to compose with both (e.g. dragging a held or removed combatant).

## Explicitly not planned yet

Keep this section so we don't accidentally scope-creep during Phase 1:
monster/NPC libraries reusable across encounters, HP/conditions tracking,
dice rolling beyond initiative (attack/damage rolls), mobile app / offline
PWA packaging.
