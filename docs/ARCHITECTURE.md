# Roll4 — Architecture

## Stack

- **Angular 22**, using the modern defaults the CLI scaffolded for us:
  **standalone components** (no `NgModule` boilerplate) and the **Signals**
  reactivity model rather than older patterns like `NgRx` or heavy RxJS
  state stores.
- **Vitest** for unit tests (already wired up by the Angular CLI template).
- **@angular/cdk** (`DragDropModule`) for the Hold Action placement drag
  gesture — the one place in the app that needs real drag-and-drop; see
  docs/ROADMAP.md's "Planned, not yet built" note on why this was deferred
  elsewhere, and docs/PRODUCT.md's Hold Action section for the feature.
- No backend yet — see "Persistence" below.

### Why Signals instead of NgRx for state management

For a project this size (one GM, a handful of screens, no complex
cross-cutting async state), a full state-management library like NgRx adds a
lot of ceremony — actions, reducers, effects, selectors — for a problem
Angular Signals now solve natively: a `signal()` holds a value, components
read it and re-render automatically when it changes, and `computed()`
derives values from other signals (e.g. "the sorted initiative list" derived
from the raw combatants signal). This is also a more approachable way to
learn Angular's current idioms, since Signals are the direction the
framework itself is moving.

## Persistence — current phase: local-only

**Decision:** for the current build phase, Roll4 has **no backend and no
accounts**. All data (Players, NPCs, Parties, Troops, Encounters,
in-progress round/turn state) is persisted to the browser via
`localStorage` (or `IndexedDB` if we outgrow `localStorage`'s size/shape
limits — unlikely at this scale).

**Why defer hosting instead of picking one now:** the real requirements for
a backend (multi-device access, GM accounts, and _especially_ the future
Player-notification feature) aren't being built yet, so picking
Firebase/Supabase/a custom API now would mean designing around
infrastructure the app doesn't need yet. Building local-only first lets us
focus learning time on Angular itself, and means the eventual backend choice
gets made against real, working requirements instead of guesses.

**How we keep this swappable later:** all reads/writes to persisted data go
through a small set of Angular **services** (e.g. `PartyStore`,
`EncounterStore`) rather than components talking to `localStorage` directly.
A service is just an injectable class — components ask for one via
dependency injection and don't know or care how it gets its data. When we
eventually add a real backend, we replace what's _inside_ those services
(swap `localStorage.getItem` for an HTTP/Firestore call) without touching
any component code. This is one of the more important patterns to learn in
Angular: **push side effects (storage, HTTP, timers) into services; keep
components focused on displaying signals and handling user events.**

**The one exception, and why it's still "local-only":** `NameTableStore`,
`MonsterStore` (Phase 2.5), and `WildMagicStore`/`TreasureStore` (Phase 2.6)
read static JSON files (`public/data/name-tables.json`, `monsters-5e-srd.json`,
`monsters-shadowdark.json`, `wild-magic.json`, `treasure.json`) via
`HttpClient` instead of `localStorage` — the app's first HTTP calls. This isn't a backend: the
JSON files are static, checked into the repo, and served by whatever's
already hosting the app's own bundle, with no server-side logic or
GM-specific data behind them ("read-only" describes how the _running app_
treats them — via `HttpClient`, never written back to — not how they're
maintained: all five JSON files are directly GM-editable at rest, the same
category as a hardcoded constant that's too large to comfortably inline).
`toSignal` bridges the resulting Observable into a signal, so every other
component still just reads a signal, same as everywhere else.

**On the `scripts/import-*.cjs` files and their `.claude/` source
inputs:** each JSON file started as a one-time conversion from an external
source (a spreadsheet, a PDF) or, for Treasure, GM-pasted plain text — see
each entity's own section in [DATA_MODEL.md](./DATA_MODEL.md) for specifics.
Once a JSON file has been hand-edited past what its script would produce,
**don't re-run that script** — it regenerates the file from the original
source input from scratch and would silently discard anything added
directly since. The scripts/source files stay in the repo as a record of
how the first batch was assembled, not as something to run again.

## Future: choosing a real backend

Deferred until Phase 2 (see [ROADMAP.md](./ROADMAP.md)). When we get there,
the live requirements will likely include: GM accounts (auth), data
accessible from more than one device, and — once the Player role exists —
some way to push a "it's your turn" notification to a connected player. That
last requirement pulls toward a backend with realtime/push support
(Firebase, Supabase) rather than a plain REST API, but we should make that
call once the Player-notification feature is actually being designed, not
before.

## Nested routes and section "shells"

`app.routes.ts` uses Angular's route nesting (a route's `children: [...]`
array) for the **Players** and **NPCs** sections — each has a small "shell"
component (`PlayersShell`/`NpcsShell`) as the parent route's `component`,
owning a `.section-nav` sub-nav (Roster / Parties, or Roster / Troops) and
its own `<router-outlet>`. The three routes under `players` (roster, party
list, party detail) render _into that outlet_, not `app.html`'s top-level
one.

