export type CognitiveDomain =
  | 'verbalMemory' | 'visualMemory' | 'episodicMemory' | 'attention'
  | 'workingMemory' | 'processingSpeed' | 'cognitiveFlexibility' | 'executiveFunction';

export type GameId =
  | 'word-recall' | 'pattern-recall' | 'scene-memory' | 'focus-finder'
  | 'sequence-master' | 'rule-switch' | 'quick-response';

export type DifficultyLevel = 1 | 2 | 3 | 4 | 5;

export interface TrialResult {
  correct: boolean;
  reactionTimeMs: number | null;
  difficulty: DifficultyLevel;
  timestamp: number;
}

export interface GameSessionResult {
  id: string;
  gameId: GameId;
  domain: CognitiveDomain;
  date: string;
  trials: TrialResult[];
  accuracy: number;
  avgReactionMs: number | null;
  difficultyStart: DifficultyLevel;
  difficultyEnd: DifficultyLevel;
  score: number;
  fatigueLevel: number;
  isDemo?: boolean;
}

export interface TrainingSessionResult {
  id: string;
  date: string;
  gameResultIds: string[];
  accuracy: number;
  avgReactionMs: number | null;
  fatigueLevel: number;
  difficultyLabel: string;
  isDemo?: boolean;
}

export interface CognitiveState {
  memoryScore: number;
  attentionScore: number;
  processingSpeed: number;
  executiveFunction: number;
  accuracy: number;
  reactionTime: number;
  errorRate: number;
  fatigueLevel: number;
  consistency: number;
  currentDifficulty: DifficultyLevel;
  sessionProgress: number;
  learningTrend: 'improving' | 'declining' | 'stable';
}

export type CognitiveProfile = Record<CognitiveDomain, number>;

export interface UserProfile {
  id: string;
  name: string;
  ageGroup: '18-39' | '40-59' | '60-74' | '75+';
  goal: 'memory' | 'attention' | 'overall';
  createdAt: string;
  lastActiveAt?: string;
  avatarColor?: string;
}

/** Generic RL-ready interface used by the deterministic simulated policy.
 *  Focus Finder's DQN has its own compact state/action representation. */
export type RLAction =
  | 'increaseDifficulty' | 'decreaseDifficulty' | 'maintainDifficulty'
  | 'reduceDistractors' | 'increaseDistractors' | 'shortenSession' | 'extendSession';

export interface RLState {
  accuracy: number;
  reactionTime: number;
  fatigue: number;
  errorRate: number;
  cognitiveDomain: CognitiveDomain;
  difficulty: DifficultyLevel;
  learningTrend: CognitiveState['learningTrend'];
}

export const GAME_META: Record<GameId, { name: string; domain: CognitiveDomain; description: string }> = {
  'word-recall':     { name: 'Word Recall',      domain: 'verbalMemory',        description: 'Study a list of words, then identify which ones you saw.' },
  'pattern-recall':  { name: 'Pattern Recall',    domain: 'visualMemory',        description: 'Memorise a highlighted grid pattern, then reproduce it.' },
  'scene-memory':    { name: 'Remember the Scene', domain: 'episodicMemory',    description: 'Study a scene, then answer questions about its details.' },
  'focus-finder':    { name: 'Focus Finder',      domain: 'attention',           description: 'Click every time a target symbol appears in a stream.' },
  'sequence-master': { name: 'Sequence Master',   domain: 'workingMemory',       description: 'Watch a sequence of numbers, then reproduce it in order.' },
  'rule-switch':     { name: 'Rule Switch',       domain: 'cognitiveFlexibility', description: 'Follow a rule that changes without warning.' },
  'quick-response':  { name: 'Quick Response',    domain: 'processingSpeed',     description: 'Click the target as quickly as possible when it appears.' },
};

export const DOMAIN_LABEL: Record<CognitiveDomain, string> = {
  verbalMemory: 'Verbal Memory',
  visualMemory: 'Visual Memory',
  episodicMemory: 'Episodic Memory',
  attention: 'Attention',
  workingMemory: 'Working Memory',
  processingSpeed: 'Processing Speed',
  cognitiveFlexibility: 'Cognitive Flexibility',
  executiveFunction: 'Executive Function',
};
