# Roll4 — Product Overview

Roll4 is a browser-based initiative tracker for tabletop RPGs (D&D and similar
systems). It's built for a Game Master (GM) running combat encounters and
needing a fast, clear way to track turn order across multiple rounds.

## Core concepts

- **Player** — a reusable library entry for a character controlled by a
  player (renamed from "Player Character (PC)" this phase). Minimum data
  needed to run combat: name and Initiative Modifier; AC, Max HP, and Notes
  are optional on top of that. Lives in the GM's Player roster
  (`/players`), independent of any one Party — see **Party** below. (Don't
  confuse this with the *future* Player account role described later in
  this doc — that's a login/permissions concept; this is character data the
  GM manages today.)
- **Party** — a reusable, named grouping of Players that a GM can pull into
  an Encounter as a unit (e.g. "The Thursday Night Group"). A Player can
  belong to more than one Party at once — Party membership is a tag on the
  shared Player roster, not ownership of it, so deleting a Party never
  deletes the Players in it.
- **NPC** — a reusable library entry for any non-player combatant: a
  monster, a villain, a townsperson who joined the fight. Same data as a
  Player: name and Initiative Modifier required, AC/Max HP/Notes optional.
  Lives in the GM's NPC roster (`/npcs`). NPCs can *also* still be created
  ad-hoc, directly within an Encounter, without ever touching the roster —
  that Phase 1 workflow is unchanged; the roster is an added option, not a
  replacement for it.
- **Troop** — the NPC-side equivalent of a Party: a reusable, named
  grouping of NPCs. Same many-to-many membership rules as Party/Player.
- **Initiative Modifier** — a signed integer (e.g. `+3`, `0`, `-1`) added to a
  d20 roll to produce a combatant's initiative result.
- **Encounter** — one combat session. Combines Players (via Party or,
  today, only via Party — see the open decision below) with
  encounter-specific NPCs, tracks initiative order, whose turn it is, and how
  many rounds have passed.

## Navigation

Two top-level tabs organize the GM's reusable data, each with its own
sub-nav:
- **Players** → **Roster** (every Player, regardless of Party) and
  **Parties** (create/rename/delete a Party, and check which roster
  Players belong to it).
- **NPCs** → **Roster** (every NPC) and **Troops** (same shape as
  Parties, for NPCs).

**Encounters** remains its own top-level tab, unchanged.

## GM workflows

### 1. Manage the Player roster and Parties
The GM adds Players to the roster (name + Initiative Modifier, plus
optional AC/Max HP/Notes) from the **Players → Roster** page — this is now
the only place a Player is created; a Party doesn't own its own dedicated
characters the way it did in Phase 1. From **Players → Parties**, the GM
creates a Party and checks which roster Players belong to it; the same
Player can be checked into more than one Party. Parties persist and can be
reused across many Encounters. NPCs/Troops work identically, under the
**NPCs** tab.

### 2. Create an Encounter
The GM picks a Party (or Parties) to pull Players from, then adds NPCs
specific to this fight (e.g. "Goblin 1", "Goblin 2", "Bandit Captain") —
today this is still always ad-hoc, typed directly into the Encounter; pulling
from the NPC roster/Troops the same way Parties are pulled in is designed
(see Core Concepts) but not wired up to Encounter creation yet. A saved
Encounter can be edited later from the Encounters list — rename it, change
which Parties are pulled in, or add/remove combatants (e.g. reinforcements)
— using that same form.

### 3. Roll Initiative
The GM presses **Roll**. Every combatant gets a random value from 1–20, plus
their Initiative Modifier, producing their initiative total. Combatants are
sorted descending by that total (highest acts first). Ties are broken by
whichever combatant has the higher Initiative Modifier; if that's also tied,
by a random coin flip.

### 4. Run the Encounter
The initiative order is displayed as a list. Each entry shows:
- Combatant name
- A color indicating PC vs. NPC
- AC, Current/Max HP, and Notes, whenever set (see 4a below)

The GM uses **Forward** / **Back** buttons to move an "Active" highlight down
the list, one combatant at a time — this is whose turn it currently is.
**Back** stops at the first combatant of the current round rather than
crossing back into the previous round — with "Re-roll every round" as the
default rule, a previous round's order/rolls are no longer meaningful to
return to.

