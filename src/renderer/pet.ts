import type { AppState, GaugeState, PetMood, Surface } from "../shared/types";
import type { WalkMsg } from "../preload/index";

const WARN = 80;
const CRIT = 95;

const EMOTES: Partial<Record<PetMood, string>> = {
  sleepy: "z",
  stressed: "!",
  panic: "!!",
};
const SURFACE_LABEL: Record<Surface, string> = {
  cli: "CLI",
  vscode: "VS Code",
  desktop: "Desktop",
  unknown: "—",
};

const $ = (id: string) => document.getElementById(id)!;

const stage = $("stage");
const panel = $("panel");
const speech = $("speech");
const pet = $("pet");
const bodyGroup = document.querySelector<SVGGElement>("#body-group")!;

let latest: AppState | null = null;

/* ---------- interaction state ---------- */
// Hover is decided in the main process (cursor vs. live window bounds) and
// pushed here, which is robust to the window roaming out from under the cursor.
let hovered = false;
let dragging = false;
let moved = 0;
window.pet.onHover((h) => {
  hovered = h;
  panel.classList.toggle("show", h);
  panel.setAttribute("aria-hidden", String(!h));
});

/* ---------- movement (facing + walk hop) ---------- */
window.pet.onWalk((msg: WalkMsg) => {
  stage.classList.toggle("walking", msg.moving);
  bodyGroup.style.transform = msg.dir === 1 ? "scaleX(-1)" : "scaleX(1)";
});

/* ---------- drag + click (main moves the window) ---------- */
const POKE_LINES = ["hi!", "boop!", "yes?", "hehe", "pet me!", "♥"];
pet.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  dragging = true;
  moved = 0;
  try {
    pet.setPointerCapture(e.pointerId);
  } catch {
    /* ignore */
  }
  window.pet.dragStart();
  e.preventDefault();
});
pet.addEventListener("pointermove", (e) => {
  if (dragging) moved += Math.abs(e.movementX) + Math.abs(e.movementY);
});
pet.addEventListener("pointerup", (e) => {
  if (!dragging) return;
  dragging = false;
  try {
    pet.releasePointerCapture(e.pointerId);
  } catch {
    /* ignore */
  }
  const wasClick = moved < 6;
  window.pet.dragEnd(wasClick);
  if (wasClick) poke();
});
function poke() {
  say(POKE_LINES[Math.floor(Math.random() * POKE_LINES.length)], 1500);
  pet.classList.remove("poke");
  void pet.offsetWidth; // restart animation
  pet.classList.add("poke");
}
pet.addEventListener("animationend", () => pet.classList.remove("poke"));

/* ---------- speech bubble ---------- */
let speechTimer: number | undefined;
function say(text: string, ms = 2800) {
  speech.textContent = text;
  speech.classList.add("show");
  speech.setAttribute("aria-hidden", "false");
  window.clearTimeout(speechTimer);
  speechTimer = window.setTimeout(() => {
    speech.classList.remove("show");
    speech.setAttribute("aria-hidden", "true");
  }, ms);
}
window.pet.onSpeak((text) => say(text));

// Layer-1 personality: occasional idle chatter while ambling.
const IDLE_LINES = ["hmm…", "la la la~", "where to?", "☕", "nice day", "boop"];
setInterval(() => {
  if (hovered || dragging || !latest || latest.mood !== "idle") return;
  if (Math.random() < 0.35) say(IDLE_LINES[Math.floor(Math.random() * IDLE_LINES.length)], 2000);
}, 22_000);

/* ---------- formatting ---------- */
function fmtTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M tokens";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k tokens";
  return `${n} tokens`;
}
function fmtReset(resetsAt: number | null): string {
  if (!resetsAt) return "—";
  const secs = Math.floor(resetsAt - Date.now() / 1000);
  if (secs <= 0) return "resetting";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return "<1m";
}
function levelClass(pct: number | null): string {
  if (pct === null) return "";
  if (pct >= CRIT) return "crit";
  if (pct >= WARN) return "warn";
  return "";
}
function renderGauge(g: GaugeState, fill: HTMLElement, pctEl: HTMLElement, resetEl: HTMLElement) {
  const pct = g.usedPercentage;
  fill.style.width = `${Math.min(100, Math.max(0, pct ?? 0))}%`;
  fill.className = `fill ${levelClass(pct)}`.trim();
  pctEl.textContent = pct === null ? "—" : `${pct.toFixed(1)}%`;
  resetEl.textContent = fmtReset(g.resetsAt);
}

/* ---------- main render ---------- */
function render(state: AppState) {
  stage.classList.remove("mood-idle", "mood-working", "mood-sleepy", "mood-stressed", "mood-panic");
  stage.classList.add(`mood-${state.mood}`);
  $("emote").textContent = EMOTES[state.mood] ?? "";

  panel.classList.toggle("no-limits", !state.hasRateLimits);
  $("surface-tag").textContent = SURFACE_LABEL[state.activeSurface];
  $("model").textContent = state.model ?? "—";

  renderGauge(state.fiveHour, $("five-fill"), $("five-pct"), $("five-reset"));
  renderGauge(state.sevenDay, $("seven-fill"), $("seven-pct"), $("seven-reset"));

  const cost = state.costUsd !== null ? `  ·  $${state.costUsd.toFixed(2)}` : "";
  $("tokens").textContent = fmtTokens(state.sessionTokens) + cost;
}

window.pet.onState((state) => {
  latest = state;
  render(state);
});

// Keep reset countdowns ticking smoothly between state pushes.
setInterval(() => {
  if (!latest) return;
  $("five-reset").textContent = fmtReset(latest.fiveHour.resetsAt);
  $("seven-reset").textContent = fmtReset(latest.sevenDay.resetsAt);
}, 1000);
