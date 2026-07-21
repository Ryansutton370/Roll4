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

## Phase 2 — Combatant Data + Players/NPCs Library (complete)

Still local-storage only, no backend yet — a feature pass that deepens what
a combatant _is_, and turns Players/NPCs into a reusable, many-to-many
library (instead of Phase 1's PC, owned 1:1 by a single Party) before
Phase 3 moves persistence off the browser. Grew larger in scope than
originally sketched here (a single "Troops tab" bullet) once Players
turned out to need the same many-to-many rework as NPCs, not just NPCs —
see [PRODUCT.md](./PRODUCT.md) for the resulting nav/data-model shape.

- [x] Combatant HP / AC / Notes: optional fields alongside Initiative
      Modifier, settable when creating a Player/NPC and editable live during
      an encounter, with column labels matching Initiative Modifier's.
      Answers the "how much combat data" open question in
      [PRODUCT.md](./PRODUCT.md).
- [x] Players/Parties library rework: `PlayerCharacter` renamed to `Player`
      and its single owning `partyId` dropped in favor of many-to-many
      `Party` membership (a Player can belong to several Parties at once;
      deleting a Party no longer deletes its members). New **Players**
      top-nav tab (Roster + Parties sub-nav).
- [x] NPCs/Troops library: a new reusable NPC library plus `Troop`
      groupings, structurally mirroring Players/Parties. New **NPCs**
      top-nav tab (Roster + Troops sub-nav). Answers the "NPC reuse" open
      question in [PRODUCT.md](./PRODUCT.md) — NPCs can still be created
      ad-hoc within an Encounter exactly as in Phase 1, unchanged; the
      roster is additive, not a replacement for that.
- [x] Encounter-builder rework: pull a whole Troop into an Encounter the
      same way a Party is pulled in today; add a single roster Player/NPC
      without pulling its whole group; from an ad-hoc entry created during
      Encounter setup, opt in to saving it to the roster (and optionally a
      Party/Troop) without duplicating it in the encounter being built.
- [x] Duplicate-name lettering: within a single Encounter, combatants
      sharing a name (trimmed, case-insensitive) get " A"/" B" suffixes,
      lettered in creation order — not initiative order, which re-sorts on
      every re-roll/manual-reorder/hold-return and would relabel far more
      often. See [DATA_MODEL.md](./DATA_MODEL.md) for
      `computeDisplayNames`.
- [x] Timers + mid-encounter "Ready to Join" combatants: a "+" menu next
      to the Previous/Next Turn buttons (run phase only) adds a Timer
      Card (optionally linked to a combatant, so it ticks on their turn
      instead of the round boundary) or a new combatant that lands in a
      "Ready to Join" list until manually joined or auto-folded in at the
      next round boundary. Grew out of scope beyond the original
      4-milestone plan sketched for this phase — see
      [PRODUCT.md](./PRODUCT.md) sections 9–10 and
      [DATA_MODEL.md](./DATA_MODEL.md) for the resulting behavior, which
      supersedes the rougher Backlog sketch this used to be.

## Phase 2.5 — Random Generators (complete)

Still local-storage only. Turns the "NPC name generator" / "Monster manual
database import" / "Encounter generator" Backlog sketches below into real
phase work — see [PRODUCT.md](./PRODUCT.md) for the Random Generators tab
and [DATA_MODEL.md](./DATA_MODEL.md) for `NameTable`.

- [x] Milestone 1 — Name Generator: the GM's "European"/"Non-European"/
      "Fantasy"/"Titles & Bynames"/"Potions & Alchemy"/"Places" spreadsheet
      imported into `public/data/name-tables.json` (see
      `scripts/import-names.cjs`), a new top-level **Random Generators** tab
      to browse/roll any table, and an inline 🎲 popover on every Name field
      (via the shared `CombatantFields`) so a GM never has to leave a
      Player/NPC create/edit screen to name someone.
- [x] Milestone 2 — Monster template data: 322 5e SRD monsters (Open5e's
      OGL-licensed SRD 5.1 data) and 239 Shadowdark monsters (transcribed
      from the "Unofficial Shadowdark Monster List" — a third-party
      compilation of official Core Rulebook stat blocks, CC BY-SA 4.0 —
      after the user provided it in place of retyping the book directly)
      imported as seed `MonsterTemplate` data, plus a Credits section on
      the Random Generators page with both sources' required attribution.
      Data-only, no generator/stat-block UI yet — see
      [DATA_MODEL.md](./DATA_MODEL.md).
- [x] Milestone 3 — Encounter Generator: a second Random Generators page
      (`/generators/encounter`, the tab's Names/Encounter sub-nav landed
      with it) generates a monster list — a real DMG XP-budget algorithm
      for 5e SRD, a level-range random draw for Shadowdark (which has no
      XP-budget system of its own — see [DATA_MODEL.md](./DATA_MODEL.md)),
      lets the GM edit it, bulk-applies generated names, and saves the
      result as a Troop. Pulled forward the `monsterTemplateId`/
      `monsterName` half of Milestone 4's data model (the Eye icon and
      name-display UI itself are still Milestone 4), since "Save as Troop"
      needed somewhere to put the link.
