import type { TrialResult, DifficultyLevel } from '../types';

/** Transparent scoring helpers; Focus Finder's learned adaptation is
 *  implemented separately in focusFinderDqn.ts. */

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const mean = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

export function calculateAccuracy(trials: TrialResult[]): number {
  if (trials.length === 0) return 0;
  const correct = trials.filter((t) => t.correct).length;
  return Math.round((correct / trials.length) * 100);
}

/** Faster + more consistent reaction time -> higher score (0-100). */
export function calculateReactionScore(trials: TrialResult[]): number {
  const times = trials.map((t) => t.reactionTimeMs).filter((t): t is number => t !== null);
  if (times.length === 0) return 100; // games with no timed component don't penalise
  const avg = mean(times);
  // 400ms -> ~100, 2500ms -> ~0, roughly linear in between
  return Math.round(clamp((1 - (avg - 400) / 2100) * 100, 0, 100));
}

export function calculateConsistency(trials: TrialResult[]): number {
  const times = trials.map((t) => t.reactionTimeMs).filter((t): t is number => t !== null);
  if (times.length < 2) return 100;
  const avg = mean(times);
  const variance = mean(times.map((t) => (t - avg) ** 2));
  const cv = avg > 0 ? Math.sqrt(variance) / avg : 0; // coefficient of variation
  return Math.round(clamp((1 - cv) * 100, 0, 100));
}

/** Difficulty contributes credit for attempting harder levels, so two
 *  players at the same accuracy but different difficulty aren't scored
 *  identically — directly addresses "lack of nuance" from the brief. */
export function calculateDifficultyContribution(difficulty: DifficultyLevel): number {
  return ((difficulty - 1) / 4) * 100; // level 1 -> 0, level 5 -> 100
}

/** Composite 0-100 performance score for a completed game session. */
export function calculateSessionScore(trials: TrialResult[], difficultyEnd: DifficultyLevel): number {
  if (trials.length === 0) return 0;
  const accuracy   = calculateAccuracy(trials);
  const reaction    = calculateReactionScore(trials);
  const consistency = calculateConsistency(trials);
  const difficulty   = calculateDifficultyContribution(difficultyEnd);

  const score = accuracy * 0.45 + reaction * 0.20 + consistency * 0.15 + difficulty * 0.20;
  return Math.round(clamp(score, 0, 100));
}
