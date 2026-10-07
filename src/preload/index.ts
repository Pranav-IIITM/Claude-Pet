import { contextBridge, ipcRenderer } from "electron";
import type { AppState } from "../shared/types";

export interface WalkMsg {
  dir: 1 | -1;
  moving: boolean;
}

export interface LookMsg {
  x: number;
  y: number;
}

contextBridge.exposeInMainWorld("pet", {
  onState(cb: (state: AppState) => void): void {
    ipcRenderer.on("pet:state", (_e, state: AppState) => cb(state));
  },
  onWalk(cb: (msg: WalkMsg) => void): void {
    ipcRenderer.on("pet:walk", (_e, msg: WalkMsg) => cb(msg));
  },
  onSpeak(cb: (text: string) => void): void {
    ipcRenderer.on("pet:speak", (_e, text: string) => cb(text));
  },
  onHover(cb: (hovering: boolean) => void): void {
    ipcRenderer.on("pet:hover", (_e, hovering: boolean) => cb(hovering));
  },
  onLook(cb: (dir: LookMsg) => void): void {
    ipcRenderer.on("pet:look", (_e, dir: LookMsg) => cb(dir));
  },
  dragStart(): void {
    ipcRenderer.send("pet:drag-start");
  },
  dragEnd(wasClick: boolean): void {
    ipcRenderer.send("pet:drag-end", wasClick);
  },
});
