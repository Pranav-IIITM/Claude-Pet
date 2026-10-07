import { EventEmitter } from "node:events";
import { createReadStream, statSync } from "node:fs";
import chokidar, { type FSWatcher } from "chokidar";
import { projectsDir } from "./paths";
import type { Surface } from "../../shared/types";

export interface UsageEvent {
  sessionId: string | null;
  surface: Surface;
  model: string | null;
  tokens: number;
  timestamp: number;
}

function surfaceOf(entrypoint: unknown): Surface {
  if (typeof entrypoint !== "string") return "unknown";
  const e = entrypoint.toLowerCase();
  if (e.includes("vscode")) return "vscode";
  if (e.includes("desktop")) return "desktop";
  if (e.includes("cli")) return "cli";
  return "unknown";
}

function tokensOf(usage: Record<string, unknown> | undefined): number {
  if (!usage) return 0;
  const n = (k: string) => (typeof usage[k] === "number" ? (usage[k] as number) : 0);
  return (
    n("input_tokens") +
    n("output_tokens") +
    n("cache_creation_input_tokens") +
    n("cache_read_input_tokens")
  );
}

/**
 * Watches ~/.claude/projects recursively and tails appended lines of every
 * *.jsonl transcript (CLI, VS Code and desktop all write here), emitting the
 * token usage of each assistant message.
 */
export class TranscriptFeed extends EventEmitter {
  private watcher?: FSWatcher;
  private offsets = new Map<string, number>();
  private leftovers = new Map<string, string>();

  start(): void {
    this.watcher = chokidar.watch(projectsDir(), {
      ignoreInitial: true, // only new activity after launch
      awaitWriteFinish: { stabilityThreshold: 120, pollInterval: 40 },
    });
    const handle = (p: string) => {
      if (p.endsWith(".jsonl")) this.readNew(p);
    };
    this.watcher
      .on("add", (p) => {
        if (p.endsWith(".jsonl")) this.offsets.set(p, 0);
        handle(p);
      })
      .on("change", handle);
  }

  private readNew(file: string): void {
    let size: number;
    try {
      size = statSync(file).size;
    } catch {
      return;
    }
    const start = this.offsets.get(file) ?? size; // unseen file: start at EOF
    if (size <= start) {
      this.offsets.set(file, size);
      return;
    }
    this.offsets.set(file, size);

    const stream = createReadStream(file, { start, end: size - 1, encoding: "utf8" });
    let buf = this.leftovers.get(file) ?? "";
    stream.on("data", (chunk) => {
      buf += chunk;
      const lines = buf.split("\n");
      buf = lines.pop() ?? ""; // keep trailing partial line
      for (const line of lines) this.parseLine(line);
    });
    stream.on("end", () => this.leftovers.set(file, buf));
    stream.on("error", () => {});
  }

  private parseLine(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) return;
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      return;
    }
    if (obj.type !== "assistant") return;
    const message = obj.message as Record<string, unknown> | undefined;
    const usage = message?.usage as Record<string, unknown> | undefined;
    const tokens = tokensOf(usage);
    if (tokens <= 0) return;
    const ts = Date.parse(String(obj.timestamp ?? "")) || Date.now();
    this.emit("usage", {
      sessionId: typeof obj.sessionId === "string" ? obj.sessionId : null,
      surface: surfaceOf(obj.entrypoint),
      model: typeof message?.model === "string" ? (message.model as string) : null,
      tokens,
      timestamp: ts,
    } satisfies UsageEvent);
  }

  stop(): void {
    void this.watcher?.close();
  }
}
