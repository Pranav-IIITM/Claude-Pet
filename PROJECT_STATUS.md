# Project Status & Handoff

> **For any AI agent / developer picking this up:** read this file first. It is the
> source of truth for what exists, how it works, and what's next. **Keep it current —
> update the "Changelog" and relevant sections in the same commit whenever you change
> behaviour, and before every push.**

## What this is
Claude Pet — a lightweight Electron desktop companion. A borderless, transparent,
always-on-top pixel mascot (the coral Claude creature) that roams the screen, reacts
to you, and natively tracks **Claude Code** token usage & session limits in real time.
It works regardless of how Claude Code is run (CLI, VS Code extension, desktop app),
because all three share `~/.claude/`.

Scope framing: MVP = **Layer 1 (personality)** + **Layer 2 (Claude awareness)**.
Layers 3 (git/GitHub/CI/project awareness) and 4 (gamification: XP, evolution, skins,
achievements, seasonal) are modular, later. User-facing behaviour is in
`PET_ACTIVITIES.md`.

## How it works (data flow)
Two front-end-agnostic feeds:
1. **Native limits — status-line hook.** `bin/cc-pet-statusline.mjs`, registered as
   the `statusLine` command in `~/.claude/settings.json`, receives Claude Code's
   per-turn JSON on stdin, tees `rate_limits` (`five_hour`/`seven_day` →
   `used_percentage`, `resets_at`), `cost` and `model` to `~/.claude/pet/status.json`
   (atomic write), and prints a compact status bar back. This is the ONLY source of
   the real rate-limit %.
2. **Activity/tokens — transcript watcher.** Watches `~/.claude/projects/**/*.jsonl`
   and tails appended lines, summing `message.usage` tokens and reading `entrypoint`
   (surface) + model. Drives "working" mood and session token totals.

Electron **main** merges both (`UsageStore`), derives mood (`moodEngine`), fires
threshold alerts (`AlertManager`), drives autonomous movement (`RoamController`), and
pushes an `AppState` snapshot to the **renderer** (transparent pixel mascot + hover
stats panel + speech bubbles).

## File map
- `src/main/index.ts` — app lifecycle, tray, tick loop, mood-transition speech,
  **main-process hover polling** (cursor vs. live window bounds → click-through +
  panel), drag IPC.
- `src/main/window.ts` — transparent/frameless/always-on-top window (260×300), starts
  click-through.
- `src/main/roam.ts` — autonomous wandering; hover/drag/homed pausing; **home** in the
  bottom-right (`HOME_LIFT` lifts it above the taskbar; `HOME_SNAP` is the drop
  radius); drag follows `screen.getCursorScreenPoint()`.
- `src/main/moodEngine.ts` — pure mood derivation; **only sleeps when `homed`**.
- `src/main/alertManager.ts` — one OS notification per upward 80%/95% crossing.
- `src/main/data/{paths,statusFeed,transcriptFeed,usageStore}.ts` — data layer.
- `src/main/config.ts` — thresholds/timings.
- `src/preload/index.ts` — contextBridge: `onState/onWalk/onSpeak/onHover/dragStart/dragEnd`.
- `src/renderer/{index.html,styles.css,pet.ts}` — pixel mascot SVG (10px grid),
  mood animations, speech bubble, drag/click (pointer capture), stats panel.
- `bin/cc-pet-statusline.mjs` — status-line helper (standalone, crash-proof).
- `scripts/install-statusline.mjs` — idempotent/reversible merge into settings.json.
- `scripts/build.mjs` — esbuild bundler (main/preload/renderer).
- `assets/` — tray/app icons (coral mascot).

## Implemented
- Pixel Claude mascot, coral, mood-tinted; blink, bob, wiggle, shake, walk-hop.
- Autonomous roaming (mood-aware speed + rests); faces direction.
- **Idle micro-tricks** (one-shot CSS, played while resting): stretch, double-hop,
  spin, look-around, trip+recover (`·_·`), wave. Low-frequency, quiet by default.
- **Cursor look**: eyes track the pointer when nearby (`onLook`, from the main hover
  poll).
- Click (poke + reaction), **double-click** (BOOP), drag (cursor-follow, pointer
  capture) with **struggle** + **land** animations, **home** park/nap in the
  bottom-right, drag-out to resume.
- **Personality memory** (tiny, localStorage): poke/drag counts → occasional
  "boop again?".
- Moods: idle / working / **tired (≥60%)** / stressed (≥80) / panic (≥95) / sleepy
  (only when homed).
- Speech bubbles on mood transitions + idle chatter.
- Hover stats panel: 5h/7d gauges + reset countdowns, model, surface (CLI/VS Code/
  Desktop), session tokens, cost. Robust hover via main-process cursor polling.
- Near-limit OS alerts (80/95). Tray (show/hide, quit). Single-instance.

## Known limitations / gotchas
- Gauges need the `statusLine` hook installed (`npm run install-statusline`) AND a
  Pro/Max session's first response before `rate_limits` appear.
- Session tokens are counted since app start (not historical).
- Launch gotcha in this dev environment: `ELECTRON_RUN_AS_NODE=1` is set and must be
  cleared before launching, or Electron runs as plain Node (`app` undefined).

## Next (priority)
1. Command **success/failure** reactions (needs Claude Code hook events: Stop /
   PostToolUse — transcript alone can't cleanly signal this).
2. **Context-window %** reaction (separate from subscription limits).
3. **Multi-session** awareness ("N sessions active" / clones).
4. **Right-click menu** + click-to-open stats card + settings/pause.
5. Richer idle activities; then Layers 3–4.

## Build / run
- `npm install` → `npm run build` → `npm start` (dev: `npm run dev`).
- Package: `npm run dist` (electron-builder; Windows nsis+portable primary).
- Status-line hook: `npm run install-statusline` / `npm run uninstall-statusline`.

## Changelog
- **2026-10-07** (personality pass)
  - Moved home further into the bottom-right (`HOME_RIGHT`/`HOME_BOTTOM`), lower than
    before.
  - Added idle micro-tricks (stretch/hop/spin/look-around/trip/wave), cursor eye-
    tracking (`pet:look`), double-click BOOP, drag struggle + landing, and a `tired`
    mood tier (≥60%). Added tiny localStorage personality memory (poke/drag counts).
  - When parked at home the pet now stays completely still (no tricks, no cursor
    tracking) and only dozes off after a delay (`config.homeNapMs`), via
    `roam.homedSince` + `AppState.homed`.
- **2026-10-07**
  - Lowered the home spot so it sits just above the taskbar, not floating high.
  - Added `PET_ACTIVITIES.md` and this `PROJECT_STATUS.md`.
  - Fixed stuck stats panel: hover is now decided in the main process (cursor vs. live
    window bounds), robust to the window roaming out from under a stationary cursor.
  - Mood: pet only sleeps when homed; stays awake (idle) while roaming.
  - Added click-to-poke, cursor-follow dragging, and a **home** in the bottom-right
    (drop to park/nap, drag out to roam).
  - Redesigned the mascot as a faithful coral pixel creature (10px grid); regenerated
    tray/app icons.
  - Autonomous roaming + speech-bubble reaction layer.
  - Initial app: data layer (status-line hook + transcript watcher), limit gauges,
    moods, near-limit alerts, tray.
