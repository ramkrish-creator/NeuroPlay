import type { CognitiveDomain, CognitiveProfile, GameId, GameSessionResult } from '../types';
import { DOMAIN_LABEL, GAME_META } from '../types';
import { calculateLearningTrend } from './adaptiveEngine';
import { fatigueBand } from './fatigueEngine';

/** Human-readable, explainable recommendations — never diagnostic language. */

export function generateGameRecommendation(
  session: GameSessionResult,
  priorScoresForDomain: number[],
): string {
  const trend = calculateLearningTrend([...priorScoresForDomain, session.score]);
  const label = GAME_META[session.gameId].name;

  if (fatigueBand(session.fatigueLevel) === 'High') {
    return `Fatigue was elevated during this ${label} session. Next time, today's tasks will begin at a slightly gentler difficulty.`;
  }
  if (trend === 'improving' && session.accuracy >= 80) {
    return `Your ${label.toLowerCase()} performance has improved across recent sessions. The difficulty will increase slightly next time.`;
  }
  if (trend === 'declining') {
    return `Accuracy has dipped a little in ${label.toLowerCase()}. The next session will stay at a comfortable difficulty to rebuild consistency.`;
  }
  return `Continue with the current difficulty until accuracy remains consistently high.`;
}

function weakestDomains(profile: CognitiveProfile, n: number): CognitiveDomain[] {
  return (Object.entries(profile) as [CognitiveDomain, number][])
    .sort((a, b) => a[1] - b[1])
    .slice(0, n)
    .map(([d]) => d);
}

export function generateDashboardRecommendation(
  profile: CognitiveProfile,
  lastSession: GameSessionResult | null,
): string {
  if (!lastSession) {
    return "Welcome to NeuroPlay. Complete your first session to start building a personalised cognitive profile.";
  }
  if (fatigueBand(lastSession.fatigueLevel) === 'High') {
    return "Your reaction time was slower during the last session. Today's tasks will begin at your previous comfortable difficulty.";
  }
  const [weakest] = weakestDomains(profile, 1);
  const label = DOMAIN_LABEL[weakest];
  if (profile[weakest] < 55) {
    return `Your ${label.toLowerCase()} performance is a current focus area. Today includes extra training in this domain.`;
  }
  return `Your performance has been improving across recent sessions. Today's challenge has been increased slightly.`;
}

const DOMAIN_TO_GAME: Record<CognitiveDomain, GameId | null> = {
  verbalMemory: 'word-recall',
  visualMemory: 'pattern-recall',
  episodicMemory: 'scene-memory',
  attention: 'focus-finder',
  workingMemory: 'sequence-master',
  processingSpeed: 'quick-response',
  cognitiveFlexibility: 'rule-switch',
  executiveFunction: null, // composite domain, no dedicated game
};

/** Picks today's recommended games: the weakest domains first, plus one
 *  well-performing domain to maintain strength. */
export function recommendTodaysGames(profile: CognitiveProfile): GameId[] {
  const ranked = weakestDomains(profile, 8)
    .map((d) => DOMAIN_TO_GAME[d])
    .filter((g): g is GameId => g !== null);
  const unique = Array.from(new Set(ranked));
  return unique.slice(0, 3);
}
