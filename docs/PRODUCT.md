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
- **Encounter** — one combat session. Combines Players and NPCs pulled in
  via Party/Troop, added individually from the roster, or defined ad-hoc
  (see "2. Create an Encounter" below), tracks initiative order, whose turn
  it is, and how many rounds have passed.

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
The GM builds up the combatant list from four sources, any combination of
which can be used together:
- **Pull a Party (or Parties)** in as a unit — every Player in the Party
  joins as a Combatant.
- **Pull a Troop (or Troops)** in the same way — every NPC in the Troop
  joins as a Combatant.
- **Add a single roster entry, or an ad-hoc one** — an **Add Combatant**
  button opens a modal (the same one used in the Encounters list's Edit
  form and the run-phase "+" menu — see section 9 below). It always opens
  on a three-way choice — **Existing NPC**, **Existing Player**, or
  **Create New** — as peers, not a toggle buried under one of them.
  Picking Existing NPC/Player shows that type's roster entries to pick
  from, one click each; picking Create New asks the type (NPC/Player) and
  then shows the ad-hoc create form. A **← Back** link on either path
  returns to the three-way choice. Any step, or Cancel (or Escape), closes
  the modal back out — nothing is added until the GM actually picks or
  submits one.

An ad-hoc entry isn't stuck ad-hoc forever: **Save to Roster** creates a
library Player/NPC from its current fields, optionally adds it to a
Party/Troop the GM checks off, and links it to the *same* Combatant — it
never appears twice in the Encounter being built.

A saved Encounter can be edited later from the Encounters list — rename it,
change which Parties/Troops are pulled in, or add/remove combatants (e.g.
reinforcements) — using that same form.

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
**Edit Info** button (in the expansion drawer) — a pop-up that reuses the
same input fields as creation, pre-filled with the combatant's current
values. The same drawer also has a **Create Timer** button, which
immediately creates a Timer linked to that combatant with a default name
and starting value — a shortcut for the common case, alongside the full
**+** → **Add Timer** flow (see section 10) for a custom name/value.
Every create/edit form for a Player/NPC uses the same layout: one field
per row-item (Name, then an icon-labeled field per stat — a d20 for
Initiative Modifier, shield for AC, heart for Max HP, notepad for Notes),
all on one line alongside the submit button whenever there's room. This is
the one shared form used everywhere a Player/NPC's data is entered
(Player/NPC roster, ad-hoc NPC forms, the Edit pop-up) — a style change to
it applies everywhere at once.

AC, HP, Notes, and Initiative each occupy the same fixed-width spot on
every bubble, in that fixed order — populated or blank, never removed from
the row — so a whole list of combatants lines up column-by-column like a
table (AC under AC, HP under HP, and so on) regardless of which combatants
happen to have which fields set. AC and Initiative each show as a solid
icon badge (a shield, a d20) with the value reversed in white and centered
inside it, rather than icon-then-text side by side — compact, and easy to
scan at a glance.

