# Roll4 — Product Overview

Roll4 is a browser-based initiative tracker for tabletop RPGs (D&D and similar
systems). It's built for a Game Master (GM) running combat encounters and
needing a fast, clear way to track turn order across multiple rounds.

## Core concepts

- **Party** — a reusable group of Player Characters (PCs) that a GM registers
  once and reuses across many encounters (e.g. "The Thursday Night Group").
- **Player Character (PC)** — a character controlled by a player. Minimum
  data needed to run combat: name and Initiative Modifier. Belongs to a Party.
- **NPC** — any non-player combatant: a monster, a villain, a townsperson who
  joined the fight. Created within an Encounter (not tied to a reusable
  library, at least for now). Same minimum data as a PC: name and Initiative
  Modifier.
- **Initiative Modifier** — a signed integer (e.g. `+3`, `0`, `-1`) added to a
  d20 roll to produce a combatant's initiative result.
- **Encounter** — one combat session. Combines the Party's PCs with
  encounter-specific NPCs, tracks initiative order, whose turn it is, and how
  many rounds have passed.

## GM workflows

### 1. Manage Parties
The GM creates a Party and adds PCs to it (name + Initiative Modifier).
Parties persist and can be reused across many Encounters.

### 2. Create an Encounter
The GM picks a Party (or Parties) to pull PCs from, then adds NPCs specific to
this fight (e.g. "Goblin 1", "Goblin 2", "Bandit Captain").

### 3. Roll Initiative
The GM presses **Roll**. Every combatant gets a random value from 1–20, plus
their Initiative Modifier, producing their initiative total. Combatants are
sorted descending by that total (highest acts first). Ties are broken by...
*(open question — see Open Decisions below)*.

### 4. Run the Encounter
The initiative order is displayed as a list. Each entry shows:
- Combatant name
- A color indicating PC vs. NPC
- (future: HP, conditions, notes, etc.)

The GM uses **Forward** / **Back** buttons to move an "Active" highlight down
the list, one combatant at a time — this is whose turn it currently is.

### 5. Rounds
When the GM advances past the last combatant in the order, a new round
begins and the round counter increments. The GM has a per-Encounter setting
for what happens to initiative order at the start of a new round:

- **Re-roll every turn** (default) — a homebrew rule where *every* combatant
  re-rolls initiative at the start of each round, and the order is rebuilt
  from scratch.
- **Keep initiative order** — the standard rule where the order rolled at the
  start of combat is kept for every subsequent round.

### 6. Remove from Combat
The GM can mark any combatant as **Removed from Combat** (e.g. defeated,
fled, or otherwise out of the fight). A removed combatant:
- Is greyed out in the initiative list.
- Is skipped when advancing Forward/Back — the Active highlight jumps over
  them.
- **Keeps its place** in the initiative order (it isn't deleted or
  re-sorted away), so it can be un-removed later without losing its spot.

## Persistence

GM data (Parties, PCs, Encounters, and encounter-in-progress state like
current round/active combatant) needs to survive a page reload and be
resumable later. See [ARCHITECTURE.md](./ARCHITECTURE.md) for how this is
implemented in the current phase, and [ROADMAP.md](./ROADMAP.md) for when
that changes.

## Future: Player role

Not in the current build phase, but part of the intended direction:
- A **Player** account type, separate from GM.
- Players can upload/manage their own PC's data for a GM's Party.
- Players get a notification when it becomes their character's turn.

This has real implications for the data model (a PC needs an *owner* distinct
from the GM) and for hosting (notifications imply a live/realtime backend of
some kind) — see [ARCHITECTURE.md](./ARCHITECTURE.md).

## Open decisions

These are known gaps we haven't resolved yet — call them out explicitly when
they become relevant rather than silently picking an answer:

- **Tie-breaking rule** for equal initiative totals (D&D 5e RAW uses highest
  Dex modifier, then GM's choice — do we want that much detail, or a simpler
  rule?).
- **NPC reuse** — should NPCs ever be saved to a reusable "monster library"
  across encounters, or are they always encounter-scoped?
- How much combat-relevant data (HP, conditions, notes) do we want on a
  combatant beyond name + Initiative Modifier, and in which phase?
