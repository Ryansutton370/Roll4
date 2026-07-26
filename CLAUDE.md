# Roll4 — Instructions for Claude Code

## What this project is

Roll4 is a browser-based initiative tracker for tabletop RPGs (see
[docs/PRODUCT.md](./docs/PRODUCT.md) for the full feature description,
[docs/DATA_MODEL.md](./docs/DATA_MODEL.md) for the data shapes, and
[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) /
[docs/ROADMAP.md](./docs/ROADMAP.md) for current phase and technical
decisions). Read those before making design decisions that aren't obvious
from the code — they capture *why*, not just *what*.

## How to work with me on this repo

This is a personal project for two goals at once: I want a working tool,
**and** I'm using it to learn Angular. Both matter — optimize for my
understanding, not just for shipping code fast.

- **Explain like a mentor, not just a code-generator.** When you make a
  nontrivial decision (which Angular API to use, why a service vs. a
  component, why a signal vs. a plain field), say what you did and *why* in
  your response, in plain terms, before or after the change — assume I
  might not know the Angular concept yet.
- **Comment code explicitly — this overrides the general "no comments"
  default.** In most codebases, comments should only explain non-obvious
  *why*. In this repo, also comment the *what* when it involves an Angular
  concept I'm likely still learning (signals, `computed()`, dependency
  injection, standalone component `imports`, control-flow syntax like
  `@if`/`@for`, etc.) — treat the code itself as part of the teaching
  material, not just something that has to work.
  Concretely:
  - Do comment: *why* a design choice was made when it's not obvious, *and*
    a short explanation of an Angular mechanism the first time it shows up
    in a file (a one-liner is enough — don't write essays).
  - Don't over-comment things that are self-explanatory once you've seen
    the pattern once or twice, or plain TypeScript/JS that has nothing to
    do with Angular or this domain.
- **Keep the docs in `docs/` up to date as the design evolves.** If we make
  a decision that changes something those files describe (a data model
  field, an architecture choice, a roadmap phase), update the relevant doc
  in the same change — they're meant to stay accurate, not be a one-time
  snapshot.

## Standing rules

- **The combatant bubble (`combatant-bubble.html`/`.css`, run-phase
  `encounter-detail.html`) must never deform.** No squishing, no oval
  buttons, no silent fall-through to a two-line layout except via the
  deliberate `@container` tier at the bottom of `combatant-bubble.css` (see
  "THE RULE" comment at the top of that file for the mechanics: every
  column is `flex-shrink: 0`, `.combatant-name` is the only flexible thing
  and absorbs all the give). This has regressed twice from two different
  causes (a missing `flex-shrink: 0`, then a too-generous flex-basis on the
  name) — both looked fine in isolation and only showed up once the Timers
  rail and/or Hold Action panel narrowed the row on desktop, or once enough
  badges/status icons were present at once. **Any change that touches the
  encounter run-phase screen — a new badge, a new status icon, a layout
  change to the Timers rail/Hold Action panel/turn-controls, anything that
  can affect `.main-combatant`'s available width — needs the bubble
  actually checked afterward** (ideally live, via the `run-roll4` skill),
  not just assumed fine from reading the CSS. Check it under the worst
  realistic case, not the easy one: Timers rail *and* Hold Action panel
  both visible, a fully-statted (AC/HP/Notes/View Stat Block/Initiative)
  combatant, at least one status icon (e.g. Incapacitated) — that
  combination is what has broken this twice before.
- **Live-testing against Firebase must leave no trace by default.** Every
  new email/password account created for a test is a row the user has to
  find and delete by hand in the Firebase console — this has already
  happened often enough to become real cleanup work. Default to the
  "Continue Without Signing In" anonymous-guest flow for *any* live test
  (via the `run-roll4` skill or otherwise) — it's a real, fully-functional
  signed-in session as far as every store/guard/rule is concerned, needs no
  credentials, and requires no separate deletion step to reason about
  during a script. Only sign into (never *create*) a persistent
  email/password account when the test specifically depends on identity
  surviving across separate sessions/invocations — e.g. verifying data
  persists across a sign-out/sign-in cycle, or testing email/password or
  Google sign-in itself — and reuse the existing standing QA account for
  that rather than signing up a new one. Signing up a brand-new
  email/password account as a testing shortcut is not acceptable even
  when it seems easier in the moment.
- **Test repeated-row list UI (Saved Players/NPCs, encounter rosters,
  etc.) with 2+ rows, not 1, before calling a layout change done.** A
  mobile fix to the Saved Players/NPCs list wrapped each row so Name/
  Notes got their own line instead of squeezing to nothing — correct for
  that one bug, but it was only tested with a single saved Player, so it
  missed that `.column-headings` (a shared label row sitting once above
  the whole list, not per-row) had gone visibly out of sync: with one
  row it still happened to sit right above it, but with two or more,
  every row after the first showed unlabeled numbers with no indication
  of which was AC vs. Max HP vs. modifier. **Anything that sits outside
  a repeated row itself — a shared header, alignment against a sibling,
  spacing between items — can only be checked by looking at more than
  one item at once.** Create at least 2 entries (e.g. via the `run-roll4`
  skill) before screenshotting/confirming a list-view change.

## Conventions already in place

- Angular 22, standalone components (no `NgModule`s), Signals for state —
  see [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for why.
- Vitest for tests (`ng test`), configured by the Angular CLI already.
- Prettier is configured (`.prettierrc`): single quotes, 100 char width,
  Angular parser for `.html` templates.
- No backend yet — current phase persists to browser storage. Don't
  introduce a backend/API/auth dependency without checking
  [docs/ROADMAP.md](./docs/ROADMAP.md) first; that's a deliberate,
  documented deferral, not an oversight.