### 4a. Combat data: AC / HP / Notes
AC, Max HP, and Notes are optional fields a GM can set when creating a
Player or NPC, and can also add or change later via the combatant bubble's
**Edit** button (in the expansion drawer) — a pop-up that reuses the same
input fields as creation, pre-filled with the combatant's current values.
Every create/edit form for a Player/NPC uses the same layout: one field
per row-item (Name, then an icon-labeled field per stat — a d20 for
Initiative Modifier, shield for AC, heart for Max HP, notepad for Notes),
all on one line alongside the submit button whenever there's room. This is
the one shared form used everywhere a Player/NPC's data is entered
(Player/NPC roster, ad-hoc NPC forms, the Edit pop-up) — a style change to
it applies everywhere at once.

AC, HP, Notes, and Initiative each occupy the same fixed-width spot on
every bubble, in that fixed order, each with the same icon used on the
input form — populated or blank, never removed from the row — so a whole
list of combatants lines up column-by-column like a table (AC under AC, HP
under HP, and so on) regardless of which combatants happen to have which
fields set. Initiative gets the same icon+value treatment (a d20) rather
than standing out as a differently-styled bold number. The whole bubble is
meant to read as one compact line; on narrow (mobile) screens every bubble
wraps at the same point — name alone, then every stat column together — so
the columns stay aligned across bubbles even after wrapping, and the HP bar
itself drops away below a phone-width breakpoint, leaving just the
current/max numbers, to help everything fit.

In an Encounter, HP displays as **Current / Max**, drawn as a health bar
showing the percentage remaining, its color easing from green through
yellow to red as that percentage drops. Clicking the heart icon or the bar
itself, on *any* combatant (not just the Active one), opens a small input
where the GM types a signed delta — `+10` to heal 10. A bare number with no
sign (e.g. `15`) is taken as damage (`-15`), since that's the more common
case; a leading `+` or `-` is only needed to say otherwise. Current HP is
always clamped between `0` and Max HP.

Notes shows the note's own text right on the bubble, clipped to the same
fixed width on every bubble (regardless of how long that particular note
is) rather than just an icon with nothing next to it. Clicking (or
hovering, for a mouse) the notepad icon expands it in place to show the
full text, growing the bubble only for as long as it's expanded, then
collapses back to the same clipped width as every other bubble's Notes
column.

Editing AC/HP/Notes from a combatant's Edit button only affects that one
Encounter — it doesn't write back to the Player/NPC's own saved roster data.

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
- Shows **N/A** for initiative (counts as `0` for sorting).
- Is skipped when advancing Forward/Back — the Active highlight jumps over
  them.
- **Sinks to the bottom** of the initiative order, since a real roll is
  almost always above `0`.
- Is pulled out of the main initiative list entirely and shown instead in a
  **Removed From Combat** table beneath the Previous/Next Turn buttons, so
  the main list only shows combatants still in the fight.

Unchecking Removed from Combat (from that table) rolls a fresh initiative
for that combatant — randomized, but always capped below the current Active
combatant's total — and reinserts them into the order at that point,
rejoining the fight mid-round rather than snapping back to wherever they
started.

### 6a. Incapacitated
The GM can also mark a combatant as **Incapacitated** (unconscious, stunned,
or otherwise unable to act) without removing them from the fight. Unlike
Removed from Combat or Hold Action, this is purely a visual marker:
- The combatant's bubble is greyed out, the same tint used for a Removed
  entry, with a small crescent-moon badge in place of the initiative-based
  status icons — clicking the badge un-marks it, the same shortcut the
  drawer's checkbox offers.
- The combatant stays exactly where it is — main list or Hold Action panel —
  and keeps rolling, sorting, and taking turns exactly like everyone else.

### 7. Hold Action
The GM can mark a combatant as **Holding their action** (waiting for a
trigger before acting). A combatant on hold:
- Moves out of the main initiative list into a **Hold Action panel**: a
  bordered, darker-background box labeled "Hold Action," shown beside the
  main list on wide screens (or stacked below it on narrow ones). The panel
  only appears at all while at least one combatant is holding.
- Is ordered by **insertion, not initiative** — whoever holds first appears
  at the top of the panel.
- Has its displayed initiative continuously pinned to **the Active
  combatant's total**, so it visually reads as "on deck" alongside them.
- Is skipped when advancing Forward/Back, the same way a Removed combatant
  is — Hold Action never becomes the Active turn on its own.

A combatant in the Hold Action panel can start returning to the main list two
ways: unchecking Hold Action in its drawer, or a dedicated ◀ button on the
left edge of its bubble (a shortcut that skips opening the drawer). Either one
opens **placement mode** rather than immediately rejoining the fight:
- Two dashed placeholder slots appear in the main list directly around the
  Active combatant, one point above its total and one point below — each
  shows just the target initiative number, since the placeholder's job is to
  mark a slot, not restate who's landing there.
