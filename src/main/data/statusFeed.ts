import { EventEmitter } from "node:events";
import { readFile } from "node:fs/promises";
import chokidar, { type FSWatcher } from "chokidar";
import { petDir, statusFilePath } from "./paths";
import type { GaugeState } from "../../shared/types";

export interface StatusSnapshot {
  fiveHour: GaugeState;
  sevenDay: GaugeState;
  model: string | null;
  costUsd: number | null;
  updatedAt: number;
}

const EMPTY_GAUGE: GaugeState = { usedPercentage: null, resetsAt: null };

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function parseGauge(v: unknown): GaugeState {
  if (!v || typeof v !== "object") return { ...EMPTY_GAUGE };
  const o = v as Record<string, unknown>;
  return { usedPercentage: num(o.usedPercentage), resetsAt: num(o.resetsAt) };
}

/** Watches ~/.claude/pet/status.json written by the status-line helper. */
export class StatusFeed extends EventEmitter {
  private watcher?: FSWatcher;

  start(): void {
    void this.read();
    // Watch the dir (the file is written via atomic rename, so the inode changes).
    this.watcher = chokidar.watch(petDir(), {
      ignoreInitial: true,
      depth: 0,
      awaitWriteFinish: { stabilityThreshold: 120, pollInterval: 40 },
    });
    const onEvent = (p: string) => {
      if (p.endsWith("status.json")) void this.read();
    };
    this.watcher.on("add", onEvent).on("change", onEvent);
  }

  private async read(): Promise<void> {
    try {
      const raw = await readFile(statusFilePath(), "utf8");
      const data = JSON.parse(raw) as Record<string, unknown>;
      const rl = (data.rateLimits ?? {}) as Record<string, unknown>;
      const snap: StatusSnapshot = {
        fiveHour: parseGauge(rl.fiveHour),
        sevenDay: parseGauge(rl.sevenDay),
        model: typeof data.model === "string" ? data.model : null,
        costUsd: num(data.costUsd),
        updatedAt: num(data.updatedAt) ?? Date.now(),
      };
      this.emit("status", snap);
    } catch {
      // Missing/partial file is normal before the first turn; ignore.
    }
  }

  stop(): void {
    void this.watcher?.close();
  }
}
