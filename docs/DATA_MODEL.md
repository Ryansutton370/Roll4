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
Parties/Troops and Encounters. A Combatant is _that Player's or Npc's
participation in this one Encounter_ — its rolled initiative, whether it's
been removed from combat, etc. Mixing those together would mean a Player's
"current initiative roll" leaks into the roster screen, which doesn't make
sense once the same Player is used in a second encounter.

The second key decision (Phase 2): **Party/Troop membership is
many-to-many**, not the Phase 1 shape where a PC belonged to exactly one
Party. A Player can be in several Parties (a GM running more than one
group who shares a player between them, e.g.), and an Npc can be in
several Troops. `Party.playerIds`/`Troop.npcIds` are the _owning_ side of
that relationship — Player/Npc carry no back-reference field at all;
"which Parties is this Player in" is always derived by scanning every
Party's `playerIds` (see `PartyStore.partiesForPlayer` /
`NpcStore.troopsForNpc`), the same "list owns its members" convention
already used for `Encounter.combatantIds`/`holdOrder`.

## Entities

**Implementation note (Phase 3):** every entity below now carries a real
`ownerId: string` field — the owning GM's Firebase Auth uid — enforced by
Firestore security rules (see [ARCHITECTURE.md](./ARCHITECTURE.md)'s
Persistence section). There's no separate `User` type or Firestore `users`
collection yet: Firebase Auth's own user object (`uid`, `email`,
`displayName`) is sufficient as every `ownerId`'s source today. The `User`
sketch below (`role`, forward-looking for the Phase 4 Player role) stays
documented as the eventual shape, to be added as a real Firestore document
once Phase 4 needs to persist something Firebase Auth doesn't already carry.

### User

| Field         | Type                 | Notes                      |
| ------------- | -------------------- | -------------------------- |
| `id`          | string               | Unique identifier          |
| `role`        | `"gm"` \| `"player"` | Player role is future work |
| `displayName` | string               |                            |

### Party