- [x] Milestone 4 — Combatant integration: a "View Stat Block" button in a
      monster-generated combatant's drawer (only shown when
      `monsterTemplateId` is set) opens its full stat block in a read-only
      `MonsterStatBlockDialog`; a combatant with both a personal name and a
      creature type displays as "Barry" with a smaller "- Goblin" subtitle
      instead of just "Goblin" (see `CombatantBubble.monsterSubtitle`).
      Also, per user feedback while reviewing Milestone 3: extracted the
      name-picker popover out of `CombatantFields` into its own
      `NameGeneratorButton` component (just the 🎲 button + popover, no
      input of its own — the parent supplies that and listens for
      `nameSelected`), and added it per-row on the Encounter Generator's
      Roster list alongside the existing bulk "Generate Names" pass, so a
      GM can mix tables/genders across one roster instead of every monster
      coming from the same category.

## Phase 2.6 — More Generators (complete)

Still local-storage only. Opened after Phase 2.5 was already marked
complete, once two more Random Generators tab pages were requested: Wild
Magic and Treasure (Trinkets, Wondrous Items, Potions — all three
categories the GM had in mind).

- [x] **Wild Magic Generator** (`/generators/wild-magic`): rolls on the
      imported Wild Magic tables — a 10,000-entry "Chaos Burst" table (wild
      magic mishap effects) and a companion 100-entry table of conditions
      that can end a Burst with no stated duration, both from _The Net
      Libram of Random Magical Effects v2.00_ by Orrex (see
      [DATA_MODEL.md](./DATA_MODEL.md)'s `WildMagicTable` and
      `scripts/import-wild-magic.cjs`). A third Random Generators sub-nav
      page, structured like the Names page (table picker, roll count, copy
      any result) but its own model/store (`WildMagicStore`) rather than
      folding into `NameTableStore` — see `WildMagicTable`'s doc comment for
      why (the inline 🎲 Name-field popover reads every `NameTableStore` set,
      and a Chaos Burst effect isn't a name).
- [x] **Treasure Generator** (`/generators/treasure`): rolls on
      GM-provided treasure lists (see [DATA_MODEL.md](./DATA_MODEL.md)'s
      `TreasureTable`/`TreasureEntry` and `scripts/import-treasure.cjs`) —
      no external source document to import from, unlike
      Names/Monsters/Wild Magic; the GM pastes each category as plain text
      instead. A fourth Random Generators sub-nav page, structured like the
      Wild Magic page. - [x] Trinkets (200 entries, one line each) - [x] Wondrous Items (83 entries, name + property each) - [x] Potions (100 entries, name + effect each)
- [x] Monster data Credits moved from the Names page to the Encounter
      Generator page — Milestone 2 (above) put it on Names simply because
      that was the only generator page that existed yet at the time; now
      that Encounter Generator exists, that's where the data it's
      attribution for is actually generated from.
- [x] `GeneratorDisclaimer` (`src/app/shared/generator-disclaimer/`): a
      short, general "sourced from a variety of places, credit given where
      possible, no ownership claimed" disclaimer shown on all four
      generator pages, alongside (not replacing) each page's own specific
      attribution — the Encounter Generator's OGL/CC BY-SA notices, the
      Wild Magic page's author credit.

## Phase 2.7 — Add Combatant "From Book" (complete)

Still local-storage only. `AddCombatantDialog`'s three-way choice (Existing
NPC / Existing Player / Create New) gains a fourth peer, **From Book** —
pick D&D 5e SRD or Shadowdark (same two sources as the Encounter Generator),
then a monster from that source, and it prefills the ad-hoc create form
(name/AC/Max HP/Initiative Modifier) instead of the GM re-typing a known
monster's stats by hand. The GM can still rename it before adding — typed or
via the 🎲 name generator, same as any ad-hoc entry — since a personal name
(e.g. "Barry") is independent of the creature type it's built from. See
[PRODUCT.md](./PRODUCT.md) section 2 and [DATA_MODEL.md](./DATA_MODEL.md)'s
`addAdHocCombatant`/"Saving an ad-hoc combatant to the roster" notes.

