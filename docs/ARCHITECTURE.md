# Roll4 — Architecture

## Stack

- **Angular 22**, using the modern defaults the CLI scaffolded for us:
  **standalone components** (no `NgModule` boilerplate) and the **Signals**
  reactivity model rather than older patterns like `NgRx` or heavy RxJS
  state stores.
- **Vitest** for unit tests (already wired up by the Angular CLI template).
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
