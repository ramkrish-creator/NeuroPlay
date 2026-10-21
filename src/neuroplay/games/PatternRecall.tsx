import { useEffect, useMemo, useRef, useState } from 'react';
import { GameFrame, type PlayingContext } from '../components/GameFrame';

const GRID_SIZE = 16; // 4x4
const ROUNDS = 6;

function cellsForLevel(level: number) {
  return [3, 5, 6, 8, 10][level - 1] ?? 3;
}

function pickCells(n: number): Set<number> {
  const pool = Array.from({ length: GRID_SIZE }, (_, i) => i);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return new Set(pool.slice(0, n));
}

function sameSet(a: Set<number>, b: Set<number>) {
  return a.size === b.size && [...a].every((v) => b.has(v));
}

export function PatternRecall() {
  return (
    <GameFrame
      gameId="pattern-recall"
      instructions={[
        `A 4x4 grid will briefly highlight some cells (${ROUNDS} rounds total).`,
        'Memorise the highlighted cells, then click the same cells once they hide.',
        'Click "Submit" when you are done selecting.',
      ]}
    >
      {(ctx) => <RoundManager {...ctx} />}
    </GameFrame>
  );
}

function RoundManager({ difficulty, recordTrial, endGame }: PlayingContext) {
  const [roundIndex, setRoundIndex] = useState(0);

  // Snapshot the pattern for this round only when the round index changes,
  // not on every difficulty update, so an in-progress round never shifts.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const targetCells = useMemo(() => pickCells(cellsForLevel(difficulty)), [roundIndex]);
  const showTime = Math.max(600, 1800 - difficulty * 150);

  const [phase, setPhase] = useState<'show' | 'input'>('show');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const hiddenAtRef = useRef(0);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setPhase('input');
      hiddenAtRef.current = Date.now();
    }, showTime);
    return () => window.clearTimeout(t);
  }, [roundIndex, showTime]);

  const toggle = (i: number) => {
    if (phase !== 'input') return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const submit = () => {
    const correct = sameSet(selected, targetCells);
    recordTrial(correct, Date.now() - hiddenAtRef.current);
    setPhase('show');
    setSelected(new Set());
    if (roundIndex + 1 >= ROUNDS) { endGame(); return; }
    setRoundIndex((r) => r + 1);
  };

  return (
    <div className="np-card p-8 text-center">
      <p className="text-sm text-slate-500 mb-4">Round {roundIndex + 1} of {ROUNDS}</p>
      <div className="np-pattern-grid mx-auto mb-6">
        {Array.from({ length: GRID_SIZE }, (_, i) => {
          const lit = phase === 'show' && targetCells.has(i);
          const chosen = phase === 'input' && selected.has(i);
          return (
            <button
              key={i}
              className="np-pattern-cell"
              style={{
                background: lit ? '#2dd4bf' : chosen ? 'rgba(45,212,191,0.35)' : 'rgba(148,163,184,0.08)',
                borderColor: chosen ? '#2dd4bf' : 'rgba(148,163,184,0.15)',
              }}
              disabled={phase !== 'input'}
              onClick={() => toggle(i)}
              aria-label={`cell ${i}`}
            />
          );
        })}
      </div>
      {phase === 'input' && (
        <button className="np-btn-primary" onClick={submit}>Submit</button>
      )}
      {phase === 'show' && <p className="text-slate-400">Memorise the pattern...</p>}
    </div>
  );
}
