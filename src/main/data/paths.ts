import { homedir } from "node:os";
import { join } from "node:path";

/** Root of the Claude Code config dir, honouring CLAUDE_CONFIG_DIR. */
export function claudeDir(): string {
  const override = process.env.CLAUDE_CONFIG_DIR?.trim();
  return override && override.length > 0 ? override : join(homedir(), ".claude");
}

export function projectsDir(): string {
  return join(claudeDir(), "projects");
}

export function settingsPath(): string {
  return join(claudeDir(), "settings.json");
}

/** Our own scratch dir under ~/.claude — the only place we write. */
export function petDir(): string {
  return join(claudeDir(), "pet");
}

export function statusFilePath(): string {
  return join(petDir(), "status.json");
}
