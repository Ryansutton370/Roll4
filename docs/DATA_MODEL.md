# Roll4 — Data Model

This describes the shape of Roll4's core data, independent of how it's
persisted (see [ARCHITECTURE.md](./ARCHITECTURE.md) for storage details).
Treat this as a living document — update it whenever the shape of the data
actually changes in code, since code and doc drifting apart helps no one.

## Entity overview

```
User (GM)
  └── owns many → Party ─┐
                          │ playerIds (many-to-many)
  └── owns many → Player ─┘

User (GM)
  └── owns many → Troop ──┐
                           │ npcIds (many-to-many)
  └── owns many → Npc ────┘

User (GM)
  └── owns many → Encounter
                    ├── references → one or more Party (to pull Players from)
                    ├── references → one or more Troop (to pull NPCs from)
                    └── contains many → Combatant
                                          ├── wraps a Player, OR
                                          └── wraps an Npc, either from the
                                              library or defined ad-hoc
```

The key design decision here: a **Combatant** is not the same thing as a
Player or an Npc. A Player/Npc is permanent library data reused across many
Parties/Troops and Encounters. A Combatant is *that Player's or Npc's
participation in this one Encounter* — its rolled initiative, whether it's
been removed from combat, etc. Mixing those together would mean a Player's
"current initiative roll" leaks into the roster screen, which doesn't make
sense once the same Player is used in a second encounter.

The second key decision (Phase 2): **Party/Troop membership is
many-to-many**, not the Phase 1 shape where a PC belonged to exactly one
Party. A Player can be in several Parties (a GM running more than one
group who shares a player between them, e.g.), and an Npc can be in
several Troops. `Party.playerIds`/`Troop.npcIds` are the *owning* side of
that relationship — Player/Npc carry no back-reference field at all;
"which Parties is this Player in" is always derived by scanning every
Party's `playerIds` (see `PartyStore.partiesForPlayer` /
`NpcStore.troopsForNpc`), the same "list owns its members" convention
already used for `Encounter.combatantIds`/`holdOrder`.

## Entities

**Implementation note (Phase 1):** `User` and the `ownerId` fields below
describe the target relational shape once GM accounts exist (Phase 3 — see
[ROADMAP.md](./ROADMAP.md)). Phase 1/2 have no accounts at all — one GM, one
browser — so the code has no `User` type and no entity has an `ownerId`
field yet. They'll be added when auth actually lands, instead of carrying
an always-empty field until then.

### User
| Field       | Type   | Notes                                   |
|-------------|--------|------------------------------------------|
| `id`        | string | Unique identifier                       |
| `role`      | `"gm"` \| `"player"` | Player role is future work |
| `displayName` | string | |

### Party
| Field       | Type     | Notes                                    |
|-------------|----------|--------------------------------------------|
| `id`        | string   | Unique identifier                          |
| `ownerId`   | string   | References `User.id` (the GM)              |
| `name`      | string   | e.g. "The Thursday Night Group"            |
| `playerIds` | string[] | References `Player.id` — the owning side of a many-to-many; deleting a Party does **not** delete these Players, it just drops the grouping |

### Player
A reusable library entry — not tied to any one Party (see `Party.playerIds`
above). Renamed from Phase 1's `PlayerCharacter`, which was owned 1:1 by a
single Party via a `partyId` field; that field is gone now that membership
is many-to-many.

| Field                | Type   | Notes                                  |
|----------------------|--------|-------------------------------------------|
| `id`                 | string | Unique identifier                         |
| `name`               | string | e.g. "Aria Windmere"                      |
| `initiativeModifier` | number | Signed integer, e.g. `3`, `0`, `-1`       |
| `ac`                 | number \| null | Optional. `null` means "not set," not zero |
| `maxHp`              | number \| null | Optional. Entered as "Max HP" when creating/editing the Player |
| `notes`              | string | Optional. `''` means "not set"            |
| `ownerId`            | string \| null | Future: references a Player-role `User.id` |

### Troop
| Field     | Type     | Notes                                        |
|-----------|----------|-------------------------------------------------|
| `id`      | string   | Unique identifier                              |
| `ownerId` | string   | References `User.id` (the GM)                  |
| `name`    | string   | e.g. "Goblin Warband"                          |
| `npcIds`  | string[] | References `Npc.id` — same many-to-many convention as `Party.playerIds` |