- [x] `AddCombatantDialog`'s `'book'` step (source toggle + a sorted,
      searchable `<select>` of `MonsterStore.templatesForSource`) —
      picking a template jumps straight into the existing `'new'` step,
      prefilled and with the NPC/Player radio hidden (a monster template
      is always an NPC). `NewCombatantSubmitted.fields` gained
      `monsterTemplateId`/`monsterName`.
- [x] Two real gaps found and fixed along the way, both pre-existing (not
      new bugs introduced by this feature, just never reachable before it):
      `EncounterStore.addAdHocCombatant`'s public `fields` param didn't
      expose `monsterTemplateId`/`monsterName`, even though the private
      `buildCombatant` helper it calls already supported them; and "Save to
      Roster" (`EncounterDetail`/`EncounterList`'s `confirmSaveToRoster`)
      hand-picked 5 fields onto the new `Npc` and never carried those two
      over, which would have silently dropped a From Book combatant's
      stat-block link the moment it was saved to the roster.
- [x] A **View Stat Block** icon on the collapsed bubble row itself (not
      just the drawer) for any monster-templated combatant — same
      `viewStatBlockRequested` output the existing drawer button already
      used. First verified broken, then fixed twice: the `@container`
      collapse threshold was picked without checking real numbers (an
      unpressured bubble's natural width sits around 40-42rem, so the
      initial 40rem threshold hid the icon under normal conditions —
      lowered to 37rem); and the button was originally nested inside
      `.combatant-name`, whose `overflow: hidden` / `text-overflow:
  ellipsis` / `white-space: nowrap` makes a clickable child unreliable
      to hit-test (verified live: real clicks landed on the sibling
      `.monster-subtitle` text instead) — moved out to be a sibling within
      `.combatant-row`, same as every other interactive stat in the bubble.

## Phase 2.8 — Encounter Builder Consolidation (complete)

