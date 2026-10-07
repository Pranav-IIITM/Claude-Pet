import { BrowserWindow, screen } from "electron";
import type { PetMood } from "../shared/types";

// Must match the window size/margin in window.ts so the window stays on-screen.
const WIN_W = 260;
const WIN_H = 300;
const MARGIN = 24;
// Lift home above the taskbar / system tray so the pet doesn't overlap it.
const HOME_LIFT = 36;
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
      win.setPosition(home.x, home.y);
      this.homed = true;
    } else {
      this.homed = false;
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

  private homeSpot() {
    const a = this.workArea();
    return {
      x: a.x + a.width - WIN_W - MARGIN,
      y: a.y + a.height - WIN_H - MARGIN - HOME_LIFT,
    };
  }

  private pickTarget(): void {
    const a = this.workArea();
    const maxX = Math.max(a.x, a.x + a.width - WIN_W);
    const maxY = Math.max(a.y, a.y + a.height - WIN_H);
    this.target = {
      x: Math.round(a.x + Math.random() * (maxX - a.x)),
      y: Math.round(a.y + Math.random() * (maxY - a.y)),
    };
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
      win.setPosition(c.x - this.dragOffset.x, c.y - this.dragOffset.y);
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

    if (dist <= step) {
      win.setPosition(this.target.x, this.target.y);
      this.target = null;
      this.restUntil = now + this.restFor(mood);
      this.stopWalk();
      return;
    }

    win.setPosition(Math.round(x + (dx / dist) * step), Math.round(y + (dy / dist) * step));
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
