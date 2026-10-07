import { app, BrowserWindow, ipcMain, Menu, nativeImage, screen, Tray } from "electron";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { config } from "./config";
import { petDir } from "./data/paths";
import { StatusFeed } from "./data/statusFeed";
import { TranscriptFeed } from "./data/transcriptFeed";
import { UsageStore } from "./data/usageStore";
import { deriveMood } from "./moodEngine";
import { AlertManager } from "./alertManager";
import { RoamController } from "./roam";
import { createPetWindow } from "./window";
import { pushState, sendHover, speak } from "./ipc";
import type { AppState, PetMood } from "../shared/types";

let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let ticker: NodeJS.Timeout | null = null;
let hoverPoll: NodeJS.Timeout | null = null;
let roam: RoamController | null = null;
let lastMood: PetMood = "idle";
let hovering = false;

const store = new UsageStore();
const alerts = new AlertManager();
const statusFeed = new StatusFeed();
const transcriptFeed = new TranscriptFeed();

// A short line the pet says when its mood changes (Layer-2 Claude awareness).
function speechForTransition(prev: PetMood, next: PetMood): string | null {
  if (prev === next) return null;
  switch (next) {
    case "working": return "Let's code!";
    case "panic": return "Almost out!";
    case "stressed": return "Careful…";
    case "sleepy": return "zzz…";
    case "idle":
      if (prev === "working") return "Done! 🎉";
      if (prev === "panic" || prev === "stressed") return "We're back! ⚡";
      return null;
    default: return null;
  }
}

app.setName("Claude Pet");
// Single instance only.
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

function buildState(): AppState {
  const s = store.snapshot();
  const mood = deriveMood({
    fiveHour: s.fiveHour,
    sevenDay: s.sevenDay,
    lastActivityTs: s.lastActivityTs,
    homed: roam?.isHomed ?? false,
    now: Date.now(),
  });
  return {
    mood,
    fiveHour: s.fiveHour,
    sevenDay: s.sevenDay,
    model: s.model,
    sessionTokens: s.sessionTokens,
    costUsd: s.costUsd,
    activeSurface: s.activeSurface,
    hasRateLimits: s.hasRateLimits,
    updatedAt: Date.now(),
  };
}

function tick(): void {
  const state = buildState();
  alerts.check(state.fiveHour, state.sevenDay);
  const line = speechForTransition(lastMood, state.mood);
  if (line) speak(win, line);
  lastMood = state.mood;
  pushState(win, state);
}

// Hit areas within the window (px). The pet sits bottom-centre; the panel/speech
// occupy the space above it. Hover opens on the pet and stays while over either.
function hitRegions(b: Electron.Rectangle) {
  const cx = b.x + b.width / 2;
  return {
    pet: { x1: cx - 68, x2: cx + 68, y1: b.y + 178, y2: b.y + b.height },
    panel: { x1: b.x + 20, x2: b.x + b.width - 20, y1: b.y + 28, y2: b.y + 182 },
  };
}
function inside(p: { x: number; y: number }, r: { x1: number; x2: number; y1: number; y2: number }) {
  return p.x >= r.x1 && p.x <= r.x2 && p.y >= r.y1 && p.y <= r.y2;
}

// Decide hover from the live cursor vs. window bounds — robust to the window
// moving out from under a stationary cursor (which never fires DOM mouseleave).
function updateHover(): void {
  if (!win || win.isDestroyed() || !win.isVisible()) return;
  if (roam?.isDragging) {
    win.setIgnoreMouseEvents(false);
    return;
  }
  const cur = screen.getCursorScreenPoint();
  const r = hitRegions(win.getBounds());
  const next = hovering ? inside(cur, r.pet) || inside(cur, r.panel) : inside(cur, r.pet);
  if (next === hovering) return;
  hovering = next;
  win.setIgnoreMouseEvents(!next, { forward: false });
  roam?.setHover(next);
  sendHover(win, next);
}

function createTray(): void {
  let image = nativeImage.createFromPath(join(app.getAppPath(), "assets", "tray.png"));
  if (image.isEmpty()) image = nativeImage.createEmpty();
  tray = new Tray(image);
  tray.setToolTip("Claude Pet");
  const menu = Menu.buildFromTemplate([
    { label: "Claude Pet", enabled: false },
    { type: "separator" },
    {
      label: "Show / Hide",
      click: () => {
        if (!win) return;
        win.isVisible() ? win.hide() : win.show();
      },
    },
    { type: "separator" },
    { label: "Quit", role: "quit" },
  ]);
  tray.setContextMenu(menu);
  tray.on("click", () => win?.show());
}

app.whenReady().then(() => {
  mkdirSync(petDir(), { recursive: true });

  win = createPetWindow();
  roam = new RoamController(() => win, () => lastMood);
  createTray();
  roam.start();
  hoverPoll = setInterval(updateHover, 60);

  // Direct manipulation: drag follows the cursor; dropping in the corner parks
  // the pet at home; a click (no real movement) pokes it.
  ipcMain.on("pet:drag-start", () => {
    win?.setIgnoreMouseEvents(false);
    roam?.beginDrag();
  });
  ipcMain.on("pet:drag-end", (_e, wasClick: boolean) => {
    const homed = roam?.endDrag() ?? false;
    if (!wasClick) speak(win, homed ? "home sweet home" : "wheee!");
  });

  statusFeed.on("status", (snap) => {
    store.applyStatus(snap);
    tick();
  });
  transcriptFeed.on("usage", (ev) => {
    store.applyUsage(ev);
    tick();
  });
  statusFeed.start();
  transcriptFeed.start();

  ticker = setInterval(tick, config.tickMs);
  tick();
});

app.on("second-instance", () => win?.show());
// Registering this listener (even empty) keeps the app alive in the tray
// after the pet window is closed, instead of Electron's default quit.
app.on("window-all-closed", () => {});

app.on("before-quit", () => {
  if (ticker) clearInterval(ticker);
  if (hoverPoll) clearInterval(hoverPoll);
  roam?.stop();
  statusFeed.stop();
  transcriptFeed.stop();
});
