import { useState } from 'react';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { BookOpen, FileText, Play } from 'lucide-react';
import { useNeuroPlayStore } from '../store/useNeuroPlayStore';
import { calculateCognitiveProfile } from '../engine/adaptiveEngine';
import { generateDashboardRecommendation } from '../engine/recommendationEngine';
import { DOMAIN_LABEL, GAME_META, type CognitiveDomain } from '../types';
import { ScienceModal } from '../components/ScienceModal';
import { ClinicalReportModal } from '../components/ClinicalReportModal';

const PROFILE_DOMAINS: CognitiveDomain[] = [
  'attention', 'workingMemory', 'processingSpeed', 'cognitiveFlexibility', 'executiveFunction',
];

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function Dashboard() {
  const profileState = useNeuroPlayStore((s) => s.profile);
  const sessions = useNeuroPlayStore((s) => s.sessions);
  const recommendedGameIds = useNeuroPlayStore((s) => s.recommendedGameIds);
  const navigate = useNeuroPlayStore((s) => s.navigate);
  const startTrainingSession = useNeuroPlayStore((s) => s.startTrainingSession);

  const [showScienceModal, setShowScienceModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const playerSessions = sessions.filter((session) => !session.isDemo);
  const assessedDomains = new Set(playerSessions.map((session) => session.domain));
  const cognitiveProfile = calculateCognitiveProfile(playerSessions);
  const memoryScore = Math.round(
    (cognitiveProfile.verbalMemory + cognitiveProfile.visualMemory + cognitiveProfile.episodicMemory) / 3,
  );
  const lastSession = playerSessions[0] ?? null;
  const recommendation = generateDashboardRecommendation(cognitiveProfile, lastSession);
  const todaysGames = recommendedGameIds;

  const trendData = [...playerSessions].slice(0, 7).reverse().map((s, i) => ({
    name: `#${i + 1}`, score: s.score,
  }));
  const memoryAssessed = ['verbalMemory', 'visualMemory', 'episodicMemory']
    .some((domain) => assessedDomains.has(domain as CognitiveDomain));

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto w-full space-y-8 animate-fade-in text-slate-100">
      <ScienceModal isOpen={showScienceModal} onClose={() => setShowScienceModal(false)} />
      <ClinicalReportModal isOpen={showReportModal} onClose={() => setShowReportModal(false)} />

      {/* Greeting & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-50 font-display">
            {greeting()}{profileState?.name ? `, ${profileState.name}` : ''}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Personalized Computerised Cognitive Training (CCT) • <span className="text-teal-400 font-semibold">{profileState?.goal ? `${profileState.goal.toUpperCase()} FOCUS` : 'GENERAL'}</span>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowScienceModal(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-xs font-semibold text-slate-300 flex items-center gap-1.5 border border-slate-700 transition-all"
          >
            <BookOpen size={14} className="text-teal-400" /> CCT Science
          </button>
          <button
            onClick={() => setShowReportModal(true)}
            className="px-3.5 py-2 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 text-xs font-semibold text-teal-300 flex items-center gap-1.5 border border-teal-500/30 transition-all"
          >
            <FileText size={14} /> Clinical Report
          </button>
        </div>
      </div>

      {/* Today's Training Section */}
      <section className="np-card p-6 border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <p className="np-section-title">Today&apos;s Prescribed Training</p>
          <span className="text-xs text-teal-400 font-mono">Recommended from your progress</span>
        </div>
        <div className="grid sm:grid-cols-3 gap-3 mb-6">
          {todaysGames.map((id) => (
            <div key={id} className="np-mini-card border-slate-800/80">
              <p className="font-semibold text-slate-100">{GAME_META[id].name}</p>
              <p className="text-xs text-teal-400 font-mono mt-1">{DOMAIN_LABEL[GAME_META[id].domain]}</p>
            </div>
          ))}
        </div>
        <button
          className="np-btn-primary flex items-center gap-2 shadow-lg shadow-teal-500/20"
          onClick={() => startTrainingSession(todaysGames)}
        >
          <Play size={16} /> Start Prescribed Session
        </button>
      </section>

      <div className="np-callout">{recommendation}</div>

      {lastSession && (
        <section className="np-card p-6 border-slate-800">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <p className="np-section-title">Most Recent Session</p>
              <p className="text-sm text-slate-300 mt-1">{GAME_META[lastSession.gameId].name}</p>
            </div>
            <time className="text-xs text-slate-500" dateTime={lastSession.date}>
              {new Date(lastSession.date).toLocaleString()}
            </time>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <SessionMetric label="Score" value={`${lastSession.score}/100`} />
            <SessionMetric label="Accuracy" value={`${lastSession.accuracy}%`} />
            <SessionMetric label="Difficulty" value={`${lastSession.difficultyStart} → ${lastSession.difficultyEnd}`} />
            <SessionMetric label="Fatigue" value={`${lastSession.fatigueLevel}%`} />
          </div>
        </section>
      )}

      {/* Cognitive Profile Domains */}
      <section className="np-card p-6 border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <p className="np-section-title">Cognitive Domain Performance</p>
          <button
            onClick={() => navigate('cognitive-profile')}
            className="text-xs text-teal-400 hover:underline"
          >
            View Full Breakdown →
          </button>
        </div>
        <div className="grid sm:grid-cols-2 gap-4 mb-2">
          <DomainBar label="Memory" value={memoryScore} assessed={memoryAssessed} />
          {PROFILE_DOMAINS.map((d) => (
            <DomainBar
              key={d}
              label={DOMAIN_LABEL[d]}
              value={cognitiveProfile[d]}
              assessed={d === 'executiveFunction'
                ? ['cognitiveFlexibility', 'attention', 'workingMemory'].some((domain) => assessedDomains.has(domain as CognitiveDomain))
                : assessedDomains.has(d)}
            />
          ))}
        </div>
      </section>

      {/* Recent Progress Line Chart */}
      {trendData.length >= 2 && (
        <section className="np-card p-6 border-slate-800">
          <p className="np-section-title mb-4">Recent Session Score Progress</p>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <LineChart data={trendData} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} domain={[0, 100]} />
                <Tooltip contentStyle={{ background: '#131b2c', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 10 }} />
                <Line type="monotone" dataKey="score" stroke="#2dd4bf" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {sessions.some((s) => s.isDemo) && playerSessions.length === 0 && (
        <p className="text-center text-xs text-slate-500">
          Simulated examples are hidden from your personal analytics. Complete a game to start building your profile.
        </p>
      )}

      <button className="np-btn-secondary w-full" onClick={() => navigate('games')}>
        Browse All 7 NeuroPlay Games
      </button>
    </div>
  );
}

function SessionMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-slate-100 mt-1">{value}</p>
    </div>
  );
}

function DomainBar({ label, value, assessed = true }: { label: string; value: number; assessed?: boolean }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5">
        <span className="text-slate-300">{label}</span>
        <span className={`font-mono font-semibold ${assessed ? 'text-slate-100' : 'text-slate-500'}`}>
          {assessed ? value : 'Not assessed'}
        </span>
      </div>
      <div className="np-track">
        {assessed && <div className="np-track-fill" style={{ width: `${value}%` }} />}
      </div>
    </div>
  );
}
