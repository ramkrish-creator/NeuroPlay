import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { DifficultyLevel, GameId, GameSessionResult, TrialResult } from '../types';
import { DOMAIN_LABEL, GAME_META } from '../types';
import { useNeuroPlayStore } from '../store/useNeuroPlayStore';
import { updateDifficulty } from '../engine/adaptiveEngine';
import { calculateAccuracy, calculateSessionScore, mean } from '../engine/scoringEngine';
import { estimateFatigue, fatigueBand, restRecommendation } from '../engine/fatigueEngine';
import { generateGameRecommendation } from '../engine/recommendationEngine';
import {
  adjustFocusFinderDifficulty,
  createFocusFinderState,
  focusFinderReward,
  useFocusFinderDqn,
  type FocusFinderAction,
  type FocusFinderState,
} from '../engine/focusFinderDqn';

export interface PlayingContext {
  difficulty: DifficultyLevel;
  trialCount: number;
  recordTrial: (correct: boolean, reactionTimeMs?: number | null, terminal?: boolean) => DifficultyLevel;
  endGame: () => void;
}

type Phase = 'intro' | 'countdown' | 'playing' | 'results';

export function GameFrame({ gameId, instructions, children }: {
  gameId: GameId;
  instructions: string[];
  children: (ctx: PlayingContext) => ReactNode;
}) {
  const meta = GAME_META[gameId];
  const startingDifficulty = useNeuroPlayStore((s) => s.difficultyByGame[gameId]);
  const addGameSession = useNeuroPlayStore((s) => s.addGameSession);
  const closeGame = useNeuroPlayStore((s) => s.closeGame);
  const navigate = useNeuroPlayStore((s) => s.navigate);
  const inTrainingSession = useNeuroPlayStore((s) => s.trainingQueue !== null);
  const advanceTrainingSession = useNeuroPlayStore((s) => s.advanceTrainingSession);
  // Select the stable `sessions` array reference and derive the filtered
  // list in a memo — computing a fresh array inside the selector itself
  // would make useSyncExternalStore see a "changed" snapshot on every
  // read and re-render forever.
  const sessions = useNeuroPlayStore((s) => s.sessions);
  const priorScores = useMemo(
    () => sessions.filter((x) => x.domain === meta.domain).slice(0, 5).map((x) => x.score),
    [sessions, meta.domain],
  );

  const [phase, setPhase] = useState<Phase>('intro');
  const [countdown, setCountdown] = useState(3);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(startingDifficulty);
  const [fatigueLevel, setFatigueLevel] = useState(0);
  const [trialCount, setTrialCount] = useState(0);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error'>('saved');
  const [saveError, setSaveError] = useState<string | null>(null);
  const trialsRef = useRef<TrialResult[]>([]);
  const pendingSessionRef = useRef<GameSessionResult | null>(null);
  const dqnStepRef = useRef<{ state: FocusFinderState; action: FocusFinderAction } | null>(null);
  const sessionStartRef = useRef(0);
  const difficultyStartRef = useRef<DifficultyLevel>(startingDifficulty);
  const [, forceRender] = useState(0);
  const [result, setResult] = useState<{
    accuracy: number; avgReactionMs: number | null; score: number;
    fatigueLevel: number; mistakes: number; recommendation: string;
  } | null>(null);

  useEffect(() => {
    if (phase !== 'countdown') return;

    if (countdown <= 0) {
      const transition = window.setTimeout(() => {
        trialsRef.current = [];
        sessionStartRef.current = Date.now();
        setFatigueLevel(0);
        setTrialCount(0);
        if (gameId === 'focus-finder') {
          const dqn = useFocusFinderDqn.getState();
          dqn.bootstrap();
          const initialState = createFocusFinderState([], difficulty, 0, 0);
          const action = dqn.chooseAction(initialState);
          const initialDifficulty = adjustFocusFinderDifficulty(difficulty, action);
          dqnStepRef.current = { state: initialState, action };
          difficultyStartRef.current = initialDifficulty;
          setDifficulty(initialDifficulty);
        } else {
          difficultyStartRef.current = difficulty;
          dqnStepRef.current = null;
        }
        setPhase('playing');
      }, 0);
      return () => window.clearTimeout(transition);
    }

    const t = window.setTimeout(() => setCountdown((c) => c - 1), 700);
    return () => window.clearTimeout(t);
  }, [phase, countdown, difficulty, gameId]);

  const start = () => {
    setCountdown(3);
    setPhase('countdown');
    trialsRef.current = [];
    setFatigueLevel(0);
    setTrialCount(0);
  };

  const recordTrial: PlayingContext['recordTrial'] = (correct, reactionTimeMs = null, terminal = false) => {
    // eslint-disable-next-line react-hooks/purity
    const nextTrials = [...trialsRef.current, { correct, reactionTimeMs, difficulty, timestamp: Date.now() }];
    trialsRef.current = nextTrials;
    setTrialCount(nextTrials.length);

    const nextFatigue = estimateFatigue(nextTrials, sessionStartRef.current);
    let nextDifficulty = difficulty;
    if (gameId === 'focus-finder') {
      const pending = dqnStepRef.current;
      if (pending) {
        const nextState = createFocusFinderState(
          nextTrials,
          difficulty,
          nextFatigue,
          nextTrials.length / 30,
        );
        const dqn = useFocusFinderDqn.getState();
        dqn.learn({
          state: pending.state,
          action: pending.action,
          reward: focusFinderReward(correct, reactionTimeMs, nextState),
          nextState,
          done: terminal,
        });
        if (terminal) {
          dqnStepRef.current = null;
        } else {
          const action = dqn.chooseAction(nextState);
          nextDifficulty = adjustFocusFinderDifficulty(difficulty, action);
          dqnStepRef.current = { state: nextState, action };
        }
      }
    } else {
      nextDifficulty = updateDifficulty(nextTrials, difficulty, nextFatigue);
    }
    setFatigueLevel(nextFatigue);
    if (nextDifficulty !== difficulty) setDifficulty(nextDifficulty);
    forceRender((n) => n + 1);
    return nextDifficulty;
  };

  const saveSession = async (session: GameSessionResult) => {
    setSaveState('saving');
    setSaveError(null);
    try {
      await addGameSession(session);
      setSaveState('saved');
    } catch (error) {
      setSaveState('error');
      setSaveError(error instanceof Error ? error.message : 'Unable to save this session.');
    }
  };

  const endGame = () => {
    const trials = trialsRef.current;
    const accuracy = calculateAccuracy(trials);
    const times = trials.map((t) => t.reactionTimeMs).filter((t): t is number => t !== null);
    const avgReactionMs = times.length ? Math.round(mean(times)) : null;
    const score = calculateSessionScore(trials, difficulty);
    const mistakes = trials.filter((t) => !t.correct).length;

    const session: GameSessionResult = {
      // eslint-disable-next-line react-hooks/purity
      id: Math.random().toString(36).slice(2, 11),
      gameId, domain: meta.domain, date: new Date().toISOString(),
      trials, accuracy, avgReactionMs,
      difficultyStart: difficultyStartRef.current, difficultyEnd: difficulty,
      score, fatigueLevel,
    };
    pendingSessionRef.current = session;
    const rest = restRecommendation(fatigueLevel);
    const recommendation = rest ?? generateGameRecommendation(session, priorScores);
    setResult({ accuracy, avgReactionMs, score, fatigueLevel, mistakes, recommendation });
    setPhase('results');
    void saveSession(session);
  };

  const playAgain = () => {
    setDifficulty(startingDifficulty);
    dqnStepRef.current = null;
    setPhase('intro');
    setResult(null);
    setCountdown(3);
    setTrialCount(0);
    trialsRef.current = [];
  };
  const backToDashboard = () => { closeGame(); navigate('dashboard'); };

  return (
    <div className="min-h-full w-full flex flex-col items-center justify-center p-6 md:p-10">
      {phase === 'intro' && (
        <div className="np-card max-w-xl w-full p-8 md:p-10 text-center">
          <p className="text-sm uppercase tracking-widest text-teal-400 font-semibold mb-2">Training Focus · {DOMAIN_LABEL[meta.domain]}</p>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-50 mb-4">{meta.description}</h2>
          <ul className="text-left space-y-2 mb-8 text-slate-300 text-base md:text-lg">
            {instructions.map((line, i) => (
              <li key={i} className="flex gap-3">
                <span className="text-teal-400 mt-1">•</span><span>{line}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-center gap-2 mb-8 text-sm text-slate-400">
            <span>Starting difficulty:</span>
            <DifficultyDots level={startingDifficulty} />
          </div>
          <p className="text-xs text-slate-500 leading-relaxed mb-6">
            This is self-paced training. Difficulty adjusts gradually from your performance and you can stop whenever you need a break.
          </p>
          <button className="np-btn-primary" onClick={start}>Start</button>
        </div>
      )}

      {phase === 'countdown' && (
        <div className="np-card max-w-xl w-full p-16 text-center">
          <span className="text-7xl font-black text-teal-400">{countdown > 0 ? countdown : 'Go!'}</span>
        </div>
      )}

      {phase === 'playing' && (
        <div className="w-full max-w-3xl">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <span className="text-lg font-semibold text-slate-100">{meta.name}</span>
            <div className="flex items-center gap-4 text-sm text-slate-400">
              <span className="flex items-center gap-2">Difficulty <DifficultyDots level={difficulty} /></span>
              <span>Trials: {trialCount}</span>
              {fatigueLevel >= 35 && (
                <span className={fatigueLevel >= 65 ? 'text-amber-400' : 'text-slate-400'}>
                  Fatigue: {fatigueBand(fatigueLevel)}
                </span>
              )}
            </div>
          </div>
          {/* eslint-disable-next-line react-hooks/refs */}
          {children({ difficulty, trialCount, recordTrial, endGame })}
        </div>
      )}

      {phase === 'results' && result && (
        <div className="np-card max-w-xl w-full p-8 md:p-10">
          <p className="text-sm uppercase tracking-widest text-teal-400 font-semibold mb-1">Session Complete</p>
          <h2 className="text-2xl font-bold text-slate-50 mb-6">{meta.name}</h2>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <StatBlock label="Score" value={result.score} />
            <StatBlock label="Accuracy" value={`${result.accuracy}%`} />
            {result.avgReactionMs !== null && <StatBlock label="Avg Reaction" value={`${result.avgReactionMs} ms`} />}
            <StatBlock label="Difficulty" value={`Level ${difficulty}`} />
            <StatBlock label="Mistakes" value={result.mistakes} />
            <StatBlock label="Fatigue" value={fatigueBand(result.fatigueLevel)} />
          </div>

          <div className="np-callout mb-8">{result.recommendation}</div>
          {saveState === 'saving' && <p role="status" className="text-sm text-slate-400 mb-4">Saving session to your account…</p>}
          {saveState === 'error' && (
            <div role="alert" className="mb-4 space-y-2 text-sm text-rose-200">
              <p>Session was not saved: {saveError}</p>
              <button className="np-btn-secondary" onClick={() => pendingSessionRef.current && void saveSession(pendingSessionRef.current)}>
                Retry saving
              </button>
            </div>
          )}
          <p className="text-xs text-slate-500 text-center mb-6">
            This result is a training indicator for {DOMAIN_LABEL[meta.domain].toLowerCase()}, not a clinical assessment.
          </p>

          <div className="flex gap-3 justify-center flex-wrap">
            {saveState !== 'saved' ? null : inTrainingSession ? (
              <button className="np-btn-primary" onClick={advanceTrainingSession}>Continue</button>
            ) : (
              <>
                <button className="np-btn-primary" onClick={playAgain}>Play Again</button>
                <button className="np-btn-secondary" onClick={backToDashboard}>Back to Dashboard</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function DifficultyDots({ level }: { level: DifficultyLevel }) {
  return (
    <span className="inline-flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className="w-2.5 h-2.5 rounded-full"
          style={{ background: i <= level ? '#2dd4bf' : 'rgba(148,163,184,0.25)' }}
        />
      ))}
    </span>
  );
}

function StatBlock({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="np-stat">
      <p className="np-stat-label">{label}</p>
      <p className="np-stat-value">{value}</p>
    </div>
  );
}
