// Types shared between the Electron main process and the renderer.

export type PetMood = "sleepy" | "idle" | "working" | "tired" | "stressed" | "panic";

export type Surface = "cli" | "vscode" | "desktop" | "unknown";

export interface GaugeState {
  /** 0-100, or null when the limit feed hasn't reported yet. */
  usedPercentage: number | null;
  /** Unix epoch seconds when this window resets, or null. */
  resetsAt: number | null;
}

/** A single snapshot pushed from main to the renderer on every update. */
export interface AppState {
  mood: PetMood;
  fiveHour: GaugeState;
  sevenDay: GaugeState;
  model: string | null;
  /** Tokens counted on the active session since the app started. */
  sessionTokens: number;
  costUsd: number | null;
  activeSurface: Surface;
  /** True once the native rate-limit feed has reported at least once. */
  hasRateLimits: boolean;
  /** True while the pet is parked in its home corner. */
  homed: boolean;
  updatedAt: number;
}
