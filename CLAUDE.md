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
