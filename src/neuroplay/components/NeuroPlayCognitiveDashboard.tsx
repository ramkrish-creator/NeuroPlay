import { Activity, Award, BarChart3, Brain, Clock } from 'lucide-react';
import { useNeuroPlayStore } from '../store/useNeuroPlayStore';
import { calculateCognitiveProfile, calculateLearningTrend } from '../engine/adaptiveEngine';
import { DOMAIN_LABEL, type CognitiveDomain } from '../types';

export function NeuroPlayCognitiveDashboard() {
  const sessions = useNeuroPlayStore((s) => s.sessions);
  const profile = calculateCognitiveProfile(sessions);
  const domains = Object.keys(DOMAIN_LABEL) as CognitiveDomain[];
  const overallScore = sessions.length
    ? Math.round(sessions.reduce((total, session) => total + session.score, 0) / sessions.length)
    : null;

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 p-4 md:p-8 text-slate-100">
      <header className="np-card p-6 md:p-8">
        <div className="flex items-center gap-2 text-teal-400 text-xs uppercase tracking-widest">
          <Brain size={16} /> NeuroPlay training
        </div>
        <h1 className="mt-2 text-2xl md:text-3xl font-bold text-white">Cognitive Profile</h1>
        <p className="mt-2 text-sm text-slate-400">
          A summary of your performance across NeuroPlay games. This is for training feedback, not diagnosis.
        </p>
        <div className="mt-5 flex flex-wrap gap-6">
          <div>
            <div className="text-xs text-slate-400">Average session score</div>
            <div className="text-3xl font-bold text-white">{overallScore ?? '—'}{overallScore !== null && '/100'}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Completed sessions</div>
            <div className="text-3xl font-bold text-white">{sessions.length}</div>
          </div>
        </div>
      </header>

      <section className="space-y-4">
        <h2 className="np-section-title flex items-center gap-2">
          <BarChart3 size={18} /> Performance by domain
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {domains.map((domain) => {
            const domainSessions = sessions.filter((session) => session.domain === domain);
            const compositeSessions = domain === 'executiveFunction'
              ? sessions.filter((session) =>
                session.domain === 'cognitiveFlexibility'
                || session.domain === 'attention'
                || session.domain === 'workingMemory')
              : domainSessions;
            const assessed = compositeSessions.length > 0;
            const trend = calculateLearningTrend(
              compositeSessions.slice(0, 6).reverse().map((session) => session.score),
            );

            return (
              <article key={domain} className="np-card p-5 space-y-3">
                <h3 className="font-semibold text-slate-100">{DOMAIN_LABEL[domain]}</h3>
                {assessed ? (
                  <>
                    <div className="text-2xl font-bold text-teal-300">
                      {profile[domain]} <span className="text-xs text-slate-400">/ 100</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span className="flex items-center gap-1"><Clock size={12} /> {compositeSessions.length} sessions</span>
                      <span className="capitalize">{trend}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-400">Play a related game to see your score.</p>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="np-card p-6 space-y-4">
        <h2 className="np-section-title flex items-center gap-2">
          <Activity size={18} /> Recent sessions ({sessions.length})
        </h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-slate-400">Complete a NeuroPlay game to start tracking progress.</p>
        ) : (
          <div className="space-y-2">
            {sessions.slice(0, 8).map((session) => (
              <div key={session.id} className="flex items-center justify-between gap-4 rounded-xl bg-slate-900/50 p-3 text-sm">
                <div className="flex items-center gap-3">
                  <Award size={16} className="text-teal-400" />
                  <div>
                    <div className="font-medium text-slate-200">{session.gameId.replaceAll('-', ' ')}</div>
                    <div className="text-xs text-slate-400">{new Date(session.date).toLocaleString()}</div>
                  </div>
                </div>
                <div className="font-mono text-teal-300">{session.score}/100</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
