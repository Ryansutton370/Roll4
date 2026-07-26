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
- **Firebase** (Firestore + Firebase Auth) as of Phase 3 — see "Persistence"
  below.

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

## Persistence — Firebase (Firestore + Firebase Auth), as of Phase 3

**Decision:** Roll4 now has real GM accounts and a real backend. Every GM
signs in (email/password or Google, via Firebase Auth) and their Players,
NPCs, Parties, Troops, and Encounters (including in-progress round/turn
state) live in **Firestore**, scoped to their account. This replaced the
Phase 1/2 local-only design once the real requirements (multi-device access,
GM accounts) were actually being built, rather than guessed at in
advance — see the superseded reasoning this section used to carry, now
folded in below.

**Why Firebase over Supabase/a custom API:** Firestore's realtime listeners
map directly onto Angular signals with very little glue code, which matters
for the eventual Player-notification feature (Phase 4 — pushing "it's your
turn" to a connected Player), and Firebase Auth covers GM accounts without
writing any auth server code. A custom API would have meant building and
hosting that server ourselves for no benefit at this project's scale.

**Raw Firebase SDK, not `@angular/fire`:** every store imports directly from
`firebase/app`/`firebase/firestore`/`firebase/auth` (see `src/app/firebase.ts`
for the one shared `initializeApp`/`getFirestore`/`getAuth` call) rather than
using the `@angular/fire` wrapper library. This keeps the underlying
Firestore/Auth concepts visible — this repo's explicit learning goal — and
fits the existing "push side effects into services" convention (below)
without adding another abstraction layer on top.

**The core inversion this brought:** before Phase 3, a mutation method
(`PartyStore.createParty`, etc.) wrote straight into its own signal, and a
single `effect()` mirrored that signal out to `localStorage`. Now, a
mutation method writes to Firestore directly and never touches the signal
itself; an `onSnapshot` **listener** (set up in each store's constructor,
scoped to `where('ownerId', '==', <signed-in GM's uid>)`) is the *only* thing
that ever calls `.set()` on the signal. State flows storage → app, not
app → storage. Every `create*` method still returns its new object
**synchronously** (the id, via `crypto.randomUUID()`, is known before the
network write fires) — the write itself is fire-and-forget
(`setDoc(...).catch(...)`), so every component call site that used to read a
synchronous return value keeps working completely unchanged.

**Collections and security:** seven top-level Firestore collections
(`players`, `npcs`, `parties`, `troops`, `encounters`, `combatants`,
`timers`), each document carrying an `ownerId` field (the owning GM's
Firebase Auth uid). `firestore.rules` (repo root) enforces `ownerId ==
request.auth.uid` on every read/write — there are no per-entity roles below
the GM (see [DATA_MODEL.md](./DATA_MODEL.md)'s `User`/`ownerId` notes).
`combatants`/`timers` are top-level with an `encounterId` field rather than
subcollections of `encounters/{id}` — every store still loads its GM's
*entire* owned collection into memory via one always-on listener, matching
how `combatantsForEncounter`/`timersForEncounter` already worked as
client-side filters before Firestore existed; there was no reason to change
that shape along with the persistence swap.

**Multi-document writes use `writeBatch`:** several `EncounterStore` methods
touch more than one collection in what has to be one atomic operation — e.g.
`commitOrder` (the shared "commit a new combatant order" helper behind
rolling, advancing turns, Hold Action, and reordering) writes every changed
`Combatant` doc *and* the `Encounter`'s `combatantIds`/`activeCombatantIndex`
together, so a page reload never sees one half updated without the other.
`PartyStore.deletePlayer`/`NpcStore.deleteNpc` (the reverse-cascade across
every Party/Troop containing that member) use the same pattern.

**`src/app/services/auth-service.ts`** wraps Firebase Auth the same way every
`*Store` wraps its own persistence — a `user`/`uid` signal fed by
`onAuthStateChanged`, and `signUpWithEmail`/`signInWithEmail`/
`signInWithGoogle`/`signOutUser` methods. `src/app/guards/auth-guard.ts`'s
`authGuard`/`redirectIfAuthedGuard` (`CanActivateFn`s) gate the whole route
tree behind a signed-in GM via a pathless parent route in `app.routes.ts`,
leaving every existing URL unchanged.

**Testing:** `PartyStore`/`NpcStore`'s own specs no longer instantiate the
real, Firestore-backed service — they test the small pure reconciliation
functions extracted out of each (`addPlayerIdToParty`,
`removePlayerIdFromAllParties`, etc.), the same "extract the real logic,
leave the storage plumbing untested" split `EncounterStore`'s pure functions
(`compareByInitiative`, `reRollRound`, ...) already used. `EncounterStore`'s
own spec is the one exception: its business logic (rolling, advancing turns,
Hold Action, Ready to Join, Timers) was valuable enough to keep testing
against the *real* service, which is only possible because
`src/app/services/testing/fake-firestore.ts` swaps the whole
`'firebase/firestore'` module for a synchronous in-memory double via
`vi.mock` — every write applies immediately and synchronously notifies any
subscribed listener, so existing "call a mutation method, assert
immediately" tests needed no `await`/tick changes. `FakePartyStore`/
`FakeNpcStore`/`FakeAuthService` (`src/app/services/testing/`) are
lightweight in-memory stand-ins used to satisfy `EncounterStore`'s
dependencies (and any component test that needs a working Party/Troop
fixture) without a real Firebase connection. No Firebase Emulator Suite is
in use — this project has no CI to run it in yet; multi-account isolation
and real end-to-end persistence are instead verified live (manually, or via
the `run-roll4` skill), not by these unit tests.

**The one exception, and why it's still not part of this migration:**
`NameTableStore`, `MonsterStore` (Phase 2.5), `WildMagicStore`/
`TreasureStore`/`CombatThesaurusStore` (Phase 2.6/2.11), and `SpellStore`
(Phase 2.13) read static JSON files (`public/data/name-tables.json`,
`monsters-5e-srd.json`, `monsters-shadowdark.json`, `wild-magic.json`,
`treasure.json`, `combat-thesaurus.json`, `spells-5e-srd.json`,
`spells-shadowdark.json`) via `HttpClient`, not Firestore. This isn't a
backend: the JSON files are static, checked into the repo, and served by
whatever's already hosting the app's own bundle, with no server-side logic
or GM-specific data behind them ("read-only" describes how the _running
app_ treats them — via `HttpClient`, never written back to — not how
they're maintained: every one of these JSON files is directly GM-editable
at rest, the same category as a hardcoded constant that's too large to
comfortably inline). `toSignal` bridges the resulting Observable into a
signal, so every other component still just reads a signal, same as
everywhere else.

**On the `scripts/import-*.cjs` files and their `.claude/` source
inputs:** each JSON file started as a one-time conversion from an external
source (a spreadsheet, a PDF) or, for Treasure, GM-pasted plain text — see
each entity's own section in [DATA_MODEL.md](./DATA_MODEL.md) for specifics.
Once a JSON file has been hand-edited past what its script would produce,
**don't re-run that script** — it regenerates the file from the original
source input from scratch and would silently discard anything added
directly since. The scripts/source files stay in the repo as a record of
how the first batch was assembled, not as something to run again.

## Hosting — Firebase Hosting

The production build (`ng build`, output `dist/Roll4/browser`) deploys to
**Firebase Hosting** on the same project (`roll4-bddd2`) already used for
Firestore/Auth — no separate host to wire up. Configured in `firebase.json`'s
`hosting` block: `public` points at the real CLI-generated output path
(`dist/Roll4/browser`, not just `dist/Roll4` — the CLI nests the actual
static site one level deeper), and a catch-all `rewrites` rule
(`"source": "**"` → `/index.html`) is required for Angular's client-side
router — without it, refreshing on any route other than `/` (e.g.
`/players`) 404s at the host level before Angular's router ever gets a
chance to handle it.

**Multiple hosting sites, one project:** the project's auto-created default
site is `roll4-bddd2.web.app` (unmemorable — it's derived from the
project ID, which itself got a random suffix at creation since `roll4` alone
was already taken as a *project* ID). Firebase Hosting supports additional,
independently-named "sites" within the same project — created a second one,
`roll4` (`hosting:sites:create roll4`), giving the much friendlier
`https://roll4.web.app`. `.firebaserc`'s `targets` block maps the local name
`roll4` to that site ID, and `firebase.json`'s `hosting.target: "roll4"`
points ordinary deploys at it — so `roll4-bddd2.web.app` still exists and
still serves whatever was last deployed to it (the very first deploy, before
the second site existed), but no longer receives new deploys unless
explicitly re-targeted.

**Auth caveat this created:** Firebase Auth's authorized-domains list is
keyed by exact hostname, and only auto-populates the project's *default*
Hosting domain at project creation. A second Hosting site's domain
(`roll4.web.app`) needed adding by hand under Firebase Console →
Authentication → Settings → Authorized domains for Google sign-in to work
there — a third-party host or a differently-named Hosting site both hit this
same gap; only the one default domain is exempt.

Deploy is `npx firebase-tools deploy --only hosting` (`--only hosting` so a
hosting deploy never touches `firestore.rules`/indexes — those deploy
separately, deliberately, since they're a very different blast radius). Not
added as an `npm` script yet since it's still a manual/occasional step, not
part of any dev-loop.

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

**Deep-linking into a page's local UI state via a query param:** the
Encounter Generator's "Add to Encounter" action (see PRODUCT.md section 12)
needs to land the GM on `/encounters` with one specific Encounter's edit
panel already open — state `EncounterList` only ever tracked locally
(`editingEncounterId`, opened via `startEdit()`), with no route of its own.
Rather than invent a new dedicated route/component just for this one
entry point, `EncounterList` gained an `openForEncounterId` input aliased
to a `?edit=<id>` query param — the same `withComponentInputBinding()`
already configured in `app.config.ts` for path params (see above) binds
query params too, so this needed no new router wiring, just a new input. A
constructor `effect()` reads it, calls the existing `startEdit()` if the
Encounter exists, then clears the param via an empty `router.navigate()` so
a refresh or back-navigation doesn't reopen the panel from a stale link.

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
after showing that banner). Both hosts now end up with an explicit commit
step, just a different one: the standalone page still requires **Save as
Troop** (troop-name input + button, outside the component), while
`EncounterList` gets two new opt-in inputs/outputs
(`showEncounterCommitActions`/`encounterName`, `addAllToEncounter`/
`addOneToEncounter`) that render an **Add All to Encounter** button plus a
per-Roster-row individual **Add to Encounter** button inside the component
itself (gated behind `showEncounterCommitActions()` so the standalone page,
which never passes it, is unaffected). This replaced an earlier design
(Phase 2.8) where `EncounterList` instead ran a host-side `effect()` that
live-synced `draft` straight to real Combatants with no button at all — that
fit the "Encounter Preview" a GM sees while building had to distinguish
"still just a candidate" from "actually in the Encounter," which a live-sync
effect can't represent (everything in `draft` was already a real Combatant
the instant it existed). Each commit method marks the affected Roster
row(s) with a CSS class that plays a flash-green/shrink animation;
`(animationend)` is what actually removes the row from `draft` (same
"`(animationend)` does the real removal" precedent as
`combatant-pop-out`/`finishPopOut` in `encounter-detail.css`/`.ts`, two
independent components landing on the same trick for the same reason: a
CSS animation needs to finish before the DOM node it's animating can
safely disappear).

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

**A seventh precedent, splitting out a whole rendered list rather than one
row's markup:** `EncounterPreviewPanel`
(`src/app/shared/encounter-preview-panel/`) is the New Encounter builder's
live preview of what's actually been added — same "template growing
unwieldy" justification as the original `CombatantBubble` extraction, one
level up (a bubble list + drawer/dialog wiring, not just one row). Unlike
`CombatantBubble` (which stays a dumb "child reports, parent decides"
component with no injected stores), `EncounterPreviewPanel` is
self-contained like `MonsterGeneratorPanel`: it injects `EncounterStore`/
`PartyStore`/`NpcStore`/`MonsterStore` directly and owns its own
`EditCombatantDialog`/`MonsterStatBlockDialog`/`NotesDialog` instances,
rather than the host (`EncounterList`) passing everything down and wiring
every dialog itself — the host only ever hands it an `encounterId`. This
reuses `CombatantBubble` itself (not a copy) so the pre-Roll preview gets
the exact same never-wraps/truncates-by-rendered-width behavior the
run-phase screen already relies on (see the `CombatantBubble` file header
and CLAUDE.md's standing rule) — including its own
`container-type: inline-size` on the wrapping `<li>`, the same mechanism
`.main-combatant`/`.held-bubble` use in `encounter-detail.css`, since this
is a third, independently-narrow usage context for the same component.

**An eighth precedent, growing `CombatantBubble` for a third host instead of
copying it:** the same component now takes a `previewMode` input (used only
by `EncounterPreviewPanel` above) that swaps its drawer's Hold Action/
Incapacitated/Create Timer/Removed-from-Combat controls (none of which make
sense before Roll Initiative) for a reduced set — Edit Info and, depending
on `combatant().type`, either a relabeled "Mark Absent" checkbox (Player,
same underlying flag as Removed from Combat) or a new `deleteRequested`
output wired to a Delete button (NPC). The change is confined to the
drawer's already-conditional inner content, not `.combatant-row` itself, so
the collapsed-row width/squish behavior CLAUDE.md's standing rule governs
is untouched in principle — but a new usage context (a narrower preview-
panel column) still needs a live check under that rule rather than assuming
the drawer-only change makes it exempt.

**A ninth precedent, a content-projection slot for drawer content
`CombatantBubble` doesn't need to understand:** `EncounterPreviewPanel`'s
"Save to Players"/"Save to NPCs" button + Party/Troop picker (creating a
library Player/NPC from an ad-hoc Combatant) needed to live in the
expansion drawer, positioned above Delete, but it's specific to the
pre-Roll builder — `CombatantBubble` shouldn't need to know about
`PartyStore`/`NpcStore` just to host it. Same `[leading-control]`
content-projection pattern `CombatantBubble` already used for the drag
handle, one level down: a `<ng-content select="[drawer-extra-action]">`
placed inside `.drawer-actions` itself, directly before the (previewMode +
NPC only) Delete button — not a separate full-width row after
`.drawer-actions`/`.drawer-checkboxes` (an earlier version of this slot,
`[drawer-footer]`, did that, but the projected content's *position*
relative to Delete matters here, and `.drawer-actions`'s own
`flex-direction: column` already lays out whatever's projected into it in
document order — no separate footer row needed). `EncounterPreviewPanel`
projects its Save to Roster markup into it (wrapped in an `@if`, which
doesn't block Angular's content-projection matching). The projected markup
is still styled from `EncounterPreviewPanel`'s own stylesheet, not
`combatant-bubble.css` — the same view-encapsulation rule as ever (a
component's styles apply to elements authored in *its own* template,
regardless of where they end up rendered) — so its "look like a drawer
action button" styling (plus the save/floppy-disk icon) is written out by
value in `encounter-preview-panel.css` rather than sharing
`.drawer-action-btn`'s class name, which would resolve to nothing there.

**A tenth precedent, retiring a hand-duplicated row once the real component
could just be reused directly:** `EncounterDetail`'s own pre-Roll setup-phase
Combatants list used to be a completely separate, hand-duplicated rendering
of a combatant row (its own AC/HP/Notes/View-Stat-Block markup and CSS,
predating `previewMode`) rather than `<app-combatant-bubble>` — reasonable
when it was written (the run-phase-only concepts `previewMode` now hides
didn't have an off switch yet), but it meant a GM saw a visibly different,
less capable row (no Edit Info, no inline AC/HP editing) the moment they
opened an Encounter they'd just finished building in Encounter Preview.
Once `previewMode` existed (see the eighth precedent above), replacing that
hand-duplicated markup with the same `<app-combatant-bubble [previewMode]>`
usage `EncounterPreviewPanel` already uses — wired to `EncounterDetail`'s own
existing dialogs/store calls (`openEditDialog` etc.), not by embedding
`EncounterPreviewPanel` itself, which would've meant a second, duplicate set
of Edit/Notes/StatBlock dialog instances on one page — deleted a large block
of duplicated markup/CSS in favor of the real component, and gave the setup
phase a capability it never had (renaming/editing AC/HP via Edit Info; the
old row was read-only apart from a bare Initiative Modifier `<input>`).
`CombatantBubble` is now used in four contexts total: the run-phase main
list, the Hold Action panel, `EncounterPreviewPanel`, and this setup-phase
list — one more reason `previewMode`'s changes stay confined to the
drawer's *already-conditional* content rather than touching `.combatant-row`
itself (see the eighth precedent's note on the CLAUDE.md standing rule).

**An eleventh precedent, a routed page and a modal dialog sharing one
picker component — the same shape as the fifth precedent above, one page
smaller:** `CombatThesaurusPicker`
(`src/app/shared/combat-thesaurus-picker/`) is the category-row/count/roll/
copy-any-result UI that used to be `CombatThesaurusGenerator`'s entire
template — pulled out once `CombatThesaurusDialog` (opened from
`EncounterDetail`'s run-phase "+" menu, for rolling a verb mid-combat
without leaving the Encounter screen) needed the identical picker a second
time. `CombatThesaurusGenerator` (the full Content & Generators page) kept only
its own page chrome (`<h1>`, intro paragraph, `GeneratorDisclaimer`) around
`<app-combat-thesaurus-picker>`; `CombatThesaurusDialog` wraps the same tag
in a native `<dialog>` with a title/close-button header, following
`MonsterStatBlockDialog`'s open()/close()/onOverlayClick shape rather than
`MonsterGeneratorPanel`'s two-way-`model()` shape — this picker owns its
data outright (loaded from `CombatThesaurusStore`) instead of taking it from
a host, so there's no draft/commit split for either host to manage.
