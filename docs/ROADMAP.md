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
        **Superseded in Phase 2.9** — a real "not yet in the Encounter"
        Candidates state (needed for the new Encounter Preview panel) isn't
        representable by a live-sync effect, so this went back to an
        explicit commit step. See Phase 2.9 below.
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

## Phase 2.9 — New Encounter Redesign (complete)

Still local-storage only. Opened once the New Encounter builder had grown
enough sections (Party/Troop pulls, an unheaded source toggle, Browse
Monster List, Generate Monsters, a flat always-editable Combatants list)
that it read as a pile of features rather than one coherent flow, and the
Combatants list looked nothing like the run-phase screen a GM spends the
rest of their time on.

- [x] `MonsterGeneratorPanel` gained a heading + short explanation wrapping
      the source toggle/Browse Monster List/Generate Monsters ("Monsters"),
      and each Roster row gained an eye icon (`MonsterStatBlockDialog`,
      same pattern as `MonsterPickerTable`'s) — on both hosts, since they
      share the component.
- [x] Reverted the Phase 2.8 live-sync effect (see that phase's note above)
      in favor of an explicit commit step: two new opt-in
      inputs/outputs (`showEncounterCommitActions`/`encounterName`,
      `addAllToEncounter`/`addOneToEncounter`) render an **Add All to
      Encounter** button plus each Roster row's individual **Add to
      Encounter** button, gated off (and so invisible/inert) on the
      standalone Encounter Generator page. Committing a row plays a
      flash-green/shrink CSS animation before it's actually removed from
      `draft`, `(animationend)`-driven same as `combatant-pop-out`/
      `finishPopOut` in `encounter-detail.css`/`.ts` — see
      [ARCHITECTURE.md](./ARCHITECTURE.md)'s fifth precedent.
- [x] New `EncounterPreviewPanel` (`src/app/shared/encounter-preview-panel/`)
      replaces the old flat, always-editable Combatants list — a live
      preview of the Encounter being built using the exact same
      `CombatantBubble` UI as the run-phase screen, in the same right-hand
      column "Saved Encounters" used to occupy (swapped in while the
      builder panel is open, rather than shown side by side with it).
      `CombatantBubble` gained a `previewMode` input for this third usage
      context — see [ARCHITECTURE.md](./ARCHITECTURE.md)'s seventh/eighth
      precedents for both components' design.
- [x] Docs updated: [PRODUCT.md](./PRODUCT.md) section 2 rewritten for the
      new Monsters/Candidates/Encounter Preview shape;
      [ARCHITECTURE.md](./ARCHITECTURE.md)'s live-sync rationale replaced
      with why an explicit commit step came back.
- [x] Follow-on polish pass, after using the above in practice:
  - [x] Party/Troop checkboxes apply immediately (materializing the
        Encounter and pulling members in on the spot, via
        `setEncounterParties`/`setEncounterTroops`) instead of staying
        staged until a submit that no longer exists — see the next bullet.
  - [x] Removed the **Update Encounter**/Create Encounter submit button
        entirely — every field in the panel (name, Party/Troop, Add
        Combatant, Candidates commits) already applies immediately, so
        there was nothing left for a submit to do. A single **Done** button
        just closes the panel back onto Saved Encounters. Typing a name
        after materialization renames the real Encounter live too (a blank
        name doesn't blank the stored one, same "don't flicker mid-edit"
        reasoning `encounterCommitPhrase` already used for the doubled-word
        case).
  - [x] Browse Monster List's Add, embedded in the builder specifically,
        now adds straight to the real Encounter instead of staging a
        Candidate — `MonsterGeneratorPanel.addTemplate()` branches on
        `showEncounterCommitActions()` (unaffected on the standalone
        Encounter Generator page, which has no Encounter to add to and
        keeps the Candidates-staging behavior).
  - [x] Candidates and Roster merged into one **Candidates** section (the
        grouped "x3" count-adjuster view is gone — Generate's output is
        per-instance rows only, on both hosts, matching what Roster already
        did) — see [ARCHITECTURE.md](./ARCHITECTURE.md) for why this is a
        shared-component change, not embedded-builder-only.
  - [x] `CombatantBubble` gained a `[drawer-extra-action]` content-projection
        slot so `EncounterPreviewPanel` could move "Save to Roster" into the
        expansion drawer (positioned above Delete) instead of a sibling row
        below the bubble — see [ARCHITECTURE.md](./ARCHITECTURE.md)'s ninth
        precedent.
  - [x] Encounter Preview's Initiative badge shows the signed Initiative
        Modifier (previewMode only) instead of "N/A", since a modifier is
        meaningful pre-Roll and "N/A" wasn't.
  - [x] `EditCombatantDialog` widened (28rem → 40rem) — `CombatantFields`
        assumes roughly a 700px column to lay its 5 fields out on one line
        (see its own CSS comment), and 28rem was well short of that.
- [x] Second follow-on polish pass:
  - [x] Removed the bulk "Apply Names" pass from `MonsterGeneratorPanel`
        entirely (Set/Table dropdowns + "Generate Names") — naming a
        Candidate is per-row only now (the 🎲 next to each one), on both
        hosts. `NameTableStore` is no longer injected by
        `MonsterGeneratorPanel` itself; its data load is now triggered
        lazily, the first time a Candidates row's `NameGeneratorButton`
        actually renders.
  - [x] "Add All to Encounter" moved from beside the "Candidates" heading to
        below the candidate list, after every row.
  - [x] `EncounterList`'s "+ Add Combatant" renamed to **"+ Add Individual
        Combatant"** and moved above the Monsters section (a peer to the
        Party/Troop pulls and Monsters, not something tucked below them),
        with a plain `<hr class="panel-divider">` between each of the
        panel's sections (Party/Troop, Add Individual Combatant, Monsters,
        Done) for a subtle visual break.
  - [x] `EncounterPreviewPanel`'s "Save to Roster" button relabeled
        **"Save to Players"**/**"Save to NPCs"** (matching `combatant.type`)
        with a save/floppy-disk icon, and repositioned above Delete in the
        drawer via the `[drawer-extra-action]` slot moving inside
        `.drawer-actions` itself (previously a separate footer row below
        both `.drawer-checkboxes` and `.drawer-actions`) — see
        [ARCHITECTURE.md](./ARCHITECTURE.md)'s ninth precedent.
  - [x] Verified (not a bug after all): Encounter Preview's AC/HP/Notes/View
        Stat Block/Initiative columns already line up pixel-for-pixel
        across every bubble regardless of which fields any one combatant
        has set, via the same fixed-width `.stat` columns
        (`combatant-bubble.css`) the run-phase screen has always used —
        confirmed live with a mix of a Player (no AC/HP/stat-block) and
        NPCs (full stats) in the same list.
- [x] Third follow-on polish pass: `EncounterDetail`'s pre-Roll setup-phase
      Combatants list (`/encounters/:id`, before the first Roll) replaced
      its own hand-duplicated combatant row (read-only AC/HP/Notes/View
      Stat Block markup, a bare Initiative Modifier `<input>`, no Edit Info)
      with the same `<app-combatant-bubble [previewMode]="true">` usage
      `EncounterPreviewPanel` uses — a GM now sees the identical bubble,
      column layout, and drawer (Edit Info, View Stat Block, Save to
      Players/Save to NPCs, Mark Absent/Delete) whether they're still
      building the Encounter or have just opened it to run — see
      [ARCHITECTURE.md](./ARCHITECTURE.md)'s tenth precedent. Deleted a
      large block of now-dead duplicated CSS/TS
      (`.setup-list-header`/`.modifier-input`/`.stat`/`.badge-icon`/
      `.icon-badge-btn`/etc., `setCombatantModifier`/`hasNotes`/
      `setupHpPercent`/`setupHpHue`) in the process. **Roll Initiative**
      also moved from the bottom of the setup section to the top (above the
      Combatants list) and got noticeably bigger/bolder, since it's the one
      thing a GM opening an unstarted Encounter is ultimately there to do.

## Phase 2.10 — Encounter Generator → Encounters bridge + layout (complete)

Still local-storage only. Opened after two requests on the standalone
Encounter Generator page (`/generators/encounter`): generated monsters could
only reach a real Encounter via a Save as Troop detour (Troop → `/encounters`
→ pull it in), and Generate Monsters (the primary "build me a roster"
action) read as equal-or-lower priority than Browse Monster List (a
secondary manual picker) — same heading size, Browse listed first.

- [x] **Add to Encounter**: a new action beside Save as Troop — a dropdown
      of existing Encounters (plus a default "+ New Encounter") and an Add
      to Encounter button that adds every Candidate as a Combatant on the
      picked (or newly created) Encounter in one step, then navigates to
      `/encounters?edit=<id>` so the GM lands with that Encounter's
      setup/edit panel already open. `EncounterList` gained a new
      `openForEncounterId` input (aliased to the `edit` query param via the
      already-configured `withComponentInputBinding()` in `app.config.ts` —
      the same router-input mechanism used elsewhere for path params, here
      applied to a query param instead) and a constructor `effect()` that
      opens the panel for that Encounter, then clears the query param so a
      refresh/back-navigation doesn't re-trigger it.
- [x] `combatantFieldsFromDraft` (`monster-generator-panel.ts`) — the
      "`DraftCombatant` → ad-hoc combatant fields" mapping was independently
      duplicated in `EncounterGenerator.saveAsTroop` and
      `EncounterList.addDraftAsCombatant`; pulled out once Add to Encounter
      needed the same mapping a third time.
- [x] `MonsterGeneratorPanel` gained an opt-in `emphasizeGenerate` input
      (true only on the standalone Encounter Generator page): Generate
      Monsters gets a bigger heading and renders first/left; Browse Monster
      List moves to a plain-size second/right column at desktop widths
      (`main:has(.emphasize-generate)` widens the page past its normal
      700px cap the same way `.hold-panel`/`.encounters-layout` already do).
      DOM order (not just visual order) swaps too, via each section living
      behind an `<ng-template>` and being stamped out via `ngTemplateOutlet`
      in whichever order the flag picks — keeps keyboard tab order matching
      what's visually first, which a CSS-only `order` reshuffle wouldn't.
      `EncounterList`'s embedded copy leaves the input unset, keeping its
      original Browse-then-Generate stacked layout (that panel's own
      right-hand column is already spent on Encounter Preview).

## Phase 2.11 — Combat Thesaurus Generator (complete)

Still local-storage only. A fifth Random Generators tab page, requested
alongside Wild Magic/Treasure back in Phase 2.6 but not built until now.

- [x] **Combat Thesaurus Generator** (`/generators/combat-thesaurus`): rolls
      a flavor verb for narrating a combat action, across six GM-provided
      categories — Blade, Blunt, Defense, Impairment, Magic, Range (see
      [DATA_MODEL.md](./DATA_MODEL.md)'s `CombatThesaurusTable`) — same
      no-external-source-document situation as Treasure, so
      `combat-thesaurus.json` has been hand-edited from the start with no
      import script. Same count/roll/copy-any-result mechanic as the Wild
      Magic/Treasure pages, but the category picker is a row of hand-drawn
      icon buttons (one SVG per category) instead of a `<select>`, since
      showing each category's icon was the point of the request. Range
      (a bullseye/target icon) was added after the other five, once the GM
      wanted a sixth category for thrown/ranged attacks.
- [x] Populate each category's `entries` — GM-provided, 29 verbs each for
      Blade, Blunt, Defense, Impairment, Magic, and Range.
- [x] Icon iteration: Impairment's icon changed twice after the initial two
      overlapping circles read as an infinity symbol rather than
      "impairment" — a wavy-line tornado tried next read as a wifi/signal
      icon at button size, so it landed on a solid blood drop instead.

## Phase 2.12 — Combat Thesaurus in the run-phase "+" menu (complete)

Still local-storage only. The standalone Combat Thesaurus page (Phase 2.11)
meant leaving the Encounter screen mid-combat to roll a flavor verb —
opened once the GM wanted it reachable from the run-phase "+" menu instead.

- [x] `CombatThesaurusPicker` (`src/app/shared/combat-thesaurus-picker/`)
      extracted from `CombatThesaurusGenerator`'s entire template (the
      category-row/count/roll/copy-any-result UI) — see
      [ARCHITECTURE.md](./ARCHITECTURE.md)'s eleventh precedent.
      `CombatThesaurusGenerator` now just wraps it with page chrome
      (`<h1>`, intro, `GeneratorDisclaimer`).
- [x] `CombatThesaurusDialog` (`src/app/shared/combat-thesaurus-dialog/`):
      a native `<dialog>` embedding `CombatThesaurusPicker`, opened via
      `EncounterDetail.openCombatThesaurusDialog()` — same
      open()/close()/onOverlayClick shape as `MonsterStatBlockDialog`
      (dismissed via × or clicking outside it).
- [x] The run-phase "+" menu (`EncounterDetail`'s `turn-controls`) gained a
      third option, **Combat Thesaurus**, alongside **Add Timer**/**Add
      Combatant** — each now with its own icon (a plus-sign glyph for the
      first two, a small open-book glyph for Combat Thesaurus). The
      trigger button itself changed from a literal **+** to a
      vertical-ellipsis (⋮) icon, since a single "+" no longer described a
      menu with a non-"add" option in it.

