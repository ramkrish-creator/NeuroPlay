import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DifficultyLevel, TrialResult } from '../types';

const INPUT_COUNT = 5;
const HIDDEN_COUNT = 16;
const ACTION_COUNT = 3;
const REPLAY_CAPACITY = 500;
const BATCH_SIZE = 16;
const WARMUP_EPISODES = 40;
const TRIALS_PER_EPISODE = 24;
const LEARNING_RATE = 0.001;
const DISCOUNT = 0.92;
const TARGET_UPDATE_INTERVAL = 50;

export type FocusFinderState = [number, number, number, number, number];
export type FocusFinderAction = 0 | 1 | 2;

interface Network {
  inputWeights: number[][];
  hiddenBias: number[];
  outputWeights: number[][];
  outputBias: number[];
}

interface Experience {
  state: FocusFinderState;
  action: FocusFinderAction;
  reward: number;
  nextState: FocusFinderState;
  done: boolean;
}

interface DqnSnapshot {
  online: Network;
  target: Network;
  replay: Experience[];
  steps: number;
  bootstrapped: boolean;
}

export interface FocusFinderEvaluationPoint {
  episode: string;
  dqnAccuracy: number;
  baselineAccuracy: number;
  dqnReward: number;
  baselineReward: number;
  dqnFatigue: number;
  baselineFatigue: number;
  dqnDifficulty: number;
  baselineDifficulty: number;
}

export interface FocusFinderEvaluation {
  points: FocusFinderEvaluationPoint[];
  generatedAt: string;
  trainingSteps: number;
  episodes: number;
  trialsPerEpisode: number;
  dqnAccuracy: number;
  baselineAccuracy: number;
  dqnReward: number;
  baselineReward: number;
  dqnFatigue: number;
  baselineFatigue: number;
  dqnDifficulty: number;
  baselineDifficulty: number;
  dqnWins: number;
}