| Field       | Type     | Notes                                                                                                                                      |
| ----------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`        | string   | Unique identifier                                                                                                                          |
| `ownerId`   | string   | References `User.id` (the GM)                                                                                                              |
| `name`      | string   | e.g. "The Thursday Night Group"                                                                                                            |
| `playerIds` | string[] | References `Player.id` — the owning side of a many-to-many; deleting a Party does **not** delete these Players, it just drops the grouping |

### Player

A reusable library entry — not tied to any one Party (see `Party.playerIds`
above). Renamed from Phase 1's `PlayerCharacter`, which was owned 1:1 by a
single Party via a `partyId` field; that field is gone now that membership
is many-to-many.

| Field                | Type           | Notes                                                          |
| -------------------- | -------------- | -------------------------------------------------------------- |
| `id`                 | string         | Unique identifier                                              |
| `ownerId`            | string         | References `User.id` (the GM) — same meaning as every other entity's `ownerId`; see the note below on why this isn't the future Player-role link |
| `name`               | string         | e.g. "Aria Windmere"                                           |
| `initiativeModifier` | number         | Signed integer, e.g. `3`, `0`, `-1`                            |
| `ac`                 | number \| null | Optional. `null` means "not set," not zero                     |
| `maxHp`              | number \| null | Optional. Entered as "Max HP" when creating/editing the Player |
| `notes`              | string         | Optional. `''` means "not set"                                 |

**On `ownerId` vs. the future Player-role link:** an earlier draft of this
doc used `Player.ownerId` for a different, forward-looking idea — which
*Player-role* `User` (Phase 4) controls this character. Once Phase 3 gave
every entity a real GM-ownership `ownerId` (enforced by Firestore security
rules — see [ARCHITECTURE.md](./ARCHITECTURE.md)), reusing the same field
name for two different relationships on the same entity would only cause
confusion. `Player.ownerId` is the GM-ownership field, exactly like
`Party`/`Troop`/`Npc`/`Encounter`/`Combatant`/`Timer` below. The future
"which Player-role account controls this character" link still needs
building in Phase 4, under a different field name (e.g. `controlledByUserId`)
— not sketched further here since that design hasn't happened yet.

### Troop

| Field     | Type     | Notes                                                                   |
| --------- | -------- | ----------------------------------------------------------------------- |
| `id`      | string   | Unique identifier                                                       |
| `ownerId` | string   | References `User.id` (the GM)                                           |
| `name`    | string   | e.g. "Goblin Warband"                                                   |
| `npcIds`  | string[] | References `Npc.id` — same many-to-many convention as `Party.playerIds` |

### Npc

The NPC-side mirror of Player — a reusable library entry, not tied to any
one Troop. New this phase: NPCs had no persisted library at all before now
(they were always created ad-hoc, inline in an Encounter). That ad-hoc path
is untouched and still the only way to add an NPC to an Encounter today —
this library and Troops exist alongside it, not in place of it yet; pulling
a Troop into an Encounter (mirroring how a Party is pulled in today) is
planned but not built.

| Field                | Type           | Notes                                                                                                                                                      |
| -------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                 | string         | Unique identifier                                                                                                                                          |
| `name`               | string         | e.g. "Goblin Shaman"                                                                                                                                       |
| `initiativeModifier` | number         | Signed integer, e.g. `3`, `0`, `-1`                                                                                                                        |
| `ac`                 | number \| null | Optional. `null` means "not set," not zero                                                                                                                 |
| `maxHp`              | number \| null | Optional. Entered as "Max HP" when creating/editing the NPC                                                                                                |
| `notes`              | string         | Optional. `''` means "not set"                                                                                                                             |
| `ownerId`            | string         | References `User.id` (the GM)                                                                                                                              |
| `monsterTemplateId`  | string \| null | Set when this Npc was generated by the Encounter Generator's "Save as Troop" step — references `MonsterTemplate.id`. `null` for every hand-entered Npc     |
| `monsterName`        | string \| null | The creature type name from the template (e.g. "Goblin"), kept separate from `name` (e.g. "Barry") — see Combatant below for the display rule this enables |

### Encounter

| Field                  | Type           | Notes                                                                                                                         |
| ---------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `id`                   | string         | Unique identifier                                                                                                             |
| `ownerId`              | string         | References `User.id` (the GM)                                                                                                 |
| `name`                 | string         | e.g. "Goblin Ambush"                                                                                                          |
| `partyIds`             | string[]       | Which Parties' Players were pulled in                                                                                         |
| `troopIds`             | string[]       | Which Troops' NPCs were pulled in                                                                                             |
| `combatantIds`         | string[]       | **Ordered** by initiative (descending); this order IS the initiative order                                                    |
| `activeCombatantIndex` | number \| null | Index into `combatantIds`; null before first Roll                                                                             |
| `holdOrder`            | string[]       | Ids of Combatants currently on Hold Action, oldest-first. Drives the secondary Hold Action list; cleared every round boundary |
| `round`                | number         | `0` before the first Roll, then starts at `1`                                                                                 |
| `reRollEachRound`      | boolean        | Default `true` (the homebrew rule)                                                                                            |

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

| Field                    | Type              | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------ | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                     | string            | Unique identifier                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `encounterId`            | string            | References `Encounter.id`                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `ownerId`                | string            | The owning GM's Firebase Auth uid, copied from the parent `Encounter` at creation — see the Phase 3 implementation note above                                                                                                                                                                                                                                                                                                                                                     |
| `type`                   | `"pc"` \| `"npc"` | Drives the color shown in the initiative list                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `playerId`               | string \| null    | Set when this Combatant is linked to a library `Player` — pulled in from a Party, added individually, or saved to the roster after the fact. `null` for an ad-hoc, unsaved Player. Always `null` when `type === "npc"`                                                                                                                                                                                                                                                              |
| `npcId`                  | string \| null    | Npc-side mirror of `playerId` above — set when linked to a library `Npc` (pulled from a Troop, added individually, or saved after the fact). `null` for an ad-hoc, unsaved NPC — Phase 1's only NPC behavior, still fully supported. Always `null` when `type === "pc"`                                                                                                                                                                                                             |
| `name`                   | string            | Copied from Player/Npc, or set directly for an ad-hoc entry                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `initiativeModifier`     | number            | Copied from Player, or set directly for an NPC                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `ac`                     | number \| null    | Copied from Player/Npc, or set directly for an ad-hoc entry. `null` = not set                                                                                                                                                                                                                                                                                                                                                                                                       |
| `maxHp`                  | number \| null    | Copied from Player/Npc, or set directly for an ad-hoc entry. `null` = not set                                                                                                                                                                                                                                                                                                                                                                                                       |
| `currentHp`              | number \| null    | Combatant-only — no Player/Npc equivalent. Starts equal to `maxHp`, then clamped to `[0, maxHp]` on every change. `null` whenever `maxHp` is `null`                                                                                                                                                                                                                                                                                                                                 |
| `notes`                  | string            | Copied from Player/Npc, or set directly for an ad-hoc entry. `''` = not set                                                                                                                                                                                                                                                                                                                                                                                                         |
| `monsterTemplateId`      | string \| null    | Copied from the source Npc — see Npc above. Powers the combatant bubble drawer's "View Stat Block" button (`CombatantBubble.viewStatBlockRequested` → `EncounterDetail.openStatBlockDialog` → `MonsterStatBlockDialog`) — only shown when this is set                                                                                                                                                                                                                               |
| `monsterName`            | string \| null    | Copied from the source Npc. When set and different from the combatant's `name` (see `CombatantBubble.monsterSubtitle`), the bubble shows the personal name prominently with this as a smaller "- Goblin" subtitle. Two unnamed generated monsters still just read as "Goblin A"/"Goblin B" via the existing duplicate-name lettering below, unaffected by this field — `monsterSubtitle` compares against the raw `name`, not the lettered display name, specifically to avoid that |
| `lastRoll`               | number \| null    | The 1–20 die result from the most recent roll                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `initiativeTotal`        | number \| null    | `lastRoll + initiativeModifier`; this is what sorts the list. `null` renders as "N/A" and sorts/counts as `0`                                                                                                                                                                                                                                                                                                                                                                       |
| `removedFromCombat`      | boolean           | Default `false`. See below.                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `incapacitated`          | boolean           | Default `false`. Purely cosmetic — see below.                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `onHold`                 | boolean           | Default `false`. See below.                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `preHoldLastRoll`        | number \| null    | Snapshot of `lastRoll` taken when Hold Action was turned on. Default `null`. See below.                                                                                                                                                                                                                                                                                                                                                                                             |
| `preHoldInitiativeTotal` | number \| null    | Snapshot of `initiativeTotal` taken when Hold Action was turned on. Default `null`. See below.                                                                                                                                                                                                                                                                                                                                                                                      |
| `readyToJoin`            | boolean           | Default `false`. See "Ready to Join" below.                                                                                                                                                                                                                                                                                                                                                                                                                                         |

### NameTable

Loaded read-only via `NameTableStore` from `public/data/name-tables.json`.
Originally converted once from the GM's Random Generators spreadsheet by
`scripts/import-names.cjs` — that script and the spreadsheet
(`.claude/Names.xlsx`) are now a historical record of that first batch, not
something to re-run: `name-tables.json` is the GM-editable source directly
(add/edit entries or whole tables in it freely; already the practice for
the five "Places" tables added straight to the JSON outside the script).
Despite the name, not every table holds _person_ names — the original
spreadsheet also had place-name, plant/alchemy-substance-name, and
byname/epithet tabs, so the shape is kept generic (a labeled list of
strings) rather than modeling "name" specially.

| Field       | Type                             | Notes                                                                                                                                                          |
| ----------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`        | string                           | Slug of setName+tableName+gender, e.g. `european-german-male`                                                                                                  |
| `setName`   | string                           | The source spreadsheet tab, e.g. `"European"`, `"Fantasy"`, `"Places"`                                                                                         |
| `tableName` | string                           | The column, gender suffix stripped, e.g. `"German"`, `"Goblin"`, `"Forest"`                                                                                    |
| `gender`    | `'male'` \| `'female'` \| `null` | Parsed from a `"(M)"`/`"(F)"` suffix on the column header; `null` for ungendered columns (most of them)                                                        |
| `entries`   | string[]                         | The column's values. Usually 100 (a d100 table), but a handful of source columns are still partially filled in — imported as-is rather than padded or rejected |