**Why a shell instead of putting the sub-nav in each page, or in
`app.html`:** every page under `/players` would otherwise have to render
the identical Roster/Parties tab strip itself (real duplication), or
`app.html`'s single global nav would need to know "am I currently
somewhere under `/players`, and if so, show these two extra links" —
coupling the app shell to the internal structure of one section. A nested
route keeps that knowledge local to the section that owns it, and
`app.html` stays exactly as simple as it was before these two tabs existed
(see `app.html` — it only gained the two new top-level links).

**The `routerLinkActiveOptions` gotcha this pattern runs into:**
`routerLinkActive`'s default matching is a _prefix_ match, not exact — a
link to `/players` reads as "active" for `/players/parties/:id` too, since
that URL starts with `/players`. Inside `PlayersShell`'s own sub-nav this
is a real problem: the "Roster" link (`/players`) and the "Parties" link
(`/players/parties`) would both show active while looking at a Party,
since both are prefixes of that URL. Fix: `[routerLinkActiveOptions]="{
exact: true }"` on the Roster link only, so it's active for `/players`
exactly and nothing else. The "Parties" link is left at the default prefix
match on purpose, since it _should_ stay highlighted for both
`/players/parties` and `/players/parties/:partyId`.

## Testing approach

Use Vitest (already configured by the CLI) for unit tests on:

- Pure logic first — e.g. the initiative sort, the round-advance/turn-skip
  logic, since these are plain functions/services with no DOM involved and
  are the easiest place to catch bugs.
- Component tests for user-facing behavior (Roll button, Forward/Back,
  Removed-from-Combat toggling) as those screens get built.

## Splitting shared UI into components

When to split: shared markup between two rendering contexts starts
drifting into real duplication, and/or a single component's template grows
unwieldy. Precedent: `CombatantBubble`
(`src/app/pages/encounter-detail/combatant-bubble.ts`) was split out of
`EncounterDetail` once its ~550-line template had the same combatant-row +
drawer markup duplicated between the main initiative list and the Hold
Action panel.

A second precedent, extracting a smaller _behavior_ rather than a big
chunk of markup: `NameGeneratorButton`
(`src/app/shared/name-generator-button/`) was split out of
`CombatantFields` once the Encounter Generator's Roster list needed the
same 🎲-button-plus-popover next to its own per-row name input — copying
that popover's open/roll/pick/click-away logic a second time wasn't worth
it once there were two call sites. It deliberately owns _only_ the button
and popover, not a name `<input>` of its own: the parent supplies that
input and listens for `nameSelected`, so the component stays usable next
to any name-ish field regardless of that field's placeholder, styling, or
what "submit" means there — the same "child reports, parent decides"
separation `CombatantBubble`'s outputs already use.

**The gotcha to watch for:** Angular's view encapsulation scopes a
component's CSS to elements written in _its own_ template — a parent's
stylesheet cannot reach into a child component's template, even when the
child is nested directly inside a parent-styled element. Splitting
`CombatantBubble` out hit this repeatedly: several classes previously
styled from `encounter-detail.css` (`.type-dot`, `.initiative-total`, the
Active combatant's larger name) quietly stopped applying the moment the
element they styled moved into the child's own template.

The convention going forward:

- A style that's a genuinely shared "atom" across pages/components (e.g.
  `.type-dot`, the PC/NPC indicator dot) belongs in the global
  `src/styles.css`, not duplicated per component — `.icon-btn`/`.bubble-list`
  already live there for the same reason.
- A style that depends on state the _parent_ knows but the child doesn't
  (e.g. "this bubble is the Active combatant") should be exposed as a
  boolean `input()` on the child, which the child's own template turns
  into a plain local class inside its own scope. Don't reach for
  `:host()`/`:host-context()` selectors from the parent's stylesheet
  instead — they work, but they're solving with CSS a problem Angular
  already has a mechanism for (passing state down via inputs).

**A second gotcha, hit splitting `CombatantFields`
(`src/app/shared/combatant-fields/`) out for reuse across the PC/NPC
create and edit forms:** a component's host tag (`<app-combatant-fields>`
itself) is a real DOM element, not a transparent wrapper — unlike
`<ng-container>`, Angular does not dissolve it away. Left alone it defaults
to `display: inline`, so when a component's template has several top-level
elements meant to lay out individually alongside the _caller's_ other
content (here, 5 form fields meant to sit inline with the caller's submit
button in one flex row), the host tag instead becomes a single opaque flex
item sized to fit all of them together — the fields never get a chance to
wrap or size independently. Fix: `:host { display: contents; }` in the
component's own stylesheet, which removes the host's own box from layout
entirely so its children lay out exactly as if they were the parent's
direct children. Reach for this whenever a component exists purely to
group a handful of _sibling_ elements for reuse (as opposed to one, since
that's the more common case where the host's default inline/block box
never mattered before).

