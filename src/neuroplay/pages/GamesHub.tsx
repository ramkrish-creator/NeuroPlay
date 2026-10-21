import { useNeuroPlayStore } from '../store/useNeuroPlayStore';
import { GAME_META, DOMAIN_LABEL, type GameId } from '../types';
import { DifficultyDots } from '../components/GameFrame';

const GAME_IDS = Object.keys(GAME_META) as GameId[];

export function GamesHub() {
  const openGame = useNeuroPlayStore((s) => s.openGame);
  const difficultyByGame = useNeuroPlayStore((s) => s.difficultyByGame);

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto w-full">
      <h1 className="text-3xl font-bold text-slate-50 mb-2">Cognitive Training Games</h1>
      <p className="text-slate-400 text-lg mb-5">Practice memory, attention, speed, and flexible thinking through short computerised exercises that adapt to your recent performance.</p>

      <div className="grid sm:grid-cols-3 gap-3 mb-8 text-xs">
        <div className="np-mini-card border-slate-800/80">
          <p className="font-semibold text-slate-200">Domain-focused practice</p>
          <p className="text-slate-400 mt-1">Each game is linked to a specific cognitive training domain.</p>
        </div>
        <div className="np-mini-card border-slate-800/80">
          <p className="font-semibold text-slate-200">Adaptive pacing</p>
          <p className="text-slate-400 mt-1">Difficulty changes gradually using accuracy, speed, and fatigue signals.</p>
        </div>
        <div className="np-mini-card border-slate-800/80">
          <p className="font-semibold text-slate-200">Training, not diagnosis</p>
          <p className="text-slate-400 mt-1">Scores describe game performance and are not medical results.</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {GAME_IDS.map((id) => {
          const meta = GAME_META[id];
          return (
            <button key={id} className="np-game-card" onClick={() => openGame(id)}>
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs uppercase tracking-widest text-teal-400 font-semibold">
                  {DOMAIN_LABEL[meta.domain]}
                </span>
                <DifficultyDots level={difficultyByGame[id]} />
              </div>
              <p className="text-xl font-bold text-slate-50 mb-1">{meta.name}</p>
              <p className="text-sm text-slate-400">{meta.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
