import { config } from "./config";
import type { GaugeState, PetMood } from "../shared/types";

function maxPercent(a: GaugeState, b: GaugeState): number {
  return Math.max(a.usedPercentage ?? 0, b.usedPercentage ?? 0);
}

/** Pure derivation of the pet's mood from the current merged state. */
export function deriveMood(input: {
  fiveHour: GaugeState;
  sevenDay: GaugeState;
  lastActivityTs: number;
  homedSince: number;
  now: number;
}): PetMood {
  const peak = maxPercent(input.fiveHour, input.sevenDay);
  if (peak >= config.criticalThreshold) return "panic";
  if (peak >= config.warnThreshold) return "stressed";

  const sinceActivity = input.now - input.lastActivityTs;
  if (input.lastActivityTs > 0 && sinceActivity <= config.workingWindowMs) return "working";

  // It only naps in its home — and only after settling there for a while.
  // Out roaming it stays awake.
  if (input.homedSince > 0 && input.now - input.homedSince >= config.homeNapMs) return "sleepy";

  // Mild tiredness as usage climbs (subtle, between idle and stressed).
  if (peak >= config.tiredThreshold) return "tired";
  return "idle";
}
