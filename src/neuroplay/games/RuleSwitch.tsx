import { useMemo, useRef, useState } from 'react';
import { GameFrame, type PlayingContext } from '../components/GameFrame';

const ALL_COLORS = ['red', 'blue', 'green', 'yellow'];
const SWITCH_EVERY = 6;

function trialCountForLevel(level: number) { return [12, 16, 20, 24, 28][level - 1] ?? 12; }
function colorPoolForLevel(level: number) { return ALL_COLORS.slice(0, [2, 2, 3, 3, 4][level - 1] ?? 2); }

export function RuleSwitch() {
  return (
    <GameFrame
      gameId="rule-switch"
      instructions={[
        'A rule at the top tells you which colour to match, e.g. "Click objects that are RED".',
        'For each shape, choose "Match" if it fits the current rule, or "No Match" if it does not.',
        'The rule will change without warning after several rounds — watch for it.',
      ]}
    >
      {(ctx) => <Session {...ctx} />}
    </GameFrame>
  );
}

function Session({ difficulty, recordTrial, endGame }: PlayingContext) {
  const [sessionDifficulty] = useState(difficulty);
  const totalTrials = trialCountForLevel(sessionDifficulty);
  const colorPool = useMemo(() => colorPoolForLevel(sessionDifficulty), [sessionDifficulty]);

  const [trialIndex, setTrialIndex] = useState(0);
  const [rule, setRule] = useState(() => colorPool[0]);
  const [shapeColor, setShapeColor] = useState(() => colorPool[Math.floor(Math.random() * colorPool.length)] ?? colorPool[0]);
  const [justSwitched, setJustSwitched] = useState(false);
  const shownAtRef = useRef(0);

  const answer = (saidMatch: boolean) => {
    const correct = saidMatch === (shapeColor === rule);
    const nextIndex = trialIndex + 1;
    const nextIsSwitch = nextIndex > 0 && nextIndex % SWITCH_EVERY === 0;

    recordTrial(correct, Date.now() - shownAtRef.current);
    shownAtRef.current = Date.now();

    if (nextIndex >= totalTrials) {
      endGame();
      return;
    }

    let nextRule = rule;
    if (nextIsSwitch) {
      const next = colorPool.filter((c) => c !== rule);
      nextRule = next[Math.floor(Math.random() * next.length)] ?? rule;
    }

    setRule(nextRule);
    setShapeColor(colorPool[Math.floor(Math.random() * colorPool.length)] ?? colorPool[0]);
    setJustSwitched(nextIsSwitch);
    setTrialIndex(nextIndex);
  };

  return (
    <div className="np-card p-10 text-center">
      <p className="text-sm text-slate-500 mb-2">Trial {trialIndex + 1} of {totalTrials}</p>
      <div className={`np-rule-banner ${justSwitched ? 'np-rule-banner-flash' : ''}`}>
        Click objects that are <strong className="uppercase">{rule}</strong>
      </div>
      <div className="flex justify-center my-10">
        <span className="np-rule-shape" style={{ background: shapeColor }} />
      </div>
      <div className="flex gap-4 justify-center">
        <button className="np-btn-primary" onClick={() => answer(true)}>Match</button>
        <button className="np-btn-secondary" onClick={() => answer(false)}>No Match</button>
      </div>
    </div>
  );
}
