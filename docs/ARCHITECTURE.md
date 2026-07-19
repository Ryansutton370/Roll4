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
accounts**. All data (Parties, PCs, Encounters, in-progress round/turn
state) is persisted to the browser via `localStorage` (or `IndexedDB` if we
outgrow `localStorage`'s size/shape limits — unlikely at this scale).

**Why defer hosting instead of picking one now:** the real requirements for
a backend (multi-device access, GM accounts, and *especially* the future
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
eventually add a real backend, we replace what's *inside* those services
(swap `localStorage.getItem` for an HTTP/Firestore call) without touching
any component code. This is one of the more important patterns to learn in
Angular: **push side effects (storage, HTTP, timers) into services; keep
components focused on displaying signals and handling user events.**

## Future: choosing a real backend

Deferred until Phase 2 (see [ROADMAP.md](./ROADMAP.md)). When we get there,
the live requirements will likely include: GM accounts (auth), data
accessible from more than one device, and — once the Player role exists —
some way to push a "it's your turn" notification to a connected player. That
last requirement pulls toward a backend with realtime/push support
(Firebase, Supabase) rather than a plain REST API, but we should make that
call once the Player-notification feature is actually being designed, not
before.

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

**The gotcha to watch for:** Angular's view encapsulation scopes a
component's CSS to elements written in *its own* template — a parent's
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
- A style that depends on state the *parent* knows but the child doesn't
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
elements meant to lay out individually alongside the *caller's* other
content (here, 5 form fields meant to sit inline with the caller's submit
button in one flex row), the host tag instead becomes a single opaque flex
item sized to fit all of them together — the fields never get a chance to
wrap or size independently. Fix: `:host { display: contents; }` in the
component's own stylesheet, which removes the host's own box from layout
entirely so its children lay out exactly as if they were the parent's
direct children. Reach for this whenever a component exists purely to
group a handful of *sibling* elements for reuse (as opposed to one, since
that's the more common case where the host's default inline/block box
never mattered before).

**A third gotcha, a real bug found in `CombatantBubble`'s HP delta
popover:** `position: absolute` only anchors to the *nearest positioned
ancestor* — an element with `position` other than `static`, or one with a
`transform` (transforms create a containing block too, which is easy to
forget). The HP popover (`.hp-adjust-popover`) is a sibling of the button
that opens it, not its child — a `<button>` can't validly contain another
interactive control — so putting `position: relative` on the button itself
did nothing for the popover; with no positioned ancestor at all, it
anchored to the document, and could render anywhere on the page depending
on document height. It happened to *look* fine for the Active combatant
only by accident, because `.combatant.active` has `transform:
scale(1.03)` for its highlight glow, which incidentally created the
containing block the popover needed. Fix: wrap the button and the popover
in a shared element and put `position: relative` on *that* wrapper, not on
either of the things inside it. Whenever a popover/menu is a sibling
(rather than a child) of the control that opens it, double check what its
actual containing block resolves to — don't assume a `position: relative`
somewhere nearby is the right one.
