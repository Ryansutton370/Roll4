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
  confuse this with the _future_ Player account role described later in
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
  Lives in the GM's NPC roster (`/npcs`). NPCs can _also_ still be created
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

`/` is a public landing page (Roll4 title, an About section, and an
Upcoming Features list), reachable whether or not a GM is signed in —
signed-out visitors get a Sign In prompt there instead of the tab nav
below; the header's tab nav and this page's own quick-nav links both only
appear once signed in. See [ROADMAP.md](./ROADMAP.md)'s 3.8 for how that
route is wired up.

Signed-out visitors can also **Continue Without Signing In** (`/` or
`/login`) to use the full app as a guest, no account required — with a
clear warning that a guest's data lives only in that browser (not backed up,
not reachable from another device, and not carried over if they sign up for
a real account afterward). See [ROADMAP.md](./ROADMAP.md)'s 3.9.

Two top-level tabs organize the GM's reusable data, each with its own
sub-nav:

- **Players** → **Roster** (every Player, regardless of Party) and
  **Parties** (create/rename/delete a Party, and check which roster
  Players belong to it).
- **NPCs** → **Roster** (every NPC) and **Troops** (same shape as
  Parties, for NPCs).

**Encounters** remains its own top-level tab, unchanged.

**Content & Generators** is a fourth top-level tab (renamed from "Random
Generators" — see [ROADMAP.md](./ROADMAP.md)'s 3.10), with its own
Roster-style sub-nav (see "11. Content & Generators", "12. Encounter
Generator", "13. Wild Magic Generator", "14. Treasure Generator", and "15.
Combat Thesaurus" below): **Names**, **Encounter**, **Wild Magic**,
**Treasure**, and **Combat Thesaurus**.

**About & Contact** is a fifth top-level tab (`/about`), always last, and
has no sub-nav — a static page (an About section, a placeholder pending
real biographical content, and a Contact section with a support/feedback
email). See [ROADMAP.md](./ROADMAP.md)'s 3.11.

## GM workflows

### 1. Manage the Player roster and Parties

The GM adds Players to the roster (name + Initiative Modifier, plus
optional AC/Max HP/Notes) from the **Players → Roster** page — this is now
the only place a Player is created; a Party doesn't own its own dedicated
characters the way it did in Phase 1. From **Players → Parties**, the GM
creates a Party and checks which roster Players belong to it; the same
Player can be checked into more than one Party. Parties persist and can be
reused across many Encounters. NPCs/Troops work the same way under the
**NPCs** tab, plus one addition Players has no equivalent for: a **Browse
Monster List** section (the same sortable/searchable/eye-icon table
described in section 12) sits between the roster and the hand-entry create
form on **NPCs → Roster**, letting the GM save a 5e SRD/Shadowdark monster
template straight into the roster — instantly, with a confirmation toast,
no separate submit step — instead of retyping its stats by hand. The saved
NPC carries the same `monsterTemplateId` link as one added via Add
Combatant's From Book option or the Encounter Generator, so it still gets
the View Stat Block button once pulled into an Encounter (section 4a). A
monster is always an NPC, never a Player, which is why this option only
exists on this tab.

### 2. Create an Encounter

The **Encounters** tab (`/encounters`) is a two-column layout (stacked on
narrow viewports): the left column holds a **+ Create Encounter** button
that expands into a build panel — the _same_ panel (name, Party/Troop
pulls, a Monsters section) is reused for editing an existing Encounter too
(via its pencil icon), pre-filled instead of blank, rather than two
different UIs for create vs. edit. The right column normally shows every
saved Encounter as a list, headed **Saved Encounters** — but while the
build panel is open, this column instead shows **Encounter Preview**
(below), taking over that same space entirely rather than the two being
shown side by side.

Inside the panel, top to bottom, are the encounter name field, Party/Troop
pulls, a subtle divider, **Add Individual Combatant** (below), another
divider, the **Monsters** section, a final divider, and **Done** — each
section separated by a plain hairline rule so the panel reads as a
sequence of distinct steps rather than one long form. The GM builds up the
combatant list from three sources, any combination of which can be used
together. **Every one of them applies immediately** — there's no separate
"Update Encounter" submit step to wait for; the moment any of them happens,
the Encounter itself is created if it doesn't already exist (see below)
and Encounter Preview reflects it right away:

- **Pull a Party (or Parties)** in as a unit — checking its box immediately
  pulls every Player in the Party in as a Combatant; unchecking immediately
  drops them again (same "only before the first Roll" rule
  `setEncounterParties` already enforces elsewhere).
- **Pull a Troop (or Troops)** in the same way, immediately, for NPCs.
- **Add Individual Combatant** — a one-off pick, positioned above the
  Monsters section since it's a peer to Party/Troop pulls and the Monsters
  compendium flow, not a sub-part of either: opens a modal (the same one
  used in the run-phase "+" menu — see section 9 below). It always opens on
  a four-way choice — **Existing NPC**, **Existing Player**, **From Book**,
  or **Create New** — as peers, not a toggle buried under one of them.
  Picking Existing NPC/Player shows that type's roster entries to pick
  from, one click each. Picking **From Book** asks a sourcebook (D&D 5e
  SRD or Shadowdark, same two sources as the Encounter Generator — see
  section 12) and then a monster from that source, picked from a
  sortable/searchable table (name, CR/Level, sortable by either and by
  A-Z/Z-A, live search-by-typing, and an eye icon previewing the full stat
  block before picking — see section 12's `MonsterPickerTable` note);
  picking one prefills the same create form Create New uses (name, AC, Max
  HP, Initiative Modifier all copied from the template) and skips asking
  NPC-vs-Player, since a monster is always an NPC. Either way the GM can
  still rename it before adding — typed by hand or via the 🎲 name
  generator (section 11) — same as any ad-hoc entry. A combatant added
  this way gets the same `monsterTemplateId` link as one from the
  Encounter Generator (see section 12's `Npc`/`Combatant` note and 4a's
  View Stat Block button). Picking Create New on its own asks the type
  (NPC/Player) and shows the same form, blank. A **← Back** link on any
  path returns to the previous step (From Book's own picker, for a
  combatant picked From Book, so re-picking a different monster doesn't
  mean starting over; the four-way choice for every other path). Any step,
  or Cancel (or Escape), closes the modal back out — nothing is added
  until the GM actually picks or submits one.
- A **Monsters** section, headed with a short explanation of the sourcebook
  toggle just below it (D&D 5e SRD or Shadowdark — same two sources as the
  Encounter Generator, section 12 — driving both subsections at once), with
  two headed subsections in order:
  - **Browse Monster List** — the same sortable/searchable/eye-icon table
    described in section 12's `MonsterPickerTable` note. Picking a monster
    here adds it straight to the Encounter immediately (shown right away in
    Encounter Preview) — it does not stage as a Candidate.
  - **Generate Monsters** — the same generate flow as the standalone
    Encounter Generator (source-specific generation controls — see section
    12), embedded directly in this panel instead of requiring a trip to a
    separate page and a Troop detour. Unlike Browse Monster List, a
    generated batch stages as **Candidates** (below) for the GM to
    review/name/prune before any of it becomes real.

  Generated monsters render below as **Candidates**: one row per instance
  (multiples of the same monster, e.g. 3 Goblins, are three separate rows,
  not one grouped "x3" row — each independently nameable via its own 🎲
  button, previewable via an eye icon, and removable), followed by a
  top-level **Add All to Encounter** button below the whole list. Each row
  also has its own **Add to Encounter** button (a green checkmark icon).
  Neither becomes a real Combatant until one of these is clicked — clicking
  either flashes the affected row(s) green before they disappear from
  Candidates, with a snackbar confirming ("Added to _Encounter Name_
  Encounter", or "_Monster Name_ added to _Encounter Name_ Encounter" for an
  individual add) — they then appear in Encounter Preview, carrying the
  same `monsterTemplateId`/`monsterName` link as any other monster-templated
  combatant.

**The Encounter isn't actually saved until the GM adds something real to
it** — typing a name alone doesn't create anything yet, and neither does
opening the panel. The moment the GM does anything real — checks a
Party/Troop, adds a monster (Browse, or a Candidates commit), or picks
something via Add Combatant — the Encounter is created right then (named
"Untitled Encounter" if the name field is still blank at that point) and
Encounter Preview fills in live. Typing a name after that point renames the
real Encounter immediately too (a blank name doesn't blank the stored one —
it just leaves it as whatever it already is, rather than flickering to
"Untitled Encounter" while the GM is mid-edit). A single **Done** button
closes the panel back onto the Saved Encounters list — there's nothing left
to discard by that point, since every change already applied the moment it
was made, so Done is just "I'm finished," not a commit step.

**Encounter Preview** (the right-hand column while the panel is open) shows
every Combatant added so far — pulled from a Party/Troop, added via Browse
Monster List or Add Combatant, or committed from Candidates — using the
exact same combatant-bubble UI as the run-phase screen (same AC/HP/Notes
columns, always in the same fixed left-to-right order and column position
whether or not any one combatant happens to have that field set, same
never-wrap/truncation behavior at any width). Initiative shows the
combatant's signed Initiative Modifier (e.g. "+2", "-1") rather than "N/A",
since no Roll has happened yet to produce a total. Its expansion drawer is
pared down to what makes sense before Roll Initiative, top to bottom:
**Edit Info** (same dialog as the run-phase drawer, and the same
`CombatantFields`-based layout/sizing as Add Combatant's Create New step),
**View Stat Block** (monster-templated combatants only, as elsewhere), an
ad-hoc entry's (no Player/NPC roster link) **Save to Players**/**Save to
NPCs** button (a save/floppy-disk icon, labeled for whichever type this
combatant is) — creates a library Player/NPC from its current fields,
optionally adds it to a Party/Troop the GM checks off, and links it to the
_same_ Combatant, never appearing twice in the Encounter being built — and,
for an NPC only, **Delete** at the bottom (removes the Combatant entirely).
A Player can only be **Mark Absent**, never deleted (the same underlying
flag as run-phase Removed from Combat, just relabeled, since a party member
can't be deleted from an Encounter) — shown in place of Delete for that
case. Hold Action, Incapacitated, and Create Timer are hidden throughout,
since none apply before combat starts.

A saved Encounter can be edited later from the Encounters list — rename it,
change which Parties/Troops are pulled in, generate and add more monsters,
or add/remove combatants (e.g. reinforcements) — using that same panel,
applying just as immediately as during the original create.

### 3. Roll Initiative

Opening a saved Encounter that hasn't rolled yet (`/encounters/:id`, before
the first Roll) shows the same setup: a **Combatants** list using the exact
same combatant-bubble UI as Encounter Preview above — same columns, same
pared-down drawer (Edit Info, View Stat Block, Save to Players/Save to NPCs,
Mark Absent/Delete) — so a GM sees no difference between "the Encounter I
was just building" and "the Encounter I just opened to run." A **+ Add
Combatant** button and the **Initiative Style** (Chaotic/Classic — see
"5. Rounds" below) setting sit beneath the list. **Roll Initiative** itself
is the first thing on the page, above the Combatants list — a large, bold
button rather than just another item in a row of controls, since it's the
one thing a GM opening an unstarted Encounter is ultimately here to do.

The GM presses **Roll4 Initiative**. Every combatant gets a random value from
1–20, plus their Initiative Modifier, producing their initiative total.
Combatants are sorted descending by that total (highest acts first). Ties
are broken by whichever combatant has the higher Initiative Modifier; if
that's also tied, by a random coin flip.

### 4. Run the Encounter

The initiative order is displayed as a list. Each entry shows:

- Combatant name — two combatants sharing a name (e.g. two "Goblin"s) each
  get an " A"/" B" suffix so they're never ambiguous, in the order they
  were added to the Encounter
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
"+" menu's **Add Timer** flow (see section 10) for a custom name/value.

A combatant sourced from a monster template — via the Encounter Generator
(section 12) or Add Combatant's **From Book** option (section 2) — gets one
more drawer button, **View Stat Block** — opens a read-only popup with that
monster's full stat block (AC, HP, Initiative, and every trait/action from
its source). The same action is also available directly on the collapsed
bubble row, as a small icon next to the name, whenever there's room for it —
one click to the stat block without expanding the drawer first; it's the
first thing to yield space if the bubble gets tight (same "give up the
least essential thing first" ladder as Notes/HP bar/Name truncation, just
ahead of all of them, since the drawer button is always a fallback). Only
shown for a monster-templated combatant; a hand-entered Player/NPC has no
stat block to show. That same combatant's bubble also displays differently
whenever it was given a personal name: the personal name shows prominently
(e.g. "Barry"), with the creature type as a smaller "- Goblin" subtitle
right after it, instead of just "Goblin" alone.
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
instead. Wrapping is a _viewport_-width concern on a phone, but a bubble can
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
itself, on _any_ combatant (not just the Active one), opens a small popover:
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

- **Re-roll every turn** (default) — a homebrew rule where _every_ combatant
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
  held trigger. The combatant who _was_ Active isn't skipped — they simply
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

Once combat is running (after the first Roll), a vertical-ellipsis (⋮)
button sits to the left of the Previous/Next Turn buttons — a **+** glyph
until a third, non-"add" option (Combat Thesaurus) made that literal plus
sign no longer describe everything the menu offers. Clicking it offers a
choice of three, each with its own icon: **Add Timer**, **Add Combatant**,
and **Combat Thesaurus**.

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

**Combat Thesaurus** (same "+" menu) opens `CombatThesaurusDialog` — a
small popup dialog (dismissed via × or clicking outside it, same as the
combatant bubble's View Stat Block popup in section 4a) embedding the exact
same category-row/count/roll/copy-any-result picker as the standalone
Combat Thesaurus page (section 15), so a GM can roll a flavor verb for
narrating whatever just happened without leaving the run-phase screen. The
picker itself (`CombatThesaurusPicker`) is a shared component used by both
this dialog and the full page — see [ARCHITECTURE.md](./ARCHITECTURE.md).

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

### 11. Content & Generators

Clicking the **Content & Generators** header tab (`/generators`) lands on a
hub page, `GeneratorsHome` — a card per generator (Names, Encounter, Wild
Magic, Treasure, Combat Thesaurus, Spell Lists), each with its own
hand-drawn icon (no icon library is used anywhere in this app — see
`CombatThesaurusPicker`'s per-category icons for the same convention) and
linking to its own sub-page, same card-grid look as the app's main landing
page's quick-nav. This replaced defaulting straight to the Names page once
there were six generators to choose from instead of one.

A GM's spreadsheet of d100 name tables (grouped into "sets" like
"European", "Non-European", "Fantasy", "Titles & Bynames", "Potions &
Alchemy", "Places" — not every table is a _person_ name, e.g. Places holds
settlement names) is imported once into the app (see
[DATA_MODEL.md](./DATA_MODEL.md)'s `NameTable`). Two ways to use it:

- **The Content & Generators tab's Names page** (`/generators/names`): pick a
  set, then a table within it, choose how many results to roll, and copy
  any result — a standalone browsing/rolling tool, not tied to any
  particular Player/NPC.
- **Inline, wherever a Name is entered**: every Player/NPC create/edit
  screen shares one form (`CombatantFields` — Player/NPC roster, ad-hoc NPC
  forms, the Edit pop-up, per section 4a above) with a 🎲 button next to the
  Name field. Clicking it opens the same set/table picker in a small
  popover; clicking a rolled name fills the Name field directly, without
  navigating away from whatever screen the GM was already on.

Every page under the Content & Generators tab (Names, Encounter, Wild Magic,
Treasure, Combat Thesaurus, Spell Lists) carries a short general disclaimer at the bottom — content is
sourced from a variety of places, credit is given wherever possible, no
ownership is claimed — alongside (not instead of) any page-specific
attribution a source requires (the Encounter Generator's OGL/CC BY-SA
notices in section 12, the Wild Magic page's author credit in section 13,
the Spell Lists page's own OGL/CC BY-SA notices in section 16).

### 12. Encounter Generator

The Content & Generators tab's second page (`/generators/encounter`) generates
a candidate monster list from the imported 5e SRD / Shadowdark monster data
(see [DATA_MODEL.md](./DATA_MODEL.md)'s `MonsterTemplate`) instead of the
GM building an Encounter's roster combatant-by-combatant. The whole
generate/adjust flow (steps 1–3 below) is the `MonsterGeneratorPanel`
component — the same one embedded directly in the Encounter creation/edit
panel (see "2. Create an Encounter" above). A GM generating monsters as
part of building one specific Encounter can do that directly inside that
Encounter's own edit panel and never need this separate page at all; this
standalone page instead suits building a reusable Troop ahead of any
specific Encounter, browsing/creating monster rosters independent of a
particular fight, or (see step 5, **Add to Encounter**, below) generating a
roster before deciding — or without yet knowing — which Encounter it's for.

On this page, **Generate Monsters** is the visually primary section (larger
heading, first/left position) — **Browse Monster List** is the secondary,
manual-pick alternative, demoted to a narrower right-hand column at desktop
widths. (The embedded copy inside an Encounter's own edit panel keeps its
original Browse-then-Generate stacked layout — see "2. Create an Encounter"
above — since that panel already spends its right-hand column on Encounter
Preview.)

1. **Choose a sourcebook** — D&D 5e SRD or Shadowdark. The two use
   different generation controls, since they don't share a difficulty
   concept (see [DATA_MODEL.md](./DATA_MODEL.md) for why):
   - **5e SRD**: Party Level, Party Size, and a Difficulty tier
     (Easy/Medium/Hard/Deadly) — generates a list whose total adjusted XP
     targets that difficulty, using the DMG's own encounter-building math.
   - **Shadowdark**: a Min/Max Level range and a monster count — draws
     randomly from monsters within that range, since Shadowdark's own
     rules don't define a difficulty budget to target.
2. **Review the candidates** — one row per instance (multiples of the same
   monster, e.g. 3 Goblins, show as three separate rows rather than one
   grouped "x3" row), each independently nameable/removable; an "Add a
   monster" picker (`MonsterPickerTable`) lets the GM add anything else from
   that source, generated or not — an expandable table (collapsed by
   default), sortable by Name (A-Z/Z-A) or CR/Level (either direction) via
   clickable column headers, live search-by-typing, and an eye icon per row
   opening that monster's full stat block (`MonsterStatBlockDialog`) before
   deciding to add it. The same component also replaced the plain
   alphabetical dropdown previously used here and in `AddCombatantDialog`'s
   "From Book" step (see section 2) — one picker, every place a GM chooses
   a single monster from either sourcebook.
3. **Name a candidate** — each Candidates row has its own 🎲 button (the
   same Content & Generators picker from section 11), so the GM can roll a
   name for that one specific monster from whichever set/table fits it —
   useful for mixing ancestries/categories across a roster instead of every
   monster coming from the same one. There's no bulk "name everything at
   once" pass; naming is deliberately per-row only. The result is
   individually editable/clearable afterward, and a candidate with no
   personal name just keeps its creature type as its name (e.g. "Goblin"),
   same as any hand-entered NPC. Each Candidates row also has an eye icon
   opening that monster's stat block (`MonsterStatBlockDialog`) — the same
   preview Browse Monster List's picker offers before adding, available
   here too without leaving the list.
4. **Save as Troop** — names the new Troop and creates one library `Npc`
   per candidate (carrying `monsterTemplateId`/`monsterName`, so the
   combatant bubble shows the View Stat Block button and the "Barry -
   Goblin" name split described in section 4a above), all added to that
   Troop. The GM lands on the new Troop's page, ready to pull it into an
   Encounter exactly like any other Troop (see "2. Create an Encounter"
   above).
5. **Add to Encounter** — an alternative to Save as Troop, sitting right
   beside it: pick an existing Encounter from the dropdown (or leave it on
   its default **+ New Encounter**), click **Add to Encounter**, and every
   current Candidate is added as a Combatant on that Encounter in one step
   — no Troop, no separate pull-in. The GM then lands on `/encounters` with
   that Encounter's setup/edit panel already open (pre-filled if it already
   existed), ready to keep building it — rename it, pull in a Party, add
   more combatants — exactly as if they'd built the roster from inside that
   panel to begin with. This is the same "commit straight to an Encounter"
   mechanism the embedded panel uses (the **Add All to Encounter**
   button/each Candidates row's own **Add to Encounter** button — see
   section 2's Monsters/Candidates description above), just reachable from
   this standalone page too, so a GM isn't forced through Save as Troop
   just to get generated monsters into a specific fight.

### 13. Wild Magic Generator

The Content & Generators tab's third page (`/generators/wild-magic`) rolls on
the imported Wild Magic tables (see [DATA_MODEL.md](./DATA_MODEL.md)'s
`WildMagicTable`): a 10,000-entry **Chaos Burst** table of wild-magic mishap
effects, and a companion 100-entry **Burst Duration Condition** table for
Bursts with no stated duration. Same table-picker/roll-count/copy-any-result
mechanic as the Names page (section 11), minus the Set step — there's
currently only one Wild Magic set.

A source credit for the document these tables are drawn from is shown
up front, right under the page's intro (not tucked behind a click, unlike
the monster data's longer formal license notices on the Names page) — this
is someone else's free fan work, not a licensed dataset, and the credit
deserves to be seen. Below the Table picker, a one-line description explains
what the currently-selected table is for — most notably that Burst Duration
Condition isn't rolled on its own; it's consulted only for a Chaos Burst
result with no stated duration, to determine what condition must be met
before that effect ends.

### 14. Treasure Generator

The Content & Generators tab's fourth page (`/generators/treasure`) rolls on
the imported Treasure tables (see [DATA_MODEL.md](./DATA_MODEL.md)'s
`TreasureTable`) — GM-provided lists, unlike Names/Monsters/Wild Magic,
which each come from one external source document. Same table-picker/
roll-count/copy-any-result mechanic as the Wild Magic page, except a rolled
result can show two lines instead of one: **Wondrous Items** and
**Potions** each carry a name **and** a property/effect (e.g. Potions'
"Healing" / "Heal 1d8 HP"), shown and copied together, while **Trinkets**
are just one descriptive line, same as a Name table's results. All three
categories are done.

### 15. Combat Thesaurus

The Content & Generators tab's fifth page (`/generators/combat-thesaurus`)
rolls a flavor verb for narrating a combat action — a quick alternative to
saying "hit" every time — from the imported Combat Thesaurus categories (see
[DATA_MODEL.md](./DATA_MODEL.md)'s `CombatThesaurusTable`): **Blade**,
**Blunt**, **Defense**, **Impairment**, **Magic**, and **Range**, GM-provided
lists like Treasure rather than drawn from one external source document.
Same count/roll/copy-any-result mechanic as the Wild Magic and Treasure
pages, except the category picker is a row of icon buttons (one hand-drawn
icon per category) instead of a `<select>` dropdown, since showing each
category's icon is the point of this picker. All six categories are
populated (29 verbs each); a category with no verbs would show a plain "No
verbs added yet" note in place of results and disable its Roll button, same
as Treasure's incremental-category handling, if a new category were ever
added empty.

### 16. Spell Lists

The Content & Generators tab's sixth page (`/generators/spells`) covers the
imported D&D 5e SRD and Shadowdark spell lists (see
[DATA_MODEL.md](./DATA_MODEL.md)'s `SpellTemplate`) — a **Browse** section
stacked above a **Generate** section. Unlike the Encounter Generator
(Generate is the visually primary section there), **Browse Spell List is
the primary section here** — the richer of the two asks — with Generate
Spells below it.

1. **Choose a sourcebook** — D&D 5e SRD or Shadowdark, same source toggle
   as the Encounter Generator. Switching sources resets the Generate
   panel's level range/class/results, since a 5e cantrip-inclusive
   Level 0–3 range doesn't carry over meaningfully to Shadowdark's 1–5
   spells, or vice versa.
2. **Browse Spell List** — an expandable, searchable table (same
   `MonsterPickerTable`-style collapse-by-default/search-by-typing shape,
   starting expanded here since it's the primary section), always a flat
   list (no grouped sections). **Name** and **Level** are directly
   sortable, ascending/descending, via their own clickable column headers
   — same convention as `MonsterPickerTable`'s Name/CR headers; Shadowdark's
   Level column shows a plain number rather than "Tier N" (see
   [DATA_MODEL.md](./DATA_MODEL.md)'s `SpellTemplate` for why), and for 5e
   a Cantrip sorts as level 0, before Level 1. Shadowdark has no school
   concept at all, so the School column is hidden entirely for that
   source rather than showing an empty/placeholder column. A **Filters**
   row lets the GM check off any number of Class chips and (5e only)
   School chips to narrow the table directly — e.g. checking just
   "Priest" for Shadowdark, or "Bard" + "Cleric" plus "Evocation" for 5e
   (any checked class matches, combined with the checked school(s) — a
   spell needs to satisfy both facets, not just one), with a **Clear
   filters** button once any chip is checked; switching sources clears
   both filters, since a class/school checked for one system is
   meaningless in the other. An eye icon per row opens a read-only spell
   detail dialog (name, level/tier, school, classes, description, and
   source-specific facts like Casting
   Time/Components/Duration/Range/Ritual/At Higher Levels for 5e, or
   Duration/Range for Shadowdark).
3. **Generate Spells** — a Count, a Min/Max Level (labeled "Tier" for
   Shadowdark) range, and a Class picker ("Any Class" or one specific
   class drawn from whatever's actually present in that source's data),
   then Generate rolls that many spells at random from the matching pool
   — e.g. "six D&D spells between Level 1 and 3 for Bards" or "three
   Shadowdark Priest spells that are Level 2". Each result shows its name,
   level label, and classes, with its own eye icon opening the same spell
   detail dialog as Browse.
4. **Credits** — both sources' required attribution (5e SRD's OGL Section
   15 notice; Shadowdark's CC BY-SA 4.0 + Shadowdark RPG Third-Party
   License notices, crediting the Unofficial Shadowdark Spell List by
   Michael Putlack of Night Noon Games — the same compiler as the
   Encounter Generator's Shadowdark monster data), tucked behind a
   `<details>` toggle same as the Encounter Generator page, plus the
   general Content & Generators disclaimer.

## Persistence

GM data (Players, NPCs, Parties, Troops, Encounters, and encounter-in-progress
state like current round/active combatant) needs to survive a page reload
and be resumable later. See [ARCHITECTURE.md](./ARCHITECTURE.md) for how
this is implemented in the current phase, and [ROADMAP.md](./ROADMAP.md)
for when that changes.

## Future: Player account role

Not in the current build phase, but part of the intended direction — a
different concept from the **Player** _character_ library entry described
above, despite the name collision:

- A **Player** _account_ type, separate from GM — a login/permissions
  role, not the reusable character data in the GM's roster.
- Account-holding players can upload/manage their own character's data for
  a GM's Party, rather than the GM entering it on their behalf as today.
- Players get a notification when it becomes their character's turn.

This has real implications for the data model (a Player entity needs an
_owner_ distinct from the GM) and for hosting (notifications imply a
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
