import { BrowserWindow, screen } from "electron";
import type { PetMood } from "../shared/types";

// Must match the window size/margin in window.ts so the window stays on-screen.
const WIN_W = 260;
const WIN_H = 300;
// Home position offsets (negative pushes further into the corner). Tuned so the
// pet sits toward the bottom-right, just clear of the taskbar / tray.
const HOME_RIGHT = -30;
const HOME_BOTTOM = 40;
// Drop within this distance of the home spot => the pet goes home and sits.
const HOME_SNAP = 190;

type WalkMsg = { dir: 1 | -1; moving: boolean };

/**
 * Autonomous wandering + direct manipulation:
 *  - roams to random spots, mood-aware speed, rests between hops ("plays around")
 *  - sits still while hovered, while being dragged, or when "homed"
 *  - has a home in the bottom-right corner: dropping it there parks it until it
 *    is dragged back out
 */
export class RoamController {
  private timer: NodeJS.Timeout | null = null;
  private hover = false;
  private dragging = false;
  private homed = false;
  private homedAt = 0;
  private dragOffset = { x: 0, y: 0 };

  private target: { x: number; y: number } | null = null;
  private restUntil = 0;
  private lastDir: 1 | -1 = -1;
  private wasMoving = false;

  constructor(
    private getWindow: () => BrowserWindow | null,
    private getMood: () => PetMood,
  ) {}

  setHover(v: boolean): void {
    this.hover = v;
  }

  start(): void {
    this.timer = setInterval(() => this.tick(), 16);
  }
  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  get isHomed(): boolean {
    return this.homed;
  }
  /** Timestamp (ms) when the pet last arrived home, or 0 if not homed. */
  get homedSince(): number {
    return this.homed ? this.homedAt : 0;
  }
  get isDragging(): boolean {
    return this.dragging;
  }

  /** User grabbed the pet: follow the cursor, leave home. */
  beginDrag(): void {
    const win = this.getWindow();
    if (!win) return;
    const c = screen.getCursorScreenPoint();
    const [x, y] = win.getPosition();
    this.dragOffset = { x: c.x - x, y: c.y - y };
    this.dragging = true;
    this.homed = false;
    this.homedAt = 0;
    this.target = null;
    this.stopWalk();
  }

  /** User let go: snap home if dropped in the corner, else resume roaming. */
  endDrag(): boolean {
    this.dragging = false;
    const win = this.getWindow();
    if (!win) return this.homed;
    const [x, y] = win.getPosition();
    const home = this.homeSpot();
    if (Math.hypot(x - home.x, y - home.y) <= HOME_SNAP) {
      this.place(win, home.x, home.y);
      this.homed = true;
      this.homedAt = Date.now();
    } else {
      this.homed = false;
      this.homedAt = 0;
      this.restUntil = Date.now() + 600; // settle before wandering off
    }
    this.stopWalk();
    return this.homed;
  }

  private paused(mood: PetMood): boolean {
    return this.hover || this.dragging || this.homed || mood === "sleepy";
  }

  private workArea() {
    const win = this.getWindow();
    const disp = win ? screen.getDisplayMatching(win.getBounds()) : screen.getPrimaryDisplay();
    return disp.workArea;
  }

  /**
   * Move the window. Electron's native setPosition only accepts finite integers
   * and throws ("conversion failure") on NaN/Infinity; since this runs on a
   * timer, one bad coordinate would crash the whole main process. Drop any
   * non-finite coordinate instead of forwarding it.
   */
  private place(win: BrowserWindow, x: number, y: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    win.setPosition(Math.round(x), Math.round(y));
  }

  private homeSpot() {
    const a = this.workArea();
    return {
      x: a.x + a.width - WIN_W - HOME_RIGHT,
      y: a.y + a.height - WIN_H - HOME_BOTTOM,
    };
  }

  private pickTarget(): void {
    const a = this.workArea();
    const maxX = Math.max(a.x, a.x + a.width - WIN_W);
    const maxY = Math.max(a.y, a.y + a.height - WIN_H);
    const x = Math.round(a.x + Math.random() * (maxX - a.x));
    const y = Math.round(a.y + Math.random() * (maxY - a.y));
    // Skip this round if the display geometry gave us a non-finite spot.
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this.target = { x, y };
  }

  private speedFor(mood: PetMood): number {
    switch (mood) {
      case "panic": return 7;
      case "stressed": return 4.5;
      case "working": return 1.6;
      default: return 2.6;
    }
  }
  private restFor(mood: PetMood): number {
    if (mood === "panic") return 150 + Math.random() * 300;
    if (mood === "stressed") return 400 + Math.random() * 900;
    return 1200 + Math.random() * 4000;
  }

  private tick(): void {
    const win = this.getWindow();
    if (!win || win.isDestroyed() || !win.isVisible()) return;

    // Being dragged: glue the window to the cursor.
    if (this.dragging) {
      const c = screen.getCursorScreenPoint();
      this.place(win, c.x - this.dragOffset.x, c.y - this.dragOffset.y);
      return;
    }

    const mood = this.getMood();
    if (this.paused(mood)) {
      this.stopWalk();
      this.target = null;
      return;
    }

    const now = Date.now();
    if (now < this.restUntil) {
      this.stopWalk();
      return;
    }
    if (!this.target) this.pickTarget();
    if (!this.target) return;

    const step = this.speedFor(mood);
    const [x, y] = win.getPosition();
    const dx = this.target.x - x;
    const dy = this.target.y - y;
    const dist = Math.hypot(dx, dy);

    // Use !(dist > step) so a non-finite dist (NaN) also counts as "arrived"
    // and is handled here rather than falling through into the move math below.
    if (!(dist > step)) {
      this.place(win, this.target.x, this.target.y);
      this.target = null;
      this.restUntil = now + this.restFor(mood);
      this.stopWalk();
      return;
    }

    this.place(win, x + (dx / dist) * step, y + (dy / dist) * step);
    this.lastDir = dx >= 0 ? 1 : -1;
    this.wasMoving = true;
    this.emitWalk({ dir: this.lastDir, moving: true });
  }

  private stopWalk(): void {
    if (this.wasMoving) {
      this.wasMoving = false;
      this.emitWalk({ dir: this.lastDir, moving: false });
    }
  }

  private emitWalk(msg: WalkMsg): void {
    const win = this.getWindow();
    if (win && !win.isDestroyed()) win.webContents.send("pet:walk", msg);
  }
}
