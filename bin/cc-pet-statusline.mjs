#!/usr/bin/env node
// Claude Code status-line helper for Claude Pet.
//
// Claude Code runs this on every turn (CLI, VS Code extension and desktop app)
// and pipes a JSON status object on stdin. We tee the rate-limit / cost fields
// to ~/.claude/pet/status.json for the pet to read, then print a compact status
// line so the user still gets a useful bar. It must never throw.

import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync, writeFileSync, renameSync } from "node:fs";

function claudeDir() {
  const o = (process.env.CLAUDE_CONFIG_DIR || "").trim();
  return o.length ? o : join(homedir(), ".claude");
}

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (data += c));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", () => resolve(data));
    // If nothing is piped, don't hang forever.
    setTimeout(() => resolve(data), 2000).unref?.();
  });
}

function gauge(g) {
  if (!g || typeof g !== "object") return { usedPercentage: null, resetsAt: null };
  const p = typeof g.used_percentage === "number" ? g.used_percentage : null;
  const r = typeof g.resets_at === "number" ? g.resets_at : null;
  return { usedPercentage: p, resetsAt: r };
}

function bar(pct) {
  if (pct === null) return "····";
  const filled = Math.max(0, Math.min(4, Math.round(pct / 25)));
  return "▓".repeat(filled) + "░".repeat(4 - filled);
}

function shortReset(resetsAt) {
  if (!resetsAt) return "";
  const s = Math.floor(resetsAt - Date.now() / 1000);
  if (s <= 0) return "·reset";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return "·" + (h > 0 ? `${h}h${m}m` : `${m}m`);
}

async function main() {
  const raw = (await readStdin()).replace(/^﻿/, "");
  let input = {};
  try {
    input = JSON.parse(raw);
  } catch {
    input = {};
  }

  const rl = input.rate_limits || {};
  const five = gauge(rl.five_hour);
  const seven = gauge(rl.seven_day);
  const model =
    (input.model && (input.model.display_name || input.model.id)) || null;
  const costUsd =
    input.cost && typeof input.cost.total_cost_usd === "number"
      ? input.cost.total_cost_usd
      : null;

  // Tee for the pet (atomic write).
  try {
    const dir = join(claudeDir(), "pet");
    mkdirSync(dir, { recursive: true });
    const payload = {
      rateLimits: { fiveHour: five, sevenDay: seven },
      model,
      costUsd,
      sessionId: input.session_id ?? null,
      transcriptPath: input.transcript_path ?? null,
      updatedAt: Date.now(),
    };
    const tmp = join(dir, `status.${process.pid}.tmp`);
    writeFileSync(tmp, JSON.stringify(payload));
    renameSync(tmp, join(dir, "status.json"));
  } catch {
    // Teeing is best-effort; never break the status line.
  }

  // Compact status line back to the user.
  let line;
  if (five.usedPercentage !== null || seven.usedPercentage !== null) {
    const parts = [];
    if (five.usedPercentage !== null)
      parts.push(`5h ${bar(five.usedPercentage)} ${Math.round(five.usedPercentage)}%${shortReset(five.resetsAt)}`);
    if (seven.usedPercentage !== null)
      parts.push(`7d ${bar(seven.usedPercentage)} ${Math.round(seven.usedPercentage)}%`);
    if (model) parts.push(model);
    line = parts.join("  ");
  } else {
    const dir = input.workspace && input.workspace.current_dir ? input.workspace.current_dir : input.cwd;
    const base = dir ? String(dir).replace(/[\\/]+$/, "").split(/[\\/]/).pop() : "";
    line = [model, base].filter(Boolean).join(" · ") || "Claude";
  }
  process.stdout.write(line);
}

main().catch(() => process.stdout.write("Claude"));
