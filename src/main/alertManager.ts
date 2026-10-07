import { Notification } from "electron";
import { config } from "./config";
import type { GaugeState } from "../shared/types";

type Level = "ok" | "warn" | "critical";
type WindowKey = "five_hour" | "seven_day";

function levelOf(pct: number | null): Level {
  if (pct === null) return "ok";
  if (pct >= config.criticalThreshold) return "critical";
  if (pct >= config.warnThreshold) return "warn";
  return "ok";
}

const LABEL: Record<WindowKey, string> = {
  five_hour: "5-hour",
  seven_day: "7-day",
};

/** Fires one OS notification per upward threshold crossing, per window. */
export class AlertManager {
  private last: Record<WindowKey, Level> = { five_hour: "ok", seven_day: "ok" };

  check(fiveHour: GaugeState, sevenDay: GaugeState): void {
    this.evaluate("five_hour", fiveHour.usedPercentage);
    this.evaluate("seven_day", sevenDay.usedPercentage);
  }

  private evaluate(key: WindowKey, pct: number | null): void {
    const level = levelOf(pct);
    const prev = this.last[key];
    const rank = { ok: 0, warn: 1, critical: 2 } as const;
    if (rank[level] > rank[prev]) {
      this.notify(key, level, pct ?? 0);
    }
    this.last[key] = level;
  }

  private notify(key: WindowKey, level: Level, pct: number): void {
    if (!Notification.isSupported()) return;
    const title = level === "critical" ? "Almost out of Claude usage!" : "Claude usage getting high";
    const body = `${LABEL[key]} limit at ${Math.round(pct)}%.`;
    new Notification({ title, body, urgency: level === "critical" ? "critical" : "normal" }).show();
  }
}