### Npc
The NPC-side mirror of Player — a reusable library entry, not tied to any
one Troop. New this phase: NPCs had no persisted library at all before now
(they were always created ad-hoc, inline in an Encounter). That ad-hoc path
is untouched and still the only way to add an NPC to an Encounter today —
this library and Troops exist alongside it, not in place of it yet; pulling
a Troop into an Encounter (mirroring how a Party is pulled in today) is
planned but not built.

| Field                | Type   | Notes                                  |
|----------------------|--------|-------------------------------------------|
| `id`                 | string | Unique identifier                         |
| `name`               | string | e.g. "Goblin Shaman"                      |
| `initiativeModifier` | number | Signed integer, e.g. `3`, `0`, `-1`       |
| `ac`                 | number \| null | Optional. `null` means "not set," not zero |
| `maxHp`              | number \| null | Optional. Entered as "Max HP" when creating/editing the NPC |
| `notes`              | string | Optional. `''` means "not set"            |
| `ownerId`            | string | References `User.id` (the GM)             |

### Encounter
| Field              | Type      | Notes                                          |
|--------------------|-----------|--------------------------------------------------|
| `id`               | string    | Unique identifier                                |
| `ownerId`          | string    | References `User.id` (the GM)                    |
| `name`             | string    | e.g. "Goblin Ambush"                              |
| `partyIds`         | string[]  | Which Parties' Players were pulled in            |
| `troopIds`         | string[]  | Which Troops' NPCs were pulled in                |
| `combatantIds`     | string[]  | **Ordered** by initiative (descending); this order IS the initiative order |
| `activeCombatantIndex` | number \| null | Index into `combatantIds`; null before first Roll |
| `holdOrder`        | string[]  | Ids of Combatants currently on Hold Action, oldest-first. Drives the secondary Hold Action list; cleared every round boundary |
| `round`            | number    | `0` before the first Roll, then starts at `1`    |
| `reRollEachRound`  | boolean   | Default `true` (the homebrew rule)               |

### Combatant
An Encounter-scoped participant. Wraps a Player (via `playerId`) or an Npc
(via `npcId`) — or, for an ad-hoc entry not yet saved to either library,
neither.

**Naming note:** `type` still says "pc"/"npc," matching the actual literal
values in code today — `PlayerCharacter` was renamed to `Player` back in
the library-rework phase, but the `type` union itself wasn't renamed to
match (it drives `.pc-entry`/`.npc-entry` styling across several templates,
and renaming it was out of scope). Read `type: "pc"` as "this Combatant is
a Player, ad-hoc or otherwise."

| Field                | Type                   | Notes                                        |
|----------------------|------------------------|-----------------------------------------------|
| `id`                 | string                 | Unique identifier                             |
| `encounterId`        | string                 | References `Encounter.id`                     |
| `type`               | `"pc"` \| `"npc"`      | Drives the color shown in the initiative list |
| `playerId`           | string \| null         | Set when this Combatant is linked to a library `Player` — pulled in from a Party, added individually, or saved to the roster after the fact. `null` for an ad-hoc, unsaved Player. Always `null` when `type === "npc"` |
| `npcId`              | string \| null         | Npc-side mirror of `playerId` above — set when linked to a library `Npc` (pulled from a Troop, added individually, or saved after the fact). `null` for an ad-hoc, unsaved NPC — Phase 1's only NPC behavior, still fully supported. Always `null` when `type === "pc"` |
| `name`               | string                 | Copied from Player/Npc, or set directly for an ad-hoc entry |
| `initiativeModifier` | number                 | Copied from Player, or set directly for an NPC |
| `ac`                 | number \| null         | Copied from Player/Npc, or set directly for an ad-hoc entry. `null` = not set |
| `maxHp`              | number \| null         | Copied from Player/Npc, or set directly for an ad-hoc entry. `null` = not set |
| `currentHp`          | number \| null         | Combatant-only — no Player/Npc equivalent. Starts equal to `maxHp`, then clamped to `[0, maxHp]` on every change. `null` whenever `maxHp` is `null` |
| `notes`              | string                 | Copied from Player/Npc, or set directly for an ad-hoc entry. `''` = not set |
| `lastRoll`           | number \| null         | The 1–20 die result from the most recent roll |
| `initiativeTotal`    | number \| null         | `lastRoll + initiativeModifier`; this is what sorts the list. `null` renders as "N/A" and sorts/counts as `0` |
| `removedFromCombat`  | boolean                | Default `false`. See below.                   |
| `incapacitated`      | boolean                | Default `false`. Purely cosmetic — see below. |
| `onHold`             | boolean                | Default `false`. See below.                   |
| `preHoldLastRoll`    | number \| null         | Snapshot of `lastRoll` taken when Hold Action was turned on. Default `null`. See below. |
| `preHoldInitiativeTotal` | number \| null     | Snapshot of `initiativeTotal` taken when Hold Action was turned on. Default `null`. See below. |
| `readyToJoin`        | boolean                | Default `false`. See "Ready to Join" below. |

