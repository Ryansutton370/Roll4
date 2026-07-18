# Roll4 — Data Model

This describes the shape of Roll4's core data, independent of how it's
persisted (see [ARCHITECTURE.md](./ARCHITECTURE.md) for storage details).
Treat this as a living document — update it whenever the shape of the data
actually changes in code, since code and doc drifting apart helps no one.

## Entity overview

```
User (GM)
  └── owns many → Party
                    └── contains many → PlayerCharacter (PC)

User (GM)
  └── owns many → Encounter
                    ├── references → one or more Party (to pull PCs from)
                    └── contains many → Combatant
                                          ├── wraps a PC, OR
                                          └── wraps an NPC (defined inline)
```

The key design decision here: a **Combatant** is not the same thing as a PC
or an NPC. A PC is permanent data that lives in a Party and gets reused
across many encounters. A Combatant is *that PC's participation in this one
Encounter* — its rolled initiative, whether it's been removed from combat,
etc. Mixing those together would mean a PC's "current initiative roll" leaks
into the Party screen, which doesn't make sense once the same PC is used in
a second encounter.

## Entities

**Implementation note (Phase 1):** `User` and the `ownerId` fields below
describe the target relational shape once GM accounts exist (Phase 2 — see
[ROADMAP.md](./ROADMAP.md)). Phase 1 has no accounts at all — one GM, one
browser — so the Phase 1 code has no `User` type and Party/Encounter have no
`ownerId` field. They'll be added when auth actually lands, instead of
carrying an always-empty field until then.

### User
| Field       | Type   | Notes                                   |
|-------------|--------|------------------------------------------|
| `id`        | string | Unique identifier                       |
| `role`      | `"gm"` \| `"player"` | Player role is future work |
| `displayName` | string | |

### Party
| Field   | Type     | Notes                          |
|---------|----------|----------------------------------|
| `id`    | string   | Unique identifier                |
| `ownerId` | string | References `User.id` (the GM)  |
| `name`  | string   | e.g. "The Thursday Night Group" |
| `pcIds` | string[] | References `PlayerCharacter.id` |

### PlayerCharacter (PC)
| Field                | Type   | Notes                                  |
|----------------------|--------|-------------------------------------------|
| `id`                 | string | Unique identifier                         |
| `partyId`            | string | References `Party.id`                     |
| `name`               | string | e.g. "Aria Windmere"                      |
| `initiativeModifier` | number | Signed integer, e.g. `3`, `0`, `-1`       |
| `ownerId`            | string \| null | Future: references a Player `User.id` |

### Encounter
| Field              | Type      | Notes                                          |
|--------------------|-----------|--------------------------------------------------|
| `id`               | string    | Unique identifier                                |
| `ownerId`          | string    | References `User.id` (the GM)                    |
| `name`             | string    | e.g. "Goblin Ambush"                              |
| `partyIds`         | string[]  | Which Parties' PCs were pulled in                |
| `combatantIds`     | string[]  | **Ordered** by initiative (descending); this order IS the initiative order |
| `activeCombatantIndex` | number \| null | Index into `combatantIds`; null before first Roll |
| `holdOrder`        | string[]  | Ids of Combatants currently on Hold Action, oldest-first. Drives the secondary Hold Action list; cleared every round boundary |
| `round`            | number    | `0` before the first Roll, then starts at `1`    |
| `reRollEachRound`  | boolean   | Default `true` (the homebrew rule)               |

### Combatant
An Encounter-scoped participant. Either backed by a PC or defined inline as
an NPC — never both.

| Field                | Type                   | Notes                                        |
|----------------------|------------------------|-----------------------------------------------|
| `id`                 | string                 | Unique identifier                             |
| `encounterId`        | string                 | References `Encounter.id`                     |
| `type`               | `"pc"` \| `"npc"`      | Drives the color shown in the initiative list |
| `pcId`                | string \| null        | Set when `type === "pc"`                      |
| `name`               | string                 | Copied from PC, or set directly for an NPC    |
| `initiativeModifier` | number                 | Copied from PC, or set directly for an NPC    |
| `lastRoll`           | number \| null         | The 1–20 die result from the most recent roll |
| `initiativeTotal`    | number \| null         | `lastRoll + initiativeModifier`; this is what sorts the list. `null` renders as "N/A" and sorts/counts as `0` |
| `removedFromCombat`  | boolean                | Default `false`. See below.                   |
| `onHold`             | boolean                | Default `false`. See below.                   |
| `preHoldLastRoll`    | number \| null         | Snapshot of `lastRoll` taken when Hold Action was turned on. Default `null`. See below. |
| `preHoldInitiativeTotal` | number \| null     | Snapshot of `initiativeTotal` taken when Hold Action was turned on. Default `null`. See below. |

