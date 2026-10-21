import { useNeuroPlayStore } from '../store/useNeuroPlayStore';
import { fatigueBand } from '../engine/fatigueEngine';
import { mean } from '../engine/scoringEngine';
import { DOMAIN_LABEL, GAME_META } from '../types';

const DIFFICULTY_LABEL = ['', 'Beginner', 'Easy', 'Intermediate', 'Advanced', 'Expert'];

export function TrainingSessionSummary() {
  const sessions = useNeuroPlayStore((s) => s.sessions);
  const trainingSessionIds = useNeuroPlayStore((s) => s.trainingSessionIds);
  const endTrainingSession = useNeuroPlayStore((s) => s.endTrainingSession);
  const navigate = useNeuroPlayStore((s) => s.navigate);

  const results = sessions.filter((s) => trainingSessionIds.includes(s.id));
  const accuracy = Math.round(mean(results.map((r) => r.accuracy)));
  const times = results.map((r) => r.avgReactionMs).filter((t): t is number => t !== null);
  const avgReactionSec = times.length ? (mean(times) / 1000).toFixed(2) : null;
  const maxFatigue = Math.max(0, ...results.map((r) => r.fatigueLevel));
  const avgDifficulty = Math.round(mean(results.map((r) => r.difficultyEnd)));

  const finish = () => { endTrainingSession(); navigate('dashboard'); };

  return (
    <div className="min-h-full flex items-center justify-center p-6">
      <div className="np-card max-w-lg w-full p-8 md:p-10 text-center">
        <p className="text-sm uppercase tracking-widest text-teal-400 font-semibold mb-1">Session Complete</p>
        <h2 className="text-2xl md:text-3xl font-bold text-slate-50 mb-8">Training Session</h2>

        <div className="grid grid-cols-2 gap-4 mb-6 text-left">
          <div className="np-stat"><p className="np-stat-label">Accuracy</p><p className="np-stat-value">{accuracy}%</p></div>
          <div className="np-stat"><p className="np-stat-label">Reaction Time</p><p className="np-stat-value">{avgReactionSec ? `${avgReactionSec} sec` : '—'}</p></div>
          <div className="np-stat"><p className="np-stat-label">Fatigue</p><p className="np-stat-value">{fatigueBand(maxFatigue)}</p></div>
          <div className="np-stat"><p className="np-stat-label">Difficulty</p><p className="np-stat-value">{DIFFICULTY_LABEL[avgDifficulty] ?? 'Beginner'}</p></div>
        </div>

        <p className="text-xs uppercase tracking-widest text-slate-500 text-left mb-2">Domains Practised</p>
        <ul className="text-left mb-6 space-y-2">
          {results.map((r) => (
            <li key={r.id} className="flex justify-between items-center text-sm text-slate-400">
              <span>
                <span className="block text-slate-300">{GAME_META[r.gameId].name}</span>
                <span className="text-xs text-teal-400">{DOMAIN_LABEL[GAME_META[r.gameId].domain]}</span>
              </span>
              <span className="text-slate-300 font-mono">{r.score}</span>
            </li>
          ))}
        </ul>

        <div className="np-callout mb-8">
          Your next session will be personalised based on today&apos;s performance.
        </div>

        <p className="text-xs text-slate-500 leading-relaxed mb-6">
          These scores reflect performance in this training session. They are not a clinical diagnosis or a replacement for professional care.
        </p>

        <button className="np-btn-primary" onClick={finish}>Back to Dashboard</button>
      </div>
    </div>
  );
}