### Timer
An Encounter-scoped countdown, created via the same "+" menu (next to the
Previous/Next Turn buttons, run phase only) as a mid-encounter Combatant —
see "Timers" below for the full behavior.

| Field                    | Type           | Notes                                        |
|---------------------------|----------------|-----------------------------------------------|
| `id`                      | string         | Unique identifier                              |
| `encounterId`             | string         | References `Encounter.id`                      |
| `name`                    | string         | GM-entered label, e.g. "Room floods"           |
| `remaining`               | number         | Current countdown value                        |
| `initialValue`            | number         | The value set at creation; never changes afterward — used only to compute the card's light-grey-to-black background as `remaining / initialValue` |
| `linkedCombatantId`       | string \| null | Optional, set at creation. `null` = ticks at every round boundary. Set = ticks when that combatant's turn ends instead |
| `lastTickedRoundCredited` | number \| null | Internal bookkeeping, not GM-facing — see "Timers" below |

**Why copy `name`/`initiativeModifier` onto the Combatant instead of always
reading through to the Player/Npc?** An ad-hoc entry has no library source
to read from, so the Combatant needs its own copy regardless. Giving
library-linked entries the same shape keeps `Combatant` a single, consistent
type the initiative-list UI can render without a `type` branch on every
field — it only needs to branch on `type`/`playerId`/`npcId` for things that
actually differ.

