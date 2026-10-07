#!/usr/bin/env node
// Idempotent, reversible installer for the Claude Pet status-line hook.
//
//   node scripts/install-statusline.mjs install
//   node scripts/install-statusline.mjs uninstall
//
// It MERGES into ~/.claude/settings.json and never clobbers an existing,
// unrelated statusLine (it warns and leaves it in place instead).

import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const HELPER = resolve(here, "..", "bin", "cc-pet-statusline.mjs");

function claudeDir() {
  const o = (process.env.CLAUDE_CONFIG_DIR || "").trim();
  return o.length ? o : join(homedir(), ".claude");
}
const SETTINGS = join(claudeDir(), "settings.json");

// Marker so we recognise our own entry on uninstall / re-install.
const ours = () => `node "${HELPER}"`;
const isOurs = (cmd) => typeof cmd === "string" && cmd.includes("cc-pet-statusline.mjs");

function readSettings() {
  if (!existsSync(SETTINGS)) return {};
  try {
    return JSON.parse(readFileSync(SETTINGS, "utf8") || "{}");
  } catch {
    console.error(`! ${SETTINGS} is not valid JSON — aborting so nothing is lost.`);
    process.exit(1);
  }
}

function backupAndWrite(obj) {
  mkdirSync(claudeDir(), { recursive: true });
  if (existsSync(SETTINGS)) copyFileSync(SETTINGS, SETTINGS + ".claudepet.bak");
  writeFileSync(SETTINGS, JSON.stringify(obj, null, 2) + "\n");
}

function install() {
  const s = readSettings();
  const existing = s.statusLine;
  if (existing && existing.command && !isOurs(existing.command)) {
    console.error("! An unrelated statusLine is already configured:");
    console.error(`    ${existing.command}`);
    console.error("  Leaving it untouched. Remove it yourself first if you want Claude Pet's,");
    console.error("  or keep both by chaining your command into cc-pet-statusline.mjs.");
    process.exit(2);
  }
  s.statusLine = { type: "command", command: ours() };
  backupAndWrite(s);
  console.log("✓ statusLine installed →", ours());
  console.log("  Applies to the CLI, VS Code extension and desktop app.");
}

function uninstall() {
  const s = readSettings();
  if (s.statusLine && isOurs(s.statusLine.command)) {
    delete s.statusLine;
    backupAndWrite(s);
    console.log("✓ Claude Pet statusLine removed.");
  } else {
    console.log("· No Claude Pet statusLine found; nothing to do.");
  }
}

const cmd = process.argv[2];
if (cmd === "install") install();
else if (cmd === "uninstall") uninstall();
else {
  console.log("usage: node scripts/install-statusline.mjs <install|uninstall>");
  process.exit(1);
}