- Every other control on the page — Forward/Back, and every other
  combatant's expand/Removed/Hold Action controls — locks until this
  resolves, since it's a one-thing-at-a-time choice.
- The GM resolves it by clicking whichever placeholder they want, or by
  dragging the bubble (still shown, highlighted, in the Hold Action panel)
  onto one of the two placeholders. While dragging, the piece that follows
  the cursor shows just the combatant's name, for the same reason the
  placeholders were trimmed down — the full bubble (icons, initiative, etc.)
  is unnecessary in motion.
- Whichever spot is chosen, the combatant plays a quick "pop" animation —
  shrinking/fading out of the panel while the same combatant pops into the
  main list at that exact spot.
- **Placing above Active means interrupting**: the returning combatant
  becomes the new Active combatant immediately, jumping in ahead on their
  held trigger. The combatant who *was* Active isn't skipped — they simply
  haven't acted yet this round, so the next Forward naturally lands back on
  them once the interrupter's turn ends.
- **Placing below Active** just queues the combatant up next, one point
  below whatever Active's total is, without disturbing whose turn it
  currently is.

If the currently Active combatant checks Hold Action on their own turn,
their turn passes immediately, the same way marking the Active combatant
Removed does — they then go through the same placement flow as anyone else
once returned to.

Starting a new round always clears the Hold Action panel — every held
combatant returns to the main list, either with a freshly rolled initiative
(the default homebrew rule) or their initiative from just before they held,
if not re-rolling each round.

### 8. Manual Reordering
The GM can drag any main-list combatant to a new spot via a grip icon on the
left edge of its bubble — for correcting a bad roll, or just for a GM call
that overrides the dice. The grip icon stays hidden until it's needed:
hovering the bubble reveals it (mouse), and tapping/clicking the bubble
toggles it on (touch, or as a mouse alternative), keeping the row
uncluttered the rest of the time. Dragging shows a dashed placeholder
marking the gap where it'll land, and the other combatants shift out of the
way as it moves, the same fluid "drag to reorder" feel as reordering items
in a task list.
Dropping sets the combatant's initiative to one point above or below
whichever neighbor it landed next to — not a recalculated roll, just enough
to hold that position in the sorted order. Removed combatants and anyone
currently on Hold Action aren't draggable this way (Hold Action has its own
placement flow, above).

## Persistence

GM data (Players, NPCs, Parties, Troops, Encounters, and encounter-in-progress
state like current round/active combatant) needs to survive a page reload
and be resumable later. See [ARCHITECTURE.md](./ARCHITECTURE.md) for how
this is implemented in the current phase, and [ROADMAP.md](./ROADMAP.md)
for when that changes.

## Future: Player account role

Not in the current build phase, but part of the intended direction — a
different concept from the **Player** *character* library entry described
above, despite the name collision:
- A **Player** *account* type, separate from GM — a login/permissions
  role, not the reusable character data in the GM's roster.
- Account-holding players can upload/manage their own character's data for
  a GM's Party, rather than the GM entering it on their behalf as today.
- Players get a notification when it becomes their character's turn.

This has real implications for the data model (a Player entity needs an
*owner* distinct from the GM) and for hosting (notifications imply a
live/realtime backend of some kind) — see [ARCHITECTURE.md](./ARCHITECTURE.md).

## Open decisions

Known gaps not yet resolved:

- **Pulling Troops/individual roster entries into an Encounter** — Parties
  can be pulled into an Encounter as a unit today; NPCs can be added
  ad-hoc; but pulling a whole Troop, or a single roster Player/NPC without
  its whole group, the way a Party already can be, isn't wired up to
  Encounter creation yet.
- **Registering an ad-hoc Encounter entry into the roster** — a GM who
  types a new NPC directly into an Encounter has no way yet to also save
  it to the NPC roster (and optionally a Troop) without creating a
  duplicate entry.

**Resolved this phase:**
- Combat-relevant data beyond name + Initiative Modifier is AC, Max HP
  (tracked in-encounter as Current/Max), and Notes — all optional, all
  editable live during an Encounter via the Edit button. See "4a. Combat
  data: AC / HP / Notes" above.
- NPC reuse: yes, via the new NPC roster and Troops (mirroring
  Players/Parties) — see "Core concepts" and "Navigation" above.