**Editing AC/Max HP/Notes on a Combatant (the drawer's Edit button) only
changes that Combatant's own copy** — it never writes back to the source
Player/Npc, the same as `setInitiativeModifier` already does for the
initiative modifier. There's no "sync back to the library" concept yet;
correcting a Player/Npc's permanent data means editing it directly on the
Players/NPCs roster screen.

**Pulling Parties/Troops, individual roster entries, and ad-hoc combatants
into an Encounter:** `EncounterStore.setEncounterParties`/`setEncounterTroops`
reconcile an Encounter's Party/Troop selection with its Combatants the same
way (add newly-selected members, drop de-selected ones before the first
Roll, never duplicate a member already pulled in via another selected
group). `addPlayerCombatant`/`addNpcCombatant` pull in one roster entry
without its whole group, no-op if that entry is already present.
`addAdHocCombatant(encounterId, type, fields)` creates a Combatant with no
library link at all (`playerId`/`npcId` both `null`) — today's only
NPC-creation path, generalized to also allow an ad-hoc Player.

**Saving an ad-hoc combatant to the roster** ("Save to Roster," available
on any Combatant with `playerId`/`npcId` both `null`): the GM optionally
checks which Party/Troop to also add it to, then
`EncounterStore.linkCombatantToLibraryEntry(encounterId, combatantId, linkedId)`
sets `playerId` or `npcId` (matching the Combatant's `type`) on that *same*
Combatant record. No second Combatant is ever created — creating the
library entry and assigning it to a group happens first, at the page level
(`PartyStore.createPlayer`/`NpcStore.createNpc` +
`addPlayerToParty`/`addNpcToTroop`), and `linkCombatantToLibraryEntry` only
does the final id assignment.

**Current HP and Max HP edits:** clicking the heart icon or the health bar
opens a small input for a signed delta (e.g. `-15`, `+10`), applied via
`EncounterStore.adjustCurrentHp` and always clamped to `[0, maxHp]` — Current
HP can never go negative or exceed Max HP. Editing Max HP itself (via the
Edit dialog) follows a different rule depending on the previous value: going
from `null` to a number is treated as a full heal (nothing was being
tracked before), but changing between two numbers **reclamps** Current HP
into the new range instead of resetting it to full — lowering a monster's
Max HP mid-fight shouldn't undo damage already tracked against it.

**`removedFromCombat` and ordering:** removing a combatant sets its
`lastRoll`/`initiativeTotal` to `null` ("N/A"), which sorts/counts as `0` —
in practice this sinks it toward the bottom of `combatantIds`, since real
rolls are rarely that low. It's skipped when advancing the active turn.
Un-removing it rolls a fresh initiative that's randomized but capped below
whatever the current Active combatant's total is, and reinserts it into
`combatantIds` at the matching sorted position — "rejoining mid-round, right
where that roll would place them," not restoring its original spot.

In the UI, a removed combatant is pulled out of the main initiative list
entirely and shown in a separate "Removed From Combat" table below the
turn controls — it's still present in `combatantIds` (still sunk to the
bottom, still skipped by Forward/Back), this is purely how `EncounterDetail`
partitions `combatantsForEncounter()` for display (see `mainCombatants` /
`removedCombatants` in `encounter-detail.ts`).

**`incapacitated`:** a purely cosmetic marker (e.g. unconscious, stunned) —
unlike `removedFromCombat`/`onHold`, it has no effect on rolling, sorting, or
turn order. An incapacitated combatant stays exactly where it would
otherwise be (main list or Hold Action panel) and keeps taking turns
normally; the UI just greys out its bubble, the same tint as a removed
entry, with a small crescent-moon badge that toggles it back off.

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

**`readyToJoin` — adding a combatant mid-encounter:** the "+" menu next to
the Previous/Next Turn buttons (run phase only, i.e. after the first Roll)
offers "Add Timer" or "Add Combatant." Add Combatant reuses the exact same
add flow as setup (`addPlayerCombatant`/`addNpcCombatant`/
`addAdHocCombatant`, including ad-hoc "Save to Roster"), but passes
`readyToJoin: true` — the new Combatant's id still lands in
`combatantIds` (so the existing "list owns its members" convention holds),
but with `initiativeTotal`/`lastRoll` both `null` and excluded from turn
order the same way `removedFromCombat`/`onHold` already are
(`firstActiveIndex`, `advanceTurn`'s eligible-index filter,
`reorderCombatant`'s not-draggable guard). In the UI it's shown in its own
"Ready to Join" list, between the turn controls and Removed From Combat.

Clicking a Ready to Join combatant joins it in via
`EncounterStore.joinReadyToJoinCombatant` — the exact same roll-capped-
below-the-Active-total-and-reinsert logic as un-removing from Removed From
Combat (both now share a private `rollCombatantInBelowActive` helper),
never interrupting whoever's turn it currently is.

Left un-joined, a Ready to Join combatant folds into the main list
automatically at the next round boundary, alongside Hold Action's own
round-boundary reconciliation:
- **Re-roll mode** (`reRollEachRound: true`): `reRollRound` clears
  `readyToJoin` the same way it already clears a held combatant's
  `onHold` — since the combatant's id is already in `combatantIds`, that
  alone is enough for it to get a fresh roll alongside everyone else's.
- **Classic mode** (`reRollEachRound: false`): `foldInReadyToJoin` is the
  round-boundary counterpart to `clearHoldWithoutReroll`. Unlike a held
  combatant, a ready-to-join combatant has no `preHold*`-style snapshot to
  restore (it was never in the turn order to begin with), so it instead
  gets a fresh, **uncapped** roll — "joining combat for real," not
  "rejoining mid-round" — and is inserted at that sorted position.

## Duplicate-name lettering

Two combatants sharing a name (e.g. two "Goblin"s, or a "Goblin" and a
"goblin") each get a disambiguating " A"/" B" suffix wherever the UI shows
or announces a combatant's name — the bubble label, its expand-drawer/edit
dialog, the Removed From Combat and Ready to Join lists, the "Link to:"
timer picker, drag handles/previews, and `encounter-list.html`'s edit-mode
table. A name with no duplicate is shown unsuffixed.

`EncounterStore.computeDisplayNames(combatantsInCreationOrder: Combatant[])`
groups by trimmed, case-insensitive name and returns a `Map<combatantId,
displayName>` — pure logic, no store/DI, same standalone-testability
reasoning as `compareByInitiative`. Each page (`EncounterDetail`,
`EncounterList`) computes its own `displayNames` map and a `displayName(id)`
lookup, feeding `combatantsForEncounterInCreationOrder(encounterId)` — a
new read-only `EncounterStore` method — into it.

**Why creation order, not initiative order:** letters are assigned in the
order combatants appear in `combatantsForEncounterInCreationOrder`'s
result, which filters the raw, append-only `combatantsSignal` directly —
**not** `combatantsForEncounter`'s `Encounter.combatantIds` order, which
re-sorts on every re-roll, manual drag-reorder, and Hold Action
return-from-hold. Keying lettering off initiative order would relabel
"A"/"B" on nearly every turn; `combatantsSignal` itself is only ever
appended to, so creation order is stable across all of that churn.

**The one accepted wrinkle:** deleting a combatant *can* relabel the
survivors. This only happens via `removeCombatant` (a hard delete — today
only reachable from the setup-phase list's trash icon on an ad-hoc NPC
before the first Roll), which actually removes the record from
`combatantsSignal`. If "Goblin A" is deleted while "Goblin B" remains,
"Goblin B" relabels to plain "Goblin" (now the only one) the next time
`computeDisplayNames` runs — same relabel-on-removal behavior already
accepted for `toggleRemoved`'s "N/A" initiative placement elsewhere. Toggling
`removedFromCombat` (the *soft* Removed From Combat flag, everywhere else
in the app) does **not** touch `combatantsSignal`, so it never triggers this
— a combatant moved to the Removed From Combat list keeps its letter.

## Timers

A Timer (see the entity above) is created via the same "+" menu as a
mid-encounter Combatant, run phase only. `remaining` counts down by 1 —
either at every round boundary (`linkedCombatantId: null`), or only when
that specific combatant's turn ends (`linkedCombatantId` set), chosen once
at creation from whichever combatants are currently in the main list or
Hold Action panel (not Removed, not Ready to Join — neither has a "turn"
to tick against right now).

**Automatic ticking is floored at 0** (a linked or unlinked timer never
free-falls into negative territory on its own); **the GM's manual +/-
nudge is deliberately unclamped**, so a mistake can be corrected in either
direction even past 0. Once `remaining <= 0`, the UI drops the numeric
value entirely, shows just the name in bold white text, and swaps the
card's background to red — ticking back above 0 (only possible manually)
reverts it to the normal light-grey-to-black gradient.

**The once-per-round rule for linked timers, and why `lastTickedRoundCredited`
exists:** a linked combatant's turn can "end" more than once in the same
round — going on Hold Action mid-turn, then later actually taking a
delayed turn after returning from Hold. A linked timer still only ticks
**once** per round no matter how many of these happen, the same
once-per-round cadence an unlinked timer gets for free from the round
boundary itself. `EncounterStore` guards this with `lastTickedRoundCredited`
(the last `Encounter.round` a decrement was actually applied for): every
"this combatant's turn just ended" event calls the same private
`creditLinkedTimerDeparture(encounterId, combatantId, round)`, which is a
no-op if that timer already credited `round`. This is called from three
places, all safe to call redundantly for the same combatant/round thanks
to the guard:
1. `advanceTurn`'s Forward branch, for whoever was Active before the step
   (same-round advance and round-rollover both count).
2. `advanceTurn`'s round-rollover branch, additionally, for every
   combatant still `onHold` at that moment — covers a combatant linked to
   a Hold Action combatant who never got a turn that round at all; a
   no-op if they *did* go on Hold this same round (already credited by
   the Forward branch when they held).
3. `returnFromHold`'s `'above'` interrupt branch, for the combatant being
   interrupted — this is the one place `activeCombatantIndex` changes
   without going through `advanceTurn` at all.

`advanceTurn`'s Back branch mirrors this with `uncreditLinkedTimerOnBack`:
if the combatant Back just landed on has a linked timer credited *this*
round, increment it by 1 and clear the credit. Back never crosses a round
boundary (see `isFirstActiveCombatant` in `encounter-detail.ts`), so
there's never an earlier round's credit to worry about touching — this
exactly reverses whatever the matching credit call did.

## Notes on "re-roll every round"

When `reRollEachRound` is `true` (the default), starting a new round means:
1. Every non-removed Combatant gets a new `lastRoll` (and thus a new
   `initiativeTotal`).
2. `combatantIds` is re-sorted descending by the new totals.
3. `activeCombatantIndex` resets to `0` (or the first non-removed entry).

When `reRollEachRound` is `false`, a new round just resets
`activeCombatantIndex` — the existing `combatantIds` order and totals are
left alone.
