# Pet Activities

What the Claude Pet does on your desktop today. (See `PROJECT_STATUS.md` for the
technical/implementation view.)

## Living on the desktop (Layer 1 — personality)
- **Roams around the screen** on its own: ambles to a random spot, rests and
  "plays" for a bit, then wanders off again.
- **Faces the way it walks** and does a little **walk-hop** while moving.
- **Micro "tricks" while resting** (quiet, low-frequency): a **stretch**, a **double
  hop**, a happy **spin**, a **look-around**, a **trip** followed by pretending
  nothing happened (`·_·`), and an occasional **wave** (👋).
- **Idle chatter**: occasional small speech bubbles while ambling (e.g. "la la la~",
  "where to?", "☕").
- **Naps only at home** — while roaming it stays awake. Once parked it **sits
  completely still** (no roaming, no tricks, no cursor-tracking) and **dozes off
  after a short while** (greyed out, eyes closed, "zzz…").

## Interaction (mouse)
- **Looks at your cursor** — when the pointer is nearby, its eyes track it (subtle).
- **Click it** → squash "poke" animation + a reaction bubble ("hi!", "boop!",
  "pet me!", "♥").
- **Double-click** → an exaggerated "BOOP!".
- **Drag it** → it follows your cursor anywhere, with a little **struggle** wiggle
  while carried and a **landing** squash when dropped.
- **Home (bottom-right corner)** → drop it there and it snaps home and settles —
  stays put, stops tricks and cursor-tracking, and nods off after a little while
  ("home sweet home"). Drag it back out and it starts roaming again ("wheee!").
  Home sits toward the bottom-right, just clear of the taskbar.
- **Hover it** → a stats panel pops up (and hides when you move away).
- **Remembers a little** — it keeps local counts of how often you poke/drag it and
  occasionally reacts ("boop again?").

## Claude awareness (Layer 2) — moods
Mood is driven by Claude Code usage and activity, in priority order:

| Mood | When | Looks like |
|------|------|-----------|
| **Panic** | 5h or 7d limit ≥ 95% | red, fast shake, "Almost out!" + OS alert |
| **Stressed** | limit ≥ 80% | amber, shake, "Careful…" + OS alert |
| **Working** | Claude generated a message in the last few seconds | brighter coral, wiggle, "Let's code!" |
| **Tired** | limit ≥ 60% (and not actively working) | muted coral, slower bob, "getting warm…" |
| **Idle** | awake, nothing happening, roaming | normal coral, gentle bob |
| **Sleepy** | parked at home and idle | greyed, closed eyes, "zzz…" |

Mood-change lines also include **"Done! 🎉"** (work finished) and **"We're back! ⚡"**
(recovered from a high-usage state).

## Stats panel (on hover)
- **5-hour** and **7-day** limit gauges with **used %** and a **reset countdown**.
- Active **model** and the **surface** in use (CLI / VS Code / Desktop).
- Current **session tokens** and estimated **cost**.
- Until Claude Code reports rate limits (Pro/Max, after the first response of a
  session), the gauges show "Waiting for first response…".

## Alerts
- A single OS notification when a limit window first crosses **80%** (warning) or
  **95%** (critical) — no repeat spam; it re-arms after the window drops/resets.

## Tray
- System-tray icon with **Show / Hide** and **Quit**.

## Not yet (planned)
Command success/failure reactions, context-window %, multi-session awareness,
richer idle activities (coffee/laptop/cursor-watching), right-click menu, settings,
and the later gamification/integration layers. See `PROJECT_STATUS.md`.
