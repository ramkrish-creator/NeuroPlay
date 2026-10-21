import { useEffect, useRef, useState } from 'react';
import { GameFrame, type PlayingContext } from '../components/GameFrame';

function trialCountForLevel(level: number) { return [10, 12, 14, 16, 18][level - 1] ?? 10; }
function targetSizeForLevel(level: number) { return [90, 80, 70, 60, 50][level - 1] ?? 90; }
function timeoutForLevel(level: number) { return [1800, 1600, 1400, 1200, 1000][level - 1] ?? 1800; }

export function QuickResponse() {
  return (
    <GameFrame
      gameId="quick-response"
      instructions={[
        'A circular target will appear at a random position.',
        'Click it as quickly as you can once it appears.',
        'Clicking before it appears, or missing it, counts as an error.',
      ]}
    >
      {(ctx) => <Session {...ctx} />}
    </GameFrame>
  );
}

function Session({ difficulty, recordTrial, endGame }: PlayingContext) {
  const [sessionDifficulty] = useState(difficulty);
  const total = trialCountForLevel(sessionDifficulty);
  const targetSize = targetSizeForLevel(sessionDifficulty);
  const timeout = timeoutForLevel(sessionDifficulty);

  const [trialIndex, setTrialIndex] = useState(0);
  const [phase, setPhase] = useState<'waiting' | 'target'>('waiting');
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const shownAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resolvedRef = useRef(false);

  const advance = () => {
    if (trialIndex + 1 >= total) { endGame(); return; }
    setTrialIndex((i) => i + 1);
  };

  useEffect(() => {
    resolvedRef.current = false;
    const delay = 500 + Math.random() * 1000;
    const startTimer = setTimeout(() => {
      setPhase('waiting');
      setPos({ x: 12 + Math.random() * 76, y: 15 + Math.random() * 70 });
      shownAtRef.current = Date.now();
      setPhase('target');
      timerRef.current = setTimeout(() => {
        if (resolvedRef.current) return;
        resolvedRef.current = true;
        recordTrial(false, null);
        advance();
      }, timeout);
    }, delay);
    return () => { clearTimeout(startTimer); if (timerRef.current) clearTimeout(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trialIndex]);

  const hitTarget = () => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    recordTrial(true, Date.now() - shownAtRef.current);
    advance();
  };

  const missClick = () => {
    if (phase !== 'target' || resolvedRef.current) return;
    resolvedRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    recordTrial(false, Date.now() - shownAtRef.current);
    advance();
  };

  return (
    <div className="np-card p-6">
      <p className="text-sm text-slate-500 mb-4 text-center">Trial {trialIndex + 1} of {total}</p>
      <div className="np-reaction-arena" onClick={missClick}>
        {phase === 'target' && (
          <button
            className="np-reaction-target"
            style={{ left: `${pos.x}%`, top: `${pos.y}%`, width: targetSize, height: targetSize }}
            onClick={(e) => { e.stopPropagation(); hitTarget(); }}
            aria-label="target"
          />
        )}
        {phase === 'waiting' && <p className="np-reaction-hint">Wait for the target...</p>}
      </div>
    </div>
  );
}
