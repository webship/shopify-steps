#!/usr/bin/env node
'use strict';

// Runs the read-only checks of tests/live/ against real public stores, gently, by hand.
//
// Each file is named after the store it reads: tests/live/ugmonk.com.feature runs with
// LAUNCH_URL=https://ugmonk.com. The checks only read: they never add to a cart, sign in, place
// an order or send a form. Each scenario loads one page (plus what the theme itself fetches), and
// the runner waits LIVE_PAUSE_MS (8 seconds by default) between two scenarios, so a run asks a
// store for a few pages, slowly. They are not part of CI on every push.
//
// Usage:
//   npm run test:live                    every store, one scenario at a time
//   npm run test:live -- ugmonk.com      one store
//   LIVE_PAUSE_MS=15000 npm run test:live -- www.thesill.com

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const LIVE_DIR = path.join(ROOT, 'tests', 'live');
const PAUSE = Math.max(Number(process.env.LIVE_PAUSE_MS || 8000), 3000);
const only = process.argv.slice(2);

const files = fs.readdirSync(LIVE_DIR)
  .filter((f) => f.endsWith('.feature'))
  .filter((f) => !only.length || only.includes(path.basename(f, '.feature')));

if (!files.length) {
  console.error(`No live feature found${only.length ? ` for: ${only.join(', ')}` : ''}.`);
  process.exit(1);
}

function pause(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

let failed = 0;
let runs = 0;
for (const file of files) {
  const host = path.basename(file, '.feature');
  const url = `https://${host}`;
  const lines = fs.readFileSync(path.join(LIVE_DIR, file), 'utf8').split('\n');
  const scenarios = lines.map((l, i) => (/^\s*Scenario( Outline)?:/.test(l) ? i + 1 : null)).filter(Boolean);
  for (const line of scenarios) {
    if (runs) pause(PAUSE);
    runs += 1;
    console.log(`\n== ${file}:${line} against ${url}`);
    const result = spawnSync('npx', ['cucumber-js', '--config', 'cucumber.js', `tests/live/${file}:${line}`], {
      cwd: ROOT,
      stdio: ['ignore', 'inherit', 'inherit'],
      env: Object.assign({}, process.env, { LAUNCH_URL: url, CUCUMBER_TAGS: '@live', FEATURES: '', WEBSHIP_REPORT_DISABLE: '1' }),
    });
    if (result.status !== 0) failed += 1;
  }
}
console.log(`\n${runs} live scenario(s), ${failed} failed.`);
process.exit(failed ? 1 : 0);
