import type {
  TrialResult, DifficultyLevel, GameSessionResult, CognitiveProfile,
  CognitiveDomain, CognitiveState, RLState, RLAction,
} from '../types';
import { calculateAccuracy, calculateReactionScore, calculateConsistency, mean, clamp } from './scoringEngine';

/**
 * Adaptive Prototype Engine.
 *
 * This is a deterministic, fully explainable rule engine — explicitly
 * NOT a trained model. Focus Finder uses a separate learned DQN in
 * `focusFinderDqn.ts`; the other NeuroPlay games use this rule-based
 * pipeline:
 *   performance data -> cognitive state -> fatigue/trend -> adaptive
 *   decision -> next difficulty
 * It is real and demonstrable today while remaining transparent.
 *
 * It goes beyond a fixed threshold (`if score < 50: decrease`) by
 * combining rolling-window accuracy, reaction-time drift, consecutive
 * errors, and session fatigue — so a single lucky or unlucky trial
 * can't swing the decision, and slowing-but-accurate performance is
 * read as fatigue rather than punished as failure.
 */

const WINDOW = 5;

function clampDifficulty(d: number): DifficultyLevel {
  return clamp(Math.round(d), 1, 5) as DifficultyLevel;
}

function trailingErrorStreak(trials: TrialResult[]): number {
  let streak = 0;
  for (let i = trials.length - 1; i >= 0; i--) {
    if (trials[i].correct) break;
    streak++;
  }
  return streak;
}

/** Within-session personalization: never moves more than one level at a time. */
export function updateDifficulty(
  trials: TrialResult[],
  currentDifficulty: DifficultyLevel,
  fatigueLevel: number,
): DifficultyLevel {
  if (trials.length < WINDOW) return currentDifficulty;

  const recent = trials.slice(-WINDOW);
  const accuracy = calculateAccuracy(recent);
  const errorStreak = trailingErrorStreak(trials);

  if (errorStreak >= 3) return clampDifficulty(currentDifficulty - 1);
  if (fatigueLevel >= 65) return clampDifficulty(currentDifficulty - 1);
  if (accuracy >= 85) return clampDifficulty(currentDifficulty + 1);
  if (accuracy < 55) return clampDifficulty(currentDifficulty - 1);
  return currentDifficulty;
}

/** Across-session personalization: rolling trend over recent session scores. */
export function calculateLearningTrend(recentScoresOldestFirst: number[]): CognitiveState['learningTrend'] {
  const n = recentScoresOldestFirst.length;
  if (n < 3) return 'stable';
  const window = recentScoresOldestFirst.slice(-6);
  const wn = window.length;
  const xs = window.map((_, i) => i);
  const xMean = mean(xs);
  const yMean = mean(window);
  let num = 0, den = 0;
  for (let i = 0; i < wn; i++) { num += (xs[i] - xMean) * (window[i] - yMean); den += (xs[i] - xMean) ** 2; }
  const slope = den === 0 ? 0 : num / den;
  return slope > 1.2 ? 'improving' : slope < -1.2 ? 'declining' : 'stable';
}

const EMPTY_DOMAIN_SCORES: CognitiveProfile = {
  verbalMemory: 50, visualMemory: 50, episodicMemory: 50, attention: 50,
  workingMemory: 50, processingSpeed: 50, cognitiveFlexibility: 50, executiveFunction: 50,
};

/** Rolling-average cognitive profile across recent sessions per domain,
 *  so one unusually good or bad session can't swing the whole profile. */
export function calculateCognitiveProfile(sessions: GameSessionResult[]): CognitiveProfile {
  const profile: CognitiveProfile = { ...EMPTY_DOMAIN_SCORES };
  (Object.keys(profile) as CognitiveDomain[]).forEach((domain) => {
    if (domain === 'executiveFunction') return; // derived below — no dedicated game
    const scores = sessions
      .filter((s) => s.domain === domain)
      .slice(0, 5)
      .map((s) => s.score);
    if (scores.length > 0) profile[domain] = Math.round(mean(scores));
  });
  // Executive function is a composite proxy (inhibitory control + switching +
  // working memory) since no single game isolates it in this prototype.
  profile.executiveFunction = Math.round(
    mean([profile.cognitiveFlexibility, profile.attention, profile.workingMemory]),
  );
  return profile;
}

export function calculateCognitiveState(
  trials: TrialResult[],
  currentDifficulty: DifficultyLevel,
  fatigueLevel: number,
  profile: CognitiveProfile,
  learningTrend: CognitiveState['learningTrend'],
  sessionProgress: number,
): CognitiveState {
  const accuracy = calculateAccuracy(trials);
  const reactionScore = calculateReactionScore(trials);
  const consistency = calculateConsistency(trials);
  const errorRate = trials.length ? Math.round(100 - accuracy) : 0;

  return {
    memoryScore: Math.round(mean([profile.verbalMemory, profile.visualMemory, profile.episodicMemory])),
    attentionScore: profile.attention,
    processingSpeed: profile.processingSpeed,
    executiveFunction: profile.executiveFunction,
    accuracy,
    reactionTime: reactionScore,
    errorRate,
    fatigueLevel,
    consistency,
    currentDifficulty,
    sessionProgress: clamp(sessionProgress, 0, 1),
    learningTrend,
  };
}

/**
 * Safe simulated RL-style policy. Implements the same State -> Action
 * interface a reinforcement-learning controller could use. It remains
 * deterministic and explainable, rather than learned.
 */
export function simulatedPolicy(state: RLState): RLAction {
  if (state.fatigue >= 70) return 'shortenSession';
  if (state.fatigue >= 55) return 'reduceDistractors';
  if (state.errorRate > 45) return 'decreaseDifficulty';
  if (state.accuracy >= 85 && state.learningTrend !== 'declining') return 'increaseDifficulty';
  if (state.accuracy < 55) return 'decreaseDifficulty';
  if (state.learningTrend === 'improving' && state.accuracy >= 70) return 'increaseDistractors';
  return 'maintainDifficulty';
}