## Phase 2.13 — Spell Lists (complete)

A sixth Content & Generators page, covering both D&D 5e SRD and Shadowdark
spells the same way Monsters covers both systems' creatures — unlike
Monsters (where the Shadowdark half followed the 5e half by a separate
phase, once the GM supplied the spreadsheet), both sources shipped
together here since the GM had the Shadowdark spell spreadsheet ready from
the start.

- [x] `SpellTemplate` (`src/app/models/spell-template.model.ts`) and
      `SpellStore` (`src/app/services/spell-store.ts`) — same
      `toSignal`-over-`HttpClient` shape as `MonsterStore`, reading
      `public/data/spells-5e-srd.json` / `spells-shadowdark.json`. See
      [DATA_MODEL.md](./DATA_MODEL.md)'s `SpellTemplate` entity.
- [x] `scripts/import-spells-5e-srd.cjs` — pulled 319 spells from Open5e's
      API (`document__slug=wotc-srd`), same shape as
      `import-monsters-5e-srd.cjs`.
- [x] `scripts/import-spells-shadowdark.cjs` — 85 spells from the GM's
      `.claude/Unofficial Shadowdark Spell List.xlsx` (by the same
      compiler as the Shadowdark Monster Database), same shape as
      `import-monsters-shadowdark.cjs`. `public/data/spells-shadowdark.LICENSE.txt`
      added alongside, same CC BY-SA ShareAlike sidecar as the monster data.