The whole bubble is meant to read as one compact line, and is designed to
never wrap onto a second line while there's still a way to reclaim width
instead. Wrapping is a *viewport*-width concern on a phone, but a bubble can
also end up just as narrow on a wide desktop screen once the Timers rail
and the Hold Action panel both crowd the combatant list — so the bubble
watches its own rendered width (not the page's) and truncates in this
order, each step only kicking in once the previous one's savings weren't
enough: **Notes** first (down to just its icon — the full text was always
one click away regardless, see below), then the **HP bar** (redundant with
the current/max numbers right next to it), then the **name** itself
(hover, or click/tap, to see it in full — the same "temporary growth that
snaps back" as Notes). Only once all three still aren't enough does a
bubble finally wrap onto two lines, as a last resort.

In an Encounter, HP displays as **Current / Max**, drawn as a health bar
showing the percentage remaining, its color easing from green through
yellow to red as that percentage drops. Clicking the heart icon or the bar
itself, on *any* combatant (not just the Active one), opens a small popover:
a magnitude input on the left, and a Damage/Healing switch (red/Damage by
default, green when flipped to Healing) stacked above a confirm button on
the right. The switch sets the sign — the input only ever holds the number
typed into it, shown with a leading `-` or `+` that the switch controls and
typing can't overwrite. Current HP is always clamped between `0` and Max HP.

Notes shows the note's own text right on the bubble, clipped to the same
fixed width on every bubble (regardless of how long that particular note
is) rather than just an icon with nothing next to it. Hovering (mouse) or
tapping (touch) the notepad icon just highlights it as a hint that it's
clickable; clicking/tapping it is what actually expands it in place to show
the full text, growing the bubble only for as long as it's expanded, then
collapses back to the same clipped width — either by clicking the note
again or clicking anywhere else — as every other bubble's Notes column.

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

### 9. Adding mid-encounter: the "+" menu
Once combat is running (after the first Roll), a **+** button sits to the
left of the Previous/Next Turn buttons. Clicking it offers a choice: **Add
Timer** or **Add Combatant**.

**Add Combatant** opens the same modal used everywhere else a combatant is
added (see section 2) — the same three-way Existing NPC / Existing Player /
Create New choice, with the same optional "Save to Roster" afterward for an
ad-hoc entry. The new combatant doesn't join the fight immediately — it
appears in a **Ready to Join** list, shown between the turn controls and
Removed From Combat, each with an upward-arrow icon. Clicking a Ready to
Join combatant rolls them into the main list right away, using the same
logic as un-marking Removed From Combat: a fresh roll capped below the
current Active combatant's total, so they slot in without interrupting
whoever's turn it is. If the GM never clicks it, the combatant is
automatically rolled into the main list once the round ends — the same
"everyone still waiting gets folded back in" moment Hold Action combatants
already get at every round boundary.

### 10. Timers
**Add Timer** (same "+" menu) opens a "new timer" card right in the
Timers rail — a GM-written name, a starting countdown value, and an
optional **link** to one specific combatant (chosen from whoever's
currently in the main list or Hold Action panel). Submitting it replaces
that card with the real Timer Card; Cancel just removes it. A combatant's
expansion drawer also has a **Create Timer** shortcut (see section 4a)
that skips this card entirely, creating an already-linked timer with a
default name/value in one click.

Cards sit in a compact, center-aligned rail to the left of the combatant
list on desktop (narrow enough that it never crowds the combatant list's
own AC/HP/Notes columns), and as a wrapping row of compact cards at the
top of the whole encounter view on mobile. Cards are sorted lowest-ticks-
remaining first (so an expired timer always sorts to the front), with
timers sharing the same remaining value and the same linked combatant kept
adjacent to each other. If there are enough cards that the rail would run
past where the Previous/Next Turn buttons sit, it caps its own height there
and scrolls internally instead of pushing the rest of the page down. A
linked combatant's name shows a small clock icon so it's clear at a glance
which combatant a Timer is tracking.

- **Unlinked** ("The room floods in 3 rounds"): counts down by 1 every
  round.
- **Linked** ("The wizard's illusion spell ends in 3 rounds"): counts down
  by 1 only once that combatant's turn ends for the round — not at the
  literal round boundary. Pressing Previous to move back onto that
  combatant un-ticks the timer, since their turn hasn't concluded again
  yet. A timer linked to someone on Hold Action still ticks once if the
  round ends before they ever return to take a turn.

A card starts light grey and darkens toward black as it nears its own
zero (relative to the value the GM set, so a timer that started at 3 and
one that started at 20 both read as "urgent" near the end). The remaining
count always shows inside a circle on the card, with **+**/**-** controls
permanently visible on either side of it — no click needed to reveal them
— to manually nudge the value in either direction, including back above 0,
unlike the automatic countdown, which never dips below it on its own. The
moment a timer first reaches 0, the card gives a quick shake so the
transition is hard to miss, the countdown stops moving on its own, and the
card shows the name in bold white text on a red background (the count
stays visible, now reading 0). An **×** button on every card dismisses it
at any time.

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

No open decisions remain from this phase's original scope — see "Resolved
this phase" below. Future phases (see [ROADMAP.md](./ROADMAP.md)) will
likely surface new ones.

**Resolved this phase:**
- Combat-relevant data beyond name + Initiative Modifier is AC, Max HP
  (tracked in-encounter as Current/Max), and Notes — all optional, all
  editable live during an Encounter via the Edit button. See "4a. Combat
  data: AC / HP / Notes" above.
- NPC reuse: yes, via the new NPC roster and Troops (mirroring
  Players/Parties) — see "Core concepts" and "Navigation" above.
- Pulling Troops/individual roster entries into an Encounter: yes — a Troop
  can be pulled in as a unit (mirroring a Party), and a single roster
  Player/NPC can be added without its whole group. See "2. Create an
  Encounter" above.
- Registering an ad-hoc Encounter entry into the roster: yes, via "Save to
  Roster" — creates a library Player/NPC from the ad-hoc entry's fields,
  optionally assigns it to a Party/Troop, and links it to the same
  Combatant rather than duplicating it. See "2. Create an Encounter" above.