**Why a flat list of tables instead of nesting `entries` under a
`setName` → `tableName` tree:** `NameTableStore.tablesForSet`/`setNames`
derive the grouping from this flat list on read, the same
"derive, don't duplicate the structure" convention as
`PartyStore.partiesForPlayer` deriving Party membership from
`Party.playerIds` rather than storing a back-reference. A flat list is also
what a straightforward per-row JSON import naturally produces.

### MonsterTemplate

Loaded read-only via `MonsterStore` from `public/data/monsters-5e-srd.json`
/ `monsters-shadowdark.json`. Originally imported once from two
open-license sources by `scripts/import-monsters-5e-srd.cjs` /
`import-monsters-shadowdark.cjs` — like `NameTable`, those scripts are now
historical, and both JSON files are the GM-editable source directly. The
Encounter Generator (Phase 2.5 Milestone 3) uses these as candidates and
links a generated `Npc`/`Combatant` back to the template it came from via
`monsterTemplateId` (Milestone 4) — see `Npc`/`Combatant` above.

| Field                | Type                                 | Notes                                                                                                                                                                                                                                                                      |
| -------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                 | string                               | e.g. `5e-srd-goblin`, `shadowdark-goblin`                                                                                                                                                                                                                                  |
| `source`             | `'5e-srd'` \| `'shadowdark'`         | Which system's difficulty/stat-block conventions this follows — still exactly these two values for a GM-added monster too (see `homebrew` below), since the Encounter Generator/stat-block dialog branch on this to know CR-vs-Level, ability-scores-vs-flat-bonuses, etc. |
| `homebrew`           | boolean                              | `true` for a GM-added monster, as opposed to one from the licensed import below. `false` for every originally-imported entry. Shown as "(Homebrew)" next to the source label in the stat-block dialog                                                                      |
| `name`               | string                               |                                                                                                                                                                                                                                                                            |
| `difficulty`         | number \| null                       | CR for `'5e-srd'` (e.g. `0.25`, `10`), Level for `'shadowdark'`. `null` for the handful of Shadowdark monsters (the four Elementals, the Hydra) whose stats scale with context rather than having one fixed value                                                          |
| `ac`                 | number \| null                       |                                                                                                                                                                                                                                                                            |
| `maxHp`              | number \| null                       | `null` for the same context-scaling monsters as `difficulty`                                                                                                                                                                                                               |
| `initiativeModifier` | number                               | DEX modifier — both systems key Roll4's d20 initiative roll off it, even though neither system's actual rules roll individual per-monster initiative quite this way                                                                                                        |
| `statBlock`          | `{ label: string; value: string }[]` | Deliberately loose rather than one rigid schema — 5e's ability-scores/saves/skills/actions shape and Shadowdark's flat-bonus/numbered-Talents shape don't line up section-for-section                                                                                      |

