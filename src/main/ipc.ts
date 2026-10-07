import { BrowserWindow } from "electron";
import type { AppState } from "../shared/types";

export function pushState(win: BrowserWindow | null, state: AppState): void {
  if (win && !win.isDestroyed()) win.webContents.send("pet:state", state);
}

export function speak(win: BrowserWindow | null, text: string): void {
  if (win && !win.isDestroyed()) win.webContents.send("pet:speak", text);
}

export function sendHover(win: BrowserWindow | null, hovering: boolean): void {
  if (win && !win.isDestroyed()) win.webContents.send("pet:hover", hovering);
}

export function sendLook(win: BrowserWindow | null, dir: { x: number; y: number }): void {
  if (win && !win.isDestroyed()) win.webContents.send("pet:look", dir);
}