**Why copy `name`/`initiativeModifier` onto the Combatant instead of always
reading through to the PC?** An NPC has no separate source to read from, so
the Combatant needs its own copy regardless. Giving PCs the same shape keeps
`Combatant` a single, consistent type the initiative-list UI can render
without a `type` branch on every field — it only needs to branch on `type`
for things that actually differ (like whether `pcId` is set).

**`removedFromCombat` and ordering:** removing a combatant sets its
`lastRoll`/`initiativeTotal` to `null` ("N/A"), which sorts/counts as `0` —
in practice this sinks it toward the bottom of `combatantIds`, since real
rolls are rarely that low. It's skipped when advancing the active turn.
Un-removing it rolls a fresh initiative that's randomized but capped below
whatever the current Active combatant's total is, and reinserts it into
`combatantIds` at the matching sorted position — "rejoining mid-round, right
where that roll would place them," not restoring its original spot.

**`onHold` and ordering:** a combatant on Hold Action is pulled out of the
main initiative list into a bordered Hold Action panel (beside the main list
on wide screens, stacked below it on narrow ones). Order in that panel is
insertion order (`Encounter.holdOrder`), not initiative — whoever holds
first appears at the top. While on hold, `initiativeTotal` is continuously
pinned to equal the Active combatant's total (a display-only value; not a
real roll) and Forward/Back skip it, same as `removedFromCombat`.

Un-holding — via the drawer's checkbox, or the panel bubble's dedicated
"return to main list" button — doesn't immediately return the combatant to
the main list. It opens placement mode (component-local UI state in
`EncounterDetail`, not persisted on the Combatant): two placeholder spots
appear around Active in the main list, one at `activeTotal + 1` and one at
`activeTotal - 1`, and every other control disables until the GM resolves it
by clicking a placeholder or dragging the bubble onto one (Angular CDK drag
and drop). Resolving calls `EncounterStore.returnFromHold(encounterId,
combatantId, position)`, which sets `onHold` to `false`, removes the id from
`holdOrder`, sets `initiativeTotal` to the chosen `activeTotal ± 1`, and
derives a matching `lastRoll` (`initiativeTotal - initiativeModifier`) purely
to keep that invariant consistent — it isn't a real die roll.

`position` also decides whose turn it is afterward: `'above'` sets
`activeCombatantIndex` to the *returning* combatant — an interrupt, since a
held trigger firing ahead of the current turn means acting immediately.
`'below'` leaves `activeCombatantIndex` on whoever was already Active — just
queuing the combatant up next. No special-case "resume" logic is needed for
the interrupt case: the previously-Active combatant is simply the
next-highest remaining total, so Forward naturally lands back on them once
the interrupter's turn ends, the same as any other turn advance.

If the Active combatant checks Hold Action on their own turn, the turn
passes immediately (same auto-advance as marking the Active combatant
Removed), and they go through the same placement flow once returned to.

**Hold Action and new rounds:** starting a new round always empties
`holdOrder` — every on-hold combatant returns to the main list. If
`reRollEachRound` is `true` (the default), they get a fresh roll like
everyone else. If `false`, each one's `initiativeTotal`/`lastRoll` is
restored from its `preHoldLastRoll`/`preHoldInitiativeTotal` snapshot (taken
the moment Hold Action was turned on), rather than keeping the "pinned to
Active" display value.

The skip/auto-advance logic for both flags lives in the Forward/Back
turn-advancement logic, not in the data itself.

**Manual reordering:** the GM can also drag any main-list combatant (one
that's neither `removedFromCombat` nor `onHold`) to a new spot via a drag
handle, using Angular CDK's default sortable-`cdkDropList` behavior — a
dashed placeholder marks the drop gap and siblings shift live as it's
dragged. `EncounterStore.reorderCombatant(encounterId, combatantId,
newIndex)` handles the drop; `newIndex` follows the same "remove, then
insert" convention as `Array.splice`/CDK's `moveItemInArray` — the target
index in the order *with the dragged combatant already removed*. Like every
other manual repositioning in this app, it pins to a neighbor's total ± 1
(one point below whoever ends up above it, or one point above whoever ends
up below it if dropped at the very top) rather than computing a midpoint.
This `cdkDropList` is deliberately self-contained — no
`cdkDropListConnectedTo` linking it to the Hold Action panel's drop lists —
so the two drag interactions can never cross into each other.

## Notes on "re-roll every round"

When `reRollEachRound` is `true` (the default), starting a new round means:
1. Every non-removed Combatant gets a new `lastRoll` (and thus a new
   `initiativeTotal`).
2. `combatantIds` is re-sorted descending by the new totals.
3. `activeCombatantIndex` resets to `0` (or the first non-removed entry).

When `reRollEachRound` is `false`, a new round just resets
`activeCombatantIndex` — the existing `combatantIds` order and totals are
left alone.
