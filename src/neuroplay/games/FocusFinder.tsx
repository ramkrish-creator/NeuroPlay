import { useEffect, useRef, useState } from 'react';
import { GameFrame, type PlayingContext } from '../components/GameFrame';

const LETTERS_EASY = ['A', 'B', 'D', 'E', 'F', 'G', 'H'];
const LETTERS_HARD = ['A', 'B', 'D', 'E', 'F', 'G', 'H', 'K', 'Y', 'V']; // visually closer to X

function intervalForLevel(level: number) { return [1100, 950, 800, 650, 520][level - 1] ?? 1100; }

function nextLetter(level: number): string {
  const pool = level >= 4 ? LETTERS_HARD : LETTERS_EASY;
  return Math.random() < (level >= 4 ? 0.22 : 0.28)
    ? 'X'
    : pool[Math.floor(Math.random() * pool.length)];
}

const TRIAL_COUNT = 30;

export function FocusFinder() {
  return (
    <GameFrame
      gameId="focus-finder"
      instructions={[
        'Letters will appear one at a time.',
        'Click "Tap" (or press Space) whenever you see the letter X.',
        'Do nothing for every other letter.',
      ]}
    >
      {(ctx) => <Round {...ctx} />}
    </GameFrame>
  );
}

function Round({ difficulty, recordTrial, endGame }: PlayingContext) {
  const [index, setIndex] = useState(-1);
  const [letter, setLetter] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const tappedRef = useRef(false);
  const shownAtRef = useRef(0);

  useEffect(() => {
    if (index === -1) {
      const t = setTimeout(() => {
        setLetter(nextLetter(difficulty));
        setIndex(0);
      }, 900);
      return () => clearTimeout(t);
    }
    if (index >= TRIAL_COUNT) { endGame(); return; }

    tappedRef.current = false;
    const isX = letter === 'X';
    shownAtRef.current = Date.now();

    const t = setTimeout(() => {
      const tapped = tappedRef.current;
      const correct = isX ? tapped : !tapped;
      const nextDifficulty = recordTrial(
        correct,
        isX && tapped ? Date.now() - shownAtRef.current : null,
        index === TRIAL_COUNT - 1,
      );
      setLetter(nextLetter(nextDifficulty));
      setIndex((i) => i + 1);
    }, intervalForLevel(difficulty));
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, difficulty]);

  const tap = () => {
    if (tappedRef.current || index < 0 || index >= TRIAL_COUNT || letter === null) return;
    tappedRef.current = true;
    setFlash(true);
    setTimeout(() => setFlash(false), 150);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === ' ') { e.preventDefault(); tap(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, letter]);

  const current = index >= 0 && index < TRIAL_COUNT ? letter : null;

  return (
    <div className="np-card p-12 text-center">
      <p className="text-sm text-slate-500 mb-6">
        {index >= 0 ? `Letter ${Math.min(index + 1, TRIAL_COUNT)} of ${TRIAL_COUNT}` : 'Get ready...'}
      </p>
      <div className="np-letter-stage" style={{ background: flash ? 'rgba(45,212,191,0.18)' : undefined }}>
        <span className="text-7xl font-black text-slate-50">{current ?? '·'}</span>
      </div>
      <button className="np-btn-primary mt-8" onClick={tap}>Tap (X)</button>
    </div>
  );
}
