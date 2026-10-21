import type { TrialResult } from '../types';
import { clamp, mean } from './scoringEngine';

/** Prototype fatigue estimator — a heuristic indicator for training
 *  pacing, not a clinical fatigue diagnosis. Combines within-session
 *  reaction-time drift, error clustering, and elapsed trial count. */

export type FatigueBand = 'Low' | 'Moderate' | 'High';

export function estimateFatigue(trials: TrialResult[], sessionStartMs: number): number {
  if (trials.length < 4) return 0;

  const times = trials.map((t) => t.reactionTimeMs).filter((t): t is number => t !== null);
  let rtDrift = 0;
  if (times.length >= 6) {
    const early = mean(times.slice(0, Math.floor(times.length / 2)));
    const late  = mean(times.slice(Math.floor(times.length / 2)));
    rtDrift = early > 0 ? clamp((late - early) / early, 0, 1) : 0;
  }

  const recent = trials.slice(-6);
  const recentErrorRate = 1 - (recent.filter((t) => t.correct).length / recent.length);

  let consecutiveErrors = 0;
  let maxConsecutiveErrors = 0;
  for (const t of trials) {
    consecutiveErrors = t.correct ? 0 : consecutiveErrors + 1;
    maxConsecutiveErrors = Math.max(maxConsecutiveErrors, consecutiveErrors);
  }
  const streakFactor = clamp(maxConsecutiveErrors / 5, 0, 1);

  const elapsedMin = (Date.now() - sessionStartMs) / 60000;
  const durationFactor = clamp(elapsedMin / 8, 0, 1); // sessions beyond ~8 min build fatigue credit

  const fatigue = rtDrift * 40 + recentErrorRate * 30 + streakFactor * 20 + durationFactor * 10;
  return Math.round(clamp(fatigue, 0, 100));
}

export function fatigueBand(fatigueLevel: number): FatigueBand {
  return fatigueLevel >= 65 ? 'High' : fatigueLevel >= 35 ? 'Moderate' : 'Low';
}

export function restRecommendation(fatigueLevel: number): string | null {
  if (fatigueLevel < 65) return null;
  return 'You have completed several demanding rounds. Consider taking a short break before continuing.';
}
