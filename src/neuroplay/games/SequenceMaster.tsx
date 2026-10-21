import { useEffect, useRef, useState } from 'react';
import { GameFrame, type PlayingContext } from '../components/GameFrame';

const ROUNDS = 6;

function spanForLevel(level: number) { return [3, 4, 5, 6, 7][level - 1] ?? 3; }
function modeForLevel(level: number): 'forward' | 'backward' { return level <= 3 ? 'forward' : 'backward'; }
function generateSeq(n: number) { return Array.from({ length: n }, () => Math.floor(Math.random() * 9) + 1); }

export function SequenceMaster() {
  return (
    <GameFrame
      gameId="sequence-master"
      instructions={[
        'A sequence of numbers will appear one at a time.',
        'At lower levels, reproduce it in the same order.',
        'At higher levels, reproduce it in reverse order.',
      ]}
    >
      {(ctx) => <RoundManager {...ctx} />}
    </GameFrame>
  );
}

function RoundManager({ difficulty, recordTrial, endGame }: PlayingContext) {
  const [roundIndex, setRoundIndex] = useState(0);
  const [phase, setPhase] = useState<'show' | 'input'>('show');
  const [showIndex, setShowIndex] = useState(0);
  const [input, setInput] = useState<number[]>([]);
  const inputStartRef = useRef(0);

  const createRoundState = (level: number) => {
    const span = spanForLevel(level);
    const mode = modeForLevel(level);
    const sequence = generateSeq(span);
    return { sequence, expected: mode === 'backward' ? [...sequence].reverse() : sequence, mode };
  };

  const [roundState, setRoundState] = useState(() => createRoundState(difficulty));

  const beginRound = (nextDifficulty = difficulty) => {
    const nextRound = createRoundState(nextDifficulty);
    setRoundState(nextRound);
    setPhase('show');
    setShowIndex(0);
    setInput([]);
    inputStartRef.current = 0;
  };

  useEffect(() => {
    if (phase !== 'show') return;
    if (showIndex >= roundState.sequence.length) {
      const t = window.setTimeout(() => {
        setPhase('input');
        inputStartRef.current = Date.now();
      }, 0);
      return () => window.clearTimeout(t);
    }

    const t = window.setTimeout(() => setShowIndex((i) => i + 1), 800);
    return () => window.clearTimeout(t);
  }, [phase, roundState.sequence.length, showIndex]);

  const pushDigit = (d: number) => {
    const next = [...input, d];
    setInput(next);
    if (next.length === roundState.expected.length) {
      const correct = next.every((v, i) => v === roundState.expected[i]);
      // eslint-disable-next-line react-hooks/purity
      recordTrial(correct, Date.now() - inputStartRef.current);
      if (roundIndex + 1 >= ROUNDS) { endGame(); return; }
      setRoundIndex((r) => r + 1);
      beginRound(difficulty);
    }
  };

  if (phase === 'show') {
    const i = Math.min(showIndex, roundState.sequence.length - 1);
    return (
      <div className="np-card p-12 text-center">
        <p className="text-sm text-slate-500 mb-2">Round {roundIndex + 1} of {ROUNDS}</p>
        <p className="text-sm text-slate-500 mb-6">Number {Math.min(showIndex + 1, roundState.sequence.length)} of {roundState.sequence.length}</p>
        <span className="text-7xl font-black text-slate-50">{roundState.sequence[i]}</span>
      </div>
    );
  }

  return (
    <div className="np-card p-10 text-center">
      <p className="text-sm text-slate-500 mb-2">
        Enter the sequence {roundState.mode === 'backward' ? 'in reverse order' : 'in the same order'}
      </p>
      <div className="flex gap-2 justify-center mb-8 min-h-[2.5rem]">
        {input.map((d, i) => (
          <span key={i} className="np-digit-chip">{d}</span>
        ))}
        {Array.from({ length: roundState.expected.length - input.length }).map((_, i) => (
          <span key={`e${i}`} className="np-digit-chip np-digit-chip-empty" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <button key={d} className="np-numpad-btn" onClick={() => pushDigit(d)}>{d}</button>
        ))}
      </div>
    </div>
  );
}
