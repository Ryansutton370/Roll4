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
| `round`            | number    | Starts at `1` once rolled                        |
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
| `initiativeTotal`    | number \| null         | `lastRoll + initiativeModifier`; this is what sorts the list |
| `removedFromCombat`  | boolean                | Default `false`. See below.                   |

**Why copy `name`/`initiativeModifier` onto the Combatant instead of always
reading through to the PC?** An NPC has no separate source to read from, so
the Combatant needs its own copy regardless. Giving PCs the same shape keeps
`Combatant` a single, consistent type the initiative-list UI can render
without a `type` branch on every field — it only needs to branch on `type`
for things that actually differ (like whether `pcId` is set).

**`removedFromCombat` and ordering:** removing a combatant from combat must
**not** remove it from `combatantIds` or change its index — the requirement
is that it keeps its place in the list, just greyed out and skipped when
advancing the active turn. The "skip removed combatants" logic lives in the
Forward/Back turn-advancement logic, not in the data itself.

## Notes on "re-roll every round"

When `reRollEachRound` is `true` (the default), starting a new round means:
1. Every non-removed Combatant gets a new `lastRoll` (and thus a new
   `initiativeTotal`).
2. `combatantIds` is re-sorted descending by the new totals.
3. `activeCombatantIndex` resets to `0` (or the first non-removed entry).

When `reRollEachRound` is `false`, a new round just resets
`activeCombatantIndex` — the existing `combatantIds` order and totals are
left alone.
