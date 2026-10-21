import { useEffect, useMemo, useRef, useState } from 'react';
import { GameFrame, type PlayingContext } from '../components/GameFrame';

const WORD_BANK = [
  'APPLE', 'RIVER', 'CHAIR', 'GARDEN', 'CLOCK', 'BRIDGE', 'CANDLE', 'FOREST', 'MIRROR', 'PENCIL',
  'BASKET', 'WINDOW', 'PILLOW', 'BOTTLE', 'KITCHEN', 'ISLAND', 'VALLEY', 'BUTTON', 'BLANKET', 'WHISTLE',
  'ORANGE', 'TURTLE', 'SILVER', 'PLANET', 'CASTLE', 'HARBOR', 'MEADOW', 'TUNNEL', 'CRAYON', 'ANCHOR',
];

function wordCountForLevel(level: number) {
  return [5, 6, 8, 10, 12][level - 1] ?? 5;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function WordRecall() {
  return (
    <GameFrame
      gameId="word-recall"
      instructions={[
        'You will see a short list of words to study.',
        'After the list disappears, words will appear one at a time.',
        'Click "Seen" if it was in the list, or "Not Seen" if it was not.',
      ]}
    >
      {(ctx) => <Round key={0} {...ctx} />}
    </GameFrame>
  );
}

function Round({ difficulty, recordTrial, endGame }: PlayingContext) {
  // Snapshot difficulty once so an in-progress round never changes shape
  // under the player mid-test, even if the adaptive engine updates
  // `difficulty` after a trial.
  const [roundDifficulty] = useState(difficulty);
  const count = wordCountForLevel(roundDifficulty);
  const [phase, setPhase] = useState<'study' | 'test'>('study');
  const [studyIndex, setStudyIndex] = useState(0);
  const [testIndex, setTestIndex] = useState(0);
  const questionStartRef = useRef(0);

  const targets = useMemo(() => shuffle(WORD_BANK).slice(0, count), [count]);
  const testWords = useMemo(() => {
    const distractors = shuffle(WORD_BANK.filter((w) => !targets.includes(w))).slice(0, count);
    return shuffle([
      ...targets.map((w) => ({ word: w, isTarget: true })),
      ...distractors.map((w) => ({ word: w, isTarget: false })),
    ]);
  }, [targets, count]);

  const studyTime = Math.max(700, 1500 - roundDifficulty * 120);

  useEffect(() => {
    if (phase !== 'study') return;
    const t = setTimeout(() => {
      if (studyIndex + 1 >= targets.length) {
        setPhase('test');
        questionStartRef.current = Date.now();
      } else {
        setStudyIndex((i) => i + 1);
      }
    }, studyTime);
    return () => clearTimeout(t);
  }, [phase, studyIndex, targets.length, studyTime]);

  const answer = (saidSeen: boolean) => {
    const q = testWords[testIndex];
    recordTrial(saidSeen === q.isTarget, Date.now() - questionStartRef.current);
    if (testIndex + 1 >= testWords.length) { endGame(); return; }
    setTestIndex((i) => i + 1);
    questionStartRef.current = Date.now();
  };

  if (phase === 'study') {
    const i = Math.min(studyIndex, targets.length - 1);
    return (
      <div className="np-card p-12 text-center">
        <p className="text-sm text-slate-500 mb-4">Study word {Math.min(studyIndex + 1, targets.length)} of {targets.length}</p>
        <p className="text-5xl font-black text-slate-50 tracking-wide">{targets[i]}</p>
      </div>
    );
  }

  const q = testWords[testIndex];
  return (
    <div className="np-card p-12 text-center">
      <p className="text-sm text-slate-500 mb-4">Word {testIndex + 1} of {testWords.length}</p>
      <p className="text-4xl font-black text-slate-50 mb-10">{q.word}</p>
      <p className="text-slate-300 mb-6 text-lg">Did you see this word in the list?</p>
      <div className="flex gap-4 justify-center">
        <button className="np-btn-primary" onClick={() => answer(true)}>Seen</button>
        <button className="np-btn-secondary" onClick={() => answer(false)}>Not Seen</button>
      </div>
    </div>
  );
}