**"CR 0.25" / "LV 3" labeling:** `monsterDifficultyLabel(template)`
(`src/app/models/monster-template.model.ts`) is the one place this
CR-vs-Level string is built from `source`/`difficulty` (blank for a `null`
difficulty) — centralized once a fourth call site (`MonsterPickerTable`)
needed it, after finding it duplicated (and missing its null guard in one
spot — a genuine "CR null" render for the four Elementals/Hydra, now
fixed) across the Encounter Generator, `AddCombatantDialog`, and
`MonsterStatBlockDialog`. `MonsterStatBlockDialog` keeps its own separate
`difficultyLabel` computed, which intentionally renders differently (a
`—` for `null` rather than blanking the whole line) — not consolidated
into the shared helper on purpose.

**Sources and required attribution** (surfaced to the GM in a Credits
section on the Encounter Generator page, `encounter-generator.html` — where
this data is actually generated from, not the Names page) — these cover
the originally-imported entries (`homebrew: false`) specifically, not
anything added directly to the JSON afterward:

- **5e SRD**: [Open5e](https://open5e.com)'s System Reference Document 5.1
  data, OGL-licensed. The OGL's Section 15 copyright notice must be
  reproduced verbatim wherever this data is used — verified directly
  against the official `SRD-OGL_V5.1.pdf`, not a paraphrase, since exact
  wording matters for OGL compliance.
- **Shadowdark**: the "Unofficial Shadowdark Monster List" by Michael
  Putlack (Night Noon Games) — a third-party compilation of official
  Shadowdark Core Rulebook monster stat blocks (every row's source column
  reads `"CR"`; no homebrew mixed into the _original import_). Two licenses
  stack: the monster text itself is used under the Shadowdark RPG
  Third-Party License (requiring a specific disclaimer), and the
  compilation itself is CC BY-SA 4.0 (requiring attribution to Night Noon
  Games, and — per ShareAlike — that this derived JSON carry the same CC
  BY-SA 4.0 license forward if the app is ever hosted/distributed publicly,
  an open item to revisit before Phase 3).

**Encounter Generator algorithm** (`src/app/services/encounter-generator.ts`,
pure functions, no store/DI — same standalone-testability precedent as
`compareByInitiative`/`computeDisplayNames`): the two sources use
deliberately different generation strategies rather than one shared
"difficulty" concept, because they don't have comparable underlying rules.

- **5e SRD** uses the actual DMG encounter-building math: the party's XP
  budget for a difficulty tier is the per-character-level XP threshold
  (DMG p.82) times party size, and a candidate list is stochastically
  assembled by repeatedly picking a random pool monster (filtered to CR's
  XP value ≤ the whole budget) and adding it, stopping once the **adjusted
  XP** — raw monster XP (DMG p.275's CR-to-XP table) times the DMG's
  group-size multiplier (p.82) — reaches the budget or comes within ~10%
  over it, or a 15-monster cap is hit.
- **Shadowdark has no XP-budget system in its own rules** — confirmed
  while researching this milestone: the Core Rulebook's stance is
  explicitly to let the world/dice decide an encounter's difficulty, not
  balance it mathematically. Inventing a fake difficulty score for it would
  misrepresent the game, so its generator is instead a level-range random
  draw: the GM picks a Level band and a monster count, and it fills that
  count by repeatedly picking a random pool monster within the range — the
  same spirit as an official Shadowdark random-encounter table, not a
  balance guarantee.

Both exclude pool monsters with a `null` difficulty (nothing to compare
against a budget or range). The Encounter Generator page lets the GM edit
the resulting candidate list (adjust counts, add/remove monsters) before
applying names and saving — see [PRODUCT.md](./PRODUCT.md).

### WildMagicTable

Loaded read-only via `WildMagicStore` from `public/data/wild-magic.json`.
Originally imported once from a free fan-made PDF by
`scripts/import-wild-magic.cjs` — like `NameTable`/`MonsterTemplate`, that
script is now historical, and `wild-magic.json` is the GM-editable source
directly (see [ARCHITECTURE.md](./ARCHITECTURE.md)).

| Field         | Type     | Notes                                                                                                                                                                                                                                       |
| ------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`          | string   | e.g. `wild-magic-chaos-burst`                                                                                                                                                                                                               |
| `setName`     | string   | Currently always `"Wild Magic"` — kept as its own field for parity with `NameTable`, in case a second source table set is added later                                                                                                       |
| `tableName`   | string   | `"Chaos Burst"` or `"Burst Duration Condition"`                                                                                                                                                                                             |
| `description` | string   | GM-facing explanation of what the table is for, shown on the Wild Magic generator page under the Table picker — e.g. Burst Duration Condition's clarifies that it's for Chaos Bursts with no stated duration, not a table rolled on its own |
| `entries`     | string[] | 10,000 entries for Chaos Burst, 100 for Burst Duration Condition                                                                                                                                                                            |

**Why a separate model/store from `NameTable`, despite the near-identical
shape:** `NameTableStore.setNames()` feeds the inline 🎲 popover on every
Name field (`NameGeneratorButton`, used by `CombatantFields` and the
Encounter Generator roster) — every set in that store is offered there as a
pickable _name_. Folding the Wild Magic tables into `NameTable` would surface
"Chaos Burst" as a name option when naming a Player/NPC. `WildMagicStore` is
a parallel, near-twin service instead (same `toSignal`-over-`HttpClient`
load shape, and it reuses `NameTableStore`'s exported `pickRandomEntries`
directly rather than duplicating that Fisher-Yates helper) — see
[PRODUCT.md](./PRODUCT.md) section 13.

**Source and attribution:** _The Net Libram of Random Magical Effects_
v2.00, by Orrex — a free, non-OGL fan document (the PDF's own disclaimer:
"derivative work... no challenge to the status of these or any other
copyrights is intended or implied"). Unlike the 5e SRD/Shadowdark monster
data, there's no formal open license here to satisfy, just a good-faith
author credit — surfaced in a Credits section on the Wild Magic generator
page. Same open item as the Shadowdark CC BY-SA data: worth a licensing
sanity check before Phase 3 hosting makes the app public, given the
source's informal "derivative work" framing.

**Import mechanics** (`scripts/import-wild-magic.cjs`): the source PDF
renders as two visual columns per page, but `pdftotext`'s default
(non-`-layout`) mode already emits one flowing, strictly-ascending stream —
so parsing is entry-number-driven rather than column-position-driven: each
entry is recognized only by matching the _exact expected next_ sequential
id (`"0001"`, `"0002"`, ... `"9999"`, then `"0000"` standing in for the
10,000th roll; separately `"01"`...`"99"`, `"00"` for the 100-entry table),
which makes it immune to ordinary numbers (dice sizes, gold amounts) inside
the entry text itself. Page-footer numbers are stripped by line before
tokenizing, since a stray one would otherwise glue onto whichever entry
finished right before that page break. A handful of degree-symbol glyphs the
PDF's font encodes non-standardly come through as the Unicode replacement
character; the script fixes those (and two unrelated accented-word cases —
"risqué," "déjà vu" — found by manually checking every occurrence) rather
than leaving `�` in the data.

### TreasureTable

Loaded read-only via `TreasureStore` (see [ARCHITECTURE.md](./ARCHITECTURE.md))
from `public/data/treasure.json`, same as `NameTable`/`MonsterTemplate`/
`WildMagicTable` — but unlike those three, **`treasure.json` itself is the
GM-editable source**, not generated output to be treated as disposable.
Those other tables come from an external document (a spreadsheet, a PDF)
worth preserving fidelity/attribution to, so their JSON is regenerated from
that source by an import script whenever it changes. Treasure has no such
external document — a GM just wants to add/edit entries over time — so
after the initial batch there's no reason to keep re-deriving the JSON from
an intermediate format. Edit `public/data/treasure.json` directly for
anything from here on (adding entries, fixing typos, a new category).

`.claude/treasure-<category>.txt` and `scripts/import-treasure.cjs` (three
parsing `format`s: `'lines'`, `'tab'`, `'blocks'` — see the script) still
exist and are how the first batch of each category was assembled, kept
around as a historical record the same way `.claude/Names.xlsx` is — but
they're stale now and **must not be re-run** once `treasure.json` has been
hand-edited past what they'd regenerate; doing so silently discards
whatever was added directly to the JSON (this happened once already — the
fix was recovered from VS Code's local edit history, not git, since none of
these files were committed at the time).

| Field       | Type              | Notes                                                                                              |
| ----------- | ----------------- | -------------------------------------------------------------------------------------------------- |
| `id`        | string            | e.g. `treasure-trinkets`                                                                           |
| `setName`   | string            | Currently always `"Treasure"` — same parity-with-`NameTable` reasoning as `WildMagicTable.setName` |
| `tableName` | string            | `"Trinkets"`, `"Wondrous Items"`, or `"Potions"`                                                   |
| `entries`   | `TreasureEntry[]` | See below                                                                                          |

**`TreasureEntry`** (`{ text: string; detail: string | null }`): one roll's
result. Trinkets are one GM-provided line per entry — `text` is that line,
`detail` is `null`. Wondrous Items and Potions each carry a name plus a
second field (a magic item's property, a potion's effect) — `text` is the
name and `detail` is that second field; the generator page shows `detail`
as a second line under `text` whenever it's set, and includes it
(`"Name — Effect"`) when copying. `scripts/import-treasure.cjs`'s `format`
per category (`'lines'`, `'tab'`, or `'blocks'`) is what selects the right
parsing for that category's source file shape — Wondrous Items' source is
blank-line-separated "Name\nDescription" blocks, unlike Potions' one
tab-separated line per entry, since that's the shape the GM pasted each
one in.

**Why a separate model/store from `NameTable`, despite the similar
shape:** same reasoning as `WildMagicTable` — `NameTableStore.setNames()`
feeds the inline 🎲 Name-field popover, and a Trinket/Potion isn't a name a
GM would pick there. `TreasureStore` is a parallel, near-twin service (same
`toSignal`-over-`HttpClient` load shape, reuses `NameTableStore`'s
`pickRandomEntries` — genericized to `<T>` so it works over `TreasureEntry`
objects too, not just strings) — see [PRODUCT.md](./PRODUCT.md) section 14.

### CombatThesaurusTable

Loaded read-only via `CombatThesaurusStore` from `public/data/
combat-thesaurus.json`. Unlike `NameTable`/`MonsterTemplate`/`WildMagicTable`,
there was never a bulk external document to convert, so — like
`TreasureTable` post-initial-batch — this JSON has been the GM-editable
source directly from the start; there's no `scripts/import-combat-
thesaurus.cjs` and none is needed. Edit `public/data/combat-thesaurus.json`
directly to add/edit verbs.

| Field       | Type                    | Notes                                                                                     |
| ----------- | ----------------------- | ------------------------------------------------------------------------------------------- |
| `id`        | string                  | e.g. `combat-thesaurus-blade`                                                             |
| `setName`   | string                  | Currently always `"Combat Thesaurus"` — same parity-with-`NameTable` reasoning as `WildMagicTable.setName` |
| `tableName` | string                  | `"Blade"`, `"Blunt"`, `"Defense"`, `"Impairment"`, `"Magic"`, or `"Range"` |
| `icon`      | `CombatThesaurusIcon`   | One of `'blade' \| 'blunt' \| 'defense' \| 'impairment' \| 'magic' \| 'range'` — selects which hand-authored inline SVG the generator page's category-button row shows for that table; no icon library is used anywhere in this app (see `CombatThesaurusGenerator`'s template) |
| `entries`   | string[]                | Flavor verbs for that category, e.g. Blade: "skewer", "slash"; 29 entries per category, all six provided |

**Why a separate model/store from `NameTable`, despite the similar
shape:** same reasoning as `WildMagicTable`/`TreasureTable` —
`NameTableStore.setNames()` feeds the inline 🎲 Name-field popover, and a
combat verb isn't a name a GM would pick there. `CombatThesaurusStore` is a
parallel, near-twin service (same `toSignal`-over-`HttpClient` load shape,
reuses `NameTableStore`'s `pickRandomEntries`) — see
[PRODUCT.md](./PRODUCT.md) section 15.

### Timer

An Encounter-scoped countdown, created via the same "+" menu (next to the
Previous/Next Turn buttons, run phase only) as a mid-encounter Combatant —
see "Timers" below for the full behavior.

| Field                     | Type           | Notes                                                                                                                                             |
| ------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                      | string         | Unique identifier                                                                                                                                 |
| `encounterId`             | string         | References `Encounter.id`                                                                                                                         |
| `ownerId`                 | string         | The owning GM's Firebase Auth uid, copied from the parent `Encounter` at creation — see the Phase 3 implementation note above                    |
| `name`                    | string         | GM-entered label, e.g. "Room floods"                                                                                                              |
| `remaining`               | number         | Current countdown value                                                                                                                           |
| `initialValue`            | number         | The value set at creation; never changes afterward — used only to compute the card's light-grey-to-black background as `remaining / initialValue` |
| `linkedCombatantId`       | string \| null | Optional, set at creation. `null` = ticks at every round boundary. Set = ticks when that combatant's turn ends instead                            |
| `lastTickedRoundCredited` | number \| null | Internal bookkeeping, not GM-facing — see "Timers" below                                                                                          |

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
NPC-creation path, generalized to also allow an ad-hoc Player. `fields`
optionally carries `monsterTemplateId`/`monsterName` too (forwarded
straight into `buildCombatant`, which already accepted them for the
Party/Troop pull-in paths above) — this is what `AddCombatantDialog`'s
**From Book** option (see [PRODUCT.md](./PRODUCT.md) section 2) uses:
picking a `MonsterTemplate` prefills the same ad-hoc create form and stashes
its id/name, so the resulting Combatant is `monsterTemplateId`-linked from
creation, the same as one pulled in from an Encounter-Generator-saved Troop,
without needing to go through that generator/Troop flow at all. A third
path reaches the same call now too: `EncounterList`'s embedded
`MonsterGeneratorPanel` (see [PRODUCT.md](./PRODUCT.md) section 2's
"Generate Monsters") loops its generated draft and calls
`addAdHocCombatant` once per entry directly — the "+ Add These to
Encounter" commit, landing monsters straight onto the Encounter being
built without ever creating a Troop, unlike the standalone Encounter
Generator page's "Save as Troop" (section 12), which still goes through
`NpcStore.createNpc`/`addNpcToTroop` instead.

**Lazily creating the Encounter itself, from `EncounterList`'s create/edit
panel:** unlike every path above (which all assume a real `encounterId`
already exists), a brand-new Encounter isn't created in the store the
instant the panel opens — only on the first real commit (a generated
roster via the path above, or any Add Combatant pick), via a private
`ensureEncounterCreated()` that calls `createEncounter` with whatever
name/Party/Troop selections are currently staged (defaulting the name to
`"Untitled Encounter"` if still blank) and remembers the resulting id for
the rest of that panel session. A plain create (name + Party/Troop only,
submitted before anything else happens) is unaffected — it still calls
`createEncounter` directly, same as before this existed.

**Saving an ad-hoc combatant to the roster** ("Save to Roster," available
on any Combatant with `playerId`/`npcId` both `null`): the GM optionally
checks which Party/Troop to also add it to, then
`EncounterStore.linkCombatantToLibraryEntry(encounterId, combatantId, linkedId)`
sets `playerId` or `npcId` (matching the Combatant's `type`) on that _same_
Combatant record. No second Combatant is ever created — creating the
library entry and assigning it to a group happens first, at the page level
(`PartyStore.createPlayer`/`NpcStore.createNpc` +
`addPlayerToParty`/`addNpcToTroop`), and `linkCombatantToLibraryEntry` only
does the final id assignment. `EncounterDetail`/`EncounterList`'s
`confirmSaveToRoster` also carries the Combatant's own
`monsterTemplateId`/`monsterName` onto the new `Npc` (the `NpcStore.createNpc`
call only, since `PartyStore.createPlayer` has no such fields — a
monster-templated Combatant is always `type: 'npc'` in the first place) —
otherwise a From Book combatant would lose its stat-block link the moment
it's saved to the roster.

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
`activeCombatantIndex` to the _returning_ combatant — an interrupt, since a
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
index in the order _with the dragged combatant already removed_. Like every
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

**The one accepted wrinkle:** deleting a combatant _can_ relabel the
survivors. This only happens via `removeCombatant` (a hard delete — today
only reachable from the setup-phase list's trash icon on an ad-hoc NPC
before the first Roll), which actually removes the record from
`combatantsSignal`. If "Goblin A" is deleted while "Goblin B" remains,
"Goblin B" relabels to plain "Goblin" (now the only one) the next time
`computeDisplayNames` runs — same relabel-on-removal behavior already
accepted for `toggleRemoved`'s "N/A" initiative placement elsewhere. Toggling
`removedFromCombat` (the _soft_ Removed From Combat flag, everywhere else
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
   no-op if they _did_ go on Hold this same round (already credited by
   the Forward branch when they held).
3. `returnFromHold`'s `'above'` interrupt branch, for the combatant being
   interrupted — this is the one place `activeCombatantIndex` changes
   without going through `advanceTurn` at all.

`advanceTurn`'s Back branch mirrors this with `uncreditLinkedTimerOnBack`:
if the combatant Back just landed on has a linked timer credited _this_
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
