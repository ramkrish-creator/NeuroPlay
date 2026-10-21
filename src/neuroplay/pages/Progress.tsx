import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, BarChart, Bar } from 'recharts';
import { useNeuroPlayStore } from '../store/useNeuroPlayStore';
import { DOMAIN_LABEL, type CognitiveDomain } from '../types';
import { calculateCognitiveProfile } from '../engine/adaptiveEngine';

const CHART_MARGIN = { top: 8, right: 16, bottom: 0, left: -16 };
const TOOLTIP_STYLE = { background: '#131b2c', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 10 };

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="np-card p-6">
      <p className="np-section-title mb-4">{title}</p>
      <div style={{ width: '100%', height: 220 }}>{children}</div>
    </section>
  );
}

export function Progress() {
  const sessions = useNeuroPlayStore((s) => s.sessions);
  const recent = [...sessions].slice(0, 12).reverse();

  const accuracyData = recent.map((s, i) => ({ name: `#${i + 1}`, accuracy: s.accuracy }));
  const reactionData = recent
    .filter((s) => s.avgReactionMs !== null)
    .map((s, i) => ({ name: `#${i + 1}`, ms: s.avgReactionMs }));
  const difficultyData = recent.map((s, i) => ({ name: `#${i + 1}`, difficulty: s.difficultyEnd }));
  const fatigueData = recent.map((s, i) => ({ name: `#${i + 1}`, fatigue: s.fatigueLevel }));

  const profile = calculateCognitiveProfile(sessions);
  const domainData = (Object.keys(profile) as CognitiveDomain[]).map((d) => ({
    name: DOMAIN_LABEL[d].replace(' ', '\n'), score: profile[d],
  }));

  if (sessions.length === 0) {
    return (
      <div className="p-10 max-w-3xl mx-auto text-center text-slate-400">
        <p className="text-xl">No sessions yet. Play a game to see your progress here.</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto w-full space-y-6">
      <h1 className="text-3xl font-bold text-slate-50 mb-2">Progress</h1>

      <ChartCard title="Accuracy Over Sessions">
        <ResponsiveContainer>
          <LineChart data={accuracyData} margin={CHART_MARGIN}>
            <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
            <YAxis stroke="#64748b" fontSize={12} domain={[0, 100]} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Line type="monotone" dataKey="accuracy" stroke="#2dd4bf" strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {reactionData.length >= 2 && (
        <ChartCard title="Reaction Time Over Sessions (ms)">
          <ResponsiveContainer>
            <LineChart data={reactionData} margin={CHART_MARGIN}>
              <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Line type="monotone" dataKey="ms" stroke="#38bdf8" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      <ChartCard title="Difficulty Over Sessions">
          <ResponsiveContainer>
            <LineChart data={difficultyData} margin={CHART_MARGIN}>
              <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} domain={[1, 5]} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Line type="stepAfter" dataKey="difficulty" stroke="#a78bfa" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Domain-Wise Performance">
        <ResponsiveContainer>
          <BarChart data={domainData} margin={CHART_MARGIN}>
            <XAxis dataKey="name" stroke="#64748b" fontSize={10} interval={0} />
            <YAxis stroke="#64748b" fontSize={12} domain={[0, 100]} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="score" fill="#2dd4bf" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Fatigue Trend">
        <ResponsiveContainer>
          <LineChart data={fatigueData} margin={CHART_MARGIN}>
            <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
            <YAxis stroke="#64748b" fontSize={12} domain={[0, 100]} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Line type="monotone" dataKey="fatigue" stroke="#fbbf24" strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
