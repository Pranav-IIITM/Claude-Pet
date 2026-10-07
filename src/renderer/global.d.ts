import type { AppState } from "../shared/types";
import type { WalkMsg, LookMsg } from "../preload/index";

declare global {
  interface Window {
    pet: {
      onState(cb: (state: AppState) => void): void;
      onWalk(cb: (msg: WalkMsg) => void): void;
      onSpeak(cb: (text: string) => void): void;
      onHover(cb: (hovering: boolean) => void): void;
      onLook(cb: (dir: LookMsg) => void): void;
      dragStart(): void;
      dragEnd(wasClick: boolean): void;
    };
  }
}

export {};