- [x] `SpellPickerTable` (`src/app/shared/spell-picker-table/`) — a
      search table like `MonsterPickerTable`, with Name and Level directly
      sortable ascending/descending via clickable column headers (same
      convention as `MonsterPickerTable`'s Name/CR headers; a 5e Cantrip's
      `level` is `0`, so it sorts first ascending with no special-casing).
      Also added **Class**/**School** filter chips (any number checked per
      facet, OR'd together; the two facets AND with each other) so a GM
      can jump straight to e.g. just Shadowdark's Priest spells, or 5e's
      Bard+Cleric Evocation spells. An earlier **Arrange by** control that
      additionally grouped the table into Class/School sections was tried
      and then removed — once the Class/School filter chips covered the
      same "just show me X" need more directly, a separate grouped-browse
      view didn't earn its keep alongside them.
- [x] `SpellDetailDialog` (`src/app/shared/spell-detail-dialog/`) — a
      read-only reference popup, same native `<dialog>`/`openFor()` shape
      as `MonsterStatBlockDialog`.
- [x] `SpellCredits` (`src/app/shared/spell-credits/`) — 5e SRD OGL Section
      15 notice plus real Shadowdark CC BY-SA/Third-Party License credit
      text (not a placeholder), same structure as `MonsterCredits`.
- [x] `SpellListsGenerator` page (`/generators/spells`) — Browse Spell
      List is the primary section (an explicit layout choice, unlike the
      Encounter Generator's Generate-primary layout), stacked above
      Generate Spells (Count, Min/Max Level, Class).

## Phase 2.14 — Content & Generators landing page (complete)

Small UX follow-up: with six generator pages now, defaulting the whole
Content & Generators tab straight to the Names page (a holdover from when
Names was the only generator) no longer made sense.

- [x] `GeneratorsHome` (`src/app/pages/generators-home/`) — a hub page at
      `/generators`, a card per generator linking to its own sub-page,
      reusing the `.quick-nav`/`.quick-nav-card` grid look Home's own
      landing page introduced (promoted from `home.css` into `styles.css`
      once a second page needed it).
- [x] Names moved off the bare `/generators` path onto its own
      `/generators/names`, freeing `''` for `GeneratorsHome`.
- [x] Fixed the Generators sub-nav wrapping to two lines on its active tab
      at some viewport widths (most visible on "Spell Lists", the newest/
      widest addition) — `.section-nav`/`.section-nav a` (`styles.css`)
      gained `overflow-x: auto`/`white-space: nowrap` so the row scrolls
      horizontally instead of squeezing a tab's text narrower than it fits
      on one line.

## Phase 3 — Firebase/Firestore Backend + GM Accounts (complete)

Chose a backend (Firebase — Firestore + Firebase Auth, see
[ARCHITECTURE.md](./ARCHITECTURE.md)'s Persistence section for the full
rationale and mechanics) and migrated every GM-owned entity off
`localStorage`. Broken into sub-milestones the way Phase 2 grew 2.5–2.12,
given the size.

- [x] **3.1 — Firebase project + SDK + environment config.** `npm install
firebase` (the raw modular SDK, not `@angular/fire` — see
      [ARCHITECTURE.md](./ARCHITECTURE.md) for why), `src/environments/`
      (the Firebase web config — safe to commit, not a secret),
      `src/app/firebase.ts` (the one shared `initializeApp`/`getFirestore`/
      `getAuth` call), `firestore.rules`/`firestore.indexes.json`/
      `firebase.json`/`.firebaserc` at the repo root.
- [x] **3.2 — `AuthService` + login page + route guards.** Email/password
      and Google sign-in (`src/app/services/auth-service.ts`), a new
      `/login` page (`src/app/pages/login/`), and `authGuard`/
      `redirectIfAuthedGuard` (`src/app/guards/auth-guard.ts`) gating the
      whole route tree behind a signed-in GM via a pathless parent route —
      every existing URL unchanged. Verified live: sign-up/sign-in,
      session persists across a fresh session, sign-out actually navigates
      away (a real bug found and fixed — route guards only run on
      navigation, not reactively, so the nav bar disappearing on sign-out
      didn't used to also leave the page), and an already-signed-in GM
      visiting `/login` bounces back to the landing page (originally
      `/players` at this point in the phase — see 3.8 below, which moved
      the root route to a real landing page instead of an immediate
      redirect).
- [x] **3.3 — `PartyStore` → Firestore** (the template every other store
      followed). `Party`/`Player` gained a real `ownerId` field; the store
      itself flipped from "mutate the signal, mirror it to `localStorage`
      via an `effect()`" to "write Firestore directly, let an
      `onSnapshot` listener be the only thing that ever sets the signal" —
      see [ARCHITECTURE.md](./ARCHITECTURE.md) for the full pattern.
      Verified live against the real backend: create/persist across
      sessions, and a second GM account seeing an empty roster (proving
      Firestore-security-rule scoping, not just browser isolation).
- [x] **3.4 — `NpcStore` → Firestore.** Structurally identical to 3.3.
- [x] **3.5 — `EncounterStore` → Firestore** — the largest, most
      cross-referential store (`Encounter`/`Combatant`/`Timer` together).
      Methods that touch more than one collection in what has to be one
      atomic operation (`commitOrder`, `createEncounter`,
      `setEncounterParties`/`setEncounterTroops`, `removeCombatant`,
      `deleteEncounter`) now use a Firestore `writeBatch`. All of
      `EncounterStore`'s existing business-logic test coverage (rolling,
      advancing turns, Hold Action, Ready to Join, Timers) was kept
      passing unchanged against the real service, via a new synchronous
      in-memory `'firebase/firestore'` test double
      (`src/app/services/testing/fake-firestore.ts`) rather than losing
      that coverage — see [ARCHITECTURE.md](./ARCHITECTURE.md)'s Testing
      note. Verified live: a full multi-round encounter (roll, advance
      turns, a Timer ticking at the round boundary) surviving across
      completely fresh sessions.
- [x] **3.6 — Docs pass** (this entry) — `ARCHITECTURE.md`'s Persistence
      section rewritten for the Firebase model, `DATA_MODEL.md`'s
      `ownerId`/`User` notes updated past-tense (and a real naming
      collision fixed along the way: an earlier draft of `DATA_MODEL.md`
      used `Player.ownerId` for a future Player-role link, which would
      have collided with the GM-ownership `ownerId` every entity now
      actually has — the future link needs its own field name when
      Phase 4 gets there).
- [x] **3.7 — Firebase Hosting deploy.** `firebase.json` gained a `hosting`
      block (`public: dist/Roll4/browser`, a catch-all rewrite to
      `index.html` for the Angular router) so the app is reachable live, not
      just runnable locally — see [ARCHITECTURE.md](./ARCHITECTURE.md)'s new
      Hosting section. Deployed via `npx firebase-tools deploy --only
      hosting`; the Firebase CLI isn't a project dependency, just invoked ad
      hoc. A second, friendlier-named Hosting site (`roll4`, alongside the
      project's auto-created `roll4-bddd2`) makes the real shareable URL
      **https://roll4.web.app** rather than the project-ID-derived default.
- [x] **3.8 — Public landing page.** The root route (`/`) changed from an
      immediate `redirectTo: 'players'` (guarded, so a signed-out visitor
      just bounced straight to `/login`) to a real `Home` page
      (`src/app/pages/home/`) reachable either signed-in or signed-out —
      the one route in `app.routes.ts` with no `authGuard`. Content
      branches on `AuthService.uid()` inside the one component rather than
      splitting into two routes: a signed-out visitor gets a "Sign In"
      prompt linking to `/login` in place of the quick-nav links (Players/
      NPCs/Encounters/Content & Generators — renamed in 3.10 below) a
      signed-in GM sees; a title, an
      About section (why Roll4 exists, and Chaotic Initiative — the
      re-roll-every-round house rule — as the concrete example), and a
      scrollable Upcoming Features list are shown either way.
      `redirectIfAuthedGuard` and both `Login` sign-in paths now send an
      already-signed-in GM to `/` instead of straight to `/players`.
- [x] **3.9 — "Continue Without Signing In" guest mode.** `AuthService`
      gained `continueAsGuest()` (`signInAnonymously`, Firebase Auth's
      built-in anonymous-user flow) and an `isGuest` computed signal
      (`user()?.isAnonymous`). Deliberately _not_ a second, separate
      local-storage code path: an anonymous Firebase user is still a real
      `request.auth.uid`, so `firestore.rules`' `isOwner()` check, every
      `*Store`'s `ownerId` scoping, and `authGuard` all treat a guest
      exactly like a signed-in GM with zero changes of their own — see
      [ARCHITECTURE.md](./ARCHITECTURE.md)'s Persistence section. What's
      actually different is discoverability, not storage mechanics: an
      anonymous uid has no email/password/Google identity behind it, so
      it's only ever reachable again from whichever browser started the
      session (Firebase's default `browserLocalPersistence` keeps it across
      a reload, but clearing that browser's storage, or opening the app
      elsewhere, has no way back in) — `Home`'s and `Login`'s sign-in
      prompts both carry a "Continue Without Signing In" button next to
      Sign In with an explicit warning to that effect, and a standing
      `.guest-banner` in `app.html` (visible only while `isGuest()`) repeats
      it with a "Sign up to save it permanently" link for the rest of the
      session. `redirectIfAuthedGuard` treats a guest as _not_ already
      signed in (`user && !user.isAnonymous`), so a guest can still reach
      `/login` to create a real account — signing up there starts a
      genuinely separate account rather than upgrading the guest session
      (no `linkWithCredential` yet), which the warning copy calls out
      rather than implying an upgrade path that doesn't exist.
      Required one one-time Firebase Console setting alongside the code:
      `signInAnonymously` fails with `ADMIN_ONLY_OPERATION` until the
      Anonymous sign-in provider is turned on for the project (Firebase
      Console → Authentication → Sign-in method → Anonymous → Enable) — not
      something the app or its deploy config can flip on its own. Verified
      live, after enabling it: `/` → Continue Without Signing In → quick-nav
      swaps in and the guest banner appears; created a real Player as a
      guest and confirmed it survives a full page reload (Firestore, not
      just an in-memory signal); confirmed a guest can still reach `/login`
      via the banner's "Sign up to save it permanently" link rather than
      being bounced back by `redirectIfAuthedGuard`.
  - [x] Follow-on: the header's **Log Out** button (`app.html`) is hidden
        for a guest (`@if (!authService.isGuest())`) — there's no account to
        log out _of_; `signOutUser()` would just drop the anonymous session
        (and its Firestore data) with no way back in. Verified live: hidden
        for a guest, still present for a real signed-in GM.
- [x] **3.10 — "Random Generators" tab renamed to "Content & Generators."**
      Cosmetic rename only, no route/data change — `/generators` and every
      child path are unchanged. Updated everywhere the old name was
      user-visible: the header nav link and `Home`'s quick-nav card
      (`app.html`/`home.html`), the Names page's own `<h1>` (it's the
      default child route under `/generators` and still carries the
      top-level tab's name as its heading, a holdover from Milestone 1
      shipping alone at that URL before the sub-nav shell existed — see
      Phase 2.5), and `GeneratorDisclaimer`'s wording (reworded to "Content
      & Generators material is sourced from..." rather than the
      literal old text, which would have doubled up as "Content &
      Generators content"). Doc-comment references to "the Random
      Generators tab" across the five generator pages/shared pickers, and
      the current-state descriptions in `PRODUCT.md`/`ARCHITECTURE.md`,
      were updated to match for consistency. Historical entries elsewhere in
      _this_ file (Phase 2.5/2.6's own titles, and their body text) were
      deliberately left as-is — they're a record of what the tab was called
      when that work happened, not a live description of today's UI.
      `name-table.model.ts`'s "imported Random Generators spreadsheet" is a
      distinct, unrelated reference (the GM's own source spreadsheet's
      name, not the app's tab) and was left alone too.
- [x] **3.11 — "About & Contact" tab.** A fifth, always-last header nav tab
      (`src/app/pages/about/`, `/about`) — static, no store, no sub-nav.
      Added as a normal guarded route/nav entry alongside Players/NPCs/
      Encounters/Content & Generators (same `authGuard`-protected children
      array, same `@if (authService.uid())` nav block in `app.html`) rather
      than public like `/`/`/login`, so its behavior stays consistent with
      its sibling tabs instead of being the one exception. `Home`'s
      quick-nav grid gained a matching fifth card, keeping it in sync with
      the header nav per that component's own "mirrors the header nav"
      doc comment. Content: an **About** section that's a placeholder for
      now (real biographical content to follow later) and a **Contact**
      section with a `mailto:` link to `roll44yan@gmail.com` for
      questions/concerns/suggestions.

A side effect of the migration, not a separate line of work: data is now
naturally **accessible from more than one device/browser** (any signed-in
session reads the same Firestore-backed account) — confirmed as part of
3.3's live verification, not something built separately.

**Not part of this phase, still open:** a GM-level settings page (starting
with a preferred source book — D&D 5e SRD vs. Shadowdark — defaulted
wherever a source toggle appears: Encounter Generator, `AddCombatantDialog`'s
From Book step, NPC roster's Browse Monster List). Revisit once it's
actually being designed.

## Phase 4 — Player Role

- [ ] Player accounts, distinct role from GM.
- [ ] A Player can be linked to a PC and upload/manage that character's
      data (at minimum: name + Initiative Modifier) instead of the GM
      entering it.
- [ ] Turn notification: a Player gets notified when their PC becomes the
      Active combatant.

## Known issues (fixed)

- **Pre-Roll Combatants list: bubble columns didn't align.** ~~Reported as
  "generated NPCs specifically don't align," but the live repro (2026-07-22,
  `getBoundingClientRect()` on each `.stat` column comparing a Browsed NPC
  against a Generated one) showed the real trigger is name _length_, not
  the source: the `<li>` wrapping each bubble in both `EncounterDetail`'s
  setup-phase Combatants list and `EncounterPreviewPanel` carried a stray
  `entry` class (`class="bubble entry preview-combatant"`) left over from
  copying the flat single-line row markup those two components used before
  Phase 2.9. `.entry` sets `display: flex` on the `<li>` — combined with
  `<app-combatant-bubble>` having no explicit `:host` display (so its block
  child `.combatant-row` becomes a direct flex item once the `<li>` is a
  flex container), that made `.combatant-row` shrink-wrap to its own
  content width instead of stretching to the full row, so `.combatant-name`
  (the only `flex-grow` child) never had real free space to fill and just
  rendered at its natural text width — shifting every fixed-width `.stat`
  column after it left or right by however much shorter/longer that
  particular name was. Generated NPCs stood out because a personal name +
  `monsterSubtitle` ("Bloodfang - Giant Toad") reads much longer than a
  Browsed NPC's bare template name ("Aboleth", no subtitle since
  `name === monsterName`) — but a hand-typed long name would have shown the
  same drift. The run-phase `.main-combatant`/`.held-bubble` `<li>`s never
  had the `entry` class, which is why that screen was never affected.~~
  **Fix:** dropped `entry` from both `<li>`s' class lists (they don't need
  its `display: flex`/`gap` — `.combatant-row` inside `CombatantBubble`
  already handles its own internal layout); verified with
  `getBoundingClientRect()` (columns now land at identical `left` offsets
  regardless of name length) and visually at desktop and 375px mobile
  widths. See [[feedback_combatant_bubble_never_deforms]] — same standing
  "never deforms" rule, one layer up (the bubble's _container_, not the
  bubble's own CSS, was at fault this time).

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
- **Temporary HP and Temporary Shield/AC bonuses on a combatant, mid-encounter**
  — separate from the base HP/AC fields (see Phase 2's Combatant HP/AC/Notes
  bullet), a GM-settable temp HP pool that absorbs damage before real HP
  and a temp AC bonus (e.g. from a Shield spell) that stacks on top of base
  AC, both scoped to the encounter/combatant and presumably clearable
  on a status/duration trigger rather than persisting like base stats do.
  Needs design: how temp HP interacts with healing/overhealing, whether
  temp AC is a flat add-on shown separately or folds into the displayed AC
  number, and whether either belongs on `Combatant` only or also on the
  Player/NPC roster templates.

## Explicitly not planned yet

Keep this section so we don't accidentally scope-creep during Phase 1: dice
rolling beyond initiative (attack/damage rolls), mobile app / offline PWA
packaging.