interface DqnStore extends DqnSnapshot {
  chooseAction: (state: FocusFinderState) => FocusFinderAction;
  learn: (experience: Experience) => void;
  bootstrap: () => void;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const randomRange = (min: number, max: number) => min + Math.random() * (max - min);

function createNetwork(): Network {
  const inputScale = Math.sqrt(2 / INPUT_COUNT);
  const outputScale = Math.sqrt(2 / HIDDEN_COUNT);
  return {
    inputWeights: Array.from({ length: HIDDEN_COUNT }, () =>
      Array.from({ length: INPUT_COUNT }, () => randomRange(-inputScale, inputScale))),
    hiddenBias: Array(HIDDEN_COUNT).fill(0),
    outputWeights: Array.from({ length: ACTION_COUNT }, () =>
      Array.from({ length: HIDDEN_COUNT }, () => randomRange(-outputScale, outputScale))),
    outputBias: Array(ACTION_COUNT).fill(0),
  };
}

function cloneNetwork(network: Network): Network {
  return {
    inputWeights: network.inputWeights.map((row) => [...row]),
    hiddenBias: [...network.hiddenBias],
    outputWeights: network.outputWeights.map((row) => [...row]),
    outputBias: [...network.outputBias],
  };
}

function forward(network: Network, state: FocusFinderState) {
  const hidden = network.inputWeights.map((weights, i) =>
    Math.max(0, weights.reduce((sum, weight, j) => sum + weight * state[j], network.hiddenBias[i])));
  const output = network.outputWeights.map((weights, i) =>
    weights.reduce((sum, weight, j) => sum + weight * hidden[j], network.outputBias[i]));
  return { hidden, output };
}

function greedyAction(network: Network, state: FocusFinderState): FocusFinderAction {
  const values = forward(network, state).output;
  return values.indexOf(Math.max(...values)) as FocusFinderAction;
}

function trainBatch(network: Network, targetNetwork: Network, replay: Experience[]) {
  const inputWeightGradients = network.inputWeights.map((row) => row.map(() => 0));
  const hiddenBiasGradients = network.hiddenBias.map(() => 0);
  const outputWeightGradients = network.outputWeights.map((row) => row.map(() => 0));
  const outputBiasGradients = network.outputBias.map(() => 0);

  for (let sample = 0; sample < BATCH_SIZE; sample++) {
    const experience = replay[Math.floor(Math.random() * replay.length)];
    const { hidden, output } = forward(network, experience.state);
    const nextValues = experience.done ? [] : forward(targetNetwork, experience.nextState).output;
    const target = experience.reward + (experience.done ? 0 : DISCOUNT * Math.max(...nextValues));
    const error = output[experience.action] - target;

    outputBiasGradients[experience.action] += error;
    for (let j = 0; j < HIDDEN_COUNT; j++) {
      outputWeightGradients[experience.action][j] += error * hidden[j];
      const hiddenError = error * network.outputWeights[experience.action][j] * (hidden[j] > 0 ? 1 : 0);
      hiddenBiasGradients[j] += hiddenError;
      for (let k = 0; k < INPUT_COUNT; k++) {
        inputWeightGradients[j][k] += hiddenError * experience.state[k];
      }
    }
  }

  const scale = LEARNING_RATE / BATCH_SIZE;
  for (let i = 0; i < HIDDEN_COUNT; i++) {
    network.hiddenBias[i] -= hiddenBiasGradients[i] * scale;
    for (let j = 0; j < INPUT_COUNT; j++) {
      network.inputWeights[i][j] -= inputWeightGradients[i][j] * scale;
    }
  }
  for (let i = 0; i < ACTION_COUNT; i++) {
    network.outputBias[i] -= outputBiasGradients[i] * scale;
    for (let j = 0; j < HIDDEN_COUNT; j++) {
      network.outputWeights[i][j] -= outputWeightGradients[i][j] * scale;
    }
  }
}

function trainSnapshot(snapshot: DqnSnapshot, experience: Experience) {
  snapshot.replay.push(experience);
  if (snapshot.replay.length > REPLAY_CAPACITY) snapshot.replay.shift();
  snapshot.steps++;

  if (snapshot.replay.length >= BATCH_SIZE) {
    trainBatch(snapshot.online, snapshot.target, snapshot.replay);
    if (snapshot.steps % TARGET_UPDATE_INTERVAL === 0) {
      snapshot.target = cloneNetwork(snapshot.online);
    }
  }
}

function bootstrapSnapshot(snapshot: DqnSnapshot) {
  if (snapshot.bootstrapped) return;

  for (let episode = 0; episode < WARMUP_EPISODES; episode++) {
    const ability = randomRange(0.45, 0.95);
    let accuracy = randomRange(0.55, 0.9);
    let reaction = randomRange(0.25, 0.75);
    let fatigue = randomRange(0, 0.2);
    let level = Math.floor(randomRange(1, 6));

    for (let trial = 0; trial < TRIALS_PER_EPISODE; trial++) {
      const state: FocusFinderState = [accuracy, reaction, fatigue, (level - 1) / 4, trial / TRIALS_PER_EPISODE];
      const action = Math.floor(Math.random() * ACTION_COUNT) as FocusFinderAction;
      const nextLevel = clamp(level + action - 1, 1, 5);
      const correct = Math.random() < clamp(ability - (nextLevel - 1) * 0.065 - fatigue * 0.18, 0.15, 0.98);
      const nextAccuracy = accuracy * 0.7 + (correct ? 1 : 0) * 0.3;
      const nextReaction = clamp(
        0.3 + (4 - nextLevel) * 0.06 + fatigue * 0.45 + (0.7 - ability) * 0.2 + randomRange(-0.07, 0.07),
        0.1,
        1,
      );
      const nextFatigue = clamp(fatigue + (nextLevel >= 4 ? 0.02 : 0.008) + (correct ? -0.012 : 0.025), 0, 1);
      const nextState: FocusFinderState = [
        nextAccuracy,
        nextReaction,
        nextFatigue,
        (nextLevel - 1) / 4,
        (trial + 1) / TRIALS_PER_EPISODE,
      ];
      const reward = (correct ? 0.8 : -0.8)
        + (nextAccuracy >= 0.65 && nextAccuracy <= 0.9 ? 0.2 : -0.1)
        + (1 - nextReaction) * 0.08
        + (nextLevel - 1) * 0.035
        - nextFatigue * 0.25;

      trainSnapshot(snapshot, {
        state, action, reward, nextState,
        done: trial === TRIALS_PER_EPISODE - 1,
      });
      accuracy = nextAccuracy;
      reaction = nextReaction;
      fatigue = nextFatigue;
      level = nextLevel;
    }
  }

  snapshot.bootstrapped = true;
  snapshot.target = cloneNetwork(snapshot.online);
}

function createInitialSnapshot(): DqnSnapshot {
  const online = createNetwork();
  return {
    online,
    target: cloneNetwork(online),
    replay: [],
    steps: 0,
    bootstrapped: false,
  };
}

export const useFocusFinderDqn = create<DqnStore>()(
  persist(
    (set, get) => ({
      ...createInitialSnapshot(),

      chooseAction: (state) => {
        const snapshot = get();
        const epsilon = Math.max(0.05, 0.35 * Math.exp(-snapshot.steps / 1200));
        if (Math.random() < epsilon) return Math.floor(Math.random() * ACTION_COUNT) as FocusFinderAction;
        return greedyAction(snapshot.online, state);
      },

      learn: (experience) => {
        const snapshot = get();
        trainSnapshot(snapshot, experience);
        set({
          online: snapshot.online,
          target: snapshot.target,
          replay: snapshot.replay,
          steps: snapshot.steps,
          bootstrapped: snapshot.bootstrapped,
        });
        if (experience.done) publishEvaluation();
      },

      bootstrap: () => {
        const snapshot = get();
        if (!snapshot.bootstrapped) {
          bootstrapSnapshot(snapshot);
          set({
            online: snapshot.online,
            target: snapshot.target,
            replay: snapshot.replay,
            steps: snapshot.steps,
            bootstrapped: snapshot.bootstrapped,
          });
        }
      },
    }),
    { name: 'neuroplay-focus-finder-dqn-v1' },
  ),
);

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function evaluateEpisode(
  network: Network | null,
  ability: number,
  initialAccuracy: number,
  initialReaction: number,
  initialFatigue: number,
  random: () => number,
): Omit<FocusFinderEvaluationPoint, 'episode'> {
  let accuracy = initialAccuracy;
  let reaction = initialReaction;
  let fatigue = initialFatigue;
  let level = 3;
  let correctCount = 0;
  let totalReward = 0;
  let totalDifficulty = 0;

  for (let trial = 0; trial < TRIALS_PER_EPISODE; trial++) {
    const state: FocusFinderState = [accuracy, reaction, fatigue, (level - 1) / 4, trial / TRIALS_PER_EPISODE];
    const action = network ? greedyAction(network, state) : 1;
    const nextLevel = clamp(level + action - 1, 1, 5);
    const correct = random() < clamp(ability - (nextLevel - 1) * 0.065 - fatigue * 0.18, 0.15, 0.98);
    const nextAccuracy = accuracy * 0.7 + (correct ? 1 : 0) * 0.3;
    const nextReaction = clamp(
      0.3 + (4 - nextLevel) * 0.06 + fatigue * 0.45 + (0.7 - ability) * 0.2 + (random() - 0.5) * 0.14,
      0.1,
      1,
    );
    const nextFatigue = clamp(fatigue + (nextLevel >= 4 ? 0.02 : 0.008) + (correct ? -0.012 : 0.025), 0, 1);
    const reward = (correct ? 0.8 : -0.8)
      + (nextAccuracy >= 0.65 && nextAccuracy <= 0.9 ? 0.2 : -0.1)
      + (1 - nextReaction) * 0.08
      + (nextLevel - 1) * 0.035
      - nextFatigue * 0.25;

    correctCount += Number(correct);
    totalReward += reward;
    totalDifficulty += nextLevel;
    accuracy = nextAccuracy;
    reaction = nextReaction;
    fatigue = nextFatigue;
    level = nextLevel;
  }

  return {
    dqnAccuracy: (correctCount / TRIALS_PER_EPISODE) * 100,
    baselineAccuracy: 0,
    dqnReward: totalReward / TRIALS_PER_EPISODE,
    baselineReward: 0,
    dqnFatigue: fatigue * 100,
    baselineFatigue: 0,
    dqnDifficulty: totalDifficulty / TRIALS_PER_EPISODE,
    baselineDifficulty: 0,
  };
}

/** Evaluates the greedy DQN against a fixed level-3 baseline on held-out synthetic profiles. */
export function evaluateFocusFinderDqn(episodes = 100): FocusFinderEvaluation {
  const { online, bootstrapped, steps } = useFocusFinderDqn.getState();
  if (!bootstrapped) {
    throw new Error('Focus Finder DQN must be bootstrapped before evaluation.');
  }

  const episodeCount = Math.max(1, Math.floor(episodes));
  const points: FocusFinderEvaluationPoint[] = [];

  for (let episode = 0; episode < episodeCount; episode++) {
    const profileRandom = seededRandom(0xD0A1 + episode * 7919);
    const ability = 0.45 + profileRandom() * 0.5;
    const initialAccuracy = 0.55 + profileRandom() * 0.35;
    const initialReaction = 0.25 + profileRandom() * 0.5;
    const initialFatigue = profileRandom() * 0.2;
    const dqn = evaluateEpisode(
      online, ability, initialAccuracy, initialReaction, initialFatigue,
      seededRandom(0xA11CE + episode * 104729),
    );
    const baseline = evaluateEpisode(
      null, ability, initialAccuracy, initialReaction, initialFatigue,
      seededRandom(0xA11CE + episode * 104729),
    );
    points.push({
      episode: `#${episode + 1}`,
      ...dqn,
      baselineAccuracy: baseline.dqnAccuracy,
      baselineReward: baseline.dqnReward,
      baselineFatigue: baseline.dqnFatigue,
      baselineDifficulty: baseline.dqnDifficulty,
    });
  }

  const average = (key: keyof Omit<FocusFinderEvaluationPoint, 'episode'>) =>
    points.reduce((sum, point) => sum + point[key], 0) / points.length;
  const dqnWins = points.filter((point) => point.dqnReward > point.baselineReward).length;

  return {
    points,
    generatedAt: new Date().toISOString(),
    trainingSteps: steps,
    episodes: episodeCount,
    trialsPerEpisode: TRIALS_PER_EPISODE,
    dqnAccuracy: average('dqnAccuracy'),
    baselineAccuracy: average('baselineAccuracy'),
    dqnReward: average('dqnReward'),
    baselineReward: average('baselineReward'),
    dqnFatigue: average('dqnFatigue'),
    baselineFatigue: average('baselineFatigue'),
    dqnDifficulty: average('dqnDifficulty'),
    baselineDifficulty: average('baselineDifficulty'),
    dqnWins,
  };
}

function publishEvaluation() {
  if (!import.meta.env.DEV) return;

  try {
    const report = evaluateFocusFinderDqn();
    void fetch('/__focus-finder-dqn-evaluation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
    }).then((response) => {
      if (!response.ok) {
        throw new Error(`Evaluation report writer returned HTTP ${response.status}.`);
      }
    }).catch((error: unknown) => {
      console.error('Could not write the Focus Finder DQN evaluation report.', error);
    });
  } catch (error) {
    console.error('Could not evaluate the Focus Finder DQN.', error);
  }
}

