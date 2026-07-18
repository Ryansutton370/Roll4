#!/usr/bin/env node
// REPL driver for Roll4 (an Angular SPA) — reads a script of commands from
// stdin, one per line, and drives a headless Chromium via playwright-core.
//
// Command vocabulary mirrors chromium-cli (nav/wait-for/fill/click/...) on
// purpose: chromium-cli is the standard driver for browser-driven apps in
// this environment, but it isn't installed in this container, so this
// script fills the same role using playwright-core directly.
//
// Usage:
//   node driver.mjs <<'EOF'
//   nav http://localhost:4200/parties
//   wait-for text=Parties
//   screenshot parties
//   EOF

import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const screenshotDir = join(__dirname, 'screenshots');
mkdirSync(screenshotDir, { recursive: true });

// playwright-core ships no browser binary of its own — it expects one at
// this well-known cache path. The installed folder name embeds a build
// number (e.g. chromium-1228) that shifts as playwright-core is upgraded,
// and the subfolder is chrome-win64 on 64-bit hosts vs. chrome-win on
// older/32-bit builds, so search rather than hardcode either.
function findChrome() {
  const base = join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (!existsSync(base)) {
    throw new Error(`ms-playwright cache not found at ${base}. Run: npx playwright install chromium`);
  }
  const dirs = readdirSync(base)
    .filter((d) => d.startsWith('chromium-'))
    .sort()
    .reverse();
  for (const d of dirs) {
    for (const sub of ['chrome-win64', 'chrome-win']) {
      const p = join(base, d, sub, 'chrome.exe');
      if (existsSync(p)) return p;
    }
  }
  throw new Error(`No chrome.exe found under ${base}. Run: npx playwright install chromium`);
}

async function readLines() {
  const rl = readline.createInterface({ input: process.stdin, terminal: false });
  const lines = [];
  for await (const line of rl) lines.push(line);
  return lines;
}

async function main() {
  const lines = await readLines();
  const browser = await chromium.launch({ executablePath: findChrome() });
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });

  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));

  let shotCount = 0;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const sp = line.indexOf(' ');
    const cmd = sp === -1 ? line : line.slice(0, sp);
    const rest = sp === -1 ? '' : line.slice(sp + 1).trim();
    console.log(`> ${line}`);

    try {
      switch (cmd) {
        case 'nav':
          await page.goto(rest);
          break;
        case 'wait-for': {
          const m = rest.match(/^text=(.+)$/);
          if (m) await page.getByText(m[1]).first().waitFor();
          else await page.waitForSelector(rest);
          break;
        }
        case 'fill': {
          const sep = rest.indexOf(' ');
          const selector = sep === -1 ? rest : rest.slice(0, sep);
          const value = sep === -1 ? '' : rest.slice(sep + 1);
          await page.fill(selector, value);
          break;
        }
        case 'click':
          await page.click(rest);
          break;
        case 'press':
          await page.keyboard.press(rest);
          break;
        case 'screenshot': {
          const name = rest || `shot-${++shotCount}`;
          const path = join(screenshotDir, `${name}.png`);
          await page.screenshot({ path, fullPage: true });
          console.log(`  saved ${path}`);
          break;
        }
        case 'eval':
          console.log('  =>', await page.evaluate(rest));
          break;
        case 'console':
          console.log('  errors:', JSON.stringify(errors));
          break;
        default:
          console.log(`  unknown command: ${cmd}`);
      }
    } catch (err) {
      console.log(`  ERROR: ${err.message}`);
    }
  }

  await browser.close();
  if (errors.length) {
    console.log(`\n${errors.length} console error(s) captured — see 'console' output above.`);
  }
}

main();