Still local-storage only. Opened after two related pain points surfaced on
the Encounters screen: the saved-Encounters list sat above an
always-visible create form (no room to breathe once a GM has several
Encounters), and generating monsters for a _specific_ new Encounter meant
a detour through the standalone Encounter Generator page and a Troop —
there was no way to build parties/troops/generated-monsters/ad-hoc
combatants for one Encounter in one place. Also folded in a longstanding
usability gap in the monster picker itself: both `AddCombatantDialog`'s
"From Book" step and the Encounter Generator's "Add a monster" control
were a plain `<select>` of (in 5e SRD's case) 300+ names with no way to
sort by CR/Level, search, or preview a stat block before picking.

- [x] `MonsterPickerTable` (`src/app/shared/monster-picker-table/`) — a
      new shared, expandable, sortable (Name A-Z/Z-A, CR/Level either
      direction via clickable column headers), searchable table with a
      per-row eye icon (`MonsterStatBlockDialog`, embedded) and Add
      button, replacing the plain `<select>` in **both** existing call
      sites (`AddCombatantDialog`'s book step, expanded by default there
      since it's the whole step's content; the Encounter Generator's "Add
      a monster") — see [PRODUCT.md](./PRODUCT.md) sections 2 and 12.
      Also centralized the previously 3x-duplicated (and, in one spot,
      null-guard-missing) "CR X"/"LV X" label into
      `monsterDifficultyLabel` (`monster-template.model.ts`) — see
      [DATA_MODEL.md](./DATA_MODEL.md)'s `MonsterTemplate` note.
- [x] `MonsterGeneratorPanel` (`src/app/shared/monster-generator-panel/`)
      — the Encounter Generator page's entire generate/adjust-candidates/
      apply-names flow extracted into a shared component (two-way
      `draft` model, `draftEdited` output for the standalone page's
      "Saved!" banner), so the _same_ generation UI can be embedded
      directly inside the Encounter List's create/edit panel — see
      [ARCHITECTURE.md](./ARCHITECTURE.md)'s "Splitting shared UI into
      components" for the extraction rationale and the `display:
  contents` gotcha it hit a second/third time.
- [x] `EncounterList` rework: saved Encounters now render below an
      expand/collapse **+ Create Encounter** panel, the same panel
      Edit (pencil icon) opens too — one UI for both, not two. The panel
      gained an embedded "Generate Monsters" section (`MonsterGeneratorPanel`,
      live-synced to real Combatants — see the live-sync bullet below) and
      now allows **Add Combatant** before the Encounter has even been
      saved yet, not just in Edit as before. See [PRODUCT.md](./PRODUCT.md)
      section 2 for the GM-facing behavior and [DATA_MODEL.md](./DATA_MODEL.md)
      for the lazy-materialization mechanics (`ensureEncounterCreated`): a
      brand new Encounter isn't created in the store until the GM actually
      adds something real, so an abandoned "+ Create Encounter" click never
      leaves a stub behind, and a plain create (name + Party/Troop, no
      early commits) behaves exactly as it always has — creates and jumps
      straight into the Encounter's setup/run screen.
- [x] A real, pre-existing bug fixed along the way (found while designing
      the above, not introduced by it): `EncounterList.submitEncounterForm`'s
      blank-name guard ran before branching on edit-vs-create, which would
      have made the bottom button silently no-op once an Encounter could
      exist with no name typed yet (materialized via the generator or Add
      Combatant before the name field was ever touched) — restructured so
      the guard only blocks the genuinely-fresh-create path.
- [x] Follow-on polish pass, after using the above in practice:
  - [x] `ToastService`/`ToastContainer` (`src/app/shared/toast/`) — a
        small global confirmation-toast system, mounted once in `app.html`
        so it's visible regardless of scroll position. Picking a monster
        from any `MonsterPickerTable` inside `MonsterGeneratorPanel`
        (Browse Monster List, on both the standalone Encounter Generator
        page and embedded in Encounter List) shows a green "Added X" toast
        — the one action whose result wasn't otherwise visible without
        scrolling.
  - [x] `EncounterList`'s embedded generator dropped the manual **+ Add
        These to Encounter** button entirely: a constructor `effect()`
        live-syncs `generatorDraft` to real Combatants as the GM builds it
        (Generate, Browse Monster List's Add, the +/- count adjusters, and
        Roster renames/removes all flow through the same signal), reusing
        `ensureEncounterCreated()` for materialization same as any other
        first commit. `EncounterStore.addAdHocCombatant` now returns the
        created `Combatant` so the effect can track/update/remove it again
        by id without a separate lookup.
  - [x] `MonsterGeneratorPanel` reordered so **Browse Monster List** is
        always visible (previously nested inside the Candidates section,
        only reachable after clicking Generate once) and sits above
        **Generate Monsters**, each its own headed section — on both hosts,
        since they share the component. Credits/Licenses + the Random
        Generators disclaimer moved out into a new `MonsterCredits`
        component (`src/app/shared/monster-credits/`), a `<footer>` each
        host places at its own true page bottom, rather than wherever
        `MonsterGeneratorPanel` happened to sit in the page.
  - [x] `EncounterList` gained a "Saved Encounters" heading and a
        two-column layout at wider viewports (New Encounter panel left,
        Saved Encounters right — `main:has(.encounters-layout)` widens the
        page the same way `main:has(.hold-panel)` already does for the
        run-phase Hold Action column), stacking to one column below 900px.
  - [x] A real CSS bug fixed along the way: `MonsterPickerTable`'s header
        actions cell (`th.col-actions`) inherited a `display: flex` rule
        meant only for the body cells, computing a box that didn't match
        its sticky background — left a stray white rectangle in the
        header. Scoped the rule to `td.col-actions`. Also added always-
        visible sort-direction indicators (a dim `⇅` on the inactive
        column, not just an arrow once a column is already the active
        sort) to both the Name and CR/Level headers.
  - [x] `NPCs → Roster` gained its own **Browse Monster List** section
        (between the roster and the hand-entry create form) — Players has
        no equivalent, since a monster template is always an NPC. Picking
        one saves it straight into the roster (`NpcStore.createNpc` with
        `monsterTemplateId`/`monsterName` set) with a confirmation toast,
        no separate submit step — the GM can still rename it afterward via
        the roster row's already-inline-editable name field, same as any
        hand-entered NPC. See [PRODUCT.md](./PRODUCT.md) section 1.

## Phase 3 — GM Accounts + Real Persistence

- [ ] Choose a backend (see [ARCHITECTURE.md](./ARCHITECTURE.md) — deferred
      on purpose until this phase).
- [ ] GM authentication/accounts.
- [ ] Migrate Players/NPCs/Parties/Troops/Encounters from browser storage to
      the backend, scoped per-GM.
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

- **Name generators beyond individual PCs/NPCs** — extend the Random
  Generators tab/inline-popover pattern (see Phase 2.5) to other
  name-needing spots in the flow, e.g. Party names, Troop names, or a
  quick "suggest a name" for the Encounter itself.
- **Custom themes** — let the GM pick an overall look (color palette, font,
  general aesthetic) instead of the single fixed style from the Phase 1.5
  design-token pass, e.g. a classic-fantasy theme, a retro theme, a sci-fi
  theme. Likely builds on the existing design tokens (see
  [ARCHITECTURE.md](./ARCHITECTURE.md)) by making them swappable per-theme
  rather than introducing a separate styling system.

## Explicitly not planned yet

Keep this section so we don't accidentally scope-creep during Phase 1: dice
rolling beyond initiative (attack/damage rolls), mobile app / offline PWA
packaging.
