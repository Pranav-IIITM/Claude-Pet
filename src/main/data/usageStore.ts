import type { GaugeState, Surface } from "../../shared/types";
import type { StatusSnapshot } from "./statusFeed";
import type { UsageEvent } from "./transcriptFeed";

const EMPTY_GAUGE: GaugeState = { usedPercentage: null, resetsAt: null };

/** Holds the merged raw state from both feeds. Mood is derived elsewhere. */
export class UsageStore {
  private fiveHour: GaugeState = { ...EMPTY_GAUGE };
  private sevenDay: GaugeState = { ...EMPTY_GAUGE };
  private statusModel: string | null = null;
  private costUsd: number | null = null;
  private hasRateLimits = false;

  private sessionTokens = new Map<string, number>();
  private activeSession: string | null = null;
  private activeSurface: Surface = "unknown";
  private activeModel: string | null = null;
  private lastActivityTs = 0;

  applyStatus(s: StatusSnapshot): void {
    this.fiveHour = s.fiveHour;
    this.sevenDay = s.sevenDay;
    this.statusModel = s.model;
    this.costUsd = s.costUsd;
    if (s.fiveHour.usedPercentage !== null || s.sevenDay.usedPercentage !== null) {
      this.hasRateLimits = true;
    }
  }

  applyUsage(e: UsageEvent): void {
    const key = e.sessionId ?? "unknown";
    this.sessionTokens.set(key, (this.sessionTokens.get(key) ?? 0) + e.tokens);
    this.activeSession = key;
    this.activeSurface = e.surface;
    if (e.model) this.activeModel = e.model;
    this.lastActivityTs = Math.max(this.lastActivityTs, e.timestamp, 0);
  }

  get lastActivity(): number {
    return this.lastActivityTs;
  }

  /** Raw (mood-less) view consumed by the mood engine and IPC. */
  snapshot() {
    const key = this.activeSession ?? "unknown";
    return {
      fiveHour: this.fiveHour,
      sevenDay: this.sevenDay,
      model: this.statusModel ?? this.activeModel,
      costUsd: this.costUsd,
      sessionTokens: this.sessionTokens.get(key) ?? 0,
      activeSurface: this.activeSurface,
      hasRateLimits: this.hasRateLimits,
      lastActivityTs: this.lastActivityTs,
    };
  }
}