export function createFocusFinderState(
  trials: TrialResult[],
  difficulty: DifficultyLevel,
  fatigueLevel: number,
  progress: number,
): FocusFinderState {
  const recent = trials.slice(-5);
  const accuracy = recent.length ? recent.filter((trial) => trial.correct).length / recent.length : 0.5;
  const reactionTimes = recent
    .map((trial) => trial.reactionTimeMs)
    .filter((time): time is number => time !== null);
  const averageReaction = reactionTimes.length
    ? reactionTimes.reduce((sum, time) => sum + time, 0) / reactionTimes.length
    : 675;

  return [
    accuracy,
    clamp(averageReaction / 1500, 0, 1),
    clamp(fatigueLevel / 100, 0, 1),
    (difficulty - 1) / 4,
    clamp(progress, 0, 1),
  ];
}

export function focusFinderReward(correct: boolean, reactionTimeMs: number | null, nextState: FocusFinderState) {
  const accuracyReward = nextState[0] >= 0.65 && nextState[0] <= 0.9 ? 0.2 : -0.1;
  const speedReward = reactionTimeMs === null ? 0 : clamp(1 - reactionTimeMs / 1500, 0, 1) * 0.08;
  const challengeReward = nextState[3] * 0.035;
  const fatiguePenalty = nextState[2] * 0.25;
  return (correct ? 0.8 : -0.8) + accuracyReward + speedReward + challengeReward - fatiguePenalty;
}

export function adjustFocusFinderDifficulty(
  difficulty: DifficultyLevel,
  action: FocusFinderAction,
): DifficultyLevel {
  return clamp(difficulty + action - 1, 1, 5) as DifficultyLevel;
}
