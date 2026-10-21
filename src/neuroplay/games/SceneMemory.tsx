import { useEffect, useMemo, useRef, useState } from 'react';
import { GameFrame, type PlayingContext } from '../components/GameFrame';

const OBJECT_POOL = ['cup', 'book', 'plant', 'clock', 'lamp', 'glasses', 'vase', 'candle', 'key', 'phone'];
const COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'white'];

function objectCountForLevel(level: number) {
  return [4, 5, 6, 7, 8][level - 1] ?? 4;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface SceneObject { name: string; color: string }
interface Question { text: string; options: string[]; answer: string }

function buildScene(count: number): SceneObject[] {
  return shuffle(OBJECT_POOL).slice(0, count).map((name) => ({
    name, color: COLORS[Math.floor(Math.random() * COLORS.length)],
  }));
}

function buildQuestions(scene: SceneObject[]): Question[] {
  const qs: Question[] = [];

  // Color questions
  scene.slice(0, 2).forEach((o) => {
    const distractors = shuffle(COLORS.filter((c) => c !== o.color)).slice(0, 2);
    qs.push({ text: `What colour was the ${o.name}?`, options: shuffle([o.color, ...distractors]), answer: o.color });
  });

  // Presence question (mix of present / absent)
  const absentPool = OBJECT_POOL.filter((n) => !scene.some((o) => o.name === n));
  const presentTarget = scene[Math.floor(Math.random() * scene.length)];
  qs.push({ text: `Was there a ${presentTarget.name} in the scene?`, options: ['Yes', 'No'], answer: 'Yes' });
  if (absentPool.length > 0) {
    const absentTarget = absentPool[Math.floor(Math.random() * absentPool.length)];
    qs.push({ text: `Was there a ${absentTarget} in the scene?`, options: ['Yes', 'No'], answer: 'No' });
  }

  // Adjacency question
  if (scene.length >= 3) {
    const i = 1 + Math.floor(Math.random() * (scene.length - 2));
    const neighbor = scene[i - 1];
    const distractors = shuffle(scene.map((o) => o.name).filter((n) => n !== neighbor.name && n !== scene[i].name)).slice(0, 2);
    qs.push({
      text: `Which object was directly beside the ${scene[i].name}?`,
      options: shuffle([neighbor.name, ...distractors]),
      answer: neighbor.name,
    });
  }

  return shuffle(qs);
}

export function SceneMemory() {
  return (
    <GameFrame
      gameId="scene-memory"
      instructions={[
        'Study a scene containing several objects for a short time.',
        'Then answer a few questions about the details of the scene.',
        'This tests memory for context, not just recognition.',
      ]}
    >
      {(ctx) => <Round {...ctx} />}
    </GameFrame>
  );
}

function Round({ difficulty, recordTrial, endGame }: PlayingContext) {
  const [roundDifficulty] = useState(difficulty);
  const count = objectCountForLevel(roundDifficulty);
  const scene = useMemo(() => buildScene(count), [count]);
  const questions = useMemo(() => buildQuestions(scene), [scene]);
  const viewTime = Math.max(2500, 5500 - roundDifficulty * 500);
  const delayTime = 500 + roundDifficulty * 300;

  const [phase, setPhase] = useState<'view' | 'delay' | 'test'>('view');
  const [qIndex, setQIndex] = useState(0);
  const questionStartRef = useRef(0);

  useEffect(() => {
    if (phase === 'view') { const t = setTimeout(() => setPhase('delay'), viewTime); return () => clearTimeout(t); }
    if (phase === 'delay') { const t = setTimeout(() => { setPhase('test'); questionStartRef.current = Date.now(); }, delayTime); return () => clearTimeout(t); }
  }, [phase, viewTime, delayTime]);

  const answer = (choice: string) => {
    recordTrial(choice === questions[qIndex].answer, Date.now() - questionStartRef.current); // eslint-disable-line react-hooks/purity -- only invoked from the click handlers below
    if (qIndex + 1 >= questions.length) { endGame(); return; }
    setQIndex((i) => i + 1);
    questionStartRef.current = Date.now(); // eslint-disable-line react-hooks/purity -- only invoked from the click handlers below
  };

  if (phase === 'view') {
    return (
      <div className="np-card p-8">
        <p className="text-sm text-slate-500 mb-4 text-center">Study the scene</p>
        <div className="flex flex-wrap gap-4 justify-center">
          {scene.map((o) => (
            <div key={o.name} className="np-scene-object">
              <span className="np-scene-swatch" style={{ background: o.color }} />
              <span className="capitalize">{o.name}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (phase === 'delay') {
    return (
      <div className="np-card p-16 text-center">
        <p className="text-slate-400 text-lg">Get ready...</p>
      </div>
    );
  }

  const q = questions[qIndex];
  return (
    <div className="np-card p-10 text-center">
      <p className="text-sm text-slate-500 mb-4">Question {qIndex + 1} of {questions.length}</p>
      <p className="text-2xl font-bold text-slate-50 mb-8 capitalize">{q.text}</p>
      <div className="flex gap-3 justify-center flex-wrap">
        {q.options.map((opt) => (
          <button key={opt} className="np-choice capitalize" onClick={() => answer(opt)}>{opt}</button>
        ))}
      </div>
    </div>
  );
}
