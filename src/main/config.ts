// Tunable thresholds and timings for the pet's behaviour.
export const config = {
  /** used_percentage at/above which the pet looks stressed. */
  warnThreshold: 80,
  /** used_percentage at/above which the pet panics + a notification fires. */
  criticalThreshold: 95,
  /** A fresh assistant transcript line within this window => "working". */
  workingWindowMs: 6_000,
  /** No activity for this long => "sleepy". */
  sleepyAfterMs: 5 * 60_000,
  /** How often main recomputes mood/countdowns and repaints. */
  tickMs: 1_000,
};