**A third gotcha, a real bug found in `CombatantBubble`'s HP delta
popover:** `position: absolute` only anchors to the _nearest positioned
ancestor_ — an element with `position` other than `static`, or one with a
`transform` (transforms create a containing block too, which is easy to
forget). The HP popover (`.hp-adjust-popover`) is a sibling of the button
that opens it, not its child — a `<button>` can't validly contain another
interactive control — so putting `position: relative` on the button itself
did nothing for the popover; with no positioned ancestor at all, it
anchored to the document, and could render anywhere on the page depending
on document height. It happened to _look_ fine for the Active combatant
only by accident, because `.combatant.active` has `transform:
scale(1.03)` for its highlight glow, which incidentally created the
containing block the popover needed. Fix: wrap the button and the popover
in a shared element and put `position: relative` on _that_ wrapper, not on
either of the things inside it. Whenever a popover/menu is a sibling
(rather than a child) of the control that opens it, double check what its
actual containing block resolves to — don't assume a `position: relative`
somewhere nearby is the right one.

**A fourth precedent, extracted for a 4th call site rather than a 2nd:**
`MonsterPickerTable` (`src/app/shared/monster-picker-table/`) replaced a
plain alphabetical `<select>` of `MonsterTemplate`s that had been
independently duplicated in `AddCombatantDialog`'s "From Book" step and
the Encounter Generator's "Add a monster" control — a new third call site
(the Encounter List's embedded generator, below) was reason enough to
centralize it as a proper sortable/searchable table (Name A-Z/Z-A, CR/Level
either direction, live search, an eye icon opening `MonsterStatBlockDialog`
inline) instead of copying the `<select>` a third time. Same "child
reports via output, parent decides what 'add' means" separation as
`NameGeneratorButton` — `AddCombatantDialog` prefills a form from the
picked template, `MonsterGeneratorPanel` increments a draft count.

**A fifth precedent, extracting a whole page's worth of behavior for reuse
inside a second, different host:** `MonsterGeneratorPanel`
(`src/app/shared/monster-generator-panel/`) is the Encounter Generator
page's entire generate/adjust-candidates/apply-names flow, moved out so
the Encounter List's create/edit panel could embed the identical UI (see
docs/PRODUCT.md section 2's "Generate Monsters") without duplicating it.
The split point deliberately excludes each host's own "what happens when
I'm done" action — those differ per host and stay outside the component.
The two are connected by a two-way `model<DraftCombatant[]>()` (`draft`) —
the first non-scalar `model()` use in this codebase (every prior use, e.g.
`CombatantFields`, was a single scalar field) — plus a separate
`draftEdited` output for a side effect that isn't part of the draft value
itself (the standalone page's "Saved!" banner needs to disappear the
moment the roster is touched again; a plain `effect()` watching `draft()`
would misfire here, since `saveAsTroop()` itself clears `draft` right
after showing that banner). The two hosts' "what happens when I'm done"
ended up genuinely different in kind, not just in target: the standalone
page still requires an explicit **Save as Troop** click (troop-name input

- button, outside the component), while `EncounterList` dropped its own
  initial "+ Add These to Encounter" button in favor of a host-side
  `effect()` that live-syncs `draft` straight to real Combatants as the GM
  builds it — see the "Encounter Builder Consolidation" phase's follow-on
  bullets in [ROADMAP.md](./ROADMAP.md) for why a live sync fit that host
  better than a second manual commit step.

**A sixth precedent, splitting attribution text out from the component
that first needed it:** `MonsterCredits` (`src/app/shared/monster-credits/`)
is `MonsterGeneratorPanel`'s Credits/Licenses `<details>` plus the Random
Generators disclaimer, pulled into its own tiny component once embedding
`MonsterGeneratorPanel` inside `EncounterList`'s multi-section page meant
the footer was no longer the last thing on the page it lived in — each
host now renders `<app-monster-credits />` itself, at its own true bottom,
rather than wherever the shared panel happened to sit.

**Both hit the `CombatantFields`/`display: contents` gotcha again, for the
same reason:** each has several top-level sibling sections (a source
toggle, a table, a `<details>`, ...) meant to flow as direct children of
whatever page or panel embeds it, not sit inside one opaque host box —
`:host { display: contents; }` in both components' own stylesheets, same
fix as before. Nesting two `display: contents` hosts inside each other
(`MonsterPickerTable` embedded inside `MonsterGeneratorPanel`, itself
embedded inside `EncounterList`'s own `<form>`) works correctly for layout,
but is worth knowing about when writing DOM-driven tests or querying by
structural position — a query like `form button[type=button]` will also
match every button belonging to a `display: contents` descendant several
components down, not just the immediate host's own; scope selectors by an
explicit class on the element you actually mean rather than relying on
`:not()`-style exclusion once a form embeds rich nested components like
these.
