---
name: run-roll4
description: Build, run, and drive Roll4 (the Angular initiative-tracker SPA). Use when asked to start Roll4, run its dev server, run its tests, build it, take a screenshot of its UI, or interact with the running app (create a party, add a PC, run an encounter).
---

Roll4 is a client-only Angular 22 SPA served by `ng serve`. There's no
separate build step for local running and no backend to stand up — drive
it by launching the dev server and scripting a headless Chromium against
it with `.claude/skills/run-roll4/driver.mjs`.

All paths below are relative to the repo root (this skill's unit is the
whole repo — there's only one app in it).

## Prerequisites

Node.js + npm (already required to work in this repo at all — see
`package.json`). No OS packages needed; this runs natively on Windows,
no Linux/xvfb involved.

The driver needs a local Chromium binary via `playwright-core`. Install
the driver's own dependency once:

```bash
cd .claude/skills/run-roll4 && npm install
```

If `playwright-core` has never downloaded a browser on this machine
(driver will error with "No chrome.exe found under ..."), fetch one:

```bash
npx playwright install chromium
```

## Run (agent path)

1. Start the dev server in the background and wait for it to actually
   serve (don't fixed-sleep — poll):

   ```bash
   npm run start > /tmp/ng-serve.log 2>&1 &
   timeout 60 bash -c 'until curl -sf http://localhost:4200 >/dev/null; do sleep 1; done'
   ```

2. Pipe a command script to the driver. Its vocabulary intentionally
   mirrors `chromium-cli` (`nav` / `wait-for` / `fill` / `click` /
   `press` / `screenshot` / `eval` / `console`) since `chromium-cli`
   itself isn't installed in this environment:

   ```bash
   node .claude/skills/run-roll4/driver.mjs <<'EOF'
   nav http://localhost:4200/parties
   wait-for text=Parties
   screenshot parties
   EOF
   ```

3. Stop the server when done — killing the port's listener (not `$!`;
   npm's wrapper doesn't forward the kill to the child it spawned):

   ```bash
   netstat -ano | grep ':4200.*LISTENING' | awk '{print $5}' | sort -u | xargs -r -I{} taskkill //PID {} //F
   ```

Screenshots land in `.claude/skills/run-roll4/screenshots/<name>.png`
(gitignored — regenerate, don't commit them).

| command | what it does |
|---|---|
| `nav <url>` | navigate |
| `wait-for text=<text>` | wait for visible text |
| `wait-for <css-selector>` | wait for a selector |
| `fill <selector> <value>` | fill an input (selector must not contain spaces — see Gotchas) |
| `click <selector>` | click (Playwright `:has-text("...")` works) |
| `press <key>` | keyboard press, e.g. `Enter` |
| `screenshot [name]` | full-page PNG, default name `shot-N` |
| `eval <js>` | `page.evaluate(js)`, prints the result — e.g. `localStorage.clear()` to reset fixture state partway through *one* script |
| `console` | print collected `console.error`/`pageerror` output so far |

### One full worked example

Creates a party, adds a PC, screenshots the result, and checks for
console errors — this is the exact script used to verify the
Initiative Modifier column heading:

```bash
node .claude/skills/run-roll4/driver.mjs <<'EOF'
nav http://localhost:4200/parties
wait-for text=Parties
eval localStorage.clear(); location.reload()
wait-for text=Parties
fill input[name=partyName] Verify Party
click button:has-text("Create Party")
wait-for text=Verify Party
click .bubble-list a.entry-title
wait-for text=Player Characters
fill input[name=pcName] Rowan
fill input[name=pcModifier] 2
click button:has-text("Add PC")
wait-for text=Initiative Modifier
screenshot party-detail
console
EOF
```

## Run (human path)

```bash
npm start   # → ng serve, opens on http://localhost:4200. Ctrl-C to stop.
```

## Test

```bash
npx ng test --watch=false
```

Runs the Vitest suite once (not watch mode) — expect all suites green.
`--browsers=ChromeHeadless` is **not** an option here (see Gotchas);
the default config already runs headless.

## Gotchas

- **The driver never persists state between invocations.** Each call
  to `driver.mjs` does `chromium.launch()` + `newPage()` with no
  profile directory, so it's a fresh, empty browser context every
  time — no localStorage/cookies survive from a previous script. The
  `localStorage.clear()` in the worked example is only there to make a
  *single* script idempotent if you re-run it without restarting the
  process (e.g. after fixing a typo mid-script); it's not undoing
  anything left behind by an earlier invocation.
- **`fill`'s selector parsing is naive (split on first space).** A
  selector like `input[placeholder="PC name"]` breaks because the
  space inside the quotes gets treated as the selector/value
  separator, silently truncating the selector and shifting the value.
  Prefer `name`/`id`-based selectors that don't need internal spaces
  — e.g. `input[name=pcName]` instead of `input[placeholder="PC
  name"]`. Roll4's forms already have `name` attributes on every
  input for this reason.
- **Button text isn't always what you'd guess.** The party-creation
  button reads "Create Party", not "Add Party" (the PC-creation button
  *is* "Add PC" — inconsistent across the two forms). Check the
  template before assuming.
- **`ng test --browsers=ChromeHeadless` fails outright** — this repo's
  Vitest setup (Angular CLI 22) doesn't have
  `@vitest/browser-playwright` installed, so passing `--browsers` errors
  with "packages required but not found." Just run `ng test --watch=false`
  with no `--browsers` flag; it already runs headless by default.
- **Killing the dev server via `$!` doesn't work.** `npm run start &`
  backgrounds the `npm` wrapper process, not the `ng serve` process it
  spawns, and npm doesn't forward signals to its child on Windows. Find
  and kill whatever's actually listening on port 4200 instead (see Run
  step 3).
- **The playwright-core browser cache path has a moving build number**
  (e.g. `chromium-1228`) and an OS-dependent subfolder name
  (`chrome-win64` vs. the older `chrome-win`). The driver searches for
  it (`findChrome()`) rather than hardcoding either — if Playwright
  gets upgraded and this still breaks, check
  `%LOCALAPPDATA%\ms-playwright\` for the actual folder name.

## Troubleshooting

- **`browserType.launch: Failed to launch chromium because executable
  doesn't exist at ...\chrome-win\chrome.exe`**: that path assumes the
  older `chrome-win` folder name; current `playwright-core` installs
  use `chrome-win64`. The driver already handles this — if you're
  hitting it, you're bypassing `findChrome()` with a hardcoded path
  somewhere.
- **`page.click`/`page.fill` times out after 30s with no other
  error**: usually means the element genuinely isn't there yet — e.g.
  clicking a party's link before one has been created. Reset state
  with `eval localStorage.clear(); location.reload()` and recreate
  whatever fixture data the script needs before navigating deeper.
