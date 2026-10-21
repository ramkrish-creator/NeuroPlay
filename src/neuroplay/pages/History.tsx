import { useNeuroPlayStore } from '../store/useNeuroPlayStore';
import { GAME_META } from '../types';
import { fatigueBand } from '../engine/fatigueEngine';

export function History() {
  const sessions = useNeuroPlayStore((s) => s.sessions);

  if (sessions.length === 0) {
    return (
      <div className="p-10 max-w-3xl mx-auto text-center text-slate-400">
        <p className="text-xl">No sessions yet. Play a game to build your history.</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto w-full">
      <h1 className="text-3xl font-bold text-slate-50 mb-6">Session History</h1>
      <div className="np-card overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/10">
              {['Date', 'Game', 'Score', 'Accuracy', 'Difficulty', 'Fatigue', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-xs uppercase tracking-widest text-slate-500 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="border-b border-white/5 last:border-0">
                <td className="px-4 py-3 text-sm text-slate-400 whitespace-nowrap">
                  {new Date(s.date).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-sm text-slate-100 font-medium">{GAME_META[s.gameId].name}</td>
                <td className="px-4 py-3 text-sm font-mono text-teal-400">{s.score}</td>
                <td className="px-4 py-3 text-sm text-slate-300">{s.accuracy}%</td>
                <td className="px-4 py-3 text-sm text-slate-300">Level {s.difficultyEnd}</td>
                <td className="px-4 py-3 text-sm text-slate-300">{fatigueBand(s.fatigueLevel)}</td>
                <td className="px-4 py-3 text-xs">
                  {s.isDemo && <span className="np-demo-tag">Demo Data</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
