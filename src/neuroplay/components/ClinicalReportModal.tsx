import React from 'react';
import { Printer, Download, ShieldCheck, FileText } from 'lucide-react';
import { useNeuroPlayStore } from '../store/useNeuroPlayStore';
import { calculateCognitiveProfile, calculateLearningTrend } from '../engine/adaptiveEngine';
import { DOMAIN_LABEL, type CognitiveDomain } from '../types';

interface ClinicalReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ClinicalReportModal: React.FC<ClinicalReportModalProps> = ({ isOpen, onClose }) => {
  const profile = useNeuroPlayStore((s) => s.profile);
  const sessions = useNeuroPlayStore((s) => s.sessions);

  if (!isOpen || !profile) return null;

  const cognitiveProfile = calculateCognitiveProfile(sessions);
  const domainKeys = Object.keys(DOMAIN_LABEL) as CognitiveDomain[];
  const overallScore = sessions.length
    ? Math.round(sessions.reduce((total, session) => total + session.score, 0) / sessions.length)
    : null;
  const assessedDomains = domainKeys.filter((domain) =>
    sessions.some((session) => session.domain === domain)
    || (domain === 'executiveFunction' && sessions.some((session) =>
      session.domain === 'cognitiveFlexibility' || session.domain === 'attention' || session.domain === 'workingMemory')),
  ).length;

  const getDomainSessions = (domain: CognitiveDomain) => domain === 'executiveFunction'
    ? sessions.filter((session) =>
      session.domain === 'cognitiveFlexibility' || session.domain === 'attention' || session.domain === 'workingMemory')
    : sessions.filter((session) => session.domain === domain);

  const handleExportCsv = () => {
    const headers = ['Date', 'Game', 'Cognitive Domain', 'Score (0-100)', 'Accuracy (%)', 'Reaction Time (ms)', 'Difficulty Level'];
    const rows = sessions.map((session) => [
      session.date,
      session.gameId,
      session.domain,
      session.score,
      session.accuracy,
      session.avgReactionMs ?? '',
      session.difficultyEnd,
    ]);
    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `neuroplay-report-${profile.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="glass-panel max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 md:p-10 space-y-6 rounded-3xl border border-slate-700/60 shadow-2xl text-slate-100 print:bg-white print:text-black print:p-0 print:border-0 print:shadow-none">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 print:hidden">
          <div className="flex items-center gap-2 text-teal-400 text-xs uppercase font-mono tracking-widest">
            <FileText size={16} /> NeuroPlay Training Report
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleExportCsv} className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 border border-slate-700">
              <Download size={14} /> Export CSV
            </button>
            <button onClick={() => window.print()} className="px-3.5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-xs font-bold text-slate-950 flex items-center gap-1.5">
              <Printer size={14} /> Print / Save PDF
            </button>
            <button onClick={onClose} aria-label="Close report" className="text-slate-400 hover:text-white text-lg font-bold ml-2">✕</button>
          </div>
        </div>

        <header className="space-y-3">
          <div className="border-b border-slate-800/80 pb-4">
            <h1 className="text-2xl font-bold font-display text-white print:text-black">Cognitive Training Summary</h1>
            <p className="text-xs text-slate-400 font-mono print:text-gray-600">NeuroPlay training activity; not a clinical assessment.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs">
            <div><span className="text-slate-500 block text-[10px] uppercase font-mono">Player</span><span className="font-bold text-sm">{profile.name}</span></div>
            <div><span className="text-slate-500 block text-[10px] uppercase font-mono">Age Group</span><span className="font-bold text-sm">{profile.ageGroup}</span></div>
            <div><span className="text-slate-500 block text-[10px] uppercase font-mono">Training Goal</span><span className="font-bold text-sm capitalize">{profile.goal}</span></div>
            <div><span className="text-slate-500 block text-[10px] uppercase font-mono">Sessions</span><span className="font-bold text-sm text-teal-400">{sessions.length}</span></div>
          </div>
        </header>

        <section className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-[11px] uppercase font-mono tracking-wider text-slate-400">Average session score</span>
            <div className="text-4xl font-black font-display text-white">{overallScore ?? '—'}<span className="text-lg text-slate-500"> / 100</span></div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-teal-500/10 border border-teal-500/30 text-teal-400">
            <ShieldCheck size={14} /> {assessedDomains} of {domainKeys.length} domains with activity
          </span>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold font-display uppercase tracking-wider text-slate-300">Performance by domain</h2>
          <div className="border border-slate-800 rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="py-3 px-4 font-semibold">Cognitive Domain</th>
                  <th className="py-3 px-4 font-semibold text-center">Score</th>
                  <th className="py-3 px-4 font-semibold text-center">Sessions</th>
                  <th className="py-3 px-4 font-semibold text-right">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {domainKeys.map((domain) => {
                  const relatedSessions = getDomainSessions(domain);
                  const trend = calculateLearningTrend(relatedSessions.slice(0, 6).reverse().map((session) => session.score));
                  return (
                    <tr key={domain}>
                      <td className="py-3 px-4 font-medium">{DOMAIN_LABEL[domain]}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold">
                        {relatedSessions.length ? cognitiveProfile[domain] : 'Not assessed'}
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-slate-400">{relatedSessions.length}</td>
                      <td className="py-3 px-4 text-right capitalize font-mono text-slate-400">
                        {relatedSessions.length ? trend : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <p className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 text-[11px] text-slate-400 leading-relaxed">
          This report summarizes performance recorded in NeuroPlay games. It is intended for training feedback only and is not a diagnosis or substitute for professional assessment.
        </p>
      </div>
    </div>
  );
};
